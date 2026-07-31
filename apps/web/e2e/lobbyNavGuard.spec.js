import { test, expect } from '@playwright/test';

// BUG-SPEC-0001: proves AppShell's nav guard against a real browser-native
// window.confirm() dialog, which apps/web/src/components/AppShell.test.jsx
// (jsdom + a mocked window.confirm) cannot do. See the spec's Testing
// section for the full rationale. Does NOT satisfy guardrail #1 -- see
// .claude/skills/e2e-testing/SKILL.md.

const ROOM_ID = 'e2e-room-1';

// Matches @supabase/auth-js's own _saveSession() storage shape exactly
// (node_modules/@supabase/auth-js/dist/module/GoTrueClient.js) -- a plain
// Session object, JSON-stringified. @supabase/supabase-js derives the
// storage key from the project URL as `sb-<ref>-auth-token` (confirmed by
// instrumenting the installed package directly, not assumed -- auth-js's
// own standalone default of the fixed 'supabase.auth.token' does NOT
// apply once supabase-js's createClient() wraps it), so this must match
// playwright.config.js's webServer.env VITE_SUPABASE_URL
// ('https://e2e-test-project.supabase.co' -> ref 'e2e-test-project').
// expires_at is far enough out that GoTrueClient's init never attempts a
// token refresh, so getSession()/onAuthStateChange resolve from
// localStorage alone with no network call -- no real Supabase project is
// ever contacted.
const SUPABASE_STORAGE_KEY = 'sb-e2e-test-project-auth-token';
function fakeSupabaseSession() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    access_token: 'e2e-fake-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSeconds + 3600,
    refresh_token: 'e2e-fake-refresh-token',
    user: {
      id: 'e2e-fake-user-id',
      aud: 'authenticated',
      email: 'e2e@example.com',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

async function seedAuthAndRoomMocks(page, { status }) {
  await page.addInitScript(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    },
    { key: SUPABASE_STORAGE_KEY, session: fakeSupabaseSession() }
  );

  await page.route(`**/api/rooms/${ROOM_ID}/status`, (route) =>
    route.fulfill({
      json: {
        status,
        isCreator: false,
        code: 'ABCDEF',
        topicText: 'E2E test topic',
        endsAt: status === 'live' ? Date.now() + 5 * 60 * 1000 : null,
      },
    })
  );
  await page.route(`**/api/rooms/${ROOM_ID}/participants`, (route) =>
    route.fulfill({ json: { participants: [] } })
  );
  // Deliberately unreachable LiveKit URL -- LiveRoomAudio will attempt and
  // fail to connect, which is fine: the nav guard reads LobbyPage's own
  // polled `status` above, not LiveRoomAudio's connection outcome.
  await page.route(`**/api/rooms/${ROOM_ID}/token`, (route) =>
    route.fulfill({ json: { token: 'e2e-fake-token', url: 'wss://127.0.0.1:1' } })
  );
  // Both tests navigate on to History after clicking the guarded link --
  // mocked purely so that landing page doesn't fire its own real,
  // unmocked backend call once navigation completes.
  await page.route('**/api/history/mine', (route) => route.fulfill({ json: { sessions: [] } }));
}

test.describe('LobbyPage nav guard — real browser confirm() dialog', () => {
  test('blocks nav on dismiss, proceeds on accept, while the session is live', async ({ page }) => {
    await seedAuthAndRoomMocks(page, { status: 'live' });
    await page.goto(`/rooms/${ROOM_ID}`);

    // Not { exact: true }: the status badge's icon ligature ("sensors") and
    // the "Live" label are sibling text nodes inside the same <span>, so
    // its combined text content is "sensorsLive", never exactly "Live"
    // alone -- same reason the sibling 'waiting' test below matches
    // 'Waiting to start' without exact either.
    await expect(page.getByText('Live')).toBeVisible();

    let dialogMessage = null;
    page.once('dialog', (dialog) => {
      dialogMessage = dialog.message();
      dialog.dismiss();
    });
    await page.getByRole('link', { name: 'History' }).click();

    expect(dialogMessage).toContain('Leaving now will disconnect your microphone');
    await expect(page).toHaveURL(new RegExp(`/rooms/${ROOM_ID}$`));

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('link', { name: 'History' }).click();

    await expect(page).toHaveURL(/\/history$/);
  });

  test('does not prompt when the room is only waiting to start', async ({ page }) => {
    await seedAuthAndRoomMocks(page, { status: 'waiting' });
    await page.goto(`/rooms/${ROOM_ID}`);

    await expect(page.getByText('Waiting to start')).toBeVisible();

    let dialogFired = false;
    page.once('dialog', (dialog) => {
      dialogFired = true;
      dialog.accept();
    });
    await page.getByRole('link', { name: 'History' }).click();

    await expect(page).toHaveURL(/\/history$/);
    expect(dialogFired).toBe(false);
  });
});
