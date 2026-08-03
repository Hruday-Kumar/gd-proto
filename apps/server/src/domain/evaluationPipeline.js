// SPEC-0011 state 7 (feat/eval-feedback-decoupled): the pipeline
// orchestrator -- composes every prior state into the sequence SPEC-0011's
// Design section describes, once per room:
//
//   Transcript Analysis (state 2)
//   -> deterministic evidence verification (state 2)
//   -> five Criterion Evaluators, each with bounded validation retry (states 3/5)
//   -> deterministic score aggregation (state 4, the ONLY place a score is computed)
//   -> confidence calculation (state 6)
//   -> per-participant Feedback Generation (this state, R7 -- reads the
//      validated scorecard + evidence, cannot alter a score)
//
// Every Gemini call is injected (generateTranscriptAnalysisFn/
// generateCriterionEvaluationFn/generateEvaluationFeedbackFn), same DI
// pattern as every other domain module in this pipeline -- this file has
// no I/O of its own. agent/feedbackWorker.js is the only caller, and the
// only place that persists this function's output.
import { createHash } from 'node:crypto';
import { buildTranscriptAnalysisPrompt } from './transcriptAnalysisPrompt.js';
import { verifyEvidenceLedger } from './evidenceVerifier.js';
import { evaluateCriterionWithValidation } from './validationLayer.js';
import { subdimensionIdsFor } from './evalRubric.js';
import { aggregateScorecard } from './scoreAggregator.js';
import { computeConfidenceForRun } from './confidenceCalculator.js';
import { buildEvaluationFeedbackPrompt } from './evaluationFeedbackPrompt.js';
import { FEEDBACK_DIMENSION_LABELS } from './feedbackPrompt.js';
import { DEFAULT_FEEDBACK_CONCURRENCY, transcriptionFailedBody } from './feedbackGeneration.js';

// Bumped whenever the combined behavior of this pipeline's prompts
// (transcript analysis + criterion evaluation + evaluation feedback)
// materially changes -- recorded on evaluation_runs so a later prompt edit
// doesn't silently change how an old run is interpreted, same reasoning as
// evalRubric.js's RUBRIC_VERSION.
export const PROMPT_BUNDLE_VERSION = 'spec-0011-state-7-2026-08-03';

// Deterministic fingerprint of exactly what was evaluated -- recorded on
// evaluation_runs.transcript_hash so a run's lineage can be verified after
// the fact without re-reading the full transcript. Order-sensitive (a
// reordered transcript is a different transcript for this purpose).
export function hashTranscript(transcriptLines) {
  const hash = createHash('sha256');
  for (const line of transcriptLines) {
    hash.update(`${line.id}|${line.userId}|${line.text}\n`);
  }
  return hash.digest('hex');
}

// A criterion evaluator that never recovers after validationLayer.js's
// bounded retries must not fabricate a level for that dimension -- R9's
// "missing evidence is never scored as failure" applies just as much to a
// validation failure as to a genuine evidence gap. Every participant gets
// insufficient_context on every subdimension of the exhausted dimension,
// which scoreAggregator.js already turns into a null (never 0) dimension
// score.
function insufficientContextFallback(dimensionLabel, participants, issue) {
  return {
    dimensionLabel,
    participantEvaluations: participants.map((p) => ({
      participantUserId: p.userId,
      subdimensions: subdimensionIdsFor(dimensionLabel).map((subdimensionId) => ({
        subdimensionId,
        level: 'insufficient_context',
        evidenceIds: [],
        reasoning: `Validation exhausted for "${dimensionLabel}": ${issue?.detail ?? 'unknown error'}`,
      })),
    })),
  };
}

// The five dimensions are fully independent of each other -- same evidence
// in, no shared state, nothing about Clarity's call depends on Fluency's
// result -- so they run concurrently, not one after another. This used to
// be a sequential for-loop, which stacked all five dimensions' latency
// (each with its own bounded validation retry) onto every single room,
// eating into the ~2 minute lobby-poll window feedbackGeneration.js's own
// comment already budgets for.
async function runCriterionEvaluators({ participants, evidence, generateCriterionEvaluationFn, maxValidationRetries }) {
  const outcomes = await Promise.all(
    FEEDBACK_DIMENSION_LABELS.map(async (dimensionLabel) => {
      const outcome = await evaluateCriterionWithValidation({
        dimensionLabel,
        evidence,
        participants,
        generate: generateCriterionEvaluationFn,
        ...(maxValidationRetries !== undefined ? { maxRetries: maxValidationRetries } : {}),
      });
      return { dimensionLabel, outcome };
    })
  );

  return {
    // Promise.all preserves input order regardless of resolution order, so
    // this still lines up with FEEDBACK_DIMENSION_LABELS exactly as the old
    // sequential loop did.
    criterionResults: outcomes.map(({ dimensionLabel, outcome }) =>
      outcome.valid ? outcome.result : insufficientContextFallback(dimensionLabel, participants, outcome.issue)
    ),
    validationResults: outcomes.map(({ dimensionLabel, outcome }) => ({
      dimensionLabel,
      valid: outcome.valid,
      retryCount: outcome.retryCount,
    })),
  };
}

