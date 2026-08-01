-- BE-4 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0005): room
-- level/difficulty, room-creation half only. POST /api/rooms's Level
-- select had no server-side concept to bind to. level is now stored per
-- room; POST /api/rooms/match deliberately never sets it (match-side
-- level filtering is deferred, to fold in alongside BE-5 -- see the spec).
--
-- Text + CHECK, not a Postgres enum type -- matches this table's existing
-- style for small closed sets (status, join_mode, visibility are also
-- plain text validated at the application/route level, not DB enum
-- types).
--
-- NOT NULL DEFAULT 'intermediate' backfills every existing row
-- automatically, same as 0014/0015 -- no separate UPDATE needed.
--
-- This is defence in depth, not the primary check: the server writes
-- rooms with the service-role key, which bypasses RLS but NOT check
-- constraints. Bounds deliberately match domain/roomLevel.js's
-- VALID_LEVELS exactly.
alter table public.rooms
  add column level text not null default 'intermediate';

alter table public.rooms
  add constraint rooms_level_allowed_values
  check (level in ('beginner', 'intermediate', 'advanced'));
