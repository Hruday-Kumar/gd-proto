-- N1 (audit comparison, 2026-07-29): a room's one feedback-generation
-- dispatch (agent/roomSweeper.js) had no retry and no persisted record of
-- whether it ever completed. If the process crashed/redeployed mid-call,
-- or Gemini returned an error for every participant (this happened for
-- real -- see PROGRESS.md's 2026-07-29 B7 entry, a dead Gemini service
-- account 401'd both participants of a real session), that room's
-- feedback was gone forever: `ended` rooms are dropped from
-- listLiveRooms() and nothing ever looked at them again.
--
-- These three columns let the sweeper find ended rooms still missing
-- feedback and retry them with backoff, bounded by attempt count and age
-- (domain/roomSweep.js's findRoomsReadyForFeedbackRetry). All nullable /
-- defaulted -- existing rows just start as "not yet generated, zero
-- attempts", which is the correct state for both a genuinely-incomplete
-- past room (it will now get picked up and retried, self-healing) and a
-- past room that already has complete feedback (the very next sweep tick
-- finds every participant already has a persisted row, marks
-- feedback_generated_at, and never touches it again).
--
-- Rollback: `alter table public.rooms drop column feedback_generated_at,
-- drop column feedback_attempts, drop column feedback_last_attempted_at;`
-- -- safe, no other table references these columns.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table public.rooms
  add column if not exists feedback_generated_at timestamptz,
  add column if not exists feedback_attempts integer not null default 0,
  add column if not exists feedback_last_attempted_at timestamptz;
