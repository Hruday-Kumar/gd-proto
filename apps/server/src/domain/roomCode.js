// Room code generation (W4). Shareable-link join path (§5 W4 core unit).
// Excludes 0/O/1/I/L so a code read aloud or typed from memory isn't
// misheard/mistyped into a different, possibly real, code.
import { randomInt } from 'node:crypto';

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

// codeExists(code) => Promise<boolean>. Caller supplies the DB lookup so
// this stays testable without a live database.
export async function generateUniqueRoomCode(codeExists, { maxAttempts = 10 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateRoomCode();
    if (!(await codeExists(code))) return code;
  }
  throw new Error(`Could not generate a unique room code after ${maxAttempts} attempts`);
}
