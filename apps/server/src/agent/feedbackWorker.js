// Feedback generation worker (W6, peripheral -- same in-process,
// fire-and-forget dispatch pattern as agent/roomAgent.js's transcription
// start). Called by agent/roomSweeper.js once a room's status flips to
// 'ended', and again on retry (N1, audit comparison 2026-07-29) if a
// previous attempt left the room incomplete.
//
// SPEC-0011 state 7 (feat/eval-feedback-decoupled) cutover: this used to
// call domain/feedbackGeneration.js's single-shot generateFeedbackForRoom
// (one Gemini call per student, inventing a score cold from the raw
// transcript) directly. It now runs domain/evaluationPipeline.js's
// deterministic multi-stage pipeline instead (Transcript Analysis ->
// evidence verification -> criterion evaluation -> validation ->
// deterministic score aggregation -> confidence -> feedback text), and
// additionally persists that pipeline's artifacts (evaluation_runs/
// evaluation_evidence/evaluation_criterion_results/evaluation_confidence)
// alongside the same `feedback` row shape as before -- R8: the `feedback`
// table/API contract is byte-for-byte unchanged.
//
// Rollback (SPEC-0011): the old path is untouched --
// domain/feedbackGeneration.js, domain/feedbackPrompt.js, and
// llm/geminiClient.generateFeedback still exist and are still tested.
// Reverting this cutover is a single-file revert of this module back to
// its pre-state-7 version, not a data migration.
import { runEvaluationPipeline, hashTranscript, PROMPT_BUNDLE_VERSION } from '../domain/evaluationPipeline.js';
import { RUBRIC_VERSION } from '../domain/evalRubric.js';
import {
  generateTranscriptAnalysis,
  generateCriterionEvaluation,
  generateEvaluationFeedback,
} from '../llm/geminiClient.js';
import { getRoomById } from '../db/rooms.js';
import { getTopicById } from '../db/topics.js';
import { listParticipants } from '../db/roomParticipants.js';
import { listProfiles } from '../db/profiles.js';
import { listTranscriptLinesForRoom } from '../db/transcriptLines.js';
import { insertFeedback, listFeedbackUserIdsForRoom } from '../db/feedback.js';
import { insertEvaluationRun, completeEvaluationRun, failEvaluationRun } from '../db/evaluationRuns.js';
import { insertEvaluationEvidence } from '../db/evaluationEvidence.js';
import { insertEvaluationCriterionResults } from '../db/evaluationCriterionResults.js';
import { insertEvaluationConfidence } from '../db/evaluationConfidence.js';

