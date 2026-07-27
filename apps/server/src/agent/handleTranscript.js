// The glue between attribution (domain/attribution.js) and persistence
// (db/transcriptLines.js) -- called by the agent worker for every
// finalized transcript turn AssemblyAI reports. Exactly where a silent
// bug would put one student's words under another's name, so it's kept
// as its own testable unit rather than inlined in the worker.
import { resolveSpeakerUserId } from '../domain/attribution.js';

export async function persistAttributedLine(
  { participants, identity, text, startedAtMs, endedAtMs, roomId },
  { insertTranscriptLine }
) {
  const userId = resolveSpeakerUserId(participants, identity);
  if (!userId) {
    console.warn(
      `[agent] no room_participants match for LiveKit identity "${identity}" in room ${roomId} -- dropping line, not persisted`
    );
    return null;
  }
  return insertTranscriptLine({ roomId, userId, text, startedAtMs, endedAtMs });
}
