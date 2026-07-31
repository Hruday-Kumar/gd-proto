-- BE-3 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0003): room
-- visibility, public/private. POST /api/rooms's Public/Private radio group
-- had no server-side concept to bind to -- every room behaved like
-- 'private' (reachable only by code, match, or being its own creator).
-- visibility is now stored per room; nothing reads it yet (that's BE-1's
-- listing endpoint, a separate migration/spec).
--
-- Text + CHECK, not a Postgres enum type -- matches this table's existing
-- style for small closed sets (status, join_mode are also plain text
-- validated at the application/route level, not DB enum types).
--
-- NOT NULL DEFAULT 'private' backfills every existing row automatically,
-- same as 0014's max_participants -- no separate UPDATE needed.
--
-- This is defence in depth, not the primary check: the server writes rooms
-- with the service-role key, which bypasses RLS but NOT check constraints.
-- Bounds deliberately match domain/roomVisibility.js's VALID_VISIBILITIES
-- exactly.
alter table public.rooms
  add column visibility text not null default 'private';

alter table public.rooms
  add constraint rooms_visibility_allowed_values
  check (visibility in ('public', 'private'));
