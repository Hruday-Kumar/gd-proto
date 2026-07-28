// W7 (Session history) core unit: proves "a student can access only their
// own history" (guardrail #4) is enforced by Postgres RLS itself, not by
// an application-level `where user_id = ...` clause that a future bug could
// drop. Uses two REAL Supabase Auth users (admin-created, signed in for
// real access tokens) and queries as each of them -- not the server's
// service-role client, which bypasses RLS entirely and would pass even if
// the policies were broken or missing.
//
// Needs a live Supabase project (SUPABASE_URL/SUPABASE_ANON_KEY/
// SUPABASE_SERVICE_ROLE_KEY) to create/sign in real users -- skipped when
// those aren't set (e.g. CI, which has no live credentials configured),
// same reasoning as `npm run regression:room` needing live LiveKit/
// AssemblyAI creds. Runs for real locally against apps/server/.env.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const hasLiveCreds = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const HOOK_TIMEOUT_MS = 30000;

describe.skipIf(!hasLiveCreds)('session history RLS isolation (two real Supabase users)', () => {
  const admin = hasLiveCreds ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = 'w7-rls-test-P@ss1';

  let userA;
  let userB;
  let topic;
  let roomA;
  let roomB;

  async function createRealUser(label) {
    const email = `w7-rls-${label}-${suffix}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    // Scoping a client to this user's real access token is what makes
    // auth.uid() resolve to them inside Postgres -- this is what actually
    // exercises RLS, unlike the server's own service-role client.
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
      auth: { persistSession: false },
    });
    return { id: data.user.id, client };
  }

  async function createFixtureRoom(ownerId, code) {
    const { data: room, error: roomError } = await admin
      .from('rooms')
      .insert({ code, topic_id: topic.id, duration_seconds: 300, join_mode: 'code', status: 'ended', created_by: ownerId })
      .select('id')
      .single();
    if (roomError) throw roomError;

    const { error: participantError } = await admin
      .from('room_participants')
      .insert({ room_id: room.id, user_id: ownerId, livekit_identity: ownerId });
    if (participantError) throw participantError;

    const { error: transcriptError } = await admin.from('transcript_lines').insert({
      room_id: room.id,
      user_id: ownerId,
      text: 'hello from the room owner',
      started_at_ms: 0,
      ended_at_ms: 1000,
    });
    if (transcriptError) throw transcriptError;

    const { error: feedbackError } = await admin
      .from('feedback')
      .insert({ room_id: room.id, user_id: ownerId, body: 'You stayed on topic throughout.', model: 'w7-rls-test-fixture' });
    if (feedbackError) throw feedbackError;

    return room;
  }

  beforeAll(async () => {
    userA = await createRealUser('a');
    userB = await createRealUser('b');

    const { data: topicRow, error: topicError } = await admin
      .from('topics')
      .insert({ text: 'W7 RLS isolation test topic', source: 'llm' })
      .select('id')
      .single();
    if (topicError) throw topicError;
    topic = topicRow;

    roomA = await createFixtureRoom(userA.id, `W7A${suffix.slice(-4)}`);
    roomB = await createFixtureRoom(userB.id, `W7B${suffix.slice(-4)}`);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    if (!admin) return;
    // Fixture rooms are deleted before their creators so this test cleans
    // up after itself completely -- rooms don't cascade FROM auth.users
    // (only room_participants/transcript_lines/feedback cascade FROM a
    // room), so leaving them would strand orphaned rows in the project.
    //
    // Until migration 0008 this ordering was mandatory rather than tidy:
    // rooms.created_by was NOT NULL with no ON DELETE clause, so deleting
    // a user who had created a room raised an FK violation. That was C1 in
    // the 2026-07-28 audit -- the same violation broke
    // scripts/delete-account.js in production. 0008 makes created_by
    // nullable with `on delete set null`, so the delete now succeeds
    // either way; this order is kept for cleanliness.
    for (const room of [roomA, roomB]) {
      if (room) await admin.from('rooms').delete().eq('id', room.id);
    }
    if (topic) await admin.from('topics').delete().eq('id', topic.id);
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  }, HOOK_TIMEOUT_MS);

  it(
    'lets a user read their own room, transcript lines, and feedback',
    async () => {
      const { data: rooms, error: roomsError } = await userA.client.from('rooms').select('id').eq('id', roomA.id);
      expect(roomsError).toBeNull();
      expect(rooms).toHaveLength(1);

      const { data: lines, error: linesError } = await userA.client
        .from('transcript_lines')
        .select('id')
        .eq('room_id', roomA.id);
      expect(linesError).toBeNull();
      expect(lines).toHaveLength(1);

      const { data: feedback, error: feedbackError } = await userA.client
        .from('feedback')
        .select('id')
        .eq('room_id', roomA.id);
      expect(feedbackError).toBeNull();
      expect(feedback).toHaveLength(1);
    },
    HOOK_TIMEOUT_MS
  );

  it(
    "blocks a user from reading another user's room via RLS",
    async () => {
      const { data, error } = await userB.client.from('rooms').select('id').eq('id', roomA.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    },
    HOOK_TIMEOUT_MS
  );

  it(
    "blocks a user from reading another user's transcript lines via RLS",
    async () => {
      const { data, error } = await userB.client.from('transcript_lines').select('id, text').eq('room_id', roomA.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    },
    HOOK_TIMEOUT_MS
  );

  it(
    "blocks a user from reading another user's feedback via RLS",
    async () => {
      const { data, error } = await userB.client.from('feedback').select('id, body').eq('room_id', roomA.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    },
    HOOK_TIMEOUT_MS
  );
});
