-- H3 (engineering audit, 2026-07-28): bound rooms.duration_seconds in the
-- schema as well as in the route.
--
-- POST /api/rooms and POST /api/rooms/match now reject anything outside
-- 60-3600 seconds (apps/server/src/domain/roomDuration.js), but the column
-- itself accepted any integer. An out-of-range duration is not a cosmetic
-- problem: ends_at lands far enough in the future that isTimerExpired() never
-- fires, so the room stays 'live' forever and feedback is never dispatched,
-- and the transcription agent's stop timer -- setTimeout(duration * 1000) --
-- overflows int32 and fires at 1ms, disconnecting the transcriber straight
-- away. The session then runs indefinitely with no transcript.
--
-- This is defence in depth, not the primary fix: the server writes rooms with
-- the service-role key, which bypasses RLS but NOT check constraints, so this
-- is the last line that holds even if another write path is added later.
-- Bounds deliberately match domain/roomDuration.js exactly.

-- Any existing row outside the bounds would make the constraint fail to
-- validate. Nothing in the UI could ever have produced one (the picker only
-- offers 5/10/15/20 minutes) but a hand-crafted request could have, so clamp
-- first rather than have the migration abort.
update public.rooms set duration_seconds = 60 where duration_seconds < 60;
update public.rooms set duration_seconds = 3600 where duration_seconds > 3600;

alter table public.rooms
  drop constraint if exists rooms_duration_seconds_bounds;

alter table public.rooms
  add constraint rooms_duration_seconds_bounds
  check (duration_seconds between 60 and 3600);
