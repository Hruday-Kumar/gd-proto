// Supabase queries for the topics table (W4). Callers can inject a
// supabase client for testing, same pattern as db/consents.js.
import { getSupabase } from './supabase.js';

export async function insertCustomTopic(userId, { text, category, difficulty }, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('topics')
    .insert({ text, category, difficulty, source: 'custom', created_by: userId })
    .select('id, text, category, difficulty, source, created_at')
    .single();
  if (error) throw error;
  return data;
}

// Inserted with no created_by -- this goes through the server's service
// role client, so it bypasses the RLS policy that would otherwise require
// auth.uid() = created_by for a direct client insert.
export async function insertGeneratedTopic({ text, category, difficulty }, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('topics')
    .insert({ text, category, difficulty, source: 'llm', created_by: null })
    .select('id, text, category, difficulty, source, created_at')
    .single();
  if (error) throw error;
  return data;
}

// Used by W6 feedback generation to give the model the session's topic as
// context.
export async function getTopicById(id, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase.from('topics').select('id, text').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
