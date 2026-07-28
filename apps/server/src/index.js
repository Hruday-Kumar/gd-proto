import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import express from 'express';
import { pathToFileURL } from 'node:url';
import { isAllowedOrigin, parseAllowedOrigins } from './domain/corsConfig.js';
import { createErrorHandler } from './api/errorHandler.js';
import { createHealthRouter } from './api/health.js';
import { createAuthMiddleware } from './api/authMiddleware.js';
import { createMeRouter } from './api/me.js';
import { createConsentRouter } from './api/consent.js';
import { getLatestConsent, recordConsent } from './db/consents.js';
import { createTopicsRouter } from './api/topics.js';
import { insertCustomTopic, insertGeneratedTopic } from './db/topics.js';
import { createRoomsRouter } from './api/rooms.js';
import { roomCodeExists, insertRoom, getRoomByCode, getRoomById, updateRoomStatus } from './db/rooms.js';
import { addParticipant, getActiveRoomForUser, isParticipant, listRoomIdsForUser } from './db/roomParticipants.js';
import { listQueue, addToQueue, removeFromQueue, claimFromQueue } from './db/matchmakingQueue.js';
import { listRoomsByIds } from './db/rooms.js';
import { listFeedbackForUserAndRooms } from './db/feedback.js';
import { createHistoryRouter } from './api/history.js';
import { startAgentWorker } from './agent/worker.js';
import { getAgentWorkerStatus, recoverLiveRooms, stopAllTranscriptions } from './agent/roomAgent.js';
import { createGracefulShutdown } from './shutdown.js';

// M6 (audit 2026-07-28): local Vite dev server default -- kept even once
// ALLOWED_ORIGINS is set in production, so local dev never breaks.
const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function createApp({ supabaseUrl, consentDb, topicsDb, roomsDb, historyDb, agentStatus, allowedOrigins } = {}) {
  const origins = allowedOrigins ?? [...DEFAULT_DEV_ORIGINS, ...parseAllowedOrigins(process.env.ALLOWED_ORIGINS)];

  const app = express();
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
  app.use(createHealthRouter(agentStatus ?? getAgentWorkerStatus()));

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

  // Down: disconnect each agent cleanly rather than having its LiveKit and
  // AssemblyAI sockets cut, so the last speaker's turn can flush.
  const shutdown = createGracefulShutdown({ server, stopAllTranscriptions });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
