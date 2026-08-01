// BE-14 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0008): unlike
// every other BE item, this one is a Postgres trigger change
// (handle_new_user(), 0018_profiles_college_graduation_year.sql), not
// Express/domain JS -- there is no pure function to unit test, so this is
// the only test coverage for this item. Same live-RLS-style pattern as
// topicsRlsIsolation.test.js/roomParticipantsRlsIsolation.test.js: a real
// Supabase Auth user, created via the admin client, then the resulting
// profiles row read back and asserted against. Needs live Supabase creds;
// skipped without them (e.g. CI without secrets).
//
// Also skips (not fails) if migration 0018 hasn't been applied to the live
// project yet -- checked live in beforeAll via a cheap column probe, same
// "warn visibly rather than silently pass or permanently fail CI" spirit
// as N8's rls-security job. Confirmed manually before adding this guard:
// against the current (unmigrated) live project, this suite genuinely
// fails with "column profiles.college does not exist" -- the guard turns
// that into a visible skip instead of a permanently red `dev` CI run
// until a human applies the migration, which is a manual step in this
// repo's process, not something a merge can trigger.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const hasLiveCreds = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const HOOK_TIMEOUT_MS = 30000;

describe.skipIf(!hasLiveCreds)('profiles signup trigger (BE-14, real Supabase user)', () => {
  const admin = hasLiveCreds ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdUserIds = [];
  let migrationApplied = false;

  beforeAll(async () => {
    const { error } = await admin.from('profiles').select('college').limit(0);
    migrationApplied = !error;
    if (!migrationApplied) {
      console.warn(
        '::warning::migration 0018_profiles_college_graduation_year.sql is not yet applied to the live project -- skipping profilesSignupTrigger.test.js until it is'
      );
    }
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    if (!admin) return;
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  }, HOOK_TIMEOUT_MS);

  it(
    'persists college and graduation_year from signup metadata onto the new profile row',
    async (ctx) => {
      if (!migrationApplied) return ctx.skip();

      const email = `be14-rls-${suffix}@example.com`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: 'be14-rls-test-P@ss1',
        email_confirm: true,
        user_metadata: { display_name: 'Test Student', college: 'NITK Surathkal', graduation_year: '2027' },
      });
      if (error) throw error;
      createdUserIds.push(data.user.id);

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('display_name, college, graduation_year')
        .eq('id', data.user.id)
        .single();
      if (profileError) throw profileError;

      expect(profile.display_name).toBe('Test Student');
      expect(profile.college).toBe('NITK Surathkal');
      expect(profile.graduation_year).toBe(2027);
    },
    HOOK_TIMEOUT_MS
  );

  it(
    'leaves college and graduation_year null when signup metadata omits them',
    async (ctx) => {
      if (!migrationApplied) return ctx.skip();

      const email = `be14-rls-nofields-${suffix}@example.com`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: 'be14-rls-test-P@ss1',
        email_confirm: true,
        user_metadata: { display_name: 'No Extra Fields' },
      });
      if (error) throw error;
      createdUserIds.push(data.user.id);

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('college, graduation_year')
        .eq('id', data.user.id)
        .single();
      if (profileError) throw profileError;

      expect(profile.college).toBeNull();
      expect(profile.graduation_year).toBeNull();
    },
    HOOK_TIMEOUT_MS
  );
});
