import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pathToFileURL } from 'node:url';
import { healthRouter } from './api/health.js';
import { createAuthMiddleware } from './api/authMiddleware.js';
import { createMeRouter } from './api/me.js';
import { createConsentRouter } from './api/consent.js';
import { getLatestConsent, recordConsent } from './db/consents.js';
import { startAgentWorker } from './agent/worker.js';

export function createApp({ supabaseUrl, consentDb } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(healthRouter);

  const requireAuth = createAuthMiddleware({ supabaseUrl });
  app.use(createMeRouter(requireAuth));
  app.use(createConsentRouter(requireAuth, consentDb ?? { getLatestConsent, recordConsent }));

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
