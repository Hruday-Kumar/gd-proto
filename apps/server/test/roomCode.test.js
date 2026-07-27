// Core logic test (W4): room codes are the shareable-link join path, so the
// format must be short, unambiguous when read aloud/typed, and collisions
// (however rare) must be retried rather than silently double-issued.
import { describe, it, expect } from 'vitest';
import { generateRoomCode, generateUniqueRoomCode, ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET } from '../src/domain/roomCode.js';

describe('generateRoomCode', () => {
  it('produces a code of the fixed length using only the allowed alphabet', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    for (const char of code) {
      expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });

  it('excludes visually ambiguous characters (0/O, 1/I/L)', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[0O1IL]/);
  });

  it('produces different codes across calls (not hardcoded)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('generateUniqueRoomCode', () => {
  it('returns a code immediately when it does not collide', async () => {
    const codeExists = async () => false;
    const code = await generateUniqueRoomCode(codeExists);
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it('retries on collision until it finds a free code', async () => {
    let calls = 0;
    const codeExists = async () => {
      calls += 1;
      return calls <= 2; // first two attempts collide, third is free
    };
    const code = await generateUniqueRoomCode(codeExists);
    expect(calls).toBe(3);
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it('throws after exhausting max attempts rather than looping forever', async () => {
    const codeExists = async () => true; // always collides
    await expect(generateUniqueRoomCode(codeExists, { maxAttempts: 5 })).rejects.toThrow(/attempts/i);
  });
});
