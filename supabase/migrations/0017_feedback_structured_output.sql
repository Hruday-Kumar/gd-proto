-- SPEC-0006 (BE-6/BE-7, place-me-UI/docs/BACKEND_REQUIREMENTS.md): feedback
-- generation moved from a single plain paragraph to structured output --
-- an overall 0-100 score, a fixed 5-dimension rubric, and strengths/
-- improvements lists -- so place-me-UI's already-built ScoreRing/ScoreBar/
-- FeedbackList UI can render real data instead of fixtures. `body` is
-- unchanged (still the prose summary); this only adds columns.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table public.feedback
  add column if not exists score integer,
  add column if not exists dimensions jsonb not null default '[]',
  add column if not exists strengths jsonb not null default '[]',
  add column if not exists improvements jsonb not null default '[]';

alter table public.feedback
  drop constraint if exists feedback_score_range;

alter table public.feedback
  add constraint feedback_score_range check (score is null or (score between 0 and 100));

-- No RLS policy change: feedback has no client-writable policy today
-- (0005_feedback.sql's "feedback_select_own" is still the only one) and
-- these columns don't need one either -- written only by the server
-- (service role) from the feedback generation worker, same as `body`.
