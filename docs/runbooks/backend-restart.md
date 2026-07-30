# Runbook — Backend restart

## Purpose

Restore the Render-hosted Express API and room/transcription worker when the
process is unhealthy. A restart does not repair a bad release, invalid secret,
provider outage, or database failure.

## Trigger

- `/health` fails or times out;
- authenticated `/health/agent` reports unhealthy;
- Render shows a crashed/stuck instance;
- the Incident Commander authorizes a restart during recovery.

## Preconditions

- Confirm environment and current release/commit in Render.
- Assign an operator and record start time.
- Check Render, Supabase, LiveKit, AssemblyAI, and Gemini status first.
- Capture privacy-safe error signatures and recent deploy/config events.
- Do not restart repeatedly without diagnosing the failure.

## Procedure

1. Pause new pilot sessions if room dispatch or transcription is impaired.
2. Check the live health endpoints and Render service events/logs. Redact tokens,
   room IDs, transcript content, and personal data from any shared evidence.
3. Determine whether the cause is a deploy, configuration change, resource
   exhaustion, provider outage, or unknown process failure.
4. If a single restart is appropriate, use Render's **Manual deploy → Restart
   service** (or the equivalent restart control) on the documented backend
   service in `docs/engineering/DEPLOYMENT.md`.
5. Do not change environment values during the restart. Configuration changes
   require their own reviewed recovery action.
6. Observe startup logs for API bind, worker registration, and immediate crash.

## Verification

- `GET /health` returns the expected healthy response.
- Authenticated `GET /health/agent` is healthy and shows no newer dispatch
  failure.
- Run an authenticated API smoke test.
- For a pilot-facing recovery, create a disposable test room and verify worker
  dispatch; require real-person audio verification before resuming sessions if
  audio/transcription was affected.
- Observe for at least 10 minutes or the incident's agreed stabilization window.

## Failure/escalation

- If the process crashes again, stop restart loops and invoke
  `deployment-failure.md`, `provider-outage.md`, or `rollback.md`.
- SEV-1/2: Incident Commander owns pause/resume and communications.

## Record

Release SHA, restart time/operator, cause or hypothesis, health evidence,
student impact, follow-up issue, and resume decision.