// This participant's own evidence, plus any evidence connecting them to
// someone else's contribution (relatedParticipants) -- enough to explain a
// Listening/turn-taking-style note ("responded when Bilal raised...")
// without ever handing the Feedback Generation stage the raw transcript or
// another participant's own evidence (R7/R10).
function evidenceFor(participantUserId, verifiedEvidence) {
  return verifiedEvidence.filter(
    (item) => item.participantUserId === participantUserId || item.relatedParticipants.includes(participantUserId)
  );
}

async function generateFeedbackForScorecard({ scorecard, target, topic, verifiedEvidence, confidence, generateEvaluationFeedbackFn }) {
  try {
    const prompt = buildEvaluationFeedbackPrompt({
      topic,
      targetDisplayName: target.displayName,
      dimensions: scorecard.dimensions,
      overallScore: scorecard.overallScore,
      evidence: evidenceFor(scorecard.participantUserId, verifiedEvidence),
    });
    const feedbackText = await generateEvaluationFeedbackFn(prompt, {
      dimensionLabels: scorecard.dimensions.map((d) => d.label),
    });
    const noteByLabel = new Map(feedbackText.dimensionNotes.map((d) => [d.label, d.note]));
    return {
      userId: scorecard.participantUserId,
      status: 'ok',
      body: {
        summary: feedbackText.summary,
        score: scorecard.overallScore,
        dimensions: scorecard.dimensions.map((d) => ({ label: d.label, score: d.score, note: noteByLabel.get(d.label) })),
        strengths: feedbackText.strengths,
        improvements: feedbackText.improvements,
      },
      confidence,
    };
  } catch (err) {
    // Never throws: one participant's Feedback Generation failure must not
    // lose another's, same isolation feedbackGeneration.js already
    // establishes for the old single-shot path.
    return { userId: scorecard.participantUserId, status: 'error', error: err.message };
  }
}

export async function runEvaluationPipeline(
  { topic, transcriptLines, participants },
  {
    generateTranscriptAnalysisFn,
    generateCriterionEvaluationFn,
    generateEvaluationFeedbackFn,
    concurrency = DEFAULT_FEEDBACK_CONCURRENCY,
    maxValidationRetries,
  }
) {
  // Same guardrail #1 reasoning as feedbackGeneration.js's own check: an
  // empty transcript means transcription itself failed, not that nothing
  // happened -- never let any stage judge a session it has no evidence for.
  if (!transcriptLines.length) {
    return {
      status: 'no_transcript',
      results: participants.map(({ userId }) => ({ userId, status: 'ok', body: transcriptionFailedBody() })),
    };
  }

  const analysisPrompt = buildTranscriptAnalysisPrompt({ topic, transcriptLines, participants });
  const analysis = await generateTranscriptAnalysisFn(analysisPrompt);
  const evidenceVerification = verifyEvidenceLedger(transcriptLines, analysis.evidenceLedger);

  // If every extracted item turned out fabricated/malformed, there is
  // nothing for a criterion evaluator to work from -- same short-circuit
  // as the empty-transcript case above, for the same reason (R9: no
  // evidence must never be treated like negative evidence).
  if (evidenceVerification.verified.length === 0) {
    return {
      status: 'insufficient_evidence',
      evidenceVerification,
      results: participants.map(({ userId }) => ({ userId, status: 'ok', body: transcriptionFailedBody() })),
    };
  }

  const { criterionResults, validationResults } = await runCriterionEvaluators({
    participants,
    evidence: evidenceVerification.verified,
    generateCriterionEvaluationFn,
    maxValidationRetries,
  });

  const scorecards = aggregateScorecard(criterionResults);
  const confidences = computeConfidenceForRun({ evidenceVerification, criterionResults, validationResults });
  const confidenceByParticipant = new Map(confidences.map((c) => [c.participantUserId, c]));

  // Fixed-size worker pool over a shared cursor, same shape as
  // feedbackGeneration.js's own pool -- results written back by index so
  // the returned order matches `scorecards` regardless of which calls
  // finish first.
  const results = Array.from({ length: scorecards.length });
  let nextIndex = 0;
  async function worker() {
    for (let index = nextIndex++; index < scorecards.length; index = nextIndex++) {
      const scorecard = scorecards[index];
      const target = participants.find((p) => p.userId === scorecard.participantUserId);
      results[index] = await generateFeedbackForScorecard({
        scorecard,
        target,
        topic,
        verifiedEvidence: evidenceVerification.verified,
        confidence: confidenceByParticipant.get(scorecard.participantUserId) ?? null,
        generateEvaluationFeedbackFn,
      });
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, scorecards.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return { status: 'ok', results, evidenceVerification, criterionResults, validationResults, confidences };
}
