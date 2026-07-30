# Runbook — Deployment failure

## Purpose

Recover from a failed or unhealthy Render backend or Vercel frontend deployment.

## Triage

1. Record environment, commit SHA, service/project, deploy ID, operator, and
   start time.
2. Compare build failure, deploy failure, startup crash, unhealthy runtime, and
   post-deploy functional regression.
3. Review the exact deploy logs and diff from the last known-good release.
   Redact environment values and personal data.
4. Check Node 22, workspace install, Docker build, Vite output, environment
   variable names, migration prerequisites, CORS origins, and provider status.

## Response

- **Build failure:** reproduce the exact build locally; fix through a reviewed PR.
- **Startup failure:** check missing/invalid configuration and process logs; do
  not add insecure defaults.
- **Frontend-only failure:** keep/restore the last known-good Vercel deployment.
- **Backend-only failure:** keep/restore the last known-good Render deployment.
- **Functional regression:** trigger `rollback.md` using compatibility and
  migration analysis.
- Do not patch production source or run an unreviewed database change.

## Verification

```sh
npm test
npm run lint
npm run build
```

Then verify:

- Render `/health` and authenticated `/health/agent`;
- Vercel page load, asset load, and client routing;
- API CORS from the deployed frontend origin;
- auth, consent, room create/join, history, and affected change;
- required real-person room/audio/transcription/feedback path;
- monitoring during the stabilization window.

## Close

Record deploy IDs/SHAs, cause, restored version, tests/smokes, migration/config
actions by name only, impact, and follow-up. Use an incident/post-mortem for
SEV-1/2 or repeated deployment failures.

