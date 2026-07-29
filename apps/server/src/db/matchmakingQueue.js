// Supabase queries for the matchmaking_queue table (W4, PHASE1_PLAN.md §8
// decision: DB-backed so the queue survives a Render free-tier restart).
// Returns/accepts the {id: userId} shape matchmake() expects, so the API
// layer can pass a fetched queue straight into the pure domain function.
import { getSupabase } from './supabase.js';

// M9 (audit 2026-07-28): a defensive ceiling, not an expected limit at pilot
// scale (~20-30 concurrent students, so realistically dozens queued at
// once at most). Bounds the worst case if queue-draining ever breaks and
// rows pile up, without changing matchmake()'s FIFO semantics -- the
// oldest-joined rows are still exactly the ones kept.
const MAX_QUEUE_ROWS = 500;

export async function listQueue({ supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('matchmaking_queue')
    .select('user_id')
    .order('joined_at', { ascending: true })
    .limit(MAX_QUEUE_ROWS);
  if (error) throw error;
  return data.map((row) => ({ id: row.user_id }));
}

export async function addToQueue(userId, { supabase = getSupabase() } = {}) {
  const { error } = await supabase.from('matchmaking_queue').insert({ user_id: userId });
  if (error) throw error;
}

export async function removeFromQueue(userIds, { supabase = getSupabase() } = {}) {
  const { error } = await supabase.from('matchmaking_queue').delete().in('user_id', userIds);
  if (error) throw error;
}

// H7 (audit 2026-07-28): atomic claim for claimMatchOrQueue
// (domain/matchmakingClaim.js). Unlike removeFromQueue above, this reports
// which ids were actually deleted -- Postgres serializes concurrent deletes
// row-by-row, so if another request already claimed one of these ids for a
// different match, it's simply absent from RETURNING rather than erroring.
// The caller compares the returned ids against what it asked for to detect
// a lost race.
export async function claimFromQueue(userIds, { supabase = getSupabase() } = {}) {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.from('matchmaking_queue').delete().in('user_id', userIds).select('user_id');
  if (error) throw error;
  return data.map((row) => row.user_id);
}
