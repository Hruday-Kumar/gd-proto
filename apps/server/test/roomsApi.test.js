// Router-level tests for room creation/join/matching (W4). requireAuth is
// stubbed and every persistence/Gemini call is injected -- no live DB or
// network, same pattern as consentApi.test.js / topicsApi.test.js. These
// tests exercise how the three pure domain functions (roomCode,
// matchmaking, sessionStateMachine) get wired to persistence, which is
// exactly where a wiring bug would hide.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRoomsRouter } from '../src/api/routes/rooms.js';
import { createLlmRateLimiter, createRoomActionRateLimiter } from '../src/api/middleware/rateLimit.js';
import { CURRENT_CONSENT_VERSION } from '../src/domain/consent.js';
import { DEFAULT_MAX_ROOM_PARTICIPANTS } from '../src/domain/roomCapacity.js';
import { DEFAULT_VISIBILITY } from '../src/domain/roomVisibility.js';
import { DEFAULT_LEVEL } from '../src/domain/roomLevel.js';

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
    removeParticipant: vi.fn(),
    listQueue: vi.fn().mockResolvedValue([]),
    addToQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    // H7: claimFromQueue defaults to "claim succeeded in full" -- echoes
    // back whatever ids it was asked to claim, matching the real
    // db/matchmakingQueue.js contract when nobody else is racing.
    claimFromQueue: vi.fn((ids) => Promise.resolve(ids)),
    insertGeneratedTopic: vi.fn(),
    generateTopicFn: vi.fn(),
    getActiveRoomForUser: vi.fn().mockResolvedValue(null),
    minGroupSize: 3,
    maxGroupSize: 6,
    isParticipant: vi.fn().mockResolvedValue(true),
    getLatestConsent: vi.fn().mockResolvedValue({ consent_version: CURRENT_CONSENT_VERSION }),
    mintTokenFn: vi.fn().mockResolvedValue('signed.jwt.token'),
    liveKitUrl: 'wss://example.livekit.cloud',
    startTranscriptionFn: vi.fn().mockResolvedValue(undefined),
    getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue(null),
    rateFeedbackFn: vi.fn().mockResolvedValue({ rating: true, rating_reason: null }),
    listParticipantsFn: vi.fn().mockResolvedValue([]),
    listProfilesFn: vi.fn().mockResolvedValue([]),
    listTranscriptLinesForRoomFn: vi.fn().mockResolvedValue([]),
    listOpenRoomsFn: vi.fn().mockResolvedValue([]),
    listParticipantsForRoomsFn: vi.fn().mockResolvedValue([]),
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

  // H3 (audit 2026-07-28). `!durationSeconds` was the only check, so every
  // one of these reached the database. A room created with an out-of-range
  // duration never expires (no feedback is ever dispatched) and its agent's
  // stop timer overflows int32, disconnecting the transcriber at 1ms -- so
  // the session runs indefinitely with no transcript.
  it.each([
    ['above the maximum', 2_000_000_000],
    ['negative', -5],
    ['fractional', 0.5],
    ['below the minimum', 30],
    ['a numeric string', '600'],
  ])('rejects a %s durationSeconds without touching the database', async (_label, durationSeconds) => {
    const deps = baseDeps();
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds });
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

  // N3 (audit comparison, 2026-07-29): confirms the limiter is actually
  // attached to this route (see roomActionRateLimit.test.js for the
  // limiter's own behavior).
  it('is rate-limited per user', async () => {
    const deps = baseDeps({
      insertRoom: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting', topic_id: 't1', duration_seconds: 300 }),
      roomActionRateLimiter: createRoomActionRateLimiter({ windowMs: 60_000, max: 2 }),
    });
    const app = buildApp(deps);
    await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300 });
    await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300 });
    const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300 });
    expect(res.status).toBe(429);
  });

  // BE-2 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0002): the room
  // creator's chosen seat cap, stored per room instead of always getting
  // the global DEFAULT_MAX_ROOM_PARTICIPANTS constant.
  describe('configurable capacity (BE-2)', () => {
    it('passes an explicit maxParticipants through to insertRoom and echoes it in the response', async () => {
      const deps = baseDeps({
        insertRoom: vi.fn().mockResolvedValue({
          id: 'r1',
          code: 'ABCXYZ',
          status: 'waiting',
          topic_id: 't1',
          duration_seconds: 300,
          max_participants: 4,
        }),
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300, maxParticipants: 4 });
      expect(res.status).toBe(201);
      expect(res.body.maxParticipants).toBe(4);
      expect(deps.insertRoom).toHaveBeenCalledWith(expect.objectContaining({ maxParticipants: 4 }));
    });

    it('defaults to DEFAULT_MAX_ROOM_PARTICIPANTS when maxParticipants is omitted', async () => {
      const deps = baseDeps({
        insertRoom: vi.fn().mockResolvedValue({
          id: 'r1',
          code: 'ABCXYZ',
          status: 'waiting',
          topic_id: 't1',
          duration_seconds: 300,
          max_participants: DEFAULT_MAX_ROOM_PARTICIPANTS,
        }),
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300 });
      expect(res.status).toBe(201);
      expect(res.body.maxParticipants).toBe(DEFAULT_MAX_ROOM_PARTICIPANTS);
      expect(deps.insertRoom).toHaveBeenCalledWith(expect.objectContaining({ maxParticipants: DEFAULT_MAX_ROOM_PARTICIPANTS }));
    });

    it.each([
      ['below the minimum', 2],
      ['above the maximum', 13],
      ['fractional', 4.5],
      ['a numeric string', '6'],
    ])('rejects a %s maxParticipants without touching the database', async (_label, maxParticipants) => {
      const deps = baseDeps();
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300, maxParticipants });
      expect(res.status).toBe(400);
      expect(deps.insertRoom).not.toHaveBeenCalled();
    });
  });

  // BE-3 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0003): the room
  // creator's chosen visibility, persisted per room. No listing endpoint
  // reads this yet (that's BE-1) -- this only proves the value round-trips
  // correctly through creation.
  describe('room visibility (BE-3)', () => {
    it('passes an explicit visibility through to insertRoom and echoes it in the response', async () => {
      const deps = baseDeps({
        insertRoom: vi.fn().mockResolvedValue({
          id: 'r1',
          code: 'ABCXYZ',
          status: 'waiting',
          topic_id: 't1',
          duration_seconds: 300,
          max_participants: DEFAULT_MAX_ROOM_PARTICIPANTS,
          visibility: 'public',
        }),
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300, visibility: 'public' });
      expect(res.status).toBe(201);
      expect(res.body.visibility).toBe('public');
      expect(deps.insertRoom).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public' }));
    });

    it('defaults to DEFAULT_VISIBILITY (private) when visibility is omitted', async () => {
      const deps = baseDeps({
        insertRoom: vi.fn().mockResolvedValue({
          id: 'r1',
          code: 'ABCXYZ',
          status: 'waiting',
          topic_id: 't1',
          duration_seconds: 300,
          max_participants: DEFAULT_MAX_ROOM_PARTICIPANTS,
          visibility: DEFAULT_VISIBILITY,
        }),
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300 });
      expect(res.status).toBe(201);
      expect(res.body.visibility).toBe(DEFAULT_VISIBILITY);
      expect(deps.insertRoom).toHaveBeenCalledWith(expect.objectContaining({ visibility: DEFAULT_VISIBILITY }));
    });

    it.each([
      ['an unrelated string', 'secret'],
      ['wrong case', 'Public'],
      ['a number', 1],
      ['a boolean', true],
    ])('rejects a %s visibility without touching the database', async (_label, visibility) => {
      const deps = baseDeps();
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300, visibility });
      expect(res.status).toBe(400);
      expect(deps.insertRoom).not.toHaveBeenCalled();
    });
  });

  // BE-4 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0005): the room
  // creator's chosen level, room-creation half only -- match-side
  // filtering is deferred (see the /match test below).
  describe('room level (BE-4)', () => {
    it('passes an explicit level through to insertRoom and echoes it in the response', async () => {
      const deps = baseDeps({
        insertRoom: vi.fn().mockResolvedValue({
          id: 'r1',
          code: 'ABCXYZ',
          status: 'waiting',
          topic_id: 't1',
          duration_seconds: 300,
          max_participants: DEFAULT_MAX_ROOM_PARTICIPANTS,
          visibility: DEFAULT_VISIBILITY,
          level: 'advanced',
        }),
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300, level: 'advanced' });
      expect(res.status).toBe(201);
      expect(res.body.level).toBe('advanced');
      expect(deps.insertRoom).toHaveBeenCalledWith(expect.objectContaining({ level: 'advanced' }));
    });

    it('defaults to DEFAULT_LEVEL (intermediate) when level is omitted', async () => {
      const deps = baseDeps({
        insertRoom: vi.fn().mockResolvedValue({
          id: 'r1',
          code: 'ABCXYZ',
          status: 'waiting',
          topic_id: 't1',
          duration_seconds: 300,
          max_participants: DEFAULT_MAX_ROOM_PARTICIPANTS,
          visibility: DEFAULT_VISIBILITY,
          level: DEFAULT_LEVEL,
        }),
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300 });
      expect(res.status).toBe(201);
      expect(res.body.level).toBe(DEFAULT_LEVEL);
      expect(deps.insertRoom).toHaveBeenCalledWith(expect.objectContaining({ level: DEFAULT_LEVEL }));
    });

    it.each([
      ['an unrelated string', 'expert'],
      ['wrong case', 'Beginner'],
      ['a number', 1],
      ['a boolean', true],
    ])('rejects a %s level without touching the database', async (_label, level) => {
      const deps = baseDeps();
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms').send({ topicId: 't1', durationSeconds: 300, level });
      expect(res.status).toBe(400);
      expect(deps.insertRoom).not.toHaveBeenCalled();
    });
  });
});

