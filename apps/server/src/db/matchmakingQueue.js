// Supabase queries for the matchmaking_queue table (W4, PHASE1_PLAN.md §8
// decision: DB-backed so the queue survives a Render free-tier restart).
// Returns/accepts the {id: userId} shape matchmake() expects, so the API
// layer can pass a fetched queue straight into the pure domain function.
import { getSupabase } from './supabase.js';

export async function listQueue({ supabase = getSupabase() } = {}) {
  const { data, error } = await supabase.from('matchmaking_queue').select('user_id').order('joined_at', { ascending: true });
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
