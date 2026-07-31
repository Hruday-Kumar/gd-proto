// Supabase queries for the room_participants table (W4).
import { getSupabase } from './supabase.js';

// Idempotent on a duplicate join: the table has a unique(room_id, user_id)
// constraint (Postgres code 23505), so rejoining a room a student is
// already in is a no-op rather than an error -- callers (the join and
// match routes) don't need to special-case "already a participant".
export async function addParticipant(roomId, userId, livekitIdentity, { supabase = getSupabase() } = {}) {
  const { error } = await supabase
    .from('room_participants')
    .insert({ room_id: roomId, user_id: userId, livekit_identity: livekitIdentity });
  if (error && error.code !== '23505') throw error;
}

// N3 (audit comparison, 2026-07-29): backs out a seat the capacity check
// in api/rooms.js optimistically inserted, if a concurrent joiner won the
// race for the room's last spot -- see that route for the full contract.
export async function removeParticipant(roomId, userId, { supabase = getSupabase() } = {}) {
  const { error } = await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', userId);
  if (error) throw error;
}

// N5 (audit comparison, 2026-07-29): M9 named the unbounded-read class but
// missed this call site. Room size is capped going forward at
// DEFAULT_MAX_ROOM_PARTICIPANTS (domain/roomCapacity.js), but that's a
// best-effort application-level guard, not a schema constraint -- this
// ceiling is generous headroom above it, not a duplicate of it, so a rare
// concurrent-join overage or a historical pre-cap room still returns
// every real participant. Earliest-joined-first: if a room somehow has
// more than the ceiling, keeping the first (legitimately seated) joiners
// is more correct than an arbitrary cutoff.
const MAX_ROOM_PARTICIPANTS_QUERY = 50;

export async function listParticipants(roomId, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('room_participants')
    .select('user_id, livekit_identity, joined_at')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })
    .limit(MAX_ROOM_PARTICIPANTS_QUERY);
  if (error) throw error;
  return data;
}

// Gate for the LiveKit token-mint route (W5): only someone already seated
// in the room (creator or joiner) may get a token to join its audio room.
export async function isParticipant(roomId, userId, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('room_participants')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// M9 (audit 2026-07-28): caps how many past rooms feed a single
// /api/history/mine call. A student's session history is what this bounds,
// not any cross-student total, so this is generous relative to how many GD
// rounds any one student could realistically attend during a pilot.
const MAX_HISTORY_ROOMS = 200;

// Every room a student has ever been seated in (W7 session history) --
// unlike getActiveRoomForUser below, includes ended rooms and isn't
// limited to one result. Ordered newest-joined-first then capped so a
// heavy user's history can't grow the query without bound (M9); the order
// itself doesn't need to survive downstream -- listRoomsByIds re-sorts by
// created_at itself.
export async function listRoomIdsForUser(userId, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(MAX_HISTORY_ROOMS);
  if (error) throw error;
  return (data ?? []).map((row) => row.room_id);
}

// BE-1 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0004): batched
// sibling of listParticipants above -- one query for every open room's
// participants, not one query per room (which is what a naive per-room
// listParticipants() loop would cost the open-rooms listing endpoint).
// The number of room ids passed in is already bounded (MAX_OPEN_ROOMS,
// db/rooms.js) at the only call site today, but M9/N5's own lesson here is
// not to rely on an upstream caller's bound as the only protection -- this
// query gets its own explicit ceiling too, generous headroom above
// MAX_OPEN_ROOMS * a realistic max room size, not a duplicate of either.
const MAX_PARTICIPANT_ROWS_FOR_ROOMS_QUERY = 1000;

export async function listParticipantsForRooms(roomIds, { supabase = getSupabase() } = {}) {
  if (!roomIds.length) return [];
  const { data, error } = await supabase
    .from('room_participants')
    .select('room_id, user_id')
    .in('room_id', roomIds)
    .limit(MAX_PARTICIPANT_ROWS_FOR_ROOMS_QUERY);
  if (error) throw error;
  return data ?? [];
}

// The student's most recent non-ended room, if any -- lets a queued
// student (or anyone else) discover a room they're already seated in
// without needing to know its id or code up front. Two queries rather
// than a single joined one: simpler to read and correct at the pilot
// scale where a student is in very few rooms at once.
export async function getActiveRoomForUser(userId, { supabase = getSupabase() } = {}) {
  // N5 (audit comparison, 2026-07-29): unbounded, and this is polled every
  // 4s throughout queueing -- an ever-growing IN-list for a heavy user.
  // Reuses listRoomIdsForUser's own MAX_HISTORY_ROOMS ceiling just above;
  // only the most recent rooms matter for finding an *active* one anyway.
  const { data: rawParticipantRows, error: participantError } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(MAX_HISTORY_ROOMS);
  if (participantError) throw participantError;
  const participantRows = rawParticipantRows ?? [];
  if (!participantRows.length) return null;

  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, status, created_at')
    .in(
      'id',
      participantRows.map((row) => row.room_id)
    )
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
