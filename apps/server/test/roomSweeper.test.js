// M10 (audit 2026-07-28). Replaces the write GET /api/rooms/:id/status used
// to perform as a side effect of a read. sweepExpiredRooms() is the
// orchestration that runs on a timer instead: list every 'live' room,
// decide which have timed out (domain/roomSweep.js), and for each one
// *claim* the ended-transition -- same conditional-update contract C3 gave
// db/rooms.js's updateRoomStatus -- then dispatch feedback generation only
// for the caller that actually won the claim. Same pattern as agent/
// roomAgent.js's recoverLiveRooms(): nothing here may throw and stop the
// process, a database hiccup just means this tick did nothing.
import { describe, it, expect, vi } from 'vitest';
import { sweepExpiredRooms } from '../src/agent/roomSweeper.js';

const NOW = Date.parse('2026-07-29T10:00:00.000Z');

function expiredRoom(overrides = {}) {
  return {
    id: 'r1',
    status: 'live',
    ends_at: new Date(NOW - 1_000).toISOString(),
    ...overrides,
  };
}

describe('sweepExpiredRooms', () => {
  it('claims the ended transition for an expired room, with a precondition on it still being live', async () => {
    const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
    const updateRoomStatusFn = vi.fn().mockResolvedValue({ id: 'r1', status: 'ended' });
    const generateFeedbackFn = vi.fn().mockResolvedValue(undefined);

    await sweepExpiredRooms({ listLiveRoomsFn, updateRoomStatusFn, generateFeedbackFn, now: NOW });

    expect(updateRoomStatusFn).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ status: 'ended', expectedStatus: 'live' })
    );
  });

  it('dispatches feedback generation only when it wins the claim', async () => {
    const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
    const updateRoomStatusFn = vi.fn().mockResolvedValue({ id: 'r1', status: 'ended' });
    const generateFeedbackFn = vi.fn().mockResolvedValue(undefined);

    await sweepExpiredRooms({ listLiveRoomsFn, updateRoomStatusFn, generateFeedbackFn, now: NOW });

    expect(generateFeedbackFn).toHaveBeenCalledWith('r1');
  });

  // C3's original concurrency guarantee, carried over: if two ticks somehow
  // overlap (a slow tick plus a short interval), the claim in the DB -- not
  // JS state -- is what stops both from dispatching feedback.
  it('dispatches feedback only once when the claim is already gone', async () => {
    const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
    const updateRoomStatusFn = vi.fn().mockResolvedValue(null); // someone else already claimed it
    const generateFeedbackFn = vi.fn().mockResolvedValue(undefined);

    await sweepExpiredRooms({ listLiveRoomsFn, updateRoomStatusFn, generateFeedbackFn, now: NOW });

    expect(generateFeedbackFn).not.toHaveBeenCalled();
  });

  it('does nothing when no live room has expired', async () => {
    const notExpired = expiredRoom({ ends_at: new Date(NOW + 60_000).toISOString() });
    const listLiveRoomsFn = vi.fn().mockResolvedValue([notExpired]);
    const updateRoomStatusFn = vi.fn();
    const generateFeedbackFn = vi.fn();

    await sweepExpiredRooms({ listLiveRoomsFn, updateRoomStatusFn, generateFeedbackFn, now: NOW });

    expect(updateRoomStatusFn).not.toHaveBeenCalled();
    expect(generateFeedbackFn).not.toHaveBeenCalled();
  });

  it('sweeps every expired room in one tick, not just the first', async () => {
    const rooms = [expiredRoom({ id: 'a' }), expiredRoom({ id: 'b' })];
    const listLiveRoomsFn = vi.fn().mockResolvedValue(rooms);
    const updateRoomStatusFn = vi.fn().mockResolvedValue({ status: 'ended' });
    const generateFeedbackFn = vi.fn().mockResolvedValue(undefined);

    await sweepExpiredRooms({ listLiveRoomsFn, updateRoomStatusFn, generateFeedbackFn, now: NOW });

    expect(generateFeedbackFn).toHaveBeenCalledWith('a');
    expect(generateFeedbackFn).toHaveBeenCalledWith('b');
  });

  it('never lets a database read failure throw', async () => {
    const listLiveRoomsFn = vi.fn().mockRejectedValue(new Error('supabase unreachable'));

    await expect(sweepExpiredRooms({ listLiveRoomsFn, updateRoomStatusFn: vi.fn(), generateFeedbackFn: vi.fn(), now: NOW })).resolves.toBeUndefined();
  });

  it('keeps sweeping the other rooms when one claim write fails', async () => {
    const rooms = [expiredRoom({ id: 'a' }), expiredRoom({ id: 'b' })];
    const listLiveRoomsFn = vi.fn().mockResolvedValue(rooms);
    const updateRoomStatusFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('db timeout'))
      .mockResolvedValueOnce({ status: 'ended' });
    const generateFeedbackFn = vi.fn().mockResolvedValue(undefined);

    await sweepExpiredRooms({ listLiveRoomsFn, updateRoomStatusFn, generateFeedbackFn, now: NOW });

    expect(generateFeedbackFn).toHaveBeenCalledWith('b');
    expect(generateFeedbackFn).not.toHaveBeenCalledWith('a');
  });

  it('does not let a failing feedback dispatch reject the sweep', async () => {
    const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
    const updateRoomStatusFn = vi.fn().mockResolvedValue({ status: 'ended' });
    const generateFeedbackFn = vi.fn().mockRejectedValue(new Error('gemini unreachable'));

    await expect(sweepExpiredRooms({ listLiveRoomsFn, updateRoomStatusFn, generateFeedbackFn, now: NOW })).resolves.toBeUndefined();
  });
});
