// Session state machine (W4 core unit, PHASE1_PLAN.md §5): waiting -> live
// -> ended. The timer is server-authoritative — every function here takes
// `now` as an argument rather than reading a clock or trusting a
// client-supplied timestamp, so the only "now" that ever matters is the
// server's own. isTimerExpired() is what the server polls to decide when to
// call endSession(); no client vote is involved.
export const SESSION_STATUS = { WAITING: 'waiting', LIVE: 'live', ENDED: 'ended' };

export function startSession(session, now) {
  if (session.status !== SESSION_STATUS.WAITING) {
    throw new Error(`Cannot start a session that is not waiting (current status: "${session.status}")`);
  }
  return {
    ...session,
    status: SESSION_STATUS.LIVE,
    startedAt: now,
    endsAt: now + session.durationSeconds * 1000,
  };
}

export function endSession(session, now) {
  if (session.status !== SESSION_STATUS.LIVE) {
    throw new Error(`Cannot end a session that is not live (current status: "${session.status}")`);
  }
  return { ...session, status: SESSION_STATUS.ENDED, endedAt: now };
}

export function isTimerExpired(session, now) {
  if (session.status !== SESSION_STATUS.LIVE) return false;
  return now >= session.endsAt;
}
