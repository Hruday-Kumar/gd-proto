# PlaceMe runbooks

Runbooks are operator procedures, not architecture specifications. Before using
one, identify the environment, release SHA, incident severity, operator, and
communication channel. Never paste credentials, tokens, raw audio, full
transcripts, or unnecessary student identifiers into a ticket or chat.

| Situation | Runbook |
|---|---|
| Backend unhealthy/restart | `backend-restart.md` |
| Apply or recover a schema change | `database-migration.md` |
| Revert a bad release/change | `rollback.md` |
| Unknown or multiple provider failure | `provider-outage.md` |
| Gemini failure | `gemini-outage.md` |
| AssemblyAI failure | `assemblyai-outage.md` |
| LiveKit failure | `livekit-outage.md` |
| Supabase failure | `supabase-outage.md` |
| Render/Vercel deployment failure | `deployment-failure.md` |
| Live pilot session | `pilot-monitoring.md` |

For a SEV-1 or SEV-2 event, invoke the Incident Commander and
`$placeme-incident`; use `docs/templates/incident-report.md`.

