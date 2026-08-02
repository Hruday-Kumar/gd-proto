// N3 (audit comparison, 2026-07-29): "There is currently no effective
// participant cap or abuse protection on room creation/join." A leaked
// room code otherwise let an unbounded number of participants join a
// single 'waiting' room via POST /api/rooms/join -- each seat costs a
// live LiveKit connection, a per-speaker AssemblyAI stream once the room
// starts (itself a rate-limited free-tier resource shared across every
// room, LESSONS.md), and a Gemini feedback call once it ends. Anchored to
// the same product-stated range PHASE1_PLAN.md §8 already established for
// matchmaking's group size (api/rooms.js's DEFAULT_MAX_GROUP_SIZE) --
// there's still no product-specific number for code/link rooms, so this
// reuses that same anchor rather than inventing a new one (guardrail #10).
export const DEFAULT_MAX_ROOM_PARTICIPANTS = 6;

export function isRoomFull(currentParticipantCount, maxParticipants = DEFAULT_MAX_ROOM_PARTICIPANTS) {
  return currentParticipantCount >= maxParticipants;
}

// BE-2 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0002): lets a room
// creator choose their own seat cap instead of always getting
// DEFAULT_MAX_ROOM_PARTICIPANTS. Same Number.isInteger-based validation
// shape as domain/roomDuration.js's isValidDurationSeconds -- rejects NaN,
// Infinity, non-numbers, fractions, and numeric strings alike, since the
// request body is attacker-controlled and coercing here would only move
// the failure later (into the DB's own CHECK constraint, migration 0014).
export const MIN_ROOM_PARTICIPANTS = 3;
export const MAX_ROOM_PARTICIPANTS = 12;

export function isValidMaxParticipants(value) {
  return Number.isInteger(value) && value >= MIN_ROOM_PARTICIPANTS && value <= MAX_ROOM_PARTICIPANTS;
}
