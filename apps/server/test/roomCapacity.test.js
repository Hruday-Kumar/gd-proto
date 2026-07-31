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
import {
  isRoomFull,
  isValidMaxParticipants,
  DEFAULT_MAX_ROOM_PARTICIPANTS,
  MIN_ROOM_PARTICIPANTS,
  MAX_ROOM_PARTICIPANTS,
} from '../src/domain/roomCapacity.js';

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

// BE-2 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0002): the room
// creator's chosen seat cap needs the same bounds-checking treatment
// domain/roomDuration.js's isValidDurationSeconds already gives
// durationSeconds -- an attacker-controlled request body, not just the UI
// picker, is the real boundary.
describe('isValidMaxParticipants', () => {
  it('accepts the bounds themselves', () => {
    expect(isValidMaxParticipants(MIN_ROOM_PARTICIPANTS)).toBe(true);
    expect(isValidMaxParticipants(MAX_ROOM_PARTICIPANTS)).toBe(true);
  });

  it('accepts a value between the bounds', () => {
    expect(isValidMaxParticipants(6)).toBe(true);
  });

  it.each([
    ['below the minimum', MIN_ROOM_PARTICIPANTS - 1],
    ['above the maximum', MAX_ROOM_PARTICIPANTS + 1],
    ['zero', 0],
    ['negative', -1],
    ['fractional', 4.5],
    ['a numeric string', '6'],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('rejects %s', (_label, value) => {
    expect(isValidMaxParticipants(value)).toBe(false);
  });
});
