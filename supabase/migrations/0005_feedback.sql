-- W6 (Feedback generation): one written paragraph per student per room
-- (PHASE1_PLAN.md §4 data model). No numeric scores -- product doc fixes
-- the format as a plain paragraph, enforced by the prompt (domain/
-- feedbackPrompt.js), not by this schema.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  model text not null,
  generated_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists feedback_user_id_idx
  on public.feedback (user_id);

alter table public.feedback enable row level security;

-- A student can read only their own feedback (guardrail #4's "own history
-- only") -- never another participant's paragraph from the same room.
create policy "feedback_select_own"
  on public.feedback for select
  using (auth.uid() = user_id);

-- Inserted only by the server (service role key, from the feedback
-- generation worker), which bypasses RLS -- no authenticated-role insert
-- policy is needed or wanted; a student's own client never writes feedback.
