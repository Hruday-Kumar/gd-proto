// Room-lifecycle orchestration for the transcription agent (W5,
// PHASE1_PLAN.md §3a: this runs in the SAME process as the Express API,
// not a separately-dispatched LiveKit Agents job -- same in-process
// pattern the Phase 0a/P2 spike validated with real humans and bots).
//
// The rooms API calls startTranscriptionForRoom() right after flipping a
// room to 'live' (POST /api/rooms/:id/start). The agent joins as a
// hidden, subscribe-only participant, transcribes every other track, and
// disconnects itself once the room's own duration has elapsed -- the
// server-authoritative timer (domain/sessionStateMachine.js) is the only
// clock that matters; the agent never waits for a client to tell it to
// stop.
import { Room } from '@livekit/rtc-node';
import { mintToken } from '../livekit/token.js';
import { attachTranscriber } from './transcriber.js';
import { persistAttributedLine } from './handleTranscript.js';
import { listParticipants } from '../db/roomParticipants.js';
import { insertTranscriptLine } from '../db/transcriptLines.js';
import { createAgentWorkerStatus } from '../domain/agentWorkerStatus.js';
import { withRetry } from '../domain/retry.js';

// One tracker for the whole process (W8) -- api/health.js reads it at
// GET /health/agent. Exported via a getter, not the object itself, so
// tests can't accidentally share mutable state across files.
const agentStatus = createAgentWorkerStatus();
export function getAgentWorkerStatus() {
  return agentStatus;
}

// Trailing grace after the timer ends so AssemblyAI can flush the last
// speaker's final turn before we disconnect (matches the 4s grace the P2
// smoke test used).
const STOP_GRACE_MS = 4000;

const activeRooms = new Map(); // roomId -> { room, timeout }

export async function startTranscriptionForRoom(
  { id: roomId, durationSeconds },
  {
    listParticipantsFn = listParticipants,
    insertTranscriptLineFn = insertTranscriptLine,
    mintTokenFn = mintToken,
    liveKitUrl = process.env.LIVEKIT_URL,
    assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY,
    roomFactory = () => new Room(),
    // A transient network blip on the connect call (confirmed live:
    // "failed to retrieve region info: error sending request for url")
    // used to permanently kill transcription for the whole room with no
    // recovery attempt. Bounded retry absorbs that class of one-off
    // failure instead of giving up on the first hiccup.
    connectRetryAttempts = 3,
    connectRetryDelayMs = 1000,
  } = {}
) {
  if (activeRooms.has(roomId)) return; // already transcribing this room

  try {
    const participants = await listParticipantsFn(roomId);
    const token = await mintTokenFn('transcriber', roomId, {
      name: 'Transcriber',
      canPublish: false,
      canSubscribe: true,
      canPublishData: true, // broadcasts live captions below -- must stay true
      hidden: true,
    });

    const room = roomFactory();
    await withRetry(() => room.connect(liveKitUrl, token, { autoSubscribe: true, dynacast: true }), {
      attempts: connectRetryAttempts,
      delayMs: connectRetryDelayMs,
      onRetry: (err, attempt) =>
        console.warn(`[agent] room.connect attempt ${attempt} failed for room ${roomId}: ${err.message}`),
    });

    const encoder = new TextEncoder();
    attachTranscriber(room, {
      apiKey: assemblyaiApiKey,
      onTranscript: ({ identity, text, startedAtMs, endedAtMs }) => {
        persistAttributedLine(
          { participants, identity, text, startedAtMs, endedAtMs, roomId },
          { insertTranscriptLine: insertTranscriptLineFn }
        ).catch((e) => console.error(`[agent] failed to persist transcript line for room ${roomId}: ${e.message}`));

        // Live captions (peripheral, PHASE1_PLAN.md §5 W5) -- broadcast
        // regardless of whether attribution matched, since a caption is
        // just a display convenience; only the DB write above is gated on
        // a resolved user_id.
        const payload = encoder.encode(JSON.stringify({ type: 'transcript', identity, text }));
        room.localParticipant.publishData(payload, { reliable: true, topic: 'transcript' });
      },
    });

    const timeout = setTimeout(() => {
      stopTranscriptionForRoom(roomId);
    }, durationSeconds * 1000 + STOP_GRACE_MS);

    activeRooms.set(roomId, { room, timeout });
    agentStatus.recordDispatchSuccess(roomId);
  } catch (err) {
    agentStatus.recordDispatchFailure(roomId, err);
    throw err; // callers (rooms.js) already log-and-swallow this
  }
}

export async function stopTranscriptionForRoom(roomId) {
  const entry = activeRooms.get(roomId);
  if (!entry) return;
  clearTimeout(entry.timeout);
  activeRooms.delete(roomId);
  agentStatus.recordRoomStopped(roomId);
  await entry.room.disconnect();
}
