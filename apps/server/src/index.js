import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pathToFileURL } from 'node:url';
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
import { listQueue, addToQueue, removeFromQueue } from './db/matchmakingQueue.js';
import { listRoomsByIds } from './db/rooms.js';
import { listFeedbackForUserAndRooms } from './db/feedback.js';
import { createHistoryRouter } from './api/history.js';
import { startAgentWorker } from './agent/worker.js';
import { getAgentWorkerStatus } from './agent/roomAgent.js';

export function createApp({ supabaseUrl, consentDb, topicsDb, roomsDb, historyDb, agentStatus } = {}) {
  const app = express();
  app.use(cors());
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

  return app;
}

// Only boot the server (and bind the port) when run directly — tests import
// createApp() and drive it in-process instead. pathToFileURL (not a raw
// "file://" template) so this comparison also works on Windows paths.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = process.env.PORT || 3000;
  const app = createApp();
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
  startAgentWorker();
}
