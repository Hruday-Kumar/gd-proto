-- W7 (Session history): fixes a real bug surfaced by the RLS isolation
-- test (test/historyRlsIsolation.test.js) -- querying `rooms` or
-- `room_participants` as an authenticated user (not the server's
-- service-role client, which bypasses RLS) throws
-- "infinite recursion detected in policy for relation room_participants".
--
-- Cause: `room_participants_select_fellow_participants` (0003) queries
-- room_participants from inside its own USING clause. Since RLS is
-- enabled on room_participants, evaluating that inner query re-triggers
-- the same policy, which queries room_participants again, forever.
-- `rooms_select_participant_or_creator` hits the same recursion
-- indirectly, since it also queries room_participants.
--
-- This had never been hit before this test: every existing app read of
-- these tables goes through the server's service-role client, which
-- bypasses RLS entirely (see 0004/0005's comments -- this was already the
-- documented, deliberate reason RLS alone wasn't relied on for the
-- server's own logic). It matters now because the whole point of RLS here
-- is defense-in-depth ("own history only" enforced by Postgres, not just
-- application code) -- and a policy that recurses infinitely instead of
-- denying isn't "secure by construction", it's broken.
--
-- Fix: a SECURITY DEFINER helper function. Its internal query runs as the
-- function's owner (the role that ran this migration), which owns the
-- table and is therefore exempt from its own RLS policies by default (no
-- FORCE ROW LEVEL SECURITY was ever set) -- so the internal lookup doesn't
-- re-trigger the policy, breaking the recursion.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create or replace function public.is_room_participant(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.room_participants rp
    where rp.room_id = p_room_id and rp.user_id = p_user_id
  );
$$;

drop policy if exists "rooms_select_participant_or_creator" on public.rooms;

create policy "rooms_select_participant_or_creator"
  on public.rooms for select
  using (
    auth.uid() = created_by
    or public.is_room_participant(rooms.id, auth.uid())
  );

drop policy if exists "room_participants_select_fellow_participants" on public.room_participants;

create policy "room_participants_select_fellow_participants"
  on public.room_participants for select
  using (
    public.is_room_participant(room_participants.room_id, auth.uid())
  );
