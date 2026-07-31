-- BE-2 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0002): configurable
-- room capacity. POST /api/rooms previously always seated every room
-- against a single global constant (DEFAULT_MAX_ROOM_PARTICIPANTS,
-- apps/server/src/domain/roomCapacity.js) -- the UI's "Seats" picker had no
-- way to actually take effect. max_participants is now stored per room and
-- read back by the join-capacity check (POST /api/rooms/join) instead of
-- the constant.
--
-- NOT NULL DEFAULT 6 backfills every existing row automatically (Postgres
-- applies the DEFAULT to existing rows when adding a NOT NULL column with
-- one) -- no separate UPDATE needed first, unlike 0009's duration-bounds
-- migration which altered an already-populated, unconstrained column.
--
-- This is defence in depth, not the primary check: the server writes rooms
-- with the service-role key, which bypasses RLS but NOT check constraints,
-- so this is the last line that holds even if another write path is added
-- later. Bounds deliberately match domain/roomCapacity.js's
-- isValidMaxParticipants exactly (3-12).
alter table public.rooms
  add column max_participants integer not null default 6;

alter table public.rooms
  add constraint rooms_max_participants_bounds
  check (max_participants between 3 and 12);
