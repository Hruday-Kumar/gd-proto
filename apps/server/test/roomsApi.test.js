// Router-level tests for room creation/join/matching (W4). requireAuth is
// stubbed and every persistence/Gemini call is injected -- no live DB or
// network, same pattern as consentApi.test.js / topicsApi.test.js. These
// tests exercise how the three pure domain functions (roomCode,
// matchmaking, sessionStateMachine) get wired to persistence, which is
// exactly where a wiring bug would hide.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRoomsRouter } from '../src/api/rooms.js';

function stubAuth(userId) {
  return (req, _res, next) => {
    req.userId = userId;
    next();
  };
}

function buildApp(deps, userId = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use(createRoomsRouter(stubAuth(userId), deps));
  return app;
}

function baseDeps(overrides = {}) {
  return {
    roomCodeExists: vi.fn().mockResolvedValue(false),
    insertRoom: vi.fn(),
    getRoomByCode: vi.fn(),
    getRoomById: vi.fn(),
    // Echoes back an updated row, like the real db/rooms.js
    // updateRoomStatus does via .select(). The return value used to be
    // ignored by every caller, so a bare vi.fn() was enough; since C3 the
    // /status route reads it to decide whether it won the ended-transition
    // claim, so the stub has to honour that contract. Tests that care about
    // *losing* the claim override this with one returning null.
    updateRoomStatus: vi.fn(async (id, patch) => ({ id, ...patch })),
    addParticipant: vi.fn(),
    listQueue: vi.fn().mockResolvedValue([]),
    addToQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    insertGeneratedTopic: vi.fn(),
    generateTopicFn: vi.fn(),
    getActiveRoomForUser: vi.fn().mockResolvedValue(null),
    minGroupSize: 3,
    maxGroupSize: 6,
    isParticipant: vi.fn().mockResolvedValue(true),
    getLatestConsent: vi.fn().mockResolvedValue({ consent_version: 1 }),
    mintTokenFn: vi.fn().mockResolvedValue('signed.jwt.token'),
    liveKitUrl: 'wss://example.livekit.cloud',
    startTranscriptionFn: vi.fn().mockResolvedValue(undefined),
    generateFeedbackFn: vi.fn().mockResolvedValue(undefined),
    getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue(null),
    rateFeedbackFn: vi.fn().mockResolvedValue({ rating: true, rating_reason: null }),
    listParticipantsFn: vi.fn().mockResolvedValue([]),
    listProfilesFn: vi.fn().mockResolvedValue([]),
    listTranscriptLinesForRoomFn: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('POST /api/rooms (create by code)', () => {
  it('rejects a request missing topicId or durationSeconds', async () => {
    const deps = baseDeps();
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms').send({ topicId: 't1' });
    expect(res.status).toBe(400);
    expect(deps.insertRoom).not.toHaveBeenCalled();
  });

  it('generates a code, creates the room, and seats the creator as a participant', async () => {
    const deps = baseDeps({
      insertRoom: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting', topic_id: 't1', duration_seconds: 300 }),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'r1', code: 'ABCXYZ', status: 'waiting', topicId: 't1', durationSeconds: 300 });
    expect(deps.insertRoom).toHaveBeenCalledWith(
      expect.objectContaining({ topicId: 't1', durationSeconds: 300, joinMode: 'code', createdBy: 'user-1' })
    );
    expect(deps.addParticipant).toHaveBeenCalledWith('r1', 'user-1', 'user-1');
  });
});

describe('POST /api/rooms/join', () => {
  it('404s when the code does not match a room', async () => {
    const deps = baseDeps({ getRoomByCode: vi.fn().mockResolvedValue(null) });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/join').send({ code: 'NOPE12' });
    expect(res.status).toBe(404);
  });

  it('409s when the room is no longer waiting', async () => {
    const deps = baseDeps({ getRoomByCode: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'live' }) });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
    expect(res.status).toBe(409);
    expect(deps.addParticipant).not.toHaveBeenCalled();
  });

  it('seats the joiner in a waiting room', async () => {
    const deps = baseDeps({ getRoomByCode: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting' }) });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
    expect(res.status).toBe(200);
    expect(deps.addParticipant).toHaveBeenCalledWith('r1', 'user-1', 'user-1');
  });
});

describe('POST /api/rooms/match', () => {
  it('queues the caller when below the matching threshold', async () => {
    const deps = baseDeps({ listQueue: vi.fn().mockResolvedValue([{ id: 'a' }]) });
    const app = buildApp(deps, 'c');
    const res = await request(app).post('/api/rooms/match').send({ durationSeconds: 300 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'queued' });
    expect(deps.addToQueue).toHaveBeenCalledWith('c');
    expect(deps.insertRoom).not.toHaveBeenCalled();
  });

  it('returns queued without re-inserting if the caller already queued', async () => {
    const deps = baseDeps({ listQueue: vi.fn().mockResolvedValue([{ id: 'user-1' }]) });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/match').send({ durationSeconds: 300 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'queued' });
    expect(deps.addToQueue).not.toHaveBeenCalled();
  });

  it('forms a room, generates a topic, seats every member, and clears the queue once threshold is reached', async () => {
    const deps = baseDeps({
      listQueue: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      generateTopicFn: vi.fn().mockResolvedValue('Should AI grade exams?'),
      insertGeneratedTopic: vi.fn().mockResolvedValue({ id: 'topic-1', text: 'Should AI grade exams?' }),
      insertRoom: vi.fn().mockResolvedValue({ id: 'r1', code: 'MATCHD', status: 'waiting', topic_id: 'topic-1', duration_seconds: 300 }),
    });
    const app = buildApp(deps, 'c');
    const res = await request(app).post('/api/rooms/match').send({ durationSeconds: 300 });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('MATCHD');
    expect(res.body.members.sort()).toEqual(['a', 'b', 'c']);
    expect(deps.insertRoom).toHaveBeenCalledWith(
      expect.objectContaining({ topicId: 'topic-1', durationSeconds: 300, joinMode: 'random', createdBy: 'c' })
    );
    expect(deps.addParticipant).toHaveBeenCalledTimes(3);
    expect(deps.removeFromQueue).toHaveBeenCalledWith(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('requires durationSeconds', async () => {
    const deps = baseDeps();
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/match').send({});
    expect(res.status).toBe(400);
  });
});

// Without this, a student who queues and then closes the tab stays in the
// queue forever, and can be matched into a room nobody is watching -- which
// also burns the other members' time, since the room is created and seated
// for everyone regardless.
describe('DELETE /api/rooms/match (leave queue)', () => {
  it('removes only the caller from the queue', async () => {
    const deps = baseDeps();
    const app = buildApp(deps, 'user-1');
    const res = await request(app).delete('/api/rooms/match');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'left' });
    expect(deps.removeFromQueue).toHaveBeenCalledWith(['user-1']);
  });

  it('is idempotent when the caller was never queued', async () => {
    const deps = baseDeps({ removeFromQueue: vi.fn().mockResolvedValue(undefined) });
    const app = buildApp(deps, 'never-queued');
    const res = await request(app).delete('/api/rooms/match');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'left' });
  });
});

describe('POST /api/rooms/:id/start', () => {
  it('starts a waiting room and persists startedAt/endsAt', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'waiting', duration_seconds: 300, created_by: 'user-1' }),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/start').send();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('live');
    expect(deps.updateRoomStatus).toHaveBeenCalledWith('r1', expect.objectContaining({ status: 'live' }));
  });

  it('dispatches the transcription agent for the newly-live room', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'waiting', duration_seconds: 300, created_by: 'user-1' }),
    });
    const app = buildApp(deps);
    await request(app).post('/api/rooms/r1/start').send();
    expect(deps.startTranscriptionFn).toHaveBeenCalledWith({ id: 'r1', durationSeconds: 300 });
  });

  it('still responds 200 even if dispatching the transcription agent fails', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'waiting', duration_seconds: 300, created_by: 'user-1' }),
      startTranscriptionFn: vi.fn().mockRejectedValue(new Error('livekit unreachable')),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/start').send();
    expect(res.status).toBe(200);
  });

  it('403s when a non-creator tries to start the room', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'waiting', duration_seconds: 300, created_by: 'someone-else' }),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/start').send();
    expect(res.status).toBe(403);
  });

  it('409s when the room is not in a startable state', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'ended', duration_seconds: 300, created_by: 'user-1' }),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/start').send();
    expect(res.status).toBe(409);
  });

  // C1 (audit 2026-07-28): migration 0008 makes rooms.created_by
  // `on delete set null`, so a room outlives the student who created it
  // once they exercise their right to erasure. Nobody may then start it --
  // the creator-only gate is an equality check against req.userId, and a
  // NULL creator must never accidentally match. Pinned here because the
  // safety of that migration depends on this behaviour, and nothing else
  // in the suite covers a null creator.
  it('403s when the room has no creator (creator account was deleted)', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'waiting', duration_seconds: 300, created_by: null }),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/start').send();
    expect(res.status).toBe(403);
    expect(deps.updateRoomStatus).not.toHaveBeenCalled();
    expect(deps.startTranscriptionFn).not.toHaveBeenCalled();
  });
});

