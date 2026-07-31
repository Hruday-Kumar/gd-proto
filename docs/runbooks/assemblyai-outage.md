# Runbook — AssemblyAI outage

## Impact

AssemblyAI provides live speech-to-text. Failure means captions, attributed
transcripts, and transcript-derived feedback may be incomplete or unavailable.
Audio must never be recorded locally as a fallback.

## Detect and classify

- Check worker/room logs for connection, authentication, quota, timeout, and
  streaming errors; redact room/user identifiers and content.
- Check AssemblyAI status and account quota/billing.
- Confirm LiveKit audio itself works separately so the failing boundary is known.
- Check recent credential or SDK/deploy changes.

## Response

1. Stop starting pilot sessions when reliable transcription/attribution is a
   promised core outcome.
2. Inform operators in active sessions that transcripts/feedback may be missing;
   follow the approved stop/continue decision. Do not claim recovery from a
   client caption alone.
3. Do not persist raw audio for later transcription.
4. Do not retry streams without bounds or attach multiple transcribers to the
   same participant.
5. Rotate an invalid credential only in approved secret stores. A provider
   substitution requires an ADR and tested change.

## Verification

- A minimal streaming transcription check succeeds.
- Worker dispatch and one transcriber per expected participant are confirmed.
- Multiple real people in a disposable deployed room receive timely captions
  with correct speaker attribution.
- Transcript finalization and one feedback record per participant complete.
- No raw-audio files/buffers are retained and errors remain stable during the
  observation window.

## Escalation/record

Treat multi-session loss during a pilot as SEV-2; privacy or cross-speaker data
exposure is SEV-1. Record counts, timing, status/ticket, safe evidence, recovery,
and corrective actions.

