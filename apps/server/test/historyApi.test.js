// Router-level tests for W7's history endpoint. requireAuth is stubbed and
// every persistence call is injected -- no live DB, same pattern as
// roomsApi.test.js/consentApi.test.js. This exercises the wiring between
// the three db reads and buildSessionHistory (already unit-tested directly
// in test/sessionHistory.test.js).
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHistoryRouter } from '../src/api/history.js';

function stubAuth(userId) {
  return (req, _res, next) => {
    req.userId = userId;
    next();
  };
}

function buildApp(deps, userId = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use(createHistoryRouter(stubAuth(userId), deps));
  return app;
}

function baseDeps(overrides = {}) {
  return {
    listRoomIdsForUser: vi.fn().mockResolvedValue([]),
    listRoomsByIds: vi.fn().mockResolvedValue([]),
    listFeedbackForUserAndRooms: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('GET /api/history/mine', () => {
  it('returns an empty list for a student with no past sessions', async () => {
    const deps = baseDeps();
    const app = buildApp(deps);
    const res = await request(app).get('/api/history/mine');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sessions: [] });
    expect(deps.listRoomsByIds).toHaveBeenCalledWith([]);
  });

  it('scopes every read to the caller, not a query parameter', async () => {
    const deps = baseDeps();
    const app = buildApp(deps, 'user-42');
    await request(app).get('/api/history/mine');
    expect(deps.listRoomIdsForUser).toHaveBeenCalledWith('user-42');
    expect(deps.listFeedbackForUserAndRooms).toHaveBeenCalledWith('user-42', []);
  });

  it("assembles the caller's rooms and feedback into a session list", async () => {
    const deps = baseDeps({
      listRoomIdsForUser: vi.fn().mockResolvedValue(['r1']),
      listRoomsByIds: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          code: 'CODE1',
          status: 'ended',
          duration_seconds: 300,
          started_at: '2026-07-26T10:00:00.000Z',
          ended_at: '2026-07-26T10:05:00.000Z',
          topics: { text: 'Should AI grade exams?' },
        },
      ]),
      listFeedbackForUserAndRooms: vi.fn().mockResolvedValue([{ room_id: 'r1', body: 'You stayed on topic throughout.' }]),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/history/mine');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sessions: [
        {
          id: 'r1',
          code: 'CODE1',
          status: 'ended',
          durationSeconds: 300,
          topicText: 'Should AI grade exams?',
          startedAt: '2026-07-26T10:00:00.000Z',
          endedAt: '2026-07-26T10:05:00.000Z',
          feedback: 'You stayed on topic throughout.',
        },
      ],
    });
    expect(deps.listRoomsByIds).toHaveBeenCalledWith(['r1']);
  });
});