describe('GET /api/rooms/:id/status', () => {
  it('reports the current status without transitioning if time remains', async () => {
    const endsAt = Date.now() + 60_000;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: new Date(endsAt).toISOString() }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.body.status).toBe('live');
    expect(deps.updateRoomStatus).not.toHaveBeenCalled();
  });

  // C1 (audit 2026-07-28), same reasoning as the /start case above: after
  // migration 0008 a room can outlive its creator with created_by NULL.
  // isCreator must be false for everyone then, so the lobby never renders
  // a start button nobody is allowed to press.
  it('reports isCreator false when the room has no creator', async () => {
    const endsAt = Date.now() + 60_000;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({
        id: 'r1',
        status: 'live',
        duration_seconds: 300,
        created_by: null,
        ends_at: new Date(endsAt).toISOString(),
      }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.status).toBe(200);
    expect(res.body.isCreator).toBe(false);
  });

  // The lobby needs this to render a countdown -- without it, a
  // server-authoritative timer is invisible to the student watching it.
  it('includes endsAt so clients can render a countdown', async () => {
    const endsAt = Date.now() + 60_000;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: new Date(endsAt).toISOString() }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.body.endsAt).toBe(endsAt);
  });

  // Polling this route is not read-only -- it lazily flips an expired room
  // to 'ended' and dispatches feedback generation. Anyone holding a room id
  // could otherwise drive another group's session state and read their
  // topic, so it's gated the same way the token/participants/transcript
  // routes already are.
  it('403s for someone who is not seated in the room', async () => {
    const deps = baseDeps({
      isParticipant: vi.fn().mockResolvedValue(false),
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: null }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.status).toBe(403);
    expect(deps.updateRoomStatus).not.toHaveBeenCalled();
  });

  // The lobby's topic heading, room code, and creator-only start button all
  // came from react-router navigation state, so a browser refresh emptied
  // them. Serving them from the room itself makes the lobby survive a
  // reload.
  it('includes the room code, topic text, duration, and whether the caller created it', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({
        id: 'r1',
        code: 'ABCXYZ',
        status: 'waiting',
        duration_seconds: 300,
        ends_at: null,
        created_by: 'user-1',
        topics: { text: 'Is remote work here to stay?' },
      }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.body).toMatchObject({
      code: 'ABCXYZ',
      topicText: 'Is remote work here to stay?',
      durationSeconds: 300,
      isCreator: true,
    });
  });

  it('reports isCreator false for a participant who did not create the room', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({
        id: 'r1',
        code: 'ABCXYZ',
        status: 'waiting',
        duration_seconds: 300,
        ends_at: null,
        created_by: 'someone-else',
      }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.body.isCreator).toBe(false);
  });

  it('omits endsAt for a room that has not started yet', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'waiting', duration_seconds: 300, ends_at: null }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.body.endsAt).toBeUndefined();
  });

  it('lazily transitions to ended once the server-side timer has expired, for every poller', async () => {
    const endsAt = Date.now() - 1_000;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: new Date(endsAt).toISOString() }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.body.status).toBe('ended');
    expect(deps.updateRoomStatus).toHaveBeenCalledWith('r1', expect.objectContaining({ status: 'ended' }));
  });

  it('dispatches feedback generation exactly when the room newly transitions to ended', async () => {
    const endsAt = Date.now() - 1_000;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: new Date(endsAt).toISOString() }),
    });
    const app = buildApp(deps);
    await request(app).get('/api/rooms/r1/status');
    expect(deps.generateFeedbackFn).toHaveBeenCalledWith('r1');
  });

  // C3 (audit 2026-07-28). Every client in a room polls /status on the same
  // 3-second interval and the timer expires for all of them at the same
  // instant, so several pollers routinely read `status: 'live'` before any
  // of them has written 'ended'. Each one then dispatched its own full
  // feedback run, and generateFeedbackForRoom fans out one Gemini call per
  // participant -- so N participants produced N*N calls against a
  // rate-limited free tier, and the students whose calls got 429'd silently
  // received no feedback at all. Reproduced 4/4 at 0ms, 5ms and 25ms of
  // simulated DB latency.
  //
  // The transition must therefore be *claimed*, not just written: the
  // update carries a precondition on the room still being 'live', and only
  // the caller whose update actually matched a row dispatches feedback.
  // The mock below models exactly what Postgres does with that
  // precondition -- the first caller matches a row, everyone after gets
  // null.
  it('dispatches feedback only once when several participants poll an expired room together', async () => {
    const endsAt = Date.now() - 1_000;
    let claimed = false;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: new Date(endsAt).toISOString() }),
      updateRoomStatus: vi.fn(async (id) => {
        if (claimed) return null;
        claimed = true;
        return { id, status: 'ended' };
      }),
    });
    const app = buildApp(deps);

    const responses = await Promise.all([
      request(app).get('/api/rooms/r1/status'),
      request(app).get('/api/rooms/r1/status'),
      request(app).get('/api/rooms/r1/status'),
      request(app).get('/api/rooms/r1/status'),
    ]);

    // Every poller still gets a correct answer -- losing the race is not an
    // error, it just means someone else already ended the room.
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(responses.map((r) => r.body.status)).toEqual(['ended', 'ended', 'ended', 'ended']);
    expect(deps.generateFeedbackFn).toHaveBeenCalledTimes(1);
  });

  // The claim has to be enforced by Postgres, not by JS state: under the
  // deployment target (Render, one container) module state would happen to
  // work, but the precondition is what makes this correct at all, and it's
  // the only thing that keeps it correct if this ever runs as more than one
  // instance.
  it('claims the ended transition with a precondition on the room still being live', async () => {
    const endsAt = Date.now() - 1_000;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: new Date(endsAt).toISOString() }),
      updateRoomStatus: vi.fn().mockResolvedValue({ id: 'r1', status: 'ended' }),
    });
    const app = buildApp(deps);
    await request(app).get('/api/rooms/r1/status');
    expect(deps.updateRoomStatus).toHaveBeenCalledWith('r1', expect.objectContaining({ status: 'ended', expectedStatus: 'live' }));
  });

  it('does not dispatch feedback generation when the room is not yet ended', async () => {
    const endsAt = Date.now() + 60_000;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: new Date(endsAt).toISOString() }),
    });
    const app = buildApp(deps);
    await request(app).get('/api/rooms/r1/status');
    expect(deps.generateFeedbackFn).not.toHaveBeenCalled();
  });

  it('still responds 200 even if dispatching feedback generation fails', async () => {
    const endsAt = Date.now() - 1_000;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: new Date(endsAt).toISOString() }),
      generateFeedbackFn: vi.fn().mockRejectedValue(new Error('gemini unreachable')),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ended');
  });
});

