// N3 (audit comparison, 2026-07-29): POST /api/rooms (create) and POST
// /api/rooms/join had no rate limiting at all -- a single account could
// spam-create rooms or spam-join a leaked code with no throttle. This is
// a separate limiter from createLlmRateLimiter (H4, llmRateLimit.test.js):
// these two routes aren't Gemini-backed themselves, so sharing one
// counter would incorrectly throttle topic generation/matching against
// unrelated room create/join traffic or vice versa. Same keying discipline
// as the LLM limiter: per req.userId (set by requireAuth, which always
// runs first), never IP, so a shared campus network can't cross-throttle
// students and a rotating IP can't dodge the cap.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRoomActionRateLimiter } from '../src/api/rateLimit.js';

function stubAuth(userId) {
  return (req, _res, next) => {
    req.userId = userId;
    next();
  };
}

function buildApp(userId, limiterOptions) {
  const app = express();
  app.use(stubAuth(userId));
  app.get('/limited', createRoomActionRateLimiter(limiterOptions), (req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('createRoomActionRateLimiter', () => {
  it('allows requests up to the configured max', async () => {
    const app = buildApp('user-1', { windowMs: 60_000, max: 3 });
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/limited');
      expect(res.status).toBe(200);
    }
  });

  it('rejects the request once a user exceeds the configured max within the window', async () => {
    const app = buildApp('user-1', { windowMs: 60_000, max: 3 });
    for (let i = 0; i < 3; i += 1) {
      await request(app).get('/limited');
    }
    const res = await request(app).get('/limited');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('keys the limit per user, not globally', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.userId = req.headers['x-test-user'];
      next();
    });
    const limiter = createRoomActionRateLimiter({ windowMs: 60_000, max: 1 });
    app.get('/limited', limiter, (req, res) => res.status(200).json({ ok: true }));

    const first = await request(app).get('/limited').set('x-test-user', 'user-a');
    expect(first.status).toBe(200);
    const second = await request(app).get('/limited').set('x-test-user', 'user-a');
    expect(second.status).toBe(429);

    const otherUser = await request(app).get('/limited').set('x-test-user', 'user-b');
    expect(otherUser.status).toBe(200);
  });
});
