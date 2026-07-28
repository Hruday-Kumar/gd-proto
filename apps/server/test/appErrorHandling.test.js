// M2 (engineering audit, 2026-07-28): confirms the error handler is
// actually the last middleware registered on the real app (index.js), not
// just correct in isolation (see errorHandler.test.js for the middleware's
// own behavior). Uses GET /health/agent (unauthenticated, so no live
// Supabase/JWKS needed) with an injected agentStatus that throws.
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';

const TEST_SUPABASE_URL = 'https://test-project.supabase.co';

describe('error handling wiring', () => {
  it('turns an uncaught route error into the same JSON {error} shape every other endpoint uses, not an HTML error page', async () => {
    const agentStatus = {
      getStatus: () => {
        throw new Error('agent worker status tracker is corrupted');
      },
    };
    const res = await request(createApp({ supabaseUrl: TEST_SUPABASE_URL, agentStatus })).get('/health/agent');

    expect(res.status).toBe(500);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: 'Internal server error' });
    // Never leak the real message to the client, even though it's safe to
    // log server-side -- see errorHandler.test.js for that half.
    expect(JSON.stringify(res.body)).not.toMatch(/corrupted/);
  });
});
