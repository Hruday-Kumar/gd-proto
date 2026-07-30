// Router-level tests for topic creation (W4). requireAuth is stubbed
// (covered by test/authMiddleware.test.js) and the db/Gemini functions are
// injected, so this stays fast and offline -- same pattern as
// test/consentApi.test.js.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTopicsRouter } from '../src/api/topics.js';
import { createLlmRateLimiter, createRoomActionRateLimiter } from '../src/api/rateLimit.js';

function stubAuth(req, _res, next) {
  req.userId = 'user-123';
  next();
}

function buildApp({ insertCustomTopic, insertGeneratedTopic, generateTopicFn, llmRateLimiter, roomActionRateLimiter }) {
  const app = express();
  app.use(express.json());
  app.use(
    createTopicsRouter(stubAuth, {
      insertCustomTopic,
      insertGeneratedTopic,
      generateTopicFn,
      llmRateLimiter,
      roomActionRateLimiter,
    })
  );
  return app;
}

describe('POST /api/topics/custom', () => {
  it('rejects a blank topic without calling the db', async () => {
    const insertCustomTopic = vi.fn();
    const app = buildApp({ insertCustomTopic, insertGeneratedTopic: vi.fn() });
    const res = await request(app).post('/api/topics/custom').send({ text: '   ' });
    expect(res.status).toBe(400);
    expect(insertCustomTopic).not.toHaveBeenCalled();
  });

  // H5 (audit 2026-07-28): a custom topic is embedded verbatim into the
  // Gemini feedback prompt for every participant in the room -- unbounded
  // text gives a hostile submission room to break out of that framing.
  it('rejects a topic longer than 200 characters without calling the db', async () => {
    const insertCustomTopic = vi.fn();
    const app = buildApp({ insertCustomTopic, insertGeneratedTopic: vi.fn() });
    const res = await request(app).post('/api/topics/custom').send({ text: 'a'.repeat(201) });
    expect(res.status).toBe(400);
    expect(insertCustomTopic).not.toHaveBeenCalled();
  });

  it('inserts a custom topic for the authenticated user and returns it', async () => {
    const insertCustomTopic = vi.fn().mockResolvedValue({ id: 't1', text: 'AI in education', source: 'custom' });
    const app = buildApp({ insertCustomTopic, insertGeneratedTopic: vi.fn() });
    const res = await request(app).post('/api/topics/custom').send({ text: 'AI in education', category: 'tech' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 't1', text: 'AI in education', source: 'custom' });
    expect(insertCustomTopic).toHaveBeenCalledWith('user-123', { text: 'AI in education', category: 'tech', difficulty: undefined });
  });

  // H4 residual (audit comparison 2026-07-29, N3's recommended fix): this
  // route writes an unbounded row count to `topics` on every request and
  // had no rate limiting at all -- PR #44 extended the room-action limiter
  // to /api/rooms and /api/rooms/join but never touched this route, even
  // though the original H4 finding named it. Uses the room-action limiter,
  // not the LLM one -- this route never calls Gemini itself.
  it('is rate-limited per user', async () => {
    const app = buildApp({
      insertCustomTopic: vi.fn().mockResolvedValue({ id: 't', text: 'x', source: 'custom' }),
      insertGeneratedTopic: vi.fn(),
      roomActionRateLimiter: createRoomActionRateLimiter({ windowMs: 60_000, max: 2 }),
    });
    await request(app).post('/api/topics/custom').send({ text: 'first' });
    await request(app).post('/api/topics/custom').send({ text: 'second' });
    const res = await request(app).post('/api/topics/custom').send({ text: 'third' });
    expect(res.status).toBe(429);
  });
});

describe('POST /api/topics/generate', () => {
  it('generates a topic via Gemini, persists it as an llm-sourced topic, and returns it', async () => {
    const generateTopicFn = vi.fn().mockResolvedValue('Should remote work be the default?');
    const insertGeneratedTopic = vi.fn().mockResolvedValue({ id: 't2', text: 'Should remote work be the default?', source: 'llm' });
    const app = buildApp({ insertCustomTopic: vi.fn(), insertGeneratedTopic, generateTopicFn });
    const res = await request(app).post('/api/topics/generate').send({ category: 'workplace', difficulty: 'medium' });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe('llm');
    expect(generateTopicFn).toHaveBeenCalledWith({ category: 'workplace', difficulty: 'medium' });
    expect(insertGeneratedTopic).toHaveBeenCalledWith({
      text: 'Should remote work be the default?',
      category: 'workplace',
      difficulty: 'medium',
    });
  });

  it('propagates a Gemini failure as a 502 without silently losing it', async () => {
    const generateTopicFn = vi.fn().mockRejectedValue(new Error('Gemini API error: 429 rate limited'));
    const app = buildApp({ insertCustomTopic: vi.fn(), insertGeneratedTopic: vi.fn(), generateTopicFn });
    const res = await request(app).post('/api/topics/generate').send({});
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/gemini/i);
  });

  // H4 (audit 2026-07-28): confirms the limiter is actually attached to
  // this route, not just correct in isolation (see llmRateLimit.test.js
  // for the limiter's own behavior).
  it('is rate-limited per user', async () => {
    const app = buildApp({
      insertCustomTopic: vi.fn(),
      insertGeneratedTopic: vi.fn().mockResolvedValue({ id: 't', text: 'x', source: 'llm' }),
      generateTopicFn: vi.fn().mockResolvedValue('x'),
      llmRateLimiter: createLlmRateLimiter({ windowMs: 60_000, max: 2 }),
    });
    await request(app).post('/api/topics/generate').send({});
    await request(app).post('/api/topics/generate').send({});
    const res = await request(app).post('/api/topics/generate').send({});
    expect(res.status).toBe(429);
  });
});
