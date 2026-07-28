// H8 (engineering audit, 2026-07-28): a student must not be able to seat
// themselves into a room they were never matched or invited into. Every
// real seat is written by the server's service-role client
// (db/roomParticipants.js's addParticipant), which bypasses RLS entirely --
// apps/web never inserts into room_participants directly. The client-facing
// "room_participants_insert_self" policy (0003) was therefore never needed
// by the app, but it IS reachable by anyone with a valid Supabase access
// token calling PostgREST directly, and its check (`auth.uid() = user_id`)
// only proves self-identity, not room membership -- so it let any
// authenticated student insert themselves into ANY room's participant list.
// A curious or malicious student could join a live discussion mid-session
// with nobody having invited them.
//
// Same live-RLS pattern as historyRlsIsolation.test.js: two real Supabase
// Auth users, queried through their own scoped access tokens (not the
// service-role client, which would pass even if the policy were broken).
// Needs live Supabase creds; skipped without them (e.g. CI).
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const hasLiveCreds = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const HOOK_TIMEOUT_MS = 30000;

describe.skipIf(!hasLiveCreds)('room_participants RLS isolation (H8, two real Supabase users)', () => {
  const admin = hasLiveCreds ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = 'h8-rls-test-P@ss1';

  let userA;
  let userB;
  let topic;
  let roomA;

  async function createRealUser(label) {
    const email = `h8-rls-${label}-${suffix}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
      auth: { persistSession: false },
    });
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    userA = await createRealUser('a');
    userB = await createRealUser('b'); // deliberately never seated in roomA

    const { data: topicRow, error: topicError } = await admin
      .from('topics')
      .insert({ text: 'H8 RLS isolation test topic', source: 'llm' })
      .select('id')
      .single();
    if (topicError) throw topicError;
    topic = topicRow;

    const { data: room, error: roomError } = await admin
      .from('rooms')
      .insert({ code: `H8${suffix.slice(-6)}`, topic_id: topic.id, duration_seconds: 300, join_mode: 'code', created_by: userA.id })
      .select('id')
      .single();
    if (roomError) throw roomError;
    roomA = room;

    const { error: seatError } = await admin
      .from('room_participants')
      .insert({ room_id: roomA.id, user_id: userA.id, livekit_identity: userA.id });
    if (seatError) throw seatError;
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    if (!admin) return;
    if (roomA) await admin.from('rooms').delete().eq('id', roomA.id);
    if (topic) await admin.from('topics').delete().eq('id', topic.id);
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  }, HOOK_TIMEOUT_MS);

  it(
    'blocks an uninvited user from seating themselves in a room via a direct client insert',
    async () => {
      const { error } = await userB.client
        .from('room_participants')
        .insert({ room_id: roomA.id, user_id: userB.id, livekit_identity: userB.id });
      expect(error).not.toBeNull();

      const { data: seatCheck, error: seatCheckError } = await admin
        .from('room_participants')
        .select('user_id')
        .eq('room_id', roomA.id)
        .eq('user_id', userB.id);
      expect(seatCheckError).toBeNull();
      expect(seatCheck).toHaveLength(0);
    },
    HOOK_TIMEOUT_MS
  );
});
