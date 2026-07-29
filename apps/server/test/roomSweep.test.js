// M10 (audit 2026-07-28). GET /api/rooms/:id/status used to lazily flip an
// expired room to 'ended' and dispatch feedback as a side effect of a read
// -- any retry, prefetch, or proxy replay could re-trigger it. This is the
// pure decision behind the replacement: a periodic sweep (agent/
// roomSweeper.js), given every room the DB still calls 'live' and the
// server's own clock, decides which ones have actually timed out. Kept pure
// (no DB) for the same reason domain/roomRecovery.js is -- the expiry rule
// is the part worth testing in isolation, not the orchestration around it.
import { describe, it, expect } from 'vitest';
import {
  findExpiredLiveRooms,
  findRoomsReadyForFeedbackRetry,
  FEEDBACK_RETRY_MAX_ATTEMPTS,
  FEEDBACK_RETRY_BACKOFF_MS,
  FEEDBACK_RETRY_MAX_AGE_MS,
} from '../src/domain/roomSweep.js';

const NOW = Date.parse('2026-07-29T10:00:00.000Z');

function liveRoom(overrides = {}) {
  return {
    id: 'room-1',
    status: 'live',
    ends_at: new Date(NOW + 60_000).toISOString(),
    ...overrides,
  };
}

describe('findExpiredLiveRooms', () => {
  it('excludes a live room whose timer has not expired yet', () => {
    expect(findExpiredLiveRooms([liveRoom()], NOW)).toEqual([]);
  });

  it('includes a live room whose ends_at has already passed', () => {
    const room = liveRoom({ ends_at: new Date(NOW - 1_000).toISOString() });
    expect(findExpiredLiveRooms([room], NOW)).toEqual([room]);
  });

  it('includes a room whose timer expires at exactly this instant', () => {
    const room = liveRoom({ ends_at: new Date(NOW).toISOString() });
    expect(findExpiredLiveRooms([room], NOW)).toEqual([room]);
  });

  it('excludes a room with no ends_at, rather than guessing one', () => {
    // Shouldn't happen (POST /start always writes ends_at), but without a
    // server-authoritative stop time there's nothing to compare against --
    // guardrail #10, same reasoning as roomRecovery.js.
    const room = liveRoom({ ends_at: null });
    expect(findExpiredLiveRooms([room], NOW)).toEqual([]);
  });

  it('returns every expired room that qualifies, not just the first', () => {
    const expiredA = liveRoom({ id: 'a', ends_at: new Date(NOW - 5_000).toISOString() });
    const notExpired = liveRoom({ id: 'b', ends_at: new Date(NOW + 5_000).toISOString() });
    const expiredC = liveRoom({ id: 'c', ends_at: new Date(NOW - 1_000).toISOString() });

    expect(findExpiredLiveRooms([expiredA, notExpired, expiredC], NOW)).toEqual([expiredA, expiredC]);
  });

  it('handles an empty room list', () => {
    expect(findExpiredLiveRooms([], NOW)).toEqual([]);
  });
});

// N1 (audit comparison, 2026-07-29): a room's one feedback dispatch used to
// be permanent -- an ended room that never got feedback (a crash mid-call,
// or Gemini failing every participant, both of which have actually
// happened) was never revisited. This is the pure decision behind the
// retry pass: given every ended room the DB still says is missing
// feedback and the server's clock, which are actually due for another
// attempt right now.
function endedRoom(overrides = {}) {
  return {
    id: 'room-1',
    ended_at: new Date(NOW - 5_000).toISOString(),
    feedback_attempts: 0,
    feedback_last_attempted_at: null,
    ...overrides,
  };
}

describe('findRoomsReadyForFeedbackRetry', () => {
  it('includes a room with zero attempts and no prior attempt timestamp', () => {
    expect(findRoomsReadyForFeedbackRetry([endedRoom()], NOW)).toEqual([endedRoom()]);
  });

  it('excludes a room that already reached the max attempt count', () => {
    const room = endedRoom({ feedback_attempts: FEEDBACK_RETRY_MAX_ATTEMPTS });
    expect(findRoomsReadyForFeedbackRetry([room], NOW)).toEqual([]);
  });

  it('excludes a room whose last attempt was too recent (still backing off)', () => {
    const room = endedRoom({
      feedback_attempts: 1,
      feedback_last_attempted_at: new Date(NOW - 1_000).toISOString(),
    });
    expect(findRoomsReadyForFeedbackRetry([room], NOW)).toEqual([]);
  });

  it('includes a room whose backoff window has fully elapsed', () => {
    const room = endedRoom({
      feedback_attempts: 1,
      feedback_last_attempted_at: new Date(NOW - FEEDBACK_RETRY_BACKOFF_MS - 1).toISOString(),
    });
    expect(findRoomsReadyForFeedbackRetry([room], NOW)).toEqual([room]);
  });

  it('excludes a room that ended too long ago to still be worth auto-retrying', () => {
    const room = endedRoom({ ended_at: new Date(NOW - FEEDBACK_RETRY_MAX_AGE_MS - 1).toISOString() });
    expect(findRoomsReadyForFeedbackRetry([room], NOW)).toEqual([]);
  });

  it('excludes a room with no ended_at, rather than guessing an age', () => {
    const room = endedRoom({ ended_at: null });
    expect(findRoomsReadyForFeedbackRetry([room], NOW)).toEqual([]);
  });

  it('respects overridden thresholds', () => {
    const room = endedRoom({ feedback_attempts: 2 });
    expect(findRoomsReadyForFeedbackRetry([room], NOW, { maxAttempts: 2 })).toEqual([]);
    expect(findRoomsReadyForFeedbackRetry([room], NOW, { maxAttempts: 3 })).toEqual([room]);
  });

  it('handles an empty room list', () => {
    expect(findRoomsReadyForFeedbackRetry([], NOW)).toEqual([]);
  });
});
