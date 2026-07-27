// Core logic test (W4): the matchmaking decision, kept pure so it's testable
// without a live queue (storage is a separate, later concern — see
// PHASE1_PLAN.md §5 W4 and §8 open decision on queue storage). Group-size
// thresholds are caller-supplied, not hardcoded here — the actual numbers
// are a product decision for whoever wires up persistence, not invented in
// domain logic (guardrail #10).
import { describe, it, expect } from 'vitest';
import { matchmake } from '../src/domain/matchmaking.js';

describe('matchmake', () => {
  it('queues the joiner when the group is still below minGroupSize', () => {
    const result = matchmake([], { id: 'a' }, { minGroupSize: 3, maxGroupSize: 5 });
    expect(result).toEqual({ type: 'queued', queue: [{ id: 'a' }] });
  });

  it('forms a room once minGroupSize is reached, taking all candidates if under maxGroupSize', () => {
    const queue = [{ id: 'a' }, { id: 'b' }];
    const result = matchmake(queue, { id: 'c' }, { minGroupSize: 3, maxGroupSize: 5 });
    expect(result).toEqual({
      type: 'matched',
      members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      remainingQueue: [],
    });
  });

  it('caps the matched group at maxGroupSize, keeping the rest queued (FIFO)', () => {
    const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
    const result = matchmake(queue, { id: 'f' }, { minGroupSize: 3, maxGroupSize: 4 });
    expect(result).toEqual({
      type: 'matched',
      members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      remainingQueue: [{ id: 'e' }, { id: 'f' }],
    });
  });

  it('throws if the joiner is already in the queue', () => {
    const queue = [{ id: 'a' }];
    expect(() => matchmake(queue, { id: 'a' }, { minGroupSize: 3, maxGroupSize: 5 })).toThrow(/already/i);
  });

  it('throws on an invalid group-size configuration (max < min)', () => {
    expect(() => matchmake([], { id: 'a' }, { minGroupSize: 5, maxGroupSize: 3 })).toThrow(/group size/i);
  });
});
