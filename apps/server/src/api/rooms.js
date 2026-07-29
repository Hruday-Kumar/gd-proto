import { Router } from 'express';
import { generateUniqueRoomCode } from '../domain/roomCode.js';
import { claimMatchOrQueue } from '../domain/matchmakingClaim.js';
import { startSession } from '../domain/sessionStateMachine.js';
import { isValidDurationSeconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS } from '../domain/roomDuration.js';
import { generateTopic } from '../llm/geminiClient.js';
import { createConsentGate } from './consentGate.js';
import { mintToken } from '../livekit/token.js';
import { startTranscriptionForRoom } from '../agent/roomAgent.js';
import { getFeedbackForRoomAndUser, rateFeedback } from '../db/feedback.js';
import { listParticipants } from '../db/roomParticipants.js';
import { listProfiles } from '../db/profiles.js';
import { listTranscriptLinesForRoom } from '../db/transcriptLines.js';
import { createLlmRateLimiter } from './rateLimit.js';

// Interim group-size default for random matching (PHASE1_PLAN.md §8,
// decided 2026-07-26: anchored to the AI Voice Practice mode's stated
// participant range since the product doc has no explicit number for
// real-human multiplayer). Code/link rooms stay uncapped -- these only
// apply to the /match path.
const DEFAULT_MIN_GROUP_SIZE = 3;
const DEFAULT_MAX_GROUP_SIZE = 6;

const INVALID_DURATION_ERROR = `durationSeconds must be a whole number of seconds between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}`;

// Maps a DB room row (snake_case) to the shape sessionStateMachine.js
// expects (camelCase, millisecond timestamps).
function toSessionShape(room) {
  return {
    status: room.status,
    durationSeconds: room.duration_seconds,
    startedAt: room.started_at ? new Date(room.started_at).getTime() : undefined,
    endsAt: room.ends_at ? new Date(room.ends_at).getTime() : undefined,
  };
}

