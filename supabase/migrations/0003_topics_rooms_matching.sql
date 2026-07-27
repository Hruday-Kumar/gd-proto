-- W4 (Topics + rooms + matching): topics, rooms, room participants, and a
-- DB-backed matchmaking queue (PHASE1_PLAN.md §4 data model + §8 decision,
-- 2026-07-26 -- DB-backed chosen over in-memory so the queue survives a
-- Render free-tier restart/sleep, PHASE1_PLAN.md §3a).
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text,
  difficulty text,
  source text not null check (source in ('llm', 'custom')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.topics enable row level security;

-- Topics aren't personal data -- any authenticated student can browse them
-- to pick one for a room.
create policy "topics_select_authenticated"
  on public.topics for select
  to authenticated
  using (true);

-- A student can only directly insert their own custom topics; LLM-generated
-- topics are inserted by the server via the service role key (bypasses RLS).
create policy "topics_insert_own_custom"
  on public.topics for insert
  with check (source = 'custom' and auth.uid() = created_by);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  topic_id uuid not null references public.topics (id),
  duration_seconds integer not null,
  status text not null default 'waiting' check (status in ('waiting', 'live', 'ended')),
  join_mode text not null check (join_mode in ('code', 'random')),
  created_by uuid not null references auth.users (id),
  started_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "rooms_insert_own"
  on public.rooms for insert
  with check (auth.uid() = created_by);

create table if not exists public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  livekit_identity text not null,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists room_participants_room_id_idx
  on public.room_participants (room_id);

alter table public.room_participants enable row level security;

-- A student can see a room once they created it or joined it -- not any
-- room in the system (guardrail #4's "own history" spirit, applied to
-- rooms even though they're inherently multi-user). Defined here, after
-- room_participants exists, since CREATE POLICY resolves the tables its
-- USING clause references immediately -- unlike a plain function body,
-- it can't forward-reference a table that doesn't exist yet.
create policy "rooms_select_participant_or_creator"
  on public.rooms for select
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.room_participants rp
      where rp.room_id = rooms.id and rp.user_id = auth.uid()
    )
  );

-- A student can see the participant list only for rooms they're themselves
-- a participant in (not any room's participants).
create policy "room_participants_select_fellow_participants"
  on public.room_participants for select
  using (
    exists (
      select 1 from public.room_participants rp2
      where rp2.room_id = room_participants.room_id and rp2.user_id = auth.uid()
    )
  );

create policy "room_participants_insert_self"
  on public.room_participants for insert
  with check (auth.uid() = user_id);

-- Matchmaking queue (§8 decision): one row per waiting student, FIFO by
-- joined_at. A student can only be queued once -- unique(user_id).
create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now()
);

create index if not exists matchmaking_queue_joined_at_idx
  on public.matchmaking_queue (joined_at);

alter table public.matchmaking_queue enable row level security;

create policy "matchmaking_queue_select_own"
  on public.matchmaking_queue for select
  using (auth.uid() = user_id);

create policy "matchmaking_queue_insert_own"
  on public.matchmaking_queue for insert
  with check (auth.uid() = user_id);

-- A student can leave the queue voluntarily before being matched.
create policy "matchmaking_queue_delete_own"
  on public.matchmaking_queue for delete
  using (auth.uid() = user_id);
