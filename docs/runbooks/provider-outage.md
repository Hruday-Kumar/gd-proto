# Runbook — External provider outage

## Purpose

Coordinate response when an external dependency is degraded, or the failing
provider is not yet known.

## Triage

1. Assign operator and timestamp. Check PlaceMe health, recent deploy/config
   changes, provider dashboards, quota/billing state, DNS/network errors, and
   credential authentication errors.
2. Classify:
   - **LiveKit:** room/audio connection;
   - **AssemblyAI:** captions/transcript/attribution;
   - **Gemini:** generated topics/feedback;
   - **Supabase:** auth/database/history;
   - **Render/Vercel:** application availability/deployment.
3. Verify with a minimal privacy-safe request. Never copy provider keys into a
   command that will be logged or shared.
4. Distinguish provider outage from expired/disabled credential, exceeded quota,
   bad local deploy, and client network failure.

## Response

- Follow the provider-specific runbook.
- Stop new sessions when consent, audio, transcript, attribution, feedback, auth,
  or data integrity cannot be delivered safely.
- Do not switch providers ad hoc. A provider change requires an ADR,
  specification, security review, and tested rollout.
- Do not buffer or persist raw audio as a transcription fallback.
- Communicate verified impact, safe workaround, next update time, and whether
  current sessions should stop.

## Verification and recovery

- Provider status and a minimal direct integration check recover.
- PlaceMe health and affected API/provider-boundary tests pass.
- A deployed end-to-end journey passes; use real people for room/audio paths.
- Observe through the declared stabilization window before resuming the pilot.

## Escalation

SEV-1/2 invokes the Incident Commander. Record provider ticket/status link,
PlaceMe impact, timestamps, mitigation, recovery evidence, and follow-ups.

