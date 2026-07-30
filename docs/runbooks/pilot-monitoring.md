# Runbook — Pilot monitoring

## Before the session

- Assign Pilot Operator, Incident Commander, Release Manager, and support
  channel.
- Record cohort count, schedule, release SHA, frontend/backend URLs, and linked
  pilot/release checklists.
- Check Render, Vercel, Supabase, LiveKit, AssemblyAI, and Gemini status, quotas,
  rate limits, and billing caps.
- Verify `/health`, authenticated `/health/agent`, GitHub keepalive status, and
  independent uptime signal if configured.
- Complete one real-person deployed smoke room: consent, join, audio,
  attribution, feedback, and history.
- Confirm stop conditions, rollback owner, participant communication, account
  deletion support, and provider runbook access.

## During the session

At session start and at least every 15 minutes, record privacy-safe counts:

- signup/login and room create/join failures;
- active/failed rooms and worker dispatch failure;
- transcription connection/error and missing-attribution reports;
- feedback completion/failure/duplicate rate;
- backend/frontend availability and latency symptoms;
- provider quota/429/5xx signals;
- participant support issues and consent/privacy concerns.

Do not copy raw audio, full transcripts, tokens, emails, or names into the
monitoring log. Use anonymized counts and incident IDs.

## Stop conditions

Pause new sessions immediately for:

- consent cannot be confirmed before mic/capture;
- suspected cross-user access, data leakage, or unauthorized room access;
- persistent inability to join/hear, transcribe/attribute, or generate the
  promised feedback with no approved safe workaround;
- data corruption or uncontrolled duplicate writes;
- provider quota/cost exceeds the approved cap;
- the named operator cannot observe or support the session.

Invoke the appropriate provider/rollback runbook and Incident Commander.

## After the session

- Confirm all rooms reached expected terminal state and feedback/history are
  complete.
- Review errors, provider usage/cost, support issues, and success metrics.
- Record incidents and follow-ups with owners/dates.
- Make an explicit continue/pause/rollback decision for the next cohort.
- Retain only privacy-safe evidence under `docs/pilot/`.

