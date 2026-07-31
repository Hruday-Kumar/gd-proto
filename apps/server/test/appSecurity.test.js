// M6/M7 (engineering audit, 2026-07-28): confirms the CORS allowlist and
// helmet security headers are actually wired into the real app (index.js),
// not just correct in isolation (see corsConfig.test.js for the allowlist
// logic itself).
import { describe, it, expect, vi } from 'vitest';
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

  // N11 (audit comparison, 2026-07-29): the local Vite dev origins used to
  // be prepended unconditionally, in production too. Impact was low (this
  // API authenticates with a Bearer token, not a cookie -- a page on a
  // developer's localhost can't read another origin's token) but it hands
  // back part of M6's own allowlist for no benefit. These two tests don't
  // pass `allowedOrigins` -- that override bypasses this default-origins
  // path entirely -- so ALLOWED_ORIGINS is stubbed empty to isolate the
  // NODE_ENV behavior from whatever happens to be in this environment.
  it('does not allow the localhost dev origin in production', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', '');
    const app = createApp({ supabaseUrl: TEST_SUPABASE_URL, nodeEnv: 'production' });
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it('still allows the localhost dev origin outside production', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', '');
    const app = createApp({ supabaseUrl: TEST_SUPABASE_URL, nodeEnv: 'development' });
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    vi.unstubAllEnvs();
  });

  // place-me-UI (TanStack Start) defaults to port 8080, unlike apps/web's
  // plain-Vite 5173 -- both are local dev frontends for this same API.
  it('still allows the place-me-UI dev origin (port 8080) outside production', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', '');
    const app = createApp({ supabaseUrl: TEST_SUPABASE_URL, nodeEnv: 'development' });
    const res = await request(app).get('/health').set('Origin', 'http://localhost:8080');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    vi.unstubAllEnvs();
  });
});

// N12 (audit comparison, 2026-07-29): behind Render's load balancer,
// req.ip/req.protocol are the proxy's, not the real client's, without
// this. Harmless today (nothing reads either value -- the rate limiter
// deliberately keys on req.userId), but silently wrong the moment
// anything IP-based is added.
describe('trust proxy', () => {
  it('is configured for one proxy hop', () => {
    const app = createApp({ supabaseUrl: TEST_SUPABASE_URL });
    expect(app.get('trust proxy')).toBeTruthy();
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
