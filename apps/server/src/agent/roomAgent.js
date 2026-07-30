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
import { listLiveRooms } from '../db/rooms.js';
import { createAgentWorkerStatus } from '../domain/agentWorkerStatus.js';
import { roomsNeedingAgent } from '../domain/roomRecovery.js';
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

const activeRooms = new Map(); // roomId -> { room, timeout, transcriber, pendingPersists, stopPromise }
// N4 (audit comparison, 2026-07-29): a room moves here the instant its stop
// begins, and out again only once every persisted write it triggered has
// actually landed -- see isTranscriptionActive() below.
const flushingRooms = new Set();

// N4 (audit comparison, 2026-07-29): the deterministic signal
// agent/roomSweeper.js gates feedback generation on. True while the agent
// is connected AND while it's in the middle of tearing down (closing
// AssemblyAI sockets, waiting for in-flight transcript writes to settle) --
// only false once a room's transcription is genuinely, fully done.
export function isTranscriptionActive(roomId) {
  return activeRooms.has(roomId) || flushingRooms.has(roomId);
}

export async function startTranscriptionForRoom(
  { id: roomId, durationSeconds },
  {
    listParticipantsFn = listParticipants,
    insertTranscriptLineFn = insertTranscriptLine,
    mintTokenFn = mintToken,
    liveKitUrl = process.env.LIVEKIT_URL,
    assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY,
    roomFactory = () => new Room(),
    attachTranscriberFn = attachTranscriber,
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

    // Built up-front, mutable, so onTranscript below (and stopTranscription
    // ForRoom later) can reference it by closure before every field is
    // known -- entry.pendingPersists is what lets stop() (N4, audit
    // comparison 2026-07-29) wait for every transcript write this room's
    // agent has issued, not just fire-and-forget them.
    const entry = { room, timeout: null, transcriber: null, pendingPersists: [], stopPromise: null };

    const encoder = new TextEncoder();
    const transcriber = attachTranscriberFn(room, {
      apiKey: assemblyaiApiKey,
      onTranscript: ({ identity, text, startedAtMs, endedAtMs }) => {
        const persisted = persistAttributedLine(
          { participants, identity, text, startedAtMs, endedAtMs, roomId },
          { insertTranscriptLine: insertTranscriptLineFn }
        ).catch((e) => console.error(`[agent] failed to persist transcript line for room ${roomId}: ${e.message}`));
        entry.pendingPersists.push(persisted);

        // Live captions (peripheral, PHASE1_PLAN.md §5 W5) -- broadcast
        // regardless of whether attribution matched, since a caption is
        // just a display convenience; only the DB write above is gated on
        // a resolved user_id. Fire-and-forget by design (must not block
        // transcript persistence above), but a data-channel failure here
        // must not go uncaught (2026-07-30 exception-handling pass) --
        // publishData can both throw synchronously and return a promise
        // that rejects, so both are guarded.
        const payload = encoder.encode(JSON.stringify({ type: 'transcript', identity, text }));
        try {
          const published = room.localParticipant.publishData(payload, { reliable: true, topic: 'transcript' });
          published?.catch?.((e) => console.error(`[agent] failed to broadcast caption for room ${roomId}: ${e.message}`));
        } catch (e) {
          console.error(`[agent] failed to broadcast caption for room ${roomId}: ${e.message}`);
        }
      },
    });
    entry.transcriber = transcriber;

    entry.timeout = setTimeout(() => {
      // 2026-07-30 (exception-handling pass): the only other caller of
      // this function (stopAllTranscriptions, during shutdown) catches
      // it -- this call site was missed. An uncaught rejection here is an
      // unhandled rejection with no global handler except the process
      // safety net (processSafetyNet.js), which logs rather than crashes
      // -- but catching here, at the source, is the correct place to
      // isolate one room's failed disconnect from every other live room.
      stopTranscriptionForRoom(roomId).catch((err) =>
        console.error(`[agent] error stopping room ${roomId} on timer: ${err.message}`)
      );
    }, durationSeconds * 1000 + STOP_GRACE_MS);

    activeRooms.set(roomId, entry);
    agentStatus.recordDispatchSuccess(roomId);
  } catch (err) {
    agentStatus.recordDispatchFailure(roomId, err);
    throw err; // callers (rooms.js) already log-and-swallow this
  }
}

