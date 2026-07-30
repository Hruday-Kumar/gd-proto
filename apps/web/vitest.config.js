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
  },
});
