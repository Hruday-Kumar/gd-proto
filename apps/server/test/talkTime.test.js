// BE-10 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0007): pure
// aggregation of transcript_lines rows into a per-participant share of
// total attributed speaking time. Kept pure/storage-agnostic, same reason
// domain/sessionHistory.js and domain/roomListing.js are.
import { describe, it, expect } from 'vitest';
import { computeTalkTimeShares, computeMyTalkShareByRoom } from '../src/domain/talkTime.js';

function line(userId, startedAtMs, endedAtMs, roomId = 'r1') {
  return { room_id: roomId, user_id: userId, started_at_ms: startedAtMs, ended_at_ms: endedAtMs };
}

describe('computeTalkTimeShares', () => {
  it('splits share proportionally to speaking duration', () => {
    // 'a' speaks 2000ms total, 'b' speaks 1000ms total -- a 2:1 ratio.
    const lines = [line('a', 0, 1000), line('a', 1000, 2000), line('b', 2000, 3000)];
    const shares = computeTalkTimeShares(lines, ['a', 'b']);
    expect(shares.get('a')).toBe(67);
    expect(shares.get('b')).toBe(33);
  });

  it('gives one participant 100% when they are the only speaker', () => {
    const lines = [line('a', 0, 5000)];
    const shares = computeTalkTimeShares(lines, ['a', 'b']);
    expect(shares.get('a')).toBe(100);
    expect(shares.get('b')).toBe(0);
  });

  it('returns 0 for every participant when there are no transcript lines', () => {
    const shares = computeTalkTimeShares([], ['a', 'b', 'c']);
    expect(shares.get('a')).toBe(0);
    expect(shares.get('b')).toBe(0);
    expect(shares.get('c')).toBe(0);
  });

  it('gives every listed participant an explicit entry even if they never spoke', () => {
    const lines = [line('a', 0, 1000)];
    const shares = computeTalkTimeShares(lines, ['a', 'b']);
    expect(shares.has('b')).toBe(true);
    expect(shares.get('b')).toBe(0);
  });

  // R3 (SPEC-0007): a stray line attributed to someone not currently
  // listed as a participant must not affect anyone else's share -- this
  // shouldn't happen given domain/attribution.js's guarantees, but the
  // aggregation itself should be defensive regardless.
  it('ignores a transcript line for a user not in the participant list', () => {
    const lines = [line('a', 0, 1000), line('ghost', 0, 9000)];
    const shares = computeTalkTimeShares(lines, ['a']);
    expect(shares.get('a')).toBe(100);
    expect(shares.has('ghost')).toBe(false);
  });

  it('treats an out-of-order or zero-length line as zero duration, never negative', () => {
    const lines = [line('a', 1000, 1000), line('b', 5000, 1000)];
    const shares = computeTalkTimeShares(lines, ['a', 'b']);
    expect(shares.get('a')).toBe(0);
    expect(shares.get('b')).toBe(0);
  });
});

// BE-9 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0009): GET
// /api/history/mine's per-session "my own talk share" -- a flat,
// multi-room line list (one batched query, not one per room) grouped and
// reduced to a single caller-scoped percentage per room.
describe('computeMyTalkShareByRoom', () => {
  it('computes the given user\'s share per room from a flat multi-room line list', () => {
    const lines = [
      line('me', 0, 2000, 'room-1'),
      line('other', 2000, 3000, 'room-1'),
      line('me', 0, 1000, 'room-2'),
      line('other', 1000, 4000, 'room-2'),
    ];
    const shares = computeMyTalkShareByRoom(lines, 'me');
    expect(shares.get('room-1')).toBe(67);
    expect(shares.get('room-2')).toBe(25);
  });

  it('gives the caller an explicit 0, not an absence, for a room where they never spoke', () => {
    const lines = [line('other', 0, 1000, 'room-1')];
    const shares = computeMyTalkShareByRoom(lines, 'me');
    expect(shares.get('room-1')).toBe(0);
  });

  it('has no entry at all for a room with zero transcript lines', () => {
    const lines = [line('me', 0, 1000, 'room-1')];
    const shares = computeMyTalkShareByRoom(lines, 'me');
    expect(shares.has('room-2')).toBe(false);
  });

  it('returns an empty map for an empty line list', () => {
    const shares = computeMyTalkShareByRoom([], 'me');
    expect(shares.size).toBe(0);
  });
});
