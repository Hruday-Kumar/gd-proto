import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { REQUIRED_ENV_VARS } from '../src/domain/readiness.js';

// Fixture URL — the auth middleware needs *a* Supabase URL to construct
// (see authMiddleware.test.js for its real behavior); no network call
// happens unless a request actually carries a bearer token.
const TEST_SUPABASE_URL = 'https://test-project.supabase.co';

// A fully-populated fake env for /ready's "everything configured" cases --
// built from REQUIRED_ENV_VARS itself, not hardcoded one-by-one, so a
// future required var is covered automatically. Must not rely on
// ambient process.env: a developer's local .env happens to have all of
// these, which let these two tests pass locally while CI's `test` job
// (no Supabase/LiveKit/Gemini secrets set there -- those live only in the
// rls-security job) silently failed on every run since 2026-08-04.
const FULL_ENV = Object.fromEntries(REQUIRED_ENV_VARS.map((name) => [name, 'test-value']));

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(createApp({ supabaseUrl: TEST_SUPABASE_URL })).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// W8: a dead/failing transcription dispatch is otherwise a silent failure
// (see rooms.js's /start and /status comments) -- this endpoint is what
// the GitHub Actions keep-alive workflow polls to catch it.
describe('GET /health/agent', () => {
  it('reports the injected agent worker status', async () => {
    const agentStatus = {
      getStatus: () => ({
        activeRooms: 2,
        dispatchSuccesses: 5,
        dispatchFailures: 1,
        lastFailure: { roomId: 'room-1', message: 'boom', at: '2026-07-26T00:00:00.000Z' },
        healthy: false,
      }),
    };
    const res = await request(createApp({ supabaseUrl: TEST_SUPABASE_URL, agentStatus })).get('/health/agent');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      activeRooms: 2,
      dispatchSuccesses: 5,
      dispatchFailures: 1,
      lastFailure: { roomId: 'room-1', message: 'boom', at: '2026-07-26T00:00:00.000Z' },
      healthy: false,
    });
  });

  it('defaults to the real in-process agent worker status when none is injected', async () => {
    const res = await request(createApp({ supabaseUrl: TEST_SUPABASE_URL })).get('/health/agent');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      activeRooms: 0,
      dispatchSuccesses: 0,
      dispatchFailures: 0,
      lastFailure: null,
      lastSuccess: null,
      healthy: true,
      // N1 (audit comparison, 2026-07-29): feedback generation's own
      // dispatch-health counters, parallel to the transcription ones above.
      feedbackSuccesses: 0,
      feedbackFailures: 0,
      lastFeedbackFailure: null,
      lastFeedbackSuccess: null,
      feedbackHealthy: true,
    });
  });

  // M3 (audit 2026-07-28): unauthenticated, this endpoint leaks lastFailure's
  // roomId and raw error text to anyone who finds the URL. When a token is
  // configured, require it -- but stay open by default so local dev/CI (no
  // HEALTH_CHECK_TOKEN set) never breaks.
  describe('when HEALTH_CHECK_TOKEN is configured', () => {
    const agentStatus = {
      getStatus: () => ({
        activeRooms: 1,
        dispatchSuccesses: 1,
        dispatchFailures: 1,
        lastFailure: { roomId: 'room-1', message: 'boom', at: '2026-07-26T00:00:00.000Z' },
        healthy: false,
      }),
    };

    it('401s a request with no token, revealing no status detail', async () => {
      const res = await request(
        createApp({ supabaseUrl: TEST_SUPABASE_URL, agentStatus, healthCheckToken: 'secret-token' })
      ).get('/health/agent');
      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty('lastFailure');
      expect(res.body).not.toHaveProperty('activeRooms');
    });

    it('401s a request with the wrong token', async () => {
      const res = await request(
        createApp({ supabaseUrl: TEST_SUPABASE_URL, agentStatus, healthCheckToken: 'secret-token' })
      )
        .get('/health/agent')
        .set('x-health-token', 'wrong');
      expect(res.status).toBe(401);
    });

    it('200s and returns full status with the correct token', async () => {
      const res = await request(
        createApp({ supabaseUrl: TEST_SUPABASE_URL, agentStatus, healthCheckToken: 'secret-token' })
      )
        .get('/health/agent')
        .set('x-health-token', 'secret-token');
      expect(res.status).toBe(200);
      expect(res.body.activeRooms).toBe(1);
      expect(res.body.lastFailure).toEqual({ roomId: 'room-1', message: 'boom', at: '2026-07-26T00:00:00.000Z' });
    });
  });

  // Phase 1 security gate (ACTION_PLAN.md, 2026-08-04): M3's open fallback
  // (above) was deliberate for local dev/CI, but the same fallback in a
  // real production deploy means a misconfigured Render service (env var
  // never set) silently ships this endpoint wide open instead of failing
  // loudly. In production, no token configured is a startup error, not a
  // quiet degrade.
  describe('in production', () => {
    it('refuses to start when HEALTH_CHECK_TOKEN is not configured', () => {
      expect(() => createApp({ supabaseUrl: TEST_SUPABASE_URL, nodeEnv: 'production', healthCheckToken: undefined })).toThrow(
        /HEALTH_CHECK_TOKEN/
      );
    });

    it('starts normally when HEALTH_CHECK_TOKEN is configured', () => {
      expect(() =>
        createApp({ supabaseUrl: TEST_SUPABASE_URL, nodeEnv: 'production', healthCheckToken: 'secret-token' })
      ).not.toThrow();
    });
  });
});

// Phase 1 (ACTION_PLAN.md, 2026-08-04): /health only ever reports "ok" --
// useful for liveness (is the process up?) but not readiness (can it
// actually serve real traffic?). A deploy with a typo'd env var, or a
// Supabase project missing a migration the code now depends on, looked
// identical to a healthy one until a real student hit it. /ready checks
// both explicitly and answers 503 instead.
describe('GET /ready', () => {
  it('200s when every required env var is set and the DB check succeeds', async () => {
    const res = await request(
      createApp({ supabaseUrl: TEST_SUPABASE_URL, checkDbFn: async () => {}, env: FULL_ENV })
    ).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  it('503s and names every missing required env var', async () => {
    const res = await request(
      createApp({ supabaseUrl: TEST_SUPABASE_URL, checkDbFn: async () => {}, env: {} })
    ).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.reason).toBe('missing_config');
    expect(res.body.missingEnvVars).toEqual(
      expect.arrayContaining(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY'])
    );
  });

  it('503s when the DB check fails, without leaking the underlying error to the client', async () => {
    const res = await request(
      createApp({
        supabaseUrl: TEST_SUPABASE_URL,
        checkDbFn: async () => {
          throw new Error('relation "rooms" does not exist');
        },
        env: FULL_ENV,
      })
    ).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.reason).toBe('db_unreachable');
    expect(res.body).not.toHaveProperty('message');
  });
});
