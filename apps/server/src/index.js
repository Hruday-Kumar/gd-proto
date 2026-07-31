import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import express from 'express';
import { pathToFileURL } from 'node:url';
import { isAllowedOrigin, parseAllowedOrigins } from './domain/corsConfig.js';
import { createErrorHandler } from './api/middleware/errorHandler.js';
import { createHealthRouter } from './api/routes/health.js';
import { createAuthMiddleware } from './api/middleware/authMiddleware.js';
import { createMeRouter } from './api/routes/me.js';
import { createConsentRouter } from './api/routes/consent.js';
import { getLatestConsent, recordConsent } from './db/consents.js';
import { createTopicsRouter } from './api/routes/topics.js';
import { insertCustomTopic, insertGeneratedTopic } from './db/topics.js';
import { createRoomsRouter } from './api/routes/rooms.js';
import { roomCodeExists, insertRoom, getRoomByCode, getRoomById, updateRoomStatus } from './db/rooms.js';
import { addParticipant, getActiveRoomForUser, isParticipant, listRoomIdsForUser } from './db/roomParticipants.js';
import { listQueue, addToQueue, removeFromQueue, claimFromQueue } from './db/matchmakingQueue.js';
import { listRoomsByIds } from './db/rooms.js';
import { listFeedbackForUserAndRooms } from './db/feedback.js';
import { createHistoryRouter } from './api/routes/history.js';
import { startAgentWorker } from './agent/worker.js';
import { getAgentWorkerStatus, recoverLiveRooms, stopAllTranscriptions } from './agent/roomAgent.js';
import { startRoomSweeper } from './agent/roomSweeper.js';
import { createGracefulShutdown } from './shutdown.js';
import { createProcessSafetyNet } from './processSafetyNet.js';

// M6 (audit 2026-07-28): local Vite dev server default -- kept even once
// ALLOWED_ORIGINS is set in production, so local dev never breaks.
// N11 (audit comparison, 2026-07-29): only outside production, though --
// this used to be prepended unconditionally. Low real impact (this API
// authenticates with a Bearer token, not a cookie, so a page on a
// developer's localhost can't read another origin's token) but there's no
// reason to hand back part of M6's own allowlist for no benefit.
// Two frontends target this API locally: apps/web (plain Vite, 5173) and
// place-me-UI (TanStack Start, 8080).
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

export function createApp({
  supabaseUrl,
  consentDb,
  topicsDb,
  roomsDb,
  historyDb,
  agentStatus,
  allowedOrigins,
  healthCheckToken,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  const devOrigins = nodeEnv === 'production' ? [] : DEFAULT_DEV_ORIGINS;
  const origins = allowedOrigins ?? [...devOrigins, ...parseAllowedOrigins(process.env.ALLOWED_ORIGINS)];

  const app = express();
  // N12 (audit comparison, 2026-07-29): Render sits behind one proxy hop --
  // without this, req.ip is the proxy's address and req.protocol is always
  // "http". Nothing currently reads either (the rate limiter deliberately
  // keys on req.userId, never IP), but it becomes silently wrong the
  // moment anything IP-based is added, so set it now rather than later.
  app.set('trust proxy', 1);
  // M7 (audit 2026-07-28): standard hardening headers (nosniff, no
  // X-Powered-By, etc.). One default needs overriding: helmet's
  // Cross-Origin-Resource-Policy defaults to "same-origin", which the
  // browser enforces independently of CORS -- left alone, it would
  // silently block the real frontend's cross-origin requests (Vercel
  // calling this Render-hosted API) even with a correct
  // Access-Control-Allow-Origin header, defeating the M6 CORS allowlist
  // right below. Confirmed live before fixing, not assumed.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // M6 (audit 2026-07-28): origin allowlist, not open CORS. `callback(null,
  // false)` (not an Error) for a disallowed origin -- CORS is enforced by
  // the browser reading the response, not by the server refusing to answer,
  // so there's nothing here for a future error-handling middleware to catch.
  app.use(cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin, origins)) }));
  app.use(express.json());
  app.use(createHealthRouter(agentStatus ?? getAgentWorkerStatus(), { healthCheckToken }));

  const requireAuth = createAuthMiddleware({ supabaseUrl });
  app.use(createMeRouter(requireAuth));
  app.use(createConsentRouter(requireAuth, consentDb ?? { getLatestConsent, recordConsent }));
  app.use(createTopicsRouter(requireAuth, topicsDb ?? { insertCustomTopic, insertGeneratedTopic }));
  app.use(
    createRoomsRouter(
      requireAuth,
      roomsDb ?? {
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
        insertGeneratedTopic,
        getActiveRoomForUser,
        isParticipant,
        getLatestConsent,
      }
    )
  );
  app.use(
    createHistoryRouter(
      requireAuth,
      historyDb ?? {
        listRoomIdsForUser,
        listRoomsByIds,
        listFeedbackForUserAndRooms,
      }
    )
  );

  // M2 (audit 2026-07-28): must be the LAST app.use() -- Express only
  // routes a 4-arg function to the error path, and only for errors raised
  // by middleware/routers registered before it.
  app.use(createErrorHandler());

  return app;
}

// Only boot the server (and bind the port) when run directly — tests import
// createApp() and drive it in-process instead. pathToFileURL (not a raw
// "file://" template) so this comparison also works on Windows paths.
// This is the only supported entry point: one long-lived process serving the
// Express API and hosting the in-process transcription agent (ADR-0009,
// PHASE1_PLAN.md §3a). Deliberately NOT a serverless handler export — see
// ADR-0009 for why this application cannot run on a function runtime.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = process.env.PORT || 3000;
  const app = createApp();
  const server = app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
  startAgentWorker();

  // H2 (audit 2026-07-28), the two halves of surviving a restart. Both only
  // ever run in this real-process branch, never under test.
  //
  // Up: this process is the only thing hosting the transcription agents, and
  // the map holding them is in memory. After a deploy, a Render free-tier
  // sleep, or a crash, any room still 'live' in the database has no agent --
  // students notice nothing (their browsers talk to LiveKit directly) while
  // the rest of the session is never transcribed. Re-attach on boot.
  recoverLiveRooms();

  // M10 (audit 2026-07-28): the room's ended-transition and feedback
  // dispatch used to happen as a side effect of a client's GET /status poll
  // -- a retry, prefetch, or proxy replay could re-trigger it. This runs it
  // on a server-side timer instead, so the route itself can be read-only.
  const stopSweeper = startRoomSweeper();

  // Down: disconnect each agent cleanly rather than having its LiveKit and
  // AssemblyAI sockets cut, so the last speaker's turn can flush.
  const shutdown = createGracefulShutdown({ server, stopAllTranscriptions, stopSweeper });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 2026-07-30 (pilot-readiness + exception-handling pass): no
  // process-level safety net existed anywhere -- Node's default on an
  // unhandled rejection is to crash the whole process, which would take
  // down every other live room over one isolated background dispatch's
  // failure (see processSafetyNet.js for the reasoning behind logging
  // rejections rather than crashing, and reusing this same graceful
  // shutdown for a genuine uncaught exception).
  const safetyNet = createProcessSafetyNet({ shutdown });
  process.on('unhandledRejection', safetyNet.onUnhandledRejection);
  process.on('uncaughtException', safetyNet.onUncaughtException);
}
