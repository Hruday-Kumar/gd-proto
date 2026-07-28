// Session-duration validation (H3, audit 2026-07-28). The room routes used to
// check only `!durationSeconds`, so any truthy value went straight into the
// rooms table. The UI's picker offers 5/10/15/20 minutes, but the API is the
// security boundary, not the picker.
//
// An out-of-range duration breaks two things at once, neither visible to a
// student: ends_at lands so far away that isTimerExpired() never fires (the
// room stays 'live' forever and feedback is never dispatched), and the agent's
// stop timer -- setTimeout(durationSeconds * 1000) -- overflows int32 and
// fires at 1ms instead, disconnecting the transcriber immediately. The session
// then runs indefinitely with no transcript.
//
// Bounds are deliberately wider than the picker so the UI can add options
// without a server change, and narrow enough that neither failure is
// reachable. Both are inclusive.
export const MIN_DURATION_SECONDS = 60;
export const MAX_DURATION_SECONDS = 3600;

export function isValidDurationSeconds(value) {
  // Number.isInteger is false for NaN, Infinity, non-numbers, and fractions,
  // which is exactly the set we want out. Numeric strings are rejected too:
  // duration_seconds is an integer column, and a request body is
  // attacker-controlled, so coercing here would only move the failure later.
  return Number.isInteger(value) && value >= MIN_DURATION_SECONDS && value <= MAX_DURATION_SECONDS;
}
