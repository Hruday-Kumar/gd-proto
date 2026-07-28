// M6/M7 (engineering audit, 2026-07-28): confirms the CORS allowlist and
// helmet security headers are actually wired into the real app (index.js),
// not just correct in isolation (see corsConfig.test.js for the allowlist
// logic itself).
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';

const TEST_SUPABASE_URL = 'https://test-project.supabase.co';

describe('CORS allowlist wiring', () => {
  it('reflects an allowed origin in Access-Control-Allow-Origin', async () => {
    const app = createApp({ supabaseUrl: TEST_SUPABASE_URL, allowedOrigins: ['https://gd-proto.example.com'] });
    const res = await request(app).get('/health').set('Origin', 'https://gd-proto.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://gd-proto.example.com');
  });

  it('omits Access-Control-Allow-Origin for a disallowed origin, without erroring the request', async () => {
    const app = createApp({ supabaseUrl: TEST_SUPABASE_URL, allowedOrigins: ['https://gd-proto.example.com'] });
    const res = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(200); // CORS is browser-enforced -- the server still answers, it just omits the header
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('still serves requests with no Origin header (curl, server-to-server, this very test suite)', async () => {
    const app = createApp({ supabaseUrl: TEST_SUPABASE_URL, allowedOrigins: ['https://gd-proto.example.com'] });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

describe('helmet security headers', () => {
  it('sets standard hardening headers on every response', async () => {
    const app = createApp({ supabaseUrl: TEST_SUPABASE_URL });
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  // Helmet's default Cross-Origin-Resource-Policy is "same-origin" -- for
  // most apps that's the right default, but this API is deliberately
  // called cross-origin (the Vercel-hosted frontend calling the
  // Render-hosted backend, exactly what M6's CORS allowlist exists to
  // permit). "same-origin" CORP is enforced by the browser independently
  // of CORS -- it would silently block the real frontend's requests even
  // with a correct Access-Control-Allow-Origin header, defeating M6.
  it('does not set a same-origin Cross-Origin-Resource-Policy, since this API is deliberately called cross-origin', async () => {
    const app = createApp({ supabaseUrl: TEST_SUPABASE_URL });
    const res = await request(app).get('/health');
    expect(res.headers['cross-origin-resource-policy']).not.toBe('same-origin');
  });
});
