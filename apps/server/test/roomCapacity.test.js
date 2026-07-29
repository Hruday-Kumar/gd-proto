// N3 (audit comparison, 2026-07-29): "There is currently no effective
// participant cap or abuse protection on room creation/join." A leaked
// room code let an unbounded number of participants join a single
// 'waiting' room via POST /api/rooms/join -- each seat costs a live
// LiveKit connection, a per-speaker AssemblyAI stream once the room
// starts, and a Gemini feedback call once it ends. This is the pure
// decision behind the cap: given how many participants a room already
// has, is there room for one more. Kept pure (no DB) for the same reason
// domain/roomDuration.js and domain/matchmaking.js are.
import { describe, it, expect } from 'vitest';
import { isRoomFull, DEFAULT_MAX_ROOM_PARTICIPANTS } from '../src/domain/roomCapacity.js';

describe('isRoomFull', () => {
  it('is not full below the cap', () => {
    expect(isRoomFull(DEFAULT_MAX_ROOM_PARTICIPANTS - 1)).toBe(false);
  });

  it('is full once the count reaches the cap', () => {
    expect(isRoomFull(DEFAULT_MAX_ROOM_PARTICIPANTS)).toBe(true);
  });

  it('is full past the cap', () => {
    expect(isRoomFull(DEFAULT_MAX_ROOM_PARTICIPANTS + 1)).toBe(true);
  });

  it('is not full for an empty room', () => {
    expect(isRoomFull(0)).toBe(false);
  });

  it('respects an overridden cap', () => {
    expect(isRoomFull(2, 3)).toBe(false);
    expect(isRoomFull(3, 3)).toBe(true);
  });
});
