-- S1 (pilot-readiness audit): the pilot's only evidence that feedback is
-- actually useful is one founder's opinion. A lightweight thumbs up/down +
-- one-line "why" on a student's own feedback gives real signal cheaply.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table public.feedback
  add column if not exists rating boolean,
  add column if not exists rating_reason text;

-- No new RLS policy needed: feedback has no client-writable policy at all
-- today (only "select own"), and that stays true here -- ratings are
-- written by the server (service role) after it verifies req.userId owns
-- the feedback row, same pattern as every other write in this app
-- (see api/rooms.js). A client-side update policy would let a student
-- rewrite their own feedback body too, not just the rating.
