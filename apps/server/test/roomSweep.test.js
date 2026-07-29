// M10 (audit 2026-07-28). GET /api/rooms/:id/status used to lazily flip an
// expired room to 'ended' and dispatch feedback as a side effect of a read
// -- any retry, prefetch, or proxy replay could re-trigger it. This is the
// pure decision behind the replacement: a periodic sweep (agent/
// roomSweeper.js), given every room the DB still calls 'live' and the
// server's own clock, decides which ones have actually timed out. Kept pure
// (no DB) for the same reason domain/roomRecovery.js is -- the expiry rule
// is the part worth testing in isolation, not the orchestration around it.
import { describe, it, expect } from 'vitest';
import { findExpiredLiveRooms } from '../src/domain/roomSweep.js';

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
