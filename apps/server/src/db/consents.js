// Supabase queries for the consents table (W3, guardrail #3). Callers can
// inject a supabase client for testing; production code goes through
// getSupabase()'s lazy singleton like every other db/ module.
import { getSupabase } from './supabase.js';

export async function getLatestConsent(userId, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('consents')
    .select('consent_version, granted_at')
    .eq('user_id', userId)
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function recordConsent(userId, consentVersion, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('consents')
    .insert({ user_id: userId, consent_version: consentVersion })
    .select('consent_version, granted_at')
    .single();
  if (error) throw error;
  return data;
}