export function createRoomsRouter(requireAuth, deps) {
  const {
    roomCodeExists,
    insertRoom,
    getRoomByCode,
    getRoomById,
    updateRoomStatus,
    addParticipant,
    listQueue,
    addToQueue,
    removeFromQueue,
    claimFromQueue,
    claimMatchOrQueueFn = claimMatchOrQueue,
    insertGeneratedTopic,
    generateTopicFn = generateTopic,
    getActiveRoomForUser,
    minGroupSize = DEFAULT_MIN_GROUP_SIZE,
    maxGroupSize = DEFAULT_MAX_GROUP_SIZE,
    isParticipant,
    getLatestConsent,
    mintTokenFn = mintToken,
    liveKitUrl = process.env.LIVEKIT_URL,
    startTranscriptionFn = startTranscriptionForRoom,
    getFeedbackForRoomAndUserFn = getFeedbackForRoomAndUser,
    rateFeedbackFn = rateFeedback,
    listParticipantsFn = listParticipants,
    listProfilesFn = listProfiles,
    listTranscriptLinesForRoomFn = listTranscriptLinesForRoom,
    llmRateLimiter = createLlmRateLimiter(),
  } = deps;

  const router = Router();
  const requireConsent = createConsentGate({ getLatestConsent });

  // Mints a LiveKit join token for the audio room, gated on both guardrail
  // #3 (current recorded consent -- the consent gate built in W3) and on
  // actually being seated in this room (creator or joiner). Identity is
  // the student's own user_id, matching what's already stored as
  // room_participants.livekit_identity -- attribution (domain/
  // attribution.js) is then a direct lookup, no extra mapping table.
  router.post('/api/rooms/:id/token', requireAuth, requireConsent, async (req, res) => {
    const room = await getRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'ended') return res.status(409).json({ error: 'Room has ended' });

    const participant = await isParticipant(room.id, req.userId);
    if (!participant) return res.status(403).json({ error: 'Not a participant of this room' });

    // M1 (audit 2026-07-28): a student's token must never carry
    // canPublishData -- only the transcription agent's own token
    // (agent/roomAgent.js) needs it, to broadcast real captions. A student
    // token that had it could forge caption data over the same channel.
    const token = await mintTokenFn(req.userId, room.id, { name: req.userId, canPublishData: false });
    res.status(200).json({ token, url: liveKitUrl, identity: req.userId, roomName: room.id });
  });

  // A student sitting in the matchmaking queue has no other way to learn
  // that someone else's /match request completed a group that includes
  // them -- their queue row is gone the moment the match forms, but
  // nothing pushes that news to them. The match/lobby UI polls this to
  // find out.
  router.get('/api/rooms/mine/active', requireAuth, async (req, res) => {
    const room = await getActiveRoomForUser(req.userId);
    res.status(200).json({ room: room ? { id: room.id, code: room.code, status: room.status } : null });
  });

  router.post('/api/rooms', requireAuth, async (req, res) => {
    const { topicId, durationSeconds } = req.body || {};
    if (!topicId || !durationSeconds) {
      return res.status(400).json({ error: 'topicId and durationSeconds are required' });
    }
    // H3: bound the duration before it reaches the database. An out-of-range
    // value leaves the room live forever AND overflows the agent's stop timer
    // -- see domain/roomDuration.js.
    if (!isValidDurationSeconds(durationSeconds)) {
      return res.status(400).json({ error: INVALID_DURATION_ERROR });
    }
    const code = await generateUniqueRoomCode(roomCodeExists);
    const room = await insertRoom({ code, topicId, durationSeconds, joinMode: 'code', createdBy: req.userId });
    await addParticipant(room.id, req.userId, req.userId);
    res.status(201).json({
      id: room.id,
      code: room.code,
      status: room.status,
      topicId: room.topic_id,
      durationSeconds: room.duration_seconds,
    });
  });

  router.post('/api/rooms/join', requireAuth, async (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code is required' });

    const room = await getRoomByCode(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status !== 'waiting') {
      return res.status(409).json({ error: `Room is already ${room.status}` });
    }

    // addParticipant is expected to be idempotent on a duplicate join
    // (see db/roomParticipants.js) -- rejoining doesn't error.
    await addParticipant(room.id, req.userId, req.userId);
    res.status(200).json({ id: room.id, code: room.code, status: room.status });
  });

  // H4 (audit 2026-07-28): rate-limited -- a formed match calls Gemini for
  // the room's topic, same shared-quota risk as /api/topics/generate.
  router.post('/api/rooms/match', requireAuth, llmRateLimiter, async (req, res) => {
    const { durationSeconds } = req.body || {};
    if (!durationSeconds) return res.status(400).json({ error: 'durationSeconds is required' });
    // Same H3 check as POST /api/rooms, and it matters more here: the matched
    // room's duration comes from whichever caller completed the group, so one
    // bad value would break the session for every member, not just its sender.
    if (!isValidDurationSeconds(durationSeconds)) {
      return res.status(400).json({ error: INVALID_DURATION_ERROR });
    }

    // H7 (audit 2026-07-28): claimMatchOrQueue wraps the pure matchmake()
    // decision in a race-safe claim -- see domain/matchmakingClaim.js. The
    // members it returns are already atomically removed from the queue, so
    // no further removeFromQueue call is needed for a match.
    const claim = await claimMatchOrQueueFn(req.userId, { listQueue, addToQueue, claimFromQueue, minGroupSize, maxGroupSize });

    if (claim.type === 'already_queued' || claim.type === 'queued') {
      return res.status(200).json({ status: 'queued' });
    }

    // Matched: the system picks the topic (no single member "owns" a
    // randomly matched room), the room starts as 'waiting' at creation
    // and every matched member is seated with livekit_identity = their
    // own user id.
    const topicText = await generateTopicFn({});
    const topic = await insertGeneratedTopic({ text: topicText });
    const code = await generateUniqueRoomCode(roomCodeExists);
    const room = await insertRoom({ code, topicId: topic.id, durationSeconds, joinMode: 'random', createdBy: req.userId });
    for (const member of claim.members) {
      await addParticipant(room.id, member.id, member.id);
    }

    res.status(201).json({
      id: room.id,
      code: room.code,
      status: room.status,
      topicId: topic.id,
      members: claim.members.map((m) => m.id),
    });
  });

  // Leaving is idempotent -- removeFromQueue on a user who isn't queued is
  // a no-op, so a client can call this on unmount without first checking.
  router.delete('/api/rooms/match', requireAuth, async (req, res) => {
    await removeFromQueue([req.userId]);
    res.status(200).json({ status: 'left' });
  });

  router.post('/api/rooms/:id/start', requireAuth, async (req, res) => {
    const room = await getRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.created_by !== req.userId) {
      return res.status(403).json({ error: 'Only the room creator can start it' });
    }

    let started;
    try {
      started = startSession(toSessionShape(room), Date.now());
    } catch (err) {
      return res.status(409).json({ error: err.message });
    }

    await updateRoomStatus(room.id, {
      status: started.status,
      startedAt: new Date(started.startedAt).toISOString(),
      endsAt: new Date(started.endsAt).toISOString(),
    });

    // Fire-and-forget: joining LiveKit + AssemblyAI takes real network
    // time and must not delay the HTTP response to the room creator. A
    // failure here must not fail the start request -- the room still
    // goes live for participants even if transcription can't join;
    // that's a degraded state to alert on (W8), not a reason to 409 here.
    startTranscriptionFn({ id: room.id, durationSeconds: room.duration_seconds }).catch((e) =>
      console.error(`[agent] failed to start transcription for room ${room.id}: ${e.message}`)
    );

    res.status(200).json({ id: room.id, status: started.status, endsAt: started.endsAt });
  });

  router.get('/api/rooms/:id/status', requireAuth, async (req, res) => {
    const room = await getRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Gate on being seated in the room, exactly like the token/
    // participants/transcript routes, so nobody holding a room id can read
    // another group's topic or status.
    const participant = await isParticipant(room.id, req.userId);
    if (!participant) return res.status(403).json({ error: 'Not a participant of this room' });

    // M10 (audit 2026-07-28): this route used to lazily flip an expired
    // room to 'ended' and dispatch feedback generation as a side effect of
    // a GET -- any retry, prefetch, or proxy replay could re-trigger it.
    // That job now belongs to a periodic server-side sweep
    // (agent/roomSweeper.js), so this route only ever reads whatever the
    // sweep already wrote; it never transitions anything itself.
    const endsAt = toSessionShape(room).endsAt;

    // code/topicText/isCreator come from the room itself rather than from
    // the client's navigation state, so a browser refresh in the lobby
    // doesn't lose the room code, the topic heading, or the creator-only
    // start button. topics(text) rides along on the same getRoomById query
    // (db/rooms.js), so this costs no extra round trip.
    res.status(200).json({
      id: room.id,
      status: room.status,
      code: room.code,
      topicText: room.topics?.text ?? null,
      durationSeconds: room.duration_seconds,
      isCreator: room.created_by === req.userId,
      ...(endsAt ? { endsAt } : {}),
    });
  });

  // Resolves a room's seated user ids to display names -- same
  // participants+profiles join the W6 feedback worker already does, reused
  // here so the live UI can show real names instead of raw user ids.
  async function resolveParticipantNames(roomId) {
    const roomParticipants = await listParticipantsFn(roomId);
    const profiles = await listProfilesFn(roomParticipants.map((p) => p.user_id));
    const nameById = new Map(profiles.map((p) => [p.id, p.display_name]));
    return roomParticipants.map((p) => ({ userId: p.user_id, displayName: nameById.get(p.user_id) || p.user_id }));
  }

  // Lets the live-room UI label speakers by name instead of a raw user id,
  // and lets it show who's actually seated in the room. Gated the same way
  // as the token route: only someone seated in this room may see who else
  // is seated in it.
  router.get('/api/rooms/:id/participants', requireAuth, async (req, res) => {
    const participant = await isParticipant(req.params.id, req.userId);
    if (!participant) return res.status(403).json({ error: 'Not a participant of this room' });

    const participants = await resolveParticipantNames(req.params.id);
    res.status(200).json({ participants });
  });

  // Lets a student re-read the attributed transcript of a session they were
  // actually in, alongside their feedback -- the same data the feedback
  // prompt already uses, just exposed for a human to read directly. Gated
  // on participation, same as above: this is a shared discussion every
  // seated participant already heard live, not another student's private
  // data.
  router.get('/api/rooms/:id/transcript', requireAuth, async (req, res) => {
    const participant = await isParticipant(req.params.id, req.userId);
    if (!participant) return res.status(403).json({ error: 'Not a participant of this room' });

    const [names, lines] = await Promise.all([resolveParticipantNames(req.params.id), listTranscriptLinesForRoomFn(req.params.id)]);
    const nameById = new Map(names.map((p) => [p.userId, p.displayName]));
    res.status(200).json({
      lines: lines.map((line) => ({
        userId: line.user_id,
        displayName: nameById.get(line.user_id) || line.user_id,
        text: line.text,
        startedAtMs: line.started_at_ms,
      })),
    });
  });

  // A student's own feedback for a room, once generation (dispatched from
  // the /status transition above) has finished. Returns null, not 404,
  // while generation is still in flight -- the caller polls, it's not an
  // error state. getFeedbackForRoomAndUserFn is scoped to req.userId
  // explicitly (not just "this room's feedback"), so this can never return
  // another participant's paragraph even though the server-side client
  // bypasses RLS.
  router.get('/api/rooms/:id/feedback/mine', requireAuth, async (req, res) => {
    const feedback = await getFeedbackForRoomAndUserFn(req.params.id, req.userId);
    if (!feedback) return res.status(200).json({ feedback: null });
    res.status(200).json({
      feedback: feedback.body,
      ...(feedback.rating !== undefined ? { rating: feedback.rating, ratingReason: feedback.rating_reason } : {}),
    });
  });

  // S1 (pilot-readiness audit): a thumbs up/down + one-line "why" on the
  // caller's own feedback. 404s rather than creating a row if feedback
  // hasn't been generated yet -- there's nothing to rate, and this also
  // means rateFeedbackFn only ever runs against a row this caller already
  // owns (feedback has no client-writable RLS policy; ownership is
  // verified here in JS instead, same pattern as every other mutating
  // route in this file).
  router.patch('/api/rooms/:id/feedback/mine/rating', requireAuth, async (req, res) => {
    const { rating, reason } = req.body || {};
    if (typeof rating !== 'boolean') return res.status(400).json({ error: 'rating must be a boolean' });

    const existing = await getFeedbackForRoomAndUserFn(req.params.id, req.userId);
    if (!existing) return res.status(404).json({ error: 'No feedback to rate yet' });

    const result = await rateFeedbackFn(req.params.id, req.userId, { rating, reason });
    res.status(200).json({ rating: result.rating, ratingReason: result.rating_reason });
  });

  return router;
}
