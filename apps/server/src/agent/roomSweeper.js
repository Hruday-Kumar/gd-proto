// M10 (audit 2026-07-28). GET /api/rooms/:id/status used to lazily flip an
// expired room to 'ended' and dispatch feedback generation as a side effect
// of a read -- any retry, prefetch, or proxy replay could re-trigger it.
// This runs the transition on a server-side timer instead, so the status
// route can go back to being a pure read. Same shape as agent/roomAgent.js's
// recoverLiveRooms(): nothing here may throw, since it runs unattended on an
// interval -- a database hiccup should just mean this tick did nothing,
// not a crashed process.
import {
  listLiveRooms,
  updateRoomStatus,
  listRoomsNeedingFeedbackRetry,
  claimFeedbackAttempt,
  markFeedbackGenerated,
} from '../db/rooms.js';
import {
  findExpiredLiveRooms,
  findRoomsReadyForFeedbackRetry,
  shouldWaitForTranscriptionFlush,
  FEEDBACK_RETRY_MAX_ATTEMPTS,
} from '../domain/roomSweep.js';
import { generateAndPersistFeedbackForRoom } from './feedbackWorker.js';
import { getAgentWorkerStatus, isTranscriptionActive } from './roomAgent.js';

// N1 (audit comparison, 2026-07-29): one feedback attempt for one room --
// used both right after a room ends and on a later retry, since a retry is
// exactly the same operation with a non-zero starting attempt count. Claims
// the attempt atomically first (same conditional-update contract as
// updateRoomStatus's expectedStatus, C3 audit 2026-07-28): if this room's
// attempt was already claimed by an overlapping sweep tick, or by the other
// dispatch path finding the same room in the same tick, the claim simply
// doesn't match and this call does nothing. Never throws -- every failure
// path is logged and swallowed, since this always runs fire-and-forget from
// sweepExpiredRooms below.
async function attemptFeedback(
  roomId,
  previousAttempts,
  endedAt,
  now,
  { generateFeedbackFn, claimFeedbackAttemptFn, markFeedbackGeneratedFn, agentStatus, isTranscriptionActiveFn }
) {
  // N4 (audit comparison, 2026-07-29): don't generate feedback from a
  // transcript that might still be missing its last few seconds --
  // isTranscriptionActive(roomId) (agent/roomAgent.js) is true until the
  // room's transcription agent has fully disconnected AND every transcript
  // write it triggered has actually landed. No claim is taken here, so
  // feedback_attempts/feedback_last_attempted_at stay untouched and the
  // very next sweep tick's retry pass (N1) picks this room straight back
  // up with zero backoff. shouldWaitForTranscriptionFlush bounds this so a
  // stuck/crashed agent can't block feedback forever.
  if (isTranscriptionActiveFn(roomId) && shouldWaitForTranscriptionFlush(endedAt, now)) {
    return;
  }

  const at = new Date(now).toISOString();

  let claim;
  try {
    claim = await claimFeedbackAttemptFn(roomId, { expectedAttempts: previousAttempts, at });
  } catch (err) {
    console.error(`[feedback] failed to claim a retry attempt for room ${roomId}: ${err.message}`);
    return;
  }
  if (!claim) return; // someone else already claimed this attempt

  let complete = false;
  let failure = null;
  try {
    const result = await generateFeedbackFn(roomId);
    complete = Boolean(result?.complete);
    if (!complete) failure = new Error('one or more participants did not receive feedback');
  } catch (err) {
    failure = err;
  }

  if (complete) {
    try {
      await markFeedbackGeneratedFn(roomId, { at });
    } catch (err) {
      console.error(`[feedback] failed to record completion for room ${roomId}: ${err.message}`);
    }
    agentStatus.recordFeedbackSuccess(roomId);
    return;
  }

  console.error(`[feedback] attempt ${claim.feedback_attempts} failed for room ${roomId}: ${failure.message}`);
  // Only report a health failure once retries are actually exhausted --
  // a transient blip that resolves on the next attempt a minute later
  // shouldn't page anyone, same "recency over count" philosophy as the
  // transcription tracker's `healthy` flag.
  if (claim.feedback_attempts >= FEEDBACK_RETRY_MAX_ATTEMPTS) {
    console.error(`[feedback] giving up on room ${roomId} after ${claim.feedback_attempts} attempts`);
    agentStatus.recordFeedbackFailure(roomId, failure);
  }
}

