import { Router } from 'express';
import { getSupabase } from '../../db/supabase.js';
import { findMissingEnvVars } from '../../domain/readiness.js';

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Phase 1 (ACTION_PLAN.md, 2026-08-04): a lightweight query against a
// table every migration set leaves behind -- if the configured Supabase
// project is unreachable, or missing a migration this code depends on,
// this fails and /ready reports it instead of looking identically "ok" to
// a real deploy.
async function defaultCheckDb() {
  const { error } = await getSupabase().from('rooms').select('id').limit(1);
  if (error) throw error;
}

// W8: exposes the in-process transcription-agent dispatch tracker
// (domain/agentWorkerStatus.js) so a silently-failing dispatch (see
// rooms.js's /start and /status comments) is visible to the GitHub
// Actions keep-alive/alert workflow instead of only in server logs.
//
// M3 (audit 2026-07-28): unauthenticated, this leaked lastFailure's roomId
// and raw error text to anyone who found the URL. Gated on a shared-secret
// token when one is configured (HEALTH_CHECK_TOKEN) -- this is a
// machine-to-machine monitoring endpoint, not a student-facing one, so a
// simple compared header is enough; falls back to open when no token is
// configured so local dev/CI never breaks.
//
// Phase 1 (ACTION_PLAN.md, 2026-08-04): that open fallback is only safe
// outside production. A misconfigured production deploy (env var never
// set on Render) must fail loudly at startup instead of silently shipping
// this endpoint wide open.
export function createHealthRouter(
  agentStatus,
  {
    healthCheckToken = process.env.HEALTH_CHECK_TOKEN,
    nodeEnv = process.env.NODE_ENV,
    checkDbFn = defaultCheckDb,
    env = process.env,
  } = {}
) {
  if (nodeEnv === 'production' && !healthCheckToken) {
    throw new Error('HEALTH_CHECK_TOKEN must be set when NODE_ENV=production');
  }
  const router = Router();
  router.use(healthRouter);
  router.get('/health/agent', (req, res) => {
    if (healthCheckToken && req.get('x-health-token') !== healthCheckToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    res.status(200).json(agentStatus.getStatus());
  });

  // Readiness (as opposed to /health's liveness): can this process actually
  // serve real traffic right now? A typo'd env var or a Supabase project
  // missing a migration this code depends on used to look identical to
  // healthy until a real student hit it.
  router.get('/ready', async (req, res) => {
    const missingEnvVars = findMissingEnvVars(env);
    if (missingEnvVars.length > 0) {
      return res.status(503).json({ status: 'not_ready', reason: 'missing_config', missingEnvVars });
    }
    try {
      await checkDbFn();
    } catch {
      // No error detail in the response -- this is reachable by anyone who
      // finds the URL, same M3 reasoning as /health/agent's token gate.
      return res.status(503).json({ status: 'not_ready', reason: 'db_unreachable' });
    }
    res.status(200).json({ status: 'ready' });
  });

  return router;
}
