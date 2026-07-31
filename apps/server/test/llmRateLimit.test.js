// H4 (engineering audit, 2026-07-28): the two Gemini-backed routes (topic
// generation, POST /api/topics/generate; random matching, which calls
// Gemini on the "matched" branch, POST /api/rooms/match) had no rate
// limiting at all. Unlike every other route in this app, spamming these
// burns the project's shared free-tier Gemini quota for every OTHER
// student at once -- the budget is $0 out-of-pocket (see
// docs/engineering/PROGRESS.md), so there's no paid headroom to absorb
// abuse. Keyed on req.userId (set by requireAuth, which always runs first)
// rather than IP, so it can't be dodged by two students sharing a NAT'd
// campus network -- and so one student hammering it can't collaterally
// rate-limit a different student on the same network.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createLlmRateLimiter } from '../src/api/middleware/rateLimit.js';

function stubAuth(userId) {
  return (req, _res, next) => {
    req.userId = userId;
    next();
  };
}

function buildApp(userId, limiterOptions) {
  const app = express();
  app.use(stubAuth(userId));
  app.get('/limited', createLlmRateLimiter(limiterOptions), (req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('createLlmRateLimiter', () => {
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

  it('keys the limit per user, not globally -- one student hammering it does not block another', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.userId = req.headers['x-test-user'];
      next();
    });
    const limiter = createLlmRateLimiter({ windowMs: 60_000, max: 1 });
    app.get('/limited', limiter, (req, res) => res.status(200).json({ ok: true }));

    const first = await request(app).get('/limited').set('x-test-user', 'user-a');
    expect(first.status).toBe(200);
    const second = await request(app).get('/limited').set('x-test-user', 'user-a');
    expect(second.status).toBe(429);

    const otherUser = await request(app).get('/limited').set('x-test-user', 'user-b');
    expect(otherUser.status).toBe(200);
  });
});