export async function sweepExpiredRooms({
  listLiveRoomsFn = listLiveRooms,
  updateRoomStatusFn = updateRoomStatus,
  generateFeedbackFn = generateAndPersistFeedbackForRoom,
  listRoomsNeedingFeedbackRetryFn = listRoomsNeedingFeedbackRetry,
  claimFeedbackAttemptFn = claimFeedbackAttempt,
  markFeedbackGeneratedFn = markFeedbackGenerated,
  agentStatus = getAgentWorkerStatus(),
  isTranscriptionActiveFn = isTranscriptionActive,
  now = Date.now(),
} = {}) {
  const feedbackDeps = { generateFeedbackFn, claimFeedbackAttemptFn, markFeedbackGeneratedFn, agentStatus, isTranscriptionActiveFn };
  // Every feedback attempt this tick dispatches, collected rather than
  // awaited one at a time -- a slow Gemini call for one room must not
  // delay ending or retrying any other room in this same tick. Settled
  // together at the end so this function's own promise reflects "this
  // tick's work is done" (useful for tests and for anything that ever
  // wants to observe tick completion) without changing when the *next*
  // tick fires -- startRoomSweeper's setInterval already doesn't wait on
  // the previous tick's promise either way.
  const pendingFeedback = [];

  let liveRooms;
  try {
    liveRooms = await listLiveRoomsFn();
  } catch (err) {
    console.error(`[sweep] could not read live rooms: ${err.message}`);
    liveRooms = [];
  }

  const expired = findExpiredLiveRooms(liveRooms, now);

  for (const room of expired) {
    let claimed;
    try {
      // Same conditional-claim contract C3 gave db/rooms.js's
      // updateRoomStatus: the write only lands if the room is still
      // 'live', so if two ticks ever overlap, only one of them wins.
      claimed = await updateRoomStatusFn(room.id, {
        status: 'ended',
        endedAt: new Date(now).toISOString(),
        expectedStatus: 'live',
      });
    } catch (err) {
      console.error(`[sweep] failed to end room ${room.id}: ${err.message}`);
      continue;
    }

    // Losing the claim is normal, not an error -- someone else already
    // ended this room.
    if (claimed) {
      pendingFeedback.push(
        attemptFeedback(room.id, claimed.feedback_attempts ?? 0, claimed.ended_at, now, feedbackDeps).catch((e) =>
          console.error(`[feedback] unexpected error dispatching room ${room.id}: ${e.message}`)
        )
      );
    }
  }

  // N1 (audit comparison, 2026-07-29): separately, retry every already-
  // `ended` room whose feedback never completed -- covers a process
  // crash/redeploy between the claim above and Gemini returning, and a
  // Gemini outage that failed every participant on the very first
  // attempt (this happened for real: PROGRESS.md's 2026-07-29 B7 entry
  // records a dead Gemini service account 401ing both participants of a
  // real session, with no way to ever regenerate that room's feedback
  // before this fix).
  let retryCandidates = [];
  try {
    retryCandidates = await listRoomsNeedingFeedbackRetryFn();
  } catch (err) {
    console.error(`[feedback] could not read feedback retry candidates: ${err.message}`);
  }

  const dueForRetry = findRoomsReadyForFeedbackRetry(retryCandidates, now);
  for (const room of dueForRetry) {
    pendingFeedback.push(
      attemptFeedback(room.id, room.feedback_attempts ?? 0, room.ended_at, now, feedbackDeps).catch((e) =>
        console.error(`[feedback] unexpected error retrying room ${room.id}: ${e.message}`)
      )
    );
  }

  await Promise.allSettled(pendingFeedback);
}

// Runs sweepExpiredRooms on a timer. Returns a stop function so index.js
// can clear the interval during graceful shutdown (shutdown.js) -- an
// interval left running doesn't hold the process open by itself (see
// .unref() below), but clearing it is still the honest thing to do rather
// than leaving a dangling timer past the point the server is shutting down.
export function startRoomSweeper({ intervalMs = 3000, sweepFn = sweepExpiredRooms, ...deps } = {}) {
  // Phase 1 (ACTION_PLAN.md, 2026-08-04): the DB claim inside a single tick
  // already stops two ticks from double-dispatching the same room's
  // feedback, but nothing stopped two ticks from running at all -- if one
  // tick's Gemini calls run longer than intervalMs (routine), setInterval
  // fires the next tick anyway, doubling every DB read/write in flight for
  // no benefit. Skip a tick outright while the previous one is still
  // running instead.
  let inFlight = false;
  const interval = setInterval(() => {
    if (inFlight) return;
    inFlight = true;
    sweepFn(deps)
      .catch((e) => console.error(`[sweep] unexpected error: ${e.message}`))
      .finally(() => {
        inFlight = false;
      });
  }, intervalMs);
  interval.unref?.();
  return () => clearInterval(interval);
}
