import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';

// Fixture URL — the auth middleware needs *a* Supabase URL to construct
// (see authMiddleware.test.js for its real behavior); no network call
// happens unless a request actually carries a bearer token.
const TEST_SUPABASE_URL = 'https://test-project.supabase.co';

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(createApp({ supabaseUrl: TEST_SUPABASE_URL })).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
