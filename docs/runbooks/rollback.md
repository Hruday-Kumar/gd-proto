# Runbook — Rollback

## Purpose

Return PlaceMe to a known safe application state, or execute a documented
forward recovery when state cannot safely be reversed.

## Triggers

- security/privacy, data-integrity, or consent stop condition;
- failed release smoke test;
- sustained core-journey or provider integration failure caused by the release;
- unacceptable error/latency increase;
- Release Manager or Incident Commander decision.

## Decide before acting

1. Identify the first bad release, last known-good release, affected services,
   migrations, configuration changes, and provider changes.
2. Determine whether new code has written data incompatible with the old code.
3. Determine whether a migration is additive, reversible, or requires forward
   recovery. Never drop data simply to make an older release start.
4. Preserve privacy-safe evidence and assign operator/verifier.
5. Pause new sessions when continuing could harm data, privacy, or the pilot.

## Application rollback

1. In Render, redeploy the exact last known-good backend artifact/commit.
2. In Vercel, promote/redeploy the exact last known-good frontend deployment.
3. Do not mix unrelated environment changes into the rollback.
4. Keep frontend/backend compatibility in mind; roll them in the order specified
   by the release plan.

## Database/configuration recovery

- Apply only the reviewed recovery from the migration specification.
- Rotate or restore provider credentials only through the provider/hosting
  secret store; never commit or paste values into the incident record.
- If configuration caused the failure, restore the last known-good named
  configuration and record who changed it.

## Verification

- Health and authenticated agent-health checks pass.
- Signup/auth, consent, room create/join, history, and affected flow smoke tests
  pass.
- RLS/data integrity verification passes if data/schema was involved.
- Real-person room/audio/transcription/feedback validation is completed before
  pilot sessions resume when those surfaces were affected.
- Monitoring remains stable for the declared observation window.

## Close

Record decision time, releases before/after, migrations/configuration actions,
verification, student impact, communications, and follow-up. Open an incident or
post-mortem for SEV-1/2 and repeated rollback causes.

