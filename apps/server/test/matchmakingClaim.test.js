// H7 (engineering audit, 2026-07-28): matchmake() (domain/matchmaking.js)
// is a pure, correct decision function, but POST /api/rooms/match wired it
// to the DB as a plain check-then-act: read the queue, decide, then write
// -- with no protection between the read and the write. Two students
// hitting /match within the same round trip (the exact shape of a real
// pilot kickoff, when several people join at once) can both read the same
// pre-match queue snapshot and both decide they're completing the SAME
// match, double-booking the existing queued members into two different
// rooms.
//
// claimMatchOrQueue keeps matchmake() itself untouched and pure (PLAN.md's
// explicit instruction) and instead wraps it in an optimistic
// claim-and-retry loop: the existing queued members matchmake() selected
// are removed from the queue with a single atomic DELETE ... RETURNING
// (claimFromQueue). If fewer rows come back than expected, someone else's
// concurrent request already claimed one of them -- this attempt's queue
// snapshot was stale, so it retries with a fresh read instead of forming a
// room with the wrong members.
import { describe, it, expect, vi } from 'vitest';
import { claimMatchOrQueue } from '../src/domain/matchmakingClaim.js';

function baseDeps(overrides = {}) {
  return {
    listQueue: vi.fn().mockResolvedValue([]),
    addToQueue: vi.fn().mockResolvedValue(undefined),
    claimFromQueue: vi.fn().mockResolvedValue([]),
    minGroupSize: 3,
    maxGroupSize: 6,
    ...overrides,
  };
}

describe('claimMatchOrQueue', () => {
  it('queues the joiner when below threshold', async () => {
    const deps = baseDeps({ listQueue: vi.fn().mockResolvedValue([{ id: 'a' }]) });
    const result = await claimMatchOrQueue('c', deps);
    expect(result).toEqual({ type: 'queued' });
    expect(deps.addToQueue).toHaveBeenCalledWith('c');
    expect(deps.claimFromQueue).not.toHaveBeenCalled();
  });

  it('returns already_queued without re-inserting if the joiner is already queued', async () => {
    const deps = baseDeps({ listQueue: vi.fn().mockResolvedValue([{ id: 'c' }]) });
    const result = await claimMatchOrQueue('c', deps);
    expect(result).toEqual({ type: 'already_queued' });
    expect(deps.addToQueue).not.toHaveBeenCalled();
  });

  it('claims exactly the pre-existing members and returns matched when the claim succeeds in full', async () => {
    const deps = baseDeps({
      listQueue: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      claimFromQueue: vi.fn().mockResolvedValue(['a', 'b']),
    });
    const result = await claimMatchOrQueue('c', deps);
    expect(result).toEqual({ type: 'matched', members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    expect(deps.claimFromQueue).toHaveBeenCalledWith(['a', 'b']);
    expect(deps.addToQueue).not.toHaveBeenCalled();
  });

  it('retries with a fresh queue read when a concurrent request already claimed one of the members', async () => {
    const deps = baseDeps({
      listQueue: vi
        .fn()
        // First read: looks like a', 'b' are free -- but by the time we try
        // to claim them, someone else's concurrent match already took them.
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
        // Second read (after losing the race): queue is now empty.
        .mockResolvedValueOnce([]),
      claimFromQueue: vi.fn().mockResolvedValueOnce(['a']), // only 'a' was actually claimed, not 'b' -- partial claim
    });
    const result = await claimMatchOrQueue('c', deps);
    expect(result).toEqual({ type: 'queued' });
    expect(deps.listQueue).toHaveBeenCalledTimes(2);
    expect(deps.addToQueue).toHaveBeenCalledWith('c');
  });

  it('re-queues any pre-existing member it did manage to partially claim, so nobody is silently lost', async () => {
    // claimFromQueue(['a', 'b']) actually deletes 'a' from the table before
    // discovering 'b' was already gone -- 'a' is now genuinely removed from
    // the queue, whether or not THIS match attempt ultimately succeeds. If
    // the attempt is abandoned without putting 'a' back, that student
    // vanishes from matchmaking entirely: never seated in a room, never
    // re-queued, with nothing in any log to explain why.
    const deps = baseDeps({
      listQueue: vi.fn().mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]).mockResolvedValueOnce([]),
      claimFromQueue: vi.fn().mockResolvedValueOnce(['a']),
    });
    await claimMatchOrQueue('c', deps);
    expect(deps.addToQueue).toHaveBeenCalledWith('a');
  });

  it('matches immediately with no claim call when matchmake needs no pre-existing members', async () => {
    const deps = baseDeps({ minGroupSize: 1, listQueue: vi.fn().mockResolvedValue([]) });
    const result = await claimMatchOrQueue('c', deps);
    expect(result).toEqual({ type: 'matched', members: [{ id: 'c' }] });
    expect(deps.claimFromQueue).not.toHaveBeenCalled();
  });

  it('throws after exceeding max attempts under persistent contention', async () => {
    const deps = baseDeps({
      listQueue: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      claimFromQueue: vi.fn().mockResolvedValue(['a']), // always a partial claim -- never succeeds
      maxAttempts: 3,
    });
    await expect(claimMatchOrQueue('c', deps)).rejects.toThrow(/contention/i);
    expect(deps.listQueue).toHaveBeenCalledTimes(3);
  });
});