describe('GET /api/rooms/open', () => {
  it('returns an empty list when there are no open rooms', async () => {
    const deps = baseDeps();
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/open');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rooms: [] });
  });

  it('shapes open rooms via buildOpenRoomsList, resolving host names from profiles', async () => {
    const deps = baseDeps({
      listOpenRoomsFn: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          code: 'ABCXYZ',
          duration_seconds: 900,
          max_participants: 6,
          created_by: 'host-1',
          created_at: '2026-08-01T00:00:00.000Z',
          topics: { text: 'Should AI grade exams?' },
        },
      ]),
      listParticipantsForRoomsFn: vi.fn().mockResolvedValue([{ room_id: 'r1', user_id: 'a' }]),
      listProfilesFn: vi.fn().mockResolvedValue([{ id: 'host-1', display_name: 'Asha' }]),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/open');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      rooms: [
        {
          id: 'r1',
          code: 'ABCXYZ',
          topicText: 'Should AI grade exams?',
          durationSeconds: 900,
          maxParticipants: 6,
          participantCount: 1,
          hostDisplayName: 'Asha',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    });
    // Only the rooms actually returned by listOpenRoomsFn get their
    // participants/profiles fetched -- confirms the route wires the two
    // batched queries to the fetched rooms rather than something static.
    expect(deps.listParticipantsForRoomsFn).toHaveBeenCalledWith(['r1']);
    expect(deps.listProfilesFn).toHaveBeenCalledWith(['host-1']);
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

  // N3 (audit comparison, 2026-07-29): a leaked room code otherwise let an
  // unbounded number of participants join a single 'waiting' room -- each
  // seat costs a live LiveKit connection, a per-speaker AssemblyAI stream
  // once the room starts, and a Gemini feedback call once it ends.
  describe('participant cap', () => {
    function fullRoomDeps(overrides = {}) {
      return baseDeps({
        getRoomByCode: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting' }),
        isParticipant: vi.fn().mockResolvedValue(false),
        listParticipantsFn: vi.fn().mockResolvedValue(Array(DEFAULT_MAX_ROOM_PARTICIPANTS).fill({ user_id: 'someone' })),
        ...overrides,
      });
    }

    it('rejects a new joiner once the room already has the maximum number of participants', async () => {
      const deps = fullRoomDeps();
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: expect.any(String) });
      expect(deps.addParticipant).not.toHaveBeenCalled();
    });

    it('allows a new joiner while the room is below the maximum', async () => {
      const deps = baseDeps({
        getRoomByCode: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting' }),
        isParticipant: vi.fn().mockResolvedValue(false),
        listParticipantsFn: vi.fn().mockResolvedValue(Array(DEFAULT_MAX_ROOM_PARTICIPANTS - 1).fill({ user_id: 'someone' })),
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
      expect(res.status).toBe(200);
      expect(deps.addParticipant).toHaveBeenCalledWith('r1', 'user-1', 'user-1');
    });

    // Duplicate join: a student re-fetching the lobby (browser refresh,
    // reconnect) is already one of the counted seats, not an additional
    // one -- the cap must never block a rejoin.
    it('always allows a rejoin by an already-seated participant, even when the room is at the cap', async () => {
      const deps = fullRoomDeps({ isParticipant: vi.fn().mockResolvedValue(true) });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
      expect(res.status).toBe(200);
      expect(deps.addParticipant).toHaveBeenCalledWith('r1', 'user-1', 'user-1');
    });

    // Concurrent joins: two requests can both pass the pre-insert check
    // against the same stale count before either of their inserts lands.
    // Re-verifying the count after inserting -- and backing the seat back
    // out if it turns out a concurrent joiner won the race -- bounds this
    // without needing a schema-level atomic guarantee.
    it('backs out its own seat if a concurrent joiner fills the room between the pre- and post-insert checks', async () => {
      const listParticipantsFn = vi
        .fn()
        .mockResolvedValueOnce(Array(DEFAULT_MAX_ROOM_PARTICIPANTS - 1).fill({ user_id: 'someone' })) // pre-insert: room for one more
        .mockResolvedValueOnce(Array(DEFAULT_MAX_ROOM_PARTICIPANTS + 1).fill({ user_id: 'someone' })); // post-insert: a concurrent joiner also landed
      const deps = baseDeps({
        getRoomByCode: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting' }),
        isParticipant: vi.fn().mockResolvedValue(false),
        listParticipantsFn,
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });

      expect(deps.addParticipant).toHaveBeenCalledWith('r1', 'user-1', 'user-1');
      expect(deps.removeParticipant).toHaveBeenCalledWith('r1', 'user-1');
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: expect.any(String) });
    });

    it('does not back out the seat when the post-insert count lands exactly at the cap', async () => {
      const listParticipantsFn = vi
        .fn()
        .mockResolvedValueOnce(Array(DEFAULT_MAX_ROOM_PARTICIPANTS - 1).fill({ user_id: 'someone' }))
        .mockResolvedValueOnce(Array(DEFAULT_MAX_ROOM_PARTICIPANTS).fill({ user_id: 'someone' }));
      const deps = baseDeps({
        getRoomByCode: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting' }),
        isParticipant: vi.fn().mockResolvedValue(false),
        listParticipantsFn,
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });

      expect(res.status).toBe(200);
      expect(deps.removeParticipant).not.toHaveBeenCalled();
    });

    // BE-2 (SPEC-0002): before this, every room -- regardless of what its
    // creator picked -- was capped at the same global constant. This proves
    // the join check now reads the room's *own* stored value: a room
    // created with maxParticipants: 3 must reject a 4th joiner even though
    // that's well below DEFAULT_MAX_ROOM_PARTICIPANTS (6).
    it("enforces the room's own max_participants, not the global default", async () => {
      const deps = baseDeps({
        getRoomByCode: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting', max_participants: 3 }),
        isParticipant: vi.fn().mockResolvedValue(false),
        listParticipantsFn: vi.fn().mockResolvedValue(Array(3).fill({ user_id: 'someone' })),
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
      expect(res.status).toBe(409);
      expect(deps.addParticipant).not.toHaveBeenCalled();
    });

    it('allows joining a room below its own smaller max_participants', async () => {
      const deps = baseDeps({
        getRoomByCode: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting', max_participants: 3 }),
        isParticipant: vi.fn().mockResolvedValue(false),
        listParticipantsFn: vi.fn().mockResolvedValue(Array(2).fill({ user_id: 'someone' })),
      });
      const app = buildApp(deps);
      const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
      expect(res.status).toBe(200);
      expect(deps.addParticipant).toHaveBeenCalledWith('r1', 'user-1', 'user-1');
    });
  });

  // N3 (audit comparison, 2026-07-29): confirms the limiter is actually
  // attached to this route (see roomActionRateLimit.test.js for the
  // limiter's own behavior).
  it('is rate-limited per user', async () => {
    const deps = baseDeps({
      getRoomByCode: vi.fn().mockResolvedValue({ id: 'r1', code: 'ABCXYZ', status: 'waiting' }),
      roomActionRateLimiter: createRoomActionRateLimiter({ windowMs: 60_000, max: 2 }),
    });
    const app = buildApp(deps);
    await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
    await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
    const res = await request(app).post('/api/rooms/join').send({ code: 'ABCXYZ' });
    expect(res.status).toBe(429);
  });
});

