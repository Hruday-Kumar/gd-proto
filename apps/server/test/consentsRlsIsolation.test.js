// Phase 1 security gate (ACTION_PLAN.md, 2026-08-04): the client-facing
// "consents_insert_own" policy (0002) only checked auth.uid() = user_id --
// proof of self-identity, not that consent_version was ever resolved or
// shown by the server. Every real consent event is written by the
// server's service-role client (db/consents.js's recordConsent, called
// from POST /api/consent after CURRENT_CONSENT_VERSION is resolved
// server-side), which bypasses RLS entirely -- confirmed no apps/web or
// placeme-UI code inserts into `consents` directly. Consent is the gate
// guardrail #3 depends on ("consent before mic, always"); leaving this
// policy in place let a client forge a consent record for a version the
// student never actually saw or agreed to. Dropping the policy (0022)
// removes that attack surface with zero effect on the app.
//
// Same live-RLS pattern as roomsRlsIsolation.test.js /
// topicsRlsIsolation.test.js: a real Supabase Auth user, queried through
// their own scoped access token (not the service-role client, which
// would pass even if the policy were broken). Needs live Supabase creds;
// skipped without them (e.g. CI).
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const hasLiveCreds = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const HOOK_TIMEOUT_MS = 30000;

describe.skipIf(!hasLiveCreds)('consents RLS isolation (Phase 1, real Supabase user)', () => {
  const admin = hasLiveCreds ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = 'p1-rls-test-P@ss1';

  let user;
  const insertedConsentIds = [];

  beforeAll(async () => {
    const email = `p1-consents-rls-${suffix}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    user = {
      id: data.user.id,
      client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
        auth: { persistSession: false },
      }),
    };
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    if (!admin) return;
    for (const id of insertedConsentIds) {
      await admin.from('consents').delete().eq('id', id);
    }
    if (user) await admin.auth.admin.deleteUser(user.id);
  }, HOOK_TIMEOUT_MS);

  it(
    'blocks a direct client insert into consents, even one that would satisfy the old self-identity check',
    async () => {
      const { data, error } = await user.client
        .from('consents')
        .insert({ user_id: user.id, consent_version: 1 })
        .select('id')
        .single();
      // Record for cleanup regardless of outcome -- if the migration
      // hasn't been applied yet, this insert will unexpectedly succeed,
      // and the resulting row must not leak into the live table just
      // because the assertion below fails.
      if (data?.id) insertedConsentIds.push(data.id);
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    },
    HOOK_TIMEOUT_MS
  );

  it(
    'still allows the server (service-role client) to insert a consent record, same as the real API path',
    async () => {
      const { data, error } = await admin
        .from('consents')
        .insert({ user_id: user.id, consent_version: 1 })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      insertedConsentIds.push(data.id);
    },
    HOOK_TIMEOUT_MS
  );
});
