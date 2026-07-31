// BE-3 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0003): lets a room
// creator mark a room public or private. Text + a closed-set check, not a
// Postgres enum type or a boolean -- matches this schema's existing style
// for small closed sets (rooms.status, rooms.join_mode are also plain text
// validated at the application/route level, not DB enum types).
export const VALID_VISIBILITIES = ['public', 'private'];
export const DEFAULT_VISIBILITY = 'private';

export function isValidVisibility(value) {
  return VALID_VISIBILITIES.includes(value);
}