describe('POST /api/rooms/match', () => {
  // Same H3 hole as POST /api/rooms: this route also only checked
  // `!durationSeconds`, and it's worse here -- the duration a matched room
  // gets is whichever caller happened to complete the group, so one bad
  // value takes down a session for up to six students, not just its sender.
  it.each([
    ['above the maximum', 2_000_000_000],
    ['negative', -5],
    ['fractional', 0.5],
    ['a numeric string', '600'],
  ])('rejects a %s durationSeconds without queueing or creating a room', async (_label, durationSeconds) => {
    const deps = baseDeps({ listQueue: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]) });
    const app = buildApp(deps, 'c');
    const res = await request(app).post('/api/rooms/match').send({ durationSeconds });
    expect(res.status).toBe(400);
    expect(deps.addToQueue).not.toHaveBeenCalled();
    expect(deps.insertRoom).not.toHaveBeenCalled();
  });

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
    // H7: only the pre-existing queue members are claimed -- 'c' (the
    // joiner) was never in the queue table, so there's nothing to remove
    // for them; claimMatchOrQueue's atomic claim already handled this.
    expect(deps.claimFromQueue).toHaveBeenCalledWith(expect.arrayContaining(['a', 'b']));
    expect(deps.removeFromQueue).not.toHaveBeenCalled();
  });

  // BE-3 (SPEC-0003, Non Goal): matched rooms are system-formed, not
  // creator-configured -- this route must never pass a visibility, so the
  // column's own DEFAULT 'private' applies at the DB level.
  it('does not pass visibility to insertRoom -- matched rooms rely on the column default', async () => {
    const deps = baseDeps({
      listQueue: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      generateTopicFn: vi.fn().mockResolvedValue('Should AI grade exams?'),
      insertGeneratedTopic: vi.fn().mockResolvedValue({ id: 'topic-1', text: 'Should AI grade exams?' }),
      insertRoom: vi.fn().mockResolvedValue({ id: 'r1', code: 'MATCHD', status: 'waiting', topic_id: 'topic-1', duration_seconds: 300 }),
    });
    const app = buildApp(deps, 'c');
    const res = await request(app).post('/api/rooms/match').send({ durationSeconds: 300 });
    expect(res.status).toBe(201);
    expect(deps.insertRoom).toHaveBeenCalledWith(expect.not.objectContaining({ visibility: expect.anything() }));
  });

  // BE-4 (SPEC-0005, Non Goal): match-side level filtering is deferred
  // (to fold in alongside BE-5) -- this route must never pass a level
  // either, so the column's own DEFAULT 'intermediate' applies.
  it('does not pass level to insertRoom -- matched rooms rely on the column default', async () => {
    const deps = baseDeps({
      listQueue: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      generateTopicFn: vi.fn().mockResolvedValue('Should AI grade exams?'),
      insertGeneratedTopic: vi.fn().mockResolvedValue({ id: 'topic-1', text: 'Should AI grade exams?' }),
      insertRoom: vi.fn().mockResolvedValue({ id: 'r1', code: 'MATCHD', status: 'waiting', topic_id: 'topic-1', duration_seconds: 300 }),
    });
    const app = buildApp(deps, 'c');
    const res = await request(app).post('/api/rooms/match').send({ durationSeconds: 300 });
    expect(res.status).toBe(201);
    expect(deps.insertRoom).toHaveBeenCalledWith(expect.not.objectContaining({ level: expect.anything() }));
  });

  // H7 (engineering audit, 2026-07-28): two students hitting /match near-
  // simultaneously must not both complete the same match by claiming the
  // same pre-existing queue members -- see domain/matchmakingClaim.js and
  // its own dedicated test suite (matchmakingClaim.test.js) for the full
  // race-retry behavior. This just confirms the route is actually wired to
  // that race-safe path rather than the old plain read-then-write.
  it('retries the match claim when a concurrent request already took a queued member', async () => {
    const deps = baseDeps({
      // Attempt 1: queue looks like [a, b] -- with joiner 'c' that's enough
      // to match (minGroupSize 3). But claiming ['a', 'b'] only succeeds for
      // 'a' -- a concurrent request already took 'b' for a different match.
      // Attempt 2 (fresh read): 'a' has been re-queued by the failed
      // attempt, and 'd' joined independently meanwhile -- enough to match
      // again, and this time the claim succeeds in full.
      listQueue: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'd' }]),
      claimFromQueue: vi.fn().mockResolvedValueOnce(['a']).mockResolvedValueOnce(['a', 'd']),
      generateTopicFn: vi.fn().mockResolvedValue('Should AI grade exams?'),
      insertGeneratedTopic: vi.fn().mockResolvedValue({ id: 'topic-1', text: 'Should AI grade exams?' }),
      insertRoom: vi.fn().mockResolvedValue({ id: 'r1', code: 'MATCHD', status: 'waiting', topic_id: 'topic-1', duration_seconds: 300 }),
    });
    const app = buildApp(deps, 'c');
    const res = await request(app).post('/api/rooms/match').send({ durationSeconds: 300 });
    expect(res.status).toBe(201);
    expect(res.body.members.sort()).toEqual(['a', 'c', 'd']);
    expect(deps.listQueue).toHaveBeenCalledTimes(2);
    // 'a' was re-queued after the lost race, not silently dropped.
    expect(deps.addToQueue).toHaveBeenCalledWith('a');
  });

  it('requires durationSeconds', async () => {
    const deps = baseDeps();
    const app = buildApp(deps);
    const res = await request(app).post('/api/rooms/match').send({});
    expect(res.status).toBe(400);
  });

  // H4 (audit 2026-07-28): confirms the limiter is actually attached to
  // this route, not just correct in isolation (see llmRateLimit.test.js
  // for the limiter's own behavior).
  it('is rate-limited per user', async () => {
    const deps = baseDeps({ llmRateLimiter: createLlmRateLimiter({ windowMs: 60_000, max: 2 }) });
    const app = buildApp(deps, 'c');
    await request(app).post('/api/rooms/match').send({ durationSeconds: 300 });
    await request(app).post('/api/rooms/match').send({ durationSeconds: 300 });
    const res = await request(app).post('/api/rooms/match').send({ durationSeconds: 300 });
    expect(res.status).toBe(429);
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

  // M10 (audit 2026-07-28): this route used to lazily flip an expired room
  // to 'ended' and dispatch feedback generation as a side effect of a GET
  // -- any retry, prefetch, or proxy replay could re-trigger it. That job
  // now belongs to the periodic sweep (agent/roomSweeper.js, test/
  // roomSweeper.test.js); this route only ever reads whatever the sweep
  // already wrote, even if the room's ends_at has already passed.
  it('does not transition or dispatch feedback even when the timer has expired -- that is the sweep\'s job now', async () => {
    const endsAt = Date.now() - 1_000;
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', duration_seconds: 300, ends_at: new Date(endsAt).toISOString() }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.body.status).toBe('live');
    expect(deps.updateRoomStatus).not.toHaveBeenCalled();
  });

  it('reports whatever status the sweep already wrote, without touching it', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'ended', duration_seconds: 300, ends_at: new Date(Date.now() - 1_000).toISOString() }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/status');
    expect(res.body.status).toBe('ended');
    expect(deps.updateRoomStatus).not.toHaveBeenCalled();
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
    // SPEC-0006 (BE-6/BE-7): a pre-migration/pre-structured row has no
    // score/dimensions/strengths/improvements -- these must default to
    // null/[] rather than being omitted or crashing the route.
    expect(res.body).toEqual({
      feedback: 'You stayed on topic throughout.',
      score: null,
      dimensions: [],
      strengths: [],
      improvements: [],
    });
  });

  it("returns the caller's own structured score/rubric/strengths/improvements once generated", async () => {
    const dimensions = [{ label: 'Content depth', score: 80, note: 'Backed a claim.' }];
    const deps = baseDeps({
      getFeedbackForRoomAndUserFn: vi.fn().mockResolvedValue({
        body: 'You stayed on topic throughout.',
        score: 82,
        dimensions,
        strengths: ['Clear opening.'],
        improvements: ['Invite others in more.'],
      }),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/feedback/mine');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      feedback: 'You stayed on topic throughout.',
      score: 82,
      dimensions,
      strengths: ['Clear opening.'],
      improvements: ['Invite others in more.'],
    });
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
    expect(res.body).toEqual({
      feedback: 'Good pacing.',
      score: null,
      dimensions: [],
      strengths: [],
      improvements: [],
      rating: true,
      ratingReason: 'Specific and kind',
    });
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

  // L6 (audit 2026-07-28): tokens used to be minted with name: req.userId --
  // a raw UUID in the participant name on any default LiveKit surface. The
  // above test's fallback (baseDeps' default listProfilesFn resolves no
  // profile, so name stays the raw id) still covers "no display name on
  // file"; this covers the common case where one exists.
  it('mints a token using the participant\'s display name, not their raw user id', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', created_by: 'user-1' }),
      listProfilesFn: vi.fn().mockResolvedValue([{ id: 'user-1', display_name: 'Asha' }]),
    });
    const app = buildApp(deps);
    await request(app).post('/api/rooms/r1/token').send();
    expect(deps.mintTokenFn).toHaveBeenCalledWith('user-1', 'r1', expect.objectContaining({ name: 'Asha' }));
  });

  // M1 (engineering audit, 2026-07-28): a student token that grants
  // canPublishData lets any student forge live-caption data messages over
  // the room's data channel -- the same channel the transcription agent
  // uses to broadcast real captions -- undermining the attribution the
  // whole product is built on. Only the agent worker's own token needs
  // canPublishData:true (agent/roomAgent.js); a student's never does.
  it('mints a student token with canPublishData explicitly false', async () => {
    const deps = baseDeps({
      getRoomById: vi.fn().mockResolvedValue({ id: 'r1', status: 'live', created_by: 'user-1' }),
    });
    const app = buildApp(deps);
    await request(app).post('/api/rooms/r1/token').send();
    expect(deps.mintTokenFn).toHaveBeenCalledWith('user-1', 'r1', expect.objectContaining({ canPublishData: false }));
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
        { userId: 'u1', displayName: 'Asha', talkShare: 0 },
        { userId: 'u2', displayName: 'u2', talkShare: 0 },
      ],
    });
  });

  // BE-10 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0007): each
  // participant's share of the room's total attributed speaking time.
  it('includes each participant\'s talkShare computed from the room\'s transcript', async () => {
    const deps = baseDeps({
      listParticipantsFn: vi.fn().mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }]),
      listProfilesFn: vi.fn().mockResolvedValue([
        { id: 'u1', display_name: 'Asha' },
        { id: 'u2', display_name: 'Karan' },
      ]),
      listTranscriptLinesForRoomFn: vi.fn().mockResolvedValue([
        { user_id: 'u1', started_at_ms: 0, ended_at_ms: 2000 },
        { user_id: 'u2', started_at_ms: 2000, ended_at_ms: 3000 },
      ]),
    });
    const app = buildApp(deps);
    const res = await request(app).get('/api/rooms/r1/participants');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      participants: [
        { userId: 'u1', displayName: 'Asha', talkShare: 67 },
        { userId: 'u2', displayName: 'Karan', talkShare: 33 },
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