// N1 (audit comparison, 2026-07-29): returns { complete }, not void --
// agent/roomSweeper.js needs to know whether every participant now has
// persisted feedback so it can mark the room done (and stop retrying it)
// or leave it for another attempt. `complete` is derived from actual
// persisted state, not "did this call throw", so a retry after a partial
// success (some students already got feedback, others didn't) correctly
// only has to finish the rest.
export async function generateAndPersistFeedbackForRoom(
  roomId,
  {
    getRoomByIdFn = getRoomById,
    getTopicByIdFn = getTopicById,
    listParticipantsFn = listParticipants,
    listProfilesFn = listProfiles,
    listTranscriptLinesForRoomFn = listTranscriptLinesForRoom,
    listFeedbackUserIdsForRoomFn = listFeedbackUserIdsForRoom,
    insertFeedbackFn = insertFeedback,
    insertEvaluationRunFn = insertEvaluationRun,
    completeEvaluationRunFn = completeEvaluationRun,
    failEvaluationRunFn = failEvaluationRun,
    insertEvaluationEvidenceFn = insertEvaluationEvidence,
    insertEvaluationCriterionResultsFn = insertEvaluationCriterionResults,
    insertEvaluationConfidenceFn = insertEvaluationConfidence,
    model = process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    generateTranscriptAnalysisFn = (prompt) => generateTranscriptAnalysis(prompt, { model }),
    generateCriterionEvaluationFn = (prompt, parseContext) => generateCriterionEvaluation(prompt, parseContext, { model }),
    generateEvaluationFeedbackFn = (prompt, parseContext) => generateEvaluationFeedback(prompt, parseContext, { model }),
  } = {}
) {
  const room = await getRoomByIdFn(roomId);
  const topic = room?.topic_id ? await getTopicByIdFn(room.topic_id) : null;

  const roomParticipants = await listParticipantsFn(roomId);
  const profiles = await listProfilesFn(roomParticipants.map((p) => p.user_id));
  const nameById = new Map(profiles.map((p) => [p.id, p.display_name]));
  const participants = roomParticipants.map((p) => ({
    userId: p.user_id,
    displayName: nameById.get(p.user_id) || p.user_id,
  }));

  // Skip anyone who already has a persisted row -- makes a retry cheap
  // (no repeat Gemini spend for students who already succeeded) and safe
  // (feedback has a unique(room_id, user_id) constraint; re-inserting for
  // them would just fail and log noise).
  const alreadyDone = new Set(await listFeedbackUserIdsForRoomFn(roomId));
  const pending = participants.filter((p) => !alreadyDone.has(p.userId));
  if (pending.length === 0) return { complete: true };

  const lines = await listTranscriptLinesForRoomFn(roomId);
  const transcriptLines = lines.map((line) => ({
    id: line.id,
    userId: line.user_id,
    text: line.text,
    startedAtMs: line.started_at_ms,
    endedAtMs: line.ended_at_ms,
  }));

  // No evaluation_runs row for a room whose transcript is empty -- no
  // pipeline stage runs at all in that case (evaluationPipeline.js's own
  // no_transcript short-circuit), so there is nothing to attribute a run
  // to. A non-empty transcript that still ends up with no usable evidence
  // ('insufficient_evidence') is different: Transcript Analysis did run,
  // and that is a real, monitorable failure (SPEC-0011's Monitoring
  // section: "evaluation_runs.status = 'failed' rate").
  //
  // Opening the run is deliberately never allowed to block feedback itself
  // -- e.g. migration 0019 not yet applied to the live Supabase project
  // (AC1's own still-pending note) would otherwise throw here on every
  // single room, permanently exhausting roomSweeper.js's retry budget
  // (FEEDBACK_RETRY_MAX_ATTEMPTS) before a student ever got feedback. A
  // failure here just means this run's artifacts aren't recorded; runId
  // stays null and every runId-gated persistence step below is skipped,
  // same as the no-transcript case.
  let runId = null;
  if (transcriptLines.length > 0) {
    try {
      runId = await insertEvaluationRunFn({
        roomId,
        transcriptHash: hashTranscript(transcriptLines),
        rubricVersion: RUBRIC_VERSION,
        promptBundleVersion: PROMPT_BUNDLE_VERSION,
        model,
        startedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[feedback] failed to open an evaluation run for room ${roomId}: ${err.message}`);
    }
  }

  let outcome;
  try {
    outcome = await runEvaluationPipeline(
      { topic: topic?.text, transcriptLines, participants: pending },
      { generateTranscriptAnalysisFn, generateCriterionEvaluationFn, generateEvaluationFeedbackFn }
    );
  } catch (err) {
    console.error(`[feedback] evaluation pipeline failed for room ${roomId}: ${err.message}`);
    if (runId) {
      await failEvaluationRunFn(runId, { error: err.message, completedAt: new Date().toISOString() }).catch((markErr) =>
        console.error(`[feedback] failed to mark evaluation_runs ${runId} failed: ${markErr.message}`)
      );
    }
    return { complete: false };
  }

  if (runId) {
    if (outcome.status === 'ok') {
      try {
        await Promise.all([
          insertEvaluationEvidenceFn(runId, outcome.evidenceVerification.verified),
          insertEvaluationCriterionResultsFn(runId, outcome.criterionResults),
          insertEvaluationConfidenceFn(runId, outcome.confidences),
        ]);
        await completeEvaluationRunFn(runId, { completedAt: new Date().toISOString() });
      } catch (err) {
        // The feedback rows below are still inserted from `outcome` even if
        // persisting the pipeline's own artifacts fails -- a lost audit
        // trail must never cost a student their feedback.
        console.error(`[feedback] failed to persist evaluation pipeline artifacts for run ${runId}: ${err.message}`);
        await failEvaluationRunFn(runId, { error: err.message, completedAt: new Date().toISOString() }).catch((markErr) =>
          console.error(`[feedback] failed to mark evaluation_runs ${runId} failed: ${markErr.message}`)
        );
      }
    } else {
      await failEvaluationRunFn(runId, { error: outcome.status, completedAt: new Date().toISOString() }).catch((markErr) =>
        console.error(`[feedback] failed to mark evaluation_runs ${runId} failed: ${markErr.message}`)
      );
    }
  }

  const outcomes = await Promise.all(
    outcome.results.map(async (result) => {
      if (result.status !== 'ok') {
        console.error(`[feedback] generation failed for user ${result.userId} in room ${roomId}: ${result.error}`);
        return false;
      }
      try {
        // SPEC-0006 (BE-6/BE-7): result.body matches
        // domain/feedbackPrompt.js's parseFeedbackResponse shape (`body` in
        // the DB row keeps its existing name/meaning, the prose summary) --
        // evaluationPipeline.js's results are built to the same shape, so
        // this insert is unchanged by the state-7 cutover (R8).
        const { summary, score, dimensions, strengths, improvements } = result.body;
        await insertFeedbackFn({
          roomId,
          userId: result.userId,
          body: summary,
          score,
          dimensions,
          strengths,
          improvements,
          model,
        });
        return true;
      } catch (err) {
        console.error(`[feedback] failed to persist feedback for user ${result.userId} in room ${roomId}: ${err.message}`);
        return false;
      }
    })
  );

  return { complete: outcomes.every(Boolean) };
}
