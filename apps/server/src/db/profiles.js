// Supabase queries for the profiles table (W2). New in W6: feedback
// generation needs every participant's display name to attribute the
// transcript by name in the prompt (domain/feedbackPrompt.js), not just by
// user_id.
import { getSupabase } from './supabase.js';

export async function listProfiles(userIds, { supabase = getSupabase() } = {}) {
  if (!userIds.length) return [];
  const { data, error } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
  if (error) throw error;
  return data;
}