export async function stopTranscriptionForRoom(roomId) {
  const entry = activeRooms.get(roomId);
  if (!entry) return;
  // A concurrent second call (e.g. the internal timer firing at the same
  // moment as a shutdown sweep) awaits the same in-flight stop rather than
  // tearing the room down twice.
  if (entry.stopPromise) return entry.stopPromise;

  entry.stopPromise = (async () => {
    clearTimeout(entry.timeout);
    // Leaves activeRooms immediately but flushingRooms picks it up in the
    // same synchronous step, so isTranscriptionActive(roomId) never has a
    // gap where it would wrongly report this room as done (N4, audit
    // comparison 2026-07-29).
    activeRooms.delete(roomId);
    flushingRooms.add(roomId);
    agentStatus.recordRoomStopped(roomId);
    try {
      // Close the per-speaker AssemblyAI sockets explicitly (H2, audit
      // 2026-07-28) rather than relying on room.disconnect() to raise a
      // TrackUnsubscribed for each one -- during shutdown those events may
      // never arrive, leaking rate-limited STT connections. Now awaited
      // (N4): closeAll()'s own close() waits for AssemblyAI to actually
      // finish sending back each speaker's final turn instead of racing
      // it, so any very-last-moment onTranscript call has already fired
      // (and been pushed onto pendingPersists below) by the time this
      // resolves.
      await entry.transcriber?.closeAll();
      // Every transcript line that final turn (or any earlier one)
      // triggered must have actually landed in the DB before this room
      // counts as done -- otherwise a feedback generation dispatched the
      // instant this promise resolves could still miss it.
      await Promise.allSettled(entry.pendingPersists);
      await entry.room.disconnect();
    } finally {
      flushingRooms.delete(roomId);
    }
  })();

  return entry.stopPromise;
}

// Shutdown sweep (H2, audit 2026-07-28) -- called from the SIGTERM/SIGINT
// handler in index.js so a deploy disconnects each agent cleanly instead of
// having its sockets cut. allSettled, not all: one room whose socket is
// already gone must not leave the rest connected. Returns how many rooms
// were active, for the shutdown log.
export async function stopAllTranscriptions() {
  const roomIds = [...activeRooms.keys()];
  await Promise.allSettled(
    roomIds.map((roomId) =>
      stopTranscriptionForRoom(roomId).catch((err) =>
        console.error(`[agent] error disconnecting room ${roomId} during shutdown: ${err.message}`)
      )
    )
  );
  return roomIds.length;
}

// Boot recovery (H2, audit 2026-07-28) -- the half that actually restores a
// session. activeRooms is in-memory, so after a deploy, a free-tier sleep, or
// a crash, rooms that are still 'live' in the database have no agent attached
// and silently produce no transcript for the rest of the session. This scans
// for them once at boot and re-dispatches, passing the time REMAINING (see
// domain/roomRecovery.js) rather than the room's original duration.
//
// Nothing here may throw: this runs during boot, and a database hiccup or a
// LiveKit outage must degrade to "no recovery" rather than a server that
// won't start. Sequential on purpose -- AssemblyAI's free tier rate-limits
// new connections (LESSONS.md), and recovery is exactly the moment several
// rooms would otherwise connect at once.
export async function recoverLiveRooms({ listLiveRoomsFn = listLiveRooms, startFn = startTranscriptionForRoom, now = Date.now() } = {}) {
  let liveRooms;
  try {
    liveRooms = await listLiveRoomsFn();
  } catch (err) {
    console.error(`[agent] boot recovery could not read live rooms: ${err.message}`);
    return [];
  }

  const needing = roomsNeedingAgent(liveRooms, now);
  if (!needing.length) {
    console.log('[agent] boot recovery: no live rooms to re-attach');
    return [];
  }

  for (const { id, remainingSeconds } of needing) {
    try {
      await startFn({ id, durationSeconds: remainingSeconds });
      console.log(`[agent] boot recovery: re-attached room ${id} with ${remainingSeconds}s remaining`);
    } catch (err) {
      console.error(`[agent] boot recovery failed for room ${id}: ${err.message}`);
    }
  }

  return needing;
}
