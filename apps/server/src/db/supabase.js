// Supabase client wiring (ADR-0003/0004). Queries live in this folder as
// they're built (starting W2) — this file only constructs the client.
import { createClient } from '@supabase/supabase-js';

let client;

export function getSupabase() {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
    }
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return client;
}
