// N2 (AUDIT_COMPARISON_2026-07-29.md): H5's custom-topic length cap and
// prompt delimiting live in api/topics.js, but the client-facing
// "topics_insert_own_custom" policy (0003) let any authenticated student
// bypass that route entirely and insert directly into public.topics via
// PostgREST, with only a self-identity check (source = 'custom' and
// auth.uid() = created_by) and no length or content check -- an unbounded
// payload was free to contain a `"""` sequence that closes the delimiter
// domain/feedbackPrompt.js relies on, then be referenced as topicId in
// POST /api/rooms like any legitimate topic.
//
// Same live-RLS pattern as roomParticipantsRlsIsolation.test.js /
// historyRlsIsolation.test.js: a real Supabase Auth user, queried through
// their own scoped access token (not the service-role client, which would
// pass even if the policy were broken). Needs live Supabase creds; skipped
// without them (e.g. CI).
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const hasLiveCreds = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const HOOK_TIMEOUT_MS = 30000;

describe.skipIf(!hasLiveCreds)('topics RLS isolation (N2, real Supabase user)', () => {
  const admin = hasLiveCreds ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = 'n2-rls-test-P@ss1';

  let user;
  const insertedTopicIds = [];

  beforeAll(async () => {
    const email = `n2-rls-${suffix}@example.com`;
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
    for (const id of insertedTopicIds) {
      await admin.from('topics').delete().eq('id', id);
    }
    if (user) await admin.auth.admin.deleteUser(user.id);
  }, HOOK_TIMEOUT_MS);

  it(
    'blocks a direct client insert into topics, even one that would satisfy the old self-identity check',
    async () => {
      const { data, error } = await user.client
        .from('topics')
        .insert({ text: 'N2 direct-insert attempt', source: 'custom', created_by: user.id })
        .select('id')
        .single();
      // Record for cleanup regardless of outcome -- if the migration hasn't
      // been applied yet, this insert will unexpectedly succeed, and the
      // resulting row must not leak into the live table just because the
      // assertion below fails.
      if (data?.id) insertedTopicIds.push(data.id);
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    },
    HOOK_TIMEOUT_MS
  );

  it(
    'rejects a topic longer than 200 characters at the database layer, even via the service-role client',
    async () => {
      // Proves the topics_text_length CHECK constraint, not RLS -- it must
      // hold regardless of which client performs the insert, since RLS
      // alone (source/created_by checks) never bounded length.
      const { data, error } = await admin
        .from('topics')
        .insert({ text: 'a'.repeat(201), source: 'llm' })
        .select('id')
        .single();
      // Same cleanup-regardless-of-outcome reasoning as the test above.
      if (data?.id) insertedTopicIds.push(data.id);
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    },
    HOOK_TIMEOUT_MS
  );

  it(
    'still allows the server (service-role client) to insert a within-bounds topic, same as the real API path',
    async () => {
      const { data, error } = await admin
        .from('topics')
        .insert({ text: 'N2 regression check: a valid topic within bounds', source: 'llm' })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      insertedTopicIds.push(data.id);
    },
    HOOK_TIMEOUT_MS
  );
});
