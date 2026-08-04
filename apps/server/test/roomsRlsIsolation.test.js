// Phase 1 security gate (ACTION_PLAN.md, 2026-08-04): the client-facing
// "rooms_insert_own" policy (0003) only checked auth.uid() = created_by --
// proof of self-identity, not that duration/join_mode/topic_id were
// validated. Every real room is written by the server's service-role
// client (db/rooms.js's insertRoom, called from POST /api/rooms and
// POST /api/rooms/match), which bypasses RLS entirely -- confirmed no
// apps/web or placeme-UI code inserts into `rooms` directly. Dropping the
// policy (0022) removes an attack surface with zero effect on the app.
//
// Same live-RLS pattern as topicsRlsIsolation.test.js /
// roomParticipantsRlsIsolation.test.js: a real Supabase Auth user, queried
// through their own scoped access token (not the service-role client,
// which would pass even if the policy were broken). Needs live Supabase
// creds; skipped without them (e.g. CI).
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const hasLiveCreds = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const HOOK_TIMEOUT_MS = 30000;

describe.skipIf(!hasLiveCreds)('rooms RLS isolation (Phase 1, real Supabase user)', () => {
  const admin = hasLiveCreds ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = 'p1-rls-test-P@ss1';

  let user;
  let topic;
  const insertedRoomIds = [];

  beforeAll(async () => {
    const email = `p1-rooms-rls-${suffix}@example.com`;
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

    const { data: topicRow, error: topicError } = await admin
      .from('topics')
      .insert({ text: 'Phase 1 rooms RLS isolation test topic', source: 'llm' })
      .select('id')
      .single();
    if (topicError) throw topicError;
    topic = topicRow;
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    if (!admin) return;
    for (const id of insertedRoomIds) {
      await admin.from('rooms').delete().eq('id', id);
    }
    if (topic) await admin.from('topics').delete().eq('id', topic.id);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }, HOOK_TIMEOUT_MS);

  it(
    'blocks a direct client insert into rooms, even one that would satisfy the old self-identity check',
    async () => {
      const { data, error } = await user.client
        .from('rooms')
        .insert({
          code: `P1${suffix.slice(-6)}`,
          topic_id: topic.id,
          duration_seconds: 300,
          join_mode: 'code',
          created_by: user.id,
        })
        .select('id')
        .single();
      // Record for cleanup regardless of outcome -- if the migration
      // hasn't been applied yet, this insert will unexpectedly succeed,
      // and the resulting row must not leak into the live table just
      // because the assertion below fails.
      if (data?.id) insertedRoomIds.push(data.id);
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    },
    HOOK_TIMEOUT_MS
  );

  it(
    'still allows the server (service-role client) to insert a room, same as the real API path',
    async () => {
      const { data, error } = await admin
        .from('rooms')
        .insert({
          code: `P1${suffix.slice(-6)}S`,
          topic_id: topic.id,
          duration_seconds: 300,
          join_mode: 'code',
          created_by: user.id,
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      insertedRoomIds.push(data.id);
    },
    HOOK_TIMEOUT_MS
  );
});
