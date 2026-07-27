-- W5 (Live room + transcription + attribution): per-speaker transcript
-- lines, attributed via room_participants.user_id (PHASE1_PLAN.md §4 data
-- model). No audio table by design (§3b) -- raw audio is streamed straight
-- from the LiveKit track into AssemblyAI and never persisted anywhere.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.transcript_lines (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  started_at_ms bigint not null,
  ended_at_ms bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists transcript_lines_room_id_idx
  on public.transcript_lines (room_id);

alter table public.transcript_lines enable row level security;

-- A student can read only their own attributed lines (guardrail #4's "own
-- history only"), not the rest of the room's transcript. Feedback
-- generation (W6) needs the whole room's lines to judge things like "did
-- they let others speak" -- that read happens server-side via the service
-- role key, which bypasses RLS entirely, so this policy only constrains
-- direct client access.
create policy "transcript_lines_select_own"
  on public.transcript_lines for select
  using (auth.uid() = user_id);

-- Inserted only by the server (service role key, from the agent worker),
-- which bypasses RLS -- no authenticated-role insert policy is needed or
-- wanted here; a student's own client should never write a transcript line.
