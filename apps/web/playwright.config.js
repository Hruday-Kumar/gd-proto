import { defineConfig, devices } from '@playwright/test';

// Scope, deliberately narrow: this repo's E2E suite currently exists only
// to prove BUG-SPEC-0001's nav guard against a real browser-native
// window.confirm() dialog, something jsdom/RTL cannot exercise. See
// docs/specs/active/BUG-SPEC-0001-lobby-nav-guard-live-session.md's
// Testing section and .claude/skills/e2e-testing/SKILL.md's note: this
// does not satisfy guardrail #1's human-verification gate.
//
// Every spec here mocks apps/web's own backend calls at the network layer
// (page.route) and seeds a fake Supabase session directly into
// localStorage -- no live Supabase/LiveKit/AssemblyAI credentials are
// used or required, so this suite is safe to run in CI with dummy env
// values (see the webServer.env below) and never touches real data.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list']] : [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      // Never reached over the network by this suite (see spec-level
      // comments) -- shaped like real values only so supabaseClient.js's
      // own startup guard doesn't throw.
      VITE_SUPABASE_URL: 'https://e2e-test-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-test-anon-key',
      VITE_API_URL: 'http://localhost:3000',
    },
  },
});
