import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Required for @testing-library/react's automatic per-test cleanup,
    // which detects a global `afterEach` -- without this, DOM from one
    // test's render() stays mounted into the next test.
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    // e2e/**: Playwright's own suite (BUG-SPEC-0001), run via `npm run
    // test:e2e` / playwright.config.js -- it uses @playwright/test's API,
    // not Vitest's, and needs a real browser, so Vitest must never collect
    // it.
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
});
