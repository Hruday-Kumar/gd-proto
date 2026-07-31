# Runbook — Gemini outage

## Impact

Gemini powers generated topics and individual feedback. An outage, quota limit,
disabled key, or authentication error can make those operations fail while room
audio and transcription may remain available.

## Detect and classify

- Check application error rate/log signature and recent Render environment
  changes without exposing prompts, transcripts, or keys.
- Check Google AI/Gemini status, project quota/billing, model availability, and
  credential status.
- Classify 401/403 as likely credential/project authorization, 429 as
  quota/rate-limit, and 5xx/timeouts as provider/dependency failure; verify
  rather than assume.

## Response

1. Pause generated-topic requests if they repeatedly fail; custom topics may be
   used only if the normal product path safely supports them.
2. Before starting rooms, tell the pilot operator if feedback cannot currently
   be produced. Do not promise delayed feedback unless the implemented retry
   path and retention rules support it.
3. Allow only the bounded retries already defined in code. Do not create an
   unbounded retry loop or send duplicate feedback.
4. For an invalid key, rotate in the approved provider and Render secret stores.
   Never put the value in source, chat, logs, or the incident document.
5. Do not switch model/provider without a reviewed specification and ADR.

## Verification

- A minimal provider request succeeds with the configured model.
- Generated-topic API behavior succeeds.
- A disposable real room produces transcript-derived feedback without duplicate
  rows and without error logs.
- Feedback content receives the required usefulness/non-discouraging human
  check before resuming pilot sessions.
- Observe quota, latency, and errors for the stabilization window.

## Record

Failure class, affected sessions as counts, provider status/ticket, rotation
event (not value), recovery evidence, retries/data impact, and follow-up owner.