describe('GET /api/rooms/:id/feedback/mine', () => {
  it('returns null while feedback has not been generated yet', async () => {
    const deps = baseDeps({ getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue(null) });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/feedback/mine');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ feedback: null });
  });

  it("returns the caller's own feedback body once generated", async () => {
    const deps = baseDeps({
      getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue({ body: 'You stayed on topic throughout.' }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/feedback/mine');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ feedback: 'You stayed on topic throughout.' });
  });

  it('looks up feedback scoped to the caller, not just the room', async () => {
    const deps = baseDeps({ getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue(null) });
    const app = buildApp(deps, 'user-42');
    await request(app).get('/api/rooms/r1/feedback/mine');
    expect(deps.getFeedbackForRoomAndUserFn).toHaveBeenCalledWith('r1', 'user-42');
  });

  it('includes a prior rating and reason once one has been given', async () => {
    const deps = baseDeps({
      getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue({ body: 'Good pacing.', rating: true, rating_reason: 'Specific and kind' }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/feedback/mine');
    expect(res.body).toEqual({ feedback: 'Good pacing.', rating: true, ratingReason: 'Specific and kind' });
  });
});

// S1 (pilot-readiness audit): the only evidence feedback is actually
// useful was one founder's opinion -- a thumbs up/down + one-line "why"
// gives real signal from every session, cheaply.
describe('PATCH /api/rooms/:id/feedback/mine/rating', () => {
  it('404s if this caller has no feedback for this room yet', async () => {
    const deps = baseDeps({ getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue(null) });
    const app = buildApp(deps);
    const res = await request(app).patch('/api/rooms/r1/feedback/mine/rating').send({ rating: true });
    expect(res.status).toBe(404);
    expect(deps.rateFeedbackFn).not.toHaveBeenCalled();
  });

  it('requires rating to be a boolean', async () => {
    const deps = baseDeps({ getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue({ body: 'x' }) });
    const app = buildApp(deps);
    const res = await request(app).patch('/api/rooms/r1/feedback/mine/rating').send({ rating: 'yes' });
    expect(res.status).toBe(400);
  });

  it('records a thumbs-up with an optional one-line reason, scoped to the caller', async () => {
    const deps = baseDeps({
      getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue({ body: 'x' }),
      rateFeedbackFn: vi.fn().mockResolvedValue({ rating: true, rating_reason: 'Called out my filler words' }),
    });
    const app = buildApp(deps, 'user-42');
    const res = await request(app)
      .patch('/api/rooms/r1/feedback/mine/rating')
      .send({ rating: true, reason: 'Called out my filler words' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rating: true, ratingReason: 'Called out my filler words' });
    expect(deps.rateFeedbackFn).toHaveBeenCalledWith('r1', 'user-42', { rating: true, reason: 'Called out my filler words' });
  });

  it('accepts a thumbs-down with no reason', async () => {
    const deps = baseDeps({
      getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue({ body: 'x' }),
      rateFeedbackFn: vi.fn().mockResolvedValue({ rating: false, rating_reason: null }),
    });
    const app = buildApp(deps);
    const res = await request(app).patch('/api/rooms/r1/feedback/mine/rating').send({ rating: false });
    expect(res.status).toBe(200);
    expect(deps.rateFeedbackFn).toHaveBeenCalledWith('r1', 'user-1', { rating: false, reason: undefined });
  });
});

describe('POST /api/rooms/:id/token', () => {
  it('404s when the room does not exist', async () => {
    const deps = baseDeps({ getRoomById: vi.fn().mockResolvedValue(null) });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/token').send();
    expect(res.status).toBe(404);
  });

  it('403s with consent_required when the caller has no current consent', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', created_by: 'user-1' }),
      getLatestConsent: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/token').send();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'consent_required' });
    expect(deps.mintTokenFn).not.toHaveBeenCalled();
  });

  it('403s when the caller is not a participant of the room', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', created_by: 'someone-else' }),
      isParticipant: vi.fn().mockResolvedValue(false),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/token').send();
    expect(res.status).toBe(403);
    expect(deps.mintTokenFn).not.toHaveBeenCalled();
  });

  it('409s when the room has already ended', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'ended', created_by: 'user-1' }),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/token').send();
    expect(res.status).toBe(409);
    expect(deps.mintTokenFn).not.toHaveBeenCalled();
  });

  it('mints and returns a token for an authorized, consented participant', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', created_by: 'user-1' }),
    });
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/r1/token').send();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: 'signed.jwt.token',
      url: 'wss://example.livekit.cloud',
      identity: 'user-1',
      roomName: 'r1',
    });
    expect(deps.mintTokenFn).toHaveBeenCalledWith('user-1', 'r1', expect.objectContaining({ name: 'user-1' }));
  });
});

