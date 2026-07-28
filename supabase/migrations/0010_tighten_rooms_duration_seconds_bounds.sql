-- Tighten rooms.duration_seconds' max bound, 60 min -> 25 min (2026-07-28,
-- direct user request). 0009's 60-minute ceiling was sized only to rule out
-- H3's int32-overflow/runaway-timer bug, not to express an actual product
-- limit -- a GD Arena practice round was never meant to run half an hour or
-- more. apps/server/src/domain/roomDuration.js's MAX_DURATION_SECONDS is now
-- 25*60 = 1500; this brings the schema's check constraint back in sync with
-- it, same defence-in-depth reasoning as 0009 (the server writes with the
-- service-role key, which bypasses RLS but not check constraints).

-- Same reasoning as 0009: clamp any existing row outside the new bound
-- first rather than have the constraint fail to validate. At this project's
-- pilot scale, any row between 1500 and 3600 seconds would only be a
-- previously-created test/dev room, not real student history worth
-- preserving exactly.
update public.rooms set duration_seconds = 1500 where duration_seconds > 1500;

alter table public.rooms
  drop constraint if exists rooms_duration_seconds_bounds;

alter table public.rooms
  add constraint rooms_duration_seconds_bounds
  check (duration_seconds between 60 and 1500);
