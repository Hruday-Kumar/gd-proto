// Supabase queries for the rooms table (W4). Same injectable-client
// pattern as db/consents.js / db/topics.js.
import { getSupabase } from './supabase.js';

export async function roomCodeExists(code, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase.from('rooms').select('id').eq('code', code).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function insertRoom({ code, topicId, durationSeconds, joinMode, createdBy }, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      code,
      topic_id: topicId,
      duration_seconds: durationSeconds,
      join_mode: joinMode,
      created_by: createdBy,
    })
    .select('id, code, status, topic_id, duration_seconds, started_at, ends_at, ended_at, created_by')
    .single();
  if (error) throw error;
  return data;
}

export async function getRoomByCode(code, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, status, topic_id, duration_seconds, started_at, ends_at, ended_at, created_by')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// topics(text) is embedded via the topic_id foreign key (same PostgREST
// relationship listRoomsByIds uses) so the lobby's status poll can show the
// topic heading without a second query per poll.
export async function getRoomById(id, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, status, topic_id, duration_seconds, started_at, ends_at, ended_at, created_by, topics(text)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// M9 (audit 2026-07-28): matches roomParticipants.js's listRoomIdsForUser
// cap -- defensive ceiling on a single student's session history, not
// expected to bind in practice at pilot scale.
const MAX_HISTORY_ROOMS = 200;

// W7 session history: every room from a set of ids, newest first, with
// each room's topic text embedded via the topic_id foreign key (PostgREST
// resolves the rooms->topics relationship automatically) rather than a
// separate per-room lookup.
export async function listRoomsByIds(ids, { supabase = getSupabase() } = {}) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, status, duration_seconds, started_at, ends_at, ended_at, created_at, topics(text)')
    .in('id', ids)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_ROOMS);
  if (error) throw error;
  return data;
}

// Every room the database still considers in progress. Read once at boot
// (H2, audit 2026-07-28) so a process restart can re-attach a transcription
// agent to sessions that are still running -- the in-memory activeRooms map
// in agent/roomAgent.js does not survive a deploy, sleep, or crash.
export async function listLiveRooms({ supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, status, duration_seconds, started_at, ends_at')
    .eq('status', 'live');
  if (error) throw error;
  return data ?? [];
}

// `expectedStatus` makes the write a *claim* rather than a blind update: the
// row is only changed if it's still in the status the caller decided from
// (C3, audit 2026-07-28). Postgres evaluates that predicate atomically, so
// exactly one of several concurrent callers can win -- which is what stops
// every participant polling an expired room from each dispatching its own
// feedback run. Returns the updated row, or null when the precondition
// didn't match (someone else got there first). Without expectedStatus this
// behaves exactly as before -- an unconditional update that throws if the
// row is missing -- which is what POST /api/rooms/:id/start relies on.
export async function updateRoomStatus(
  id,
  { status, startedAt, endsAt, endedAt, expectedStatus },
  { supabase = getSupabase() } = {}
) {
  const patch = { status };
  if (startedAt) patch.started_at = startedAt;
  if (endsAt) patch.ends_at = endsAt;
  if (endedAt) patch.ended_at = endedAt;

  let query = supabase.from('rooms').update(patch).eq('id', id);
  if (expectedStatus) query = query.eq('status', expectedStatus);

  // maybeSingle, not single, when there's a precondition: matching no row is
  // the expected "someone else already did this" outcome, not an error.
  const { data, error } = expectedStatus ? await query.select().maybeSingle() : await query.select().single();
  if (error) throw error;
  return data;
}
