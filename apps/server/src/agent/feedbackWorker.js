// Feedback generation worker (W6, peripheral -- same in-process,
// fire-and-forget dispatch pattern as agent/roomAgent.js's transcription
// start). Called by agent/roomSweeper.js once a room's status flips to
// 'ended', and again on retry (N1, audit comparison 2026-07-29) if a
// previous attempt left the room incomplete. Fetches everything
// generateFeedbackForRoom (domain/feedbackGeneration.js, core, tested)
// needs, then persists each successful result -- one student's insert
// failure is logged, not thrown, so it can't block another student's
// feedback from being saved, same reasoning as the generation step itself.
import { generateFeedbackForRoom } from '../domain/feedbackGeneration.js';
import { generateFeedback } from '../llm/geminiClient.js';
import { getRoomById } from '../db/rooms.js';
import { getTopicById } from '../db/topics.js';
import { listParticipants } from '../db/roomParticipants.js';
import { listProfiles } from '../db/profiles.js';
import { listTranscriptLinesForRoom } from '../db/transcriptLines.js';
import { insertFeedback, listFeedbackUserIdsForRoom } from '../db/feedback.js';

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
    generateFn = generateFeedback,
    model = process.env.GEMINI_MODEL || 'gemini-3.6-flash',
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
  const transcriptLines = lines.map((line) => ({ userId: line.user_id, text: line.text }));

  const results = await generateFeedbackForRoom(
    { topic: topic?.text, transcriptLines, participants: pending },
    { generate: (prompt) => generateFn(prompt) }
  );

  const outcomes = await Promise.all(
    results.map(async (result) => {
      if (result.status !== 'ok') {
        console.error(`[feedback] generation failed for user ${result.userId} in room ${roomId}: ${result.error}`);
        return false;
      }
      try {
        // SPEC-0006 (BE-6/BE-7): result.body is now the structured shape
        // domain/feedbackPrompt.js's parseFeedbackResponse produces (or the
        // matching transcription-failed stub) -- `body` in the DB row keeps
        // its existing name/meaning (the prose summary), the rest are new
        // columns.
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
