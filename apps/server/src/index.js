import 'dotenv/config';
import express from 'express';
import { pathToFileURL } from 'node:url';
import { healthRouter } from './api/health.js';
import { startAgentWorker } from './agent/worker.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
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
