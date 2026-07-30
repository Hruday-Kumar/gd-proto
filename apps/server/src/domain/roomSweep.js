// M10 (audit 2026-07-28). GET /api/rooms/:id/status used to lazily flip an
// expired room to 'ended' and dispatch feedback generation as a side effect
// of a read -- any retry, prefetch, or proxy replay could re-trigger it.
// This is the pure decision behind the replacement, a periodic sweep
// (agent/roomSweeper.js): given every room the DB still calls 'live' and
// the server's own clock, which ones have actually timed out.
export function findExpiredLiveRooms(rooms, now) {
  return rooms.filter((room) => room.ends_at && now >= new Date(room.ends_at).getTime());
}

// N1 (audit comparison, 2026-07-29): a room's feedback dispatch used to be
// a single fire-and-forget attempt with no retry -- a crash mid-call or a
// Gemini outage meant that room's feedback was gone forever, since ended
// rooms are dropped from listLiveRooms() and nothing ever revisited them.
// This is the pure decision behind the retry half of the sweep, same
// "DB filters cheaply, this decides exactly" split as findExpiredLiveRooms
// above: db/rooms.js's listRoomsNeedingFeedbackRetry() only filters on
// status + feedback_generated_at being null; every time/attempt-count
// judgment call lives here so it's testable without a database.
export const FEEDBACK_RETRY_MAX_ATTEMPTS = 5;
// Deliberately much longer than the 3s sweep interval -- a transient
// failure (network blip, momentary Gemini 5xx) shouldn't be hammered
// every tick, and this is retried generation, not the time-critical
// ended-transition claim.
export const FEEDBACK_RETRY_BACKOFF_MS = 60_000;
// A room whose feedback has been broken for longer than this is treated as
// a case needing a human, not an automatic retry loop running forever
// against a room that's ancient history by pilot-scale usage patterns.
export const FEEDBACK_RETRY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// N4 (audit comparison, 2026-07-29): feedback generation used to dispatch
// the instant a room's ends_at passed (see findExpiredLiveRooms above),
// fully decoupled from whether agent/roomAgent.js's transcription agent
// had actually finished flushing that room's last few seconds of speech.
// The agent's own STOP_GRACE_MS (4s) plus AssemblyAI's finalization
// latency mean it's often still running -- with DB writes still in
// flight -- at the exact moment the sweep decides a room is "over".
// roomAgent.js's isTranscriptionActive() is the real, deterministic
// signal for "is this room's agent still connected or still flushing its
// last writes"; this is the bounded fallback for the one case that signal
// can't cover -- a stuck or crashed agent that never clears. Comfortably
// covers STOP_GRACE_MS + a couple of sweep ticks + the AssemblyAI
// socket-close safety net, so a real bug there can't silently block a
// room's feedback forever.
export const FEEDBACK_FLUSH_MAX_WAIT_MS = 15_000;

export function shouldWaitForTranscriptionFlush(endedAt, now, { maxWaitMs = FEEDBACK_FLUSH_MAX_WAIT_MS } = {}) {
  if (!endedAt) return false; // no stop time to judge age from -- guardrail #10, same as findExpiredLiveRooms
  return now - new Date(endedAt).getTime() < maxWaitMs;
}

export function findRoomsReadyForFeedbackRetry(
  rooms,
  now,
  {
    maxAttempts = FEEDBACK_RETRY_MAX_ATTEMPTS,
    backoffMs = FEEDBACK_RETRY_BACKOFF_MS,
    maxAgeMs = FEEDBACK_RETRY_MAX_AGE_MS,
  } = {}
) {
  return rooms.filter((room) => {
    if (!room.ended_at) return false; // no stop time to judge age from -- guardrail #10, same as findExpiredLiveRooms
    if (now - new Date(room.ended_at).getTime() > maxAgeMs) return false;
    if ((room.feedback_attempts ?? 0) >= maxAttempts) return false;
    if (room.feedback_last_attempted_at && now - new Date(room.feedback_last_attempted_at).getTime() < backoffMs) {
      return false;
    }
    return true;
  });
}
