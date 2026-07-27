import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// W8: exposes the in-process transcription-agent dispatch tracker
// (domain/agentWorkerStatus.js) so a silently-failing dispatch (see
// rooms.js's /start and /status comments) is visible to the GitHub
// Actions keep-alive/alert workflow instead of only in server logs.
export function createHealthRouter(agentStatus) {
  const router = Router();
  router.use(healthRouter);
  router.get('/health/agent', (req, res) => {
    res.status(200).json(agentStatus.getStatus());
  });
  return router;
}
