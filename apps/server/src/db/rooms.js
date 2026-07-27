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
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateRoomStatus(id, { status, startedAt, endsAt, endedAt }, { supabase = getSupabase() } = {}) {
  const patch = { status };
  if (startedAt) patch.started_at = startedAt;
  if (endsAt) patch.ends_at = endsAt;
  if (endedAt) patch.ended_at = endedAt;
  const { data, error } = await supabase.from('rooms').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
