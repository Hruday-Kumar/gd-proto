// BE-4 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0005): lets a room
// creator pick a level at creation time. Text + a closed-set check, same
// style as domain/roomVisibility.js -- matches rooms.status/join_mode's
// existing style, not a DB enum type.
//
// Room-creation half only -- POST /api/rooms/match deliberately never
// passes this (SPEC-0005's Non Goals); match-side level filtering is
// deferred to fold in alongside BE-5.
export const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];
export const DEFAULT_LEVEL = 'intermediate';

export function isValidLevel(value) {
  return VALID_LEVELS.includes(value);
}
