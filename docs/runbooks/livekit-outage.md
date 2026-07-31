# Runbook — LiveKit outage

## Impact

LiveKit provides rooms, participant audio, permissions, and worker dispatch. A
failure can prevent join/publish/subscribe or silently omit the transcription
worker.

## Detect and classify

- Check LiveKit status, project quota, region, and credential validity.
- Check backend token/room API errors and authenticated agent-health dispatch
  status.
- In a disposable room, separate token issuance, join, publish, subscribe, and
  worker dispatch failures.
- Review recent permission, room-capacity, SDK, or environment changes.

## Response

1. Pause new pilot rooms if participants cannot reliably join, hear each other,
   or receive the worker.
2. Ask active participants to stop/rejoin only when the operator has a verified
   recovery path; avoid repeated reconnect loops.
3. Never loosen grants, consent gates, room scoping, or authentication to restore
   service.
4. Rotate invalid credentials only through LiveKit and Render secret stores.
5. Do not switch to another real-time provider without an ADR/specification.

## Verification

- Backend health and authenticated agent-health are healthy.
- Token creation enforces room-scoped, least-privilege grants.
- At least two real people on representative devices can join, publish, and hear
  each other.
- The worker dispatches, transcription attribution is correct, and feedback
  completes.
- Participant disconnect/cleanup and room terminal state are correct.
- Observe provider and application errors through the stabilization window.

## Escalation/record

Widespread room failure is SEV-1/2 depending on pilot impact. Record failed
stage, affected-room count, provider evidence/ticket, actions, recovery, and
follow-up.

