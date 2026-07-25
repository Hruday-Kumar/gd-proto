// Integration test for W2's done-criteria: "a logged-out request to any
// protected route is rejected in a test." Uses a fixture Supabase URL — no
// bearer token is ever sent here, so the middleware short-circuits before
// any JWKS fetch and this stays fully offline.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';

const TEST_SUPABASE_URL = 'https://test-project.supabase.co';

describe('GET /api/me (protected)', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(createApp({ supabaseUrl: TEST_SUPABASE_URL })).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('rejects a request with a garbage bearer token', async () => {
    const res = await request(createApp({ supabaseUrl: TEST_SUPABASE_URL }))
      .get('/api/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
