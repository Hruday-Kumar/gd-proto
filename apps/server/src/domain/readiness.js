// Phase 1 (ACTION_PLAN.md, 2026-08-04): GET /ready needs to know which env
// vars the server actually depends on to serve real traffic (see
// docs/engineering/DEPLOYMENT.md's env var table) -- kept as a pure,
// injectable list rather than a hardcoded check inline in the route, so
// this stays the single source of truth as dependencies change.
export const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'ASSEMBLYAI_API_KEY',
  'GEMINI_API_KEY',
];

export function findMissingEnvVars(env, requiredVars = REQUIRED_ENV_VARS) {
  return requiredVars.filter((name) => !env[name]);
}
