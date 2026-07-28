-- H8 (engineering audit, 2026-07-28): drop the client-facing INSERT policy
-- on room_participants.
--
-- "room_participants_insert_self" (0003) only checked auth.uid() = user_id
-- -- proof of self-identity, not of room membership or invitation. Any
-- authenticated student holding a valid Supabase access token could call
-- PostgREST directly and seat themselves into ANY room's participant list,
-- joining a live discussion nobody invited them to.
--
-- Every real seat is written by the server's service-role client
-- (apps/server/src/db/roomParticipants.js's addParticipant, called from the
-- join/match routes), which bypasses RLS entirely -- policies on this table
-- only ever governed direct client access, which the app itself never uses
-- (confirmed: no apps/web code references room_participants). Dropping the
-- policy removes an attack surface with zero effect on the app; with no
-- INSERT policy left for `authenticated`, RLS defaults to deny.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

drop policy if exists "room_participants_insert_self" on public.room_participants;