describe('GET /api/rooms/:id/participants', () => {
  // Speaker labels in the live caption UI are currently a truncated LiveKit
  // identity (a raw user id) -- this endpoint is what lets the client show
  // real names instead, reusing the same participants+profiles join the W6
  // feedback worker already does.
  it('403s when the caller is not a participant of the room', async () => {
    const deps = baseDeps({ isParticipant: vi.fn().mockResolvedValue(false) });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/participants');
    expect(res.status).toBe(403);
  });

  it('returns each participant with their display name', async () => {
    const deps = baseDeps({
      listParticipantsFn: vi.fn().mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }]),
      listProfilesFn: vi.fn().mockResolvedValue([{ id: 'u1', display_name: 'Asha' }]),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/participants');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      participants: [
        { userId: 'u1', displayName: 'Asha' },
        { userId: 'u2', displayName: 'u2' },
      ],
    });
  });
});

describe('GET /api/rooms/:id/transcript', () => {
  // Feedback is currently a bare paragraph with no transcript alongside it,
  // even though transcript_lines already holds the attributed lines a
  // student would want to re-read next to their feedback.
  it('403s when the caller is not a participant of the room', async () => {
    const deps = baseDeps({ isParticipant: vi.fn().mockResolvedValue(false) });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/transcript');
    expect(res.status).toBe(403);
  });

  it('returns transcript lines attributed by display name', async () => {
    const deps = baseDeps({
      listParticipantsFn: vi.fn().mockResolvedValue([{ user_id: 'u1' }]),
      listProfilesFn: vi.fn().mockResolvedValue([{ id: 'u1', display_name: 'Asha' }]),
      listTranscriptLinesForRoomFn: vi
        .fn()
        .mockResolvedValue([{ user_id: 'u1', text: 'Hello everyone', started_at_ms: 1000 }]),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/transcript');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      lines: [{ userId: 'u1', displayName: 'Asha', text: 'Hello everyone', startedAtMs: 1000 }],
    });
  });
});

describe('GET /api/rooms/mine/active', () => {
  // A student who's still sitting in the matchmaking queue has no other
  // way to discover that someone else's /match request completed a group
  // that includes them -- their queue row is gone (matched, not waiting)
  // but nothing pushes that news to them. This is what the lobby/match UI
  // polls to find out.
  it('returns null when the caller has no non-ended room', async () => {
    const deps = baseDeps({ getActiveRoomForUser: vi.fn().mockResolvedValue(null) });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/mine/active');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ room: null });
  });

  it('returns the room when the caller is a participant in a non-ended room', async () => {
    const deps = baseDeps({
      getActiveRoomForUser: vi.fn().mockResolvedValue({ id: 'r1', code: 'MATCHD', status: 'waiting' }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/mine/active');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ room: { id: 'r1', code: 'MATCHD', status: 'waiting' } });
    expect(deps.getActiveRoomForUser).toHaveBeenCalledWith('user-1');
  });
});
