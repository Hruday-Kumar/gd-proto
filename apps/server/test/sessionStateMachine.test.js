// Core logic test (W4): waiting -> live -> ended, with a server-authoritative
// timer. "now" is always passed in by the caller (the server's own clock) —
// no client-supplied timestamp is ever trusted, since clients can disagree
// and the agent worker needs one single truth for when to stop transcribing
// (PHASE1_PLAN.md §5 W4 core unit).
import { describe, it, expect } from 'vitest';
import { SESSION_STATUS, startSession, endSession, isTimerExpired } from '../src/domain/sessionStateMachine.js';

const baseSession = { status: SESSION_STATUS.WAITING, durationSeconds: 300 };

describe('startSession', () => {
  it('transitions waiting -> live, recording startedAt and computing endsAt', () => {
    const now = 1_000_000;
    const result = startSession(baseSession, now);
    expect(result.status).toBe(SESSION_STATUS.LIVE);
    expect(result.startedAt).toBe(now);
    expect(result.endsAt).toBe(now + 300_000);
  });

  it('throws when starting a session that is not waiting', () => {
    const live = { ...baseSession, status: SESSION_STATUS.LIVE };
    expect(() => startSession(live, 0)).toThrow(/waiting/i);
    const ended = { ...baseSession, status: SESSION_STATUS.ENDED };
    expect(() => startSession(ended, 0)).toThrow(/waiting/i);
  });
});

describe('endSession', () => {
  it('transitions live -> ended, recording endedAt', () => {
    const live = { ...baseSession, status: SESSION_STATUS.LIVE, startedAt: 0, endsAt: 300_000 };
    const result = endSession(live, 300_000);
    expect(result.status).toBe(SESSION_STATUS.ENDED);
    expect(result.endedAt).toBe(300_000);
  });

  it('throws when ending a session that is not live', () => {
    expect(() => endSession(baseSession, 0)).toThrow(/live/i);
    const ended = { ...baseSession, status: SESSION_STATUS.ENDED };
    expect(() => endSession(ended, 0)).toThrow(/live/i);
  });
});

describe('isTimerExpired', () => {
  const live = { ...baseSession, status: SESSION_STATUS.LIVE, startedAt: 0, endsAt: 300_000 };

  it('is false while a live session has time remaining', () => {
    expect(isTimerExpired(live, 299_999)).toBe(false);
  });

  it('is true once now reaches or passes endsAt', () => {
    expect(isTimerExpired(live, 300_000)).toBe(true);
    expect(isTimerExpired(live, 400_000)).toBe(true);
  });

  it('is false for a waiting or already-ended session (nothing to expire)', () => {
    expect(isTimerExpired(baseSession, 999_999)).toBe(false);
    expect(isTimerExpired({ ...baseSession, status: SESSION_STATUS.ENDED }, 999_999)).toBe(false);
  });
});
