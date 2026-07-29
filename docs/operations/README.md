# Operations

Operational ownership for the PlaceMe pilot:

| Surface | Primary signal | Operator response |
|---|---|---|
| Backend | `/health`, authenticated `/health/agent`, Render logs | `docs/runbooks/backend-restart.md` |
| Database | Supabase status, query/RLS errors, migration record | `docs/runbooks/database-migration.md` |
| Gemini | topic/feedback errors, quota and 401/429/5xx rates | `docs/runbooks/gemini-outage.md` |
| AssemblyAI | transcription connection/error rate | `docs/runbooks/assemblyai-outage.md` |
| LiveKit | room join, dispatch, publish/subscribe failures | `docs/runbooks/livekit-outage.md` |
| Supabase | auth/database availability and latency | `docs/runbooks/supabase-outage.md` |
| Deployment | Render/Vercel deployment status and smoke tests | `docs/runbooks/deployment-failure.md` |

Before a pilot session, assign a named operator, confirm provider dashboards and
access, and open the pilot monitoring runbook. Never put credentials or student
transcripts in an incident record or shared screenshot.

## Severity

- **SEV-1:** safety/privacy breach, widespread inability to join, or data
  corruption. Stop the pilot and invoke the Incident Commander.
- **SEV-2:** a core path such as transcription or feedback is substantially
  degraded. Pause new sessions if no safe fallback exists.
- **SEV-3:** limited degradation with a documented workaround and no privacy or
  integrity risk.

Use `templates/incident-report.md`, `templates/post-mortem.md`, and
`$placeme-incident` for incidents.

