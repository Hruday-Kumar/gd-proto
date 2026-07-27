// Feedback generation worker (W6, peripheral -- same in-process,
// fire-and-forget dispatch pattern as agent/roomAgent.js's transcription
// start). Called by the rooms API right after a room's status flips to
// 'ended' (GET /api/rooms/:id/status). Fetches everything
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
import { insertFeedback } from '../db/feedback.js';

export async function generateAndPersistFeedbackForRoom(
  roomId,
  {
    getRoomByIdFn = getRoomById,
    getTopicByIdFn = getTopicById,
    listParticipantsFn = listParticipants,
    listProfilesFn = listProfiles,
    listTranscriptLinesForRoomFn = listTranscriptLinesForRoom,
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

  const lines = await listTranscriptLinesForRoomFn(roomId);
  const transcriptLines = lines.map((line) => ({ userId: line.user_id, text: line.text }));

  const results = await generateFeedbackForRoom(
    { topic: topic?.text, transcriptLines, participants },
    { generate: (prompt) => generateFn(prompt) }
  );

  await Promise.all(
    results.map(async (result) => {
      if (result.status !== 'ok') {
        console.error(`[feedback] generation failed for user ${result.userId} in room ${roomId}: ${result.error}`);
        return;
      }
      try {
        await insertFeedbackFn({ roomId, userId: result.userId, body: result.body, model });
      } catch (err) {
        console.error(`[feedback] failed to persist feedback for user ${result.userId} in room ${roomId}: ${err.message}`);
      }
    })
  );
}
