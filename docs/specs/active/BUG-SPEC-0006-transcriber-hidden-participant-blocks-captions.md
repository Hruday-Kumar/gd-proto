# BUG-SPEC-0006 — Live captions never render because the transcriber's LiveKit token is minted `hidden: true`

**Status:** Implementing
**Owner:** Claude Code (agent-assisted), autonomous incident response per direct
user instruction ("transcription is not working in either preview or
production")
**Incident/issue:** User-reported transcription outage, this session
(2026-07-31). Treated as an incident per `.claude/rules/guardrails.md` and
`CLAUDE.md`'s `$placeme-incident` routing.
**Severity:** High (core product feature — the live caption display students
rely on during a session never shows anything) but **not** a data-loss or
attribution bug: the underlying transcript persistence and feedback
generation pipeline are unaffected.
**First affected release:** PR #52 (`fix/caption-identity-livekit-sender`,
merged into `dev` 2026-07-30, released to `main` via PR #55 the same day) —
the N13 caption sender-identity fix.
**Regression, not a new build:** this is a real bug in previously-shipped
code, confirmed reproducing today; it is not hypothetical.

## Problem

**Expected behavior:** While a group-discussion session is live, every
finalized transcript turn the agent broadcasts over the LiveKit data channel
(`agent/roomAgent.js`'s `publishData` call) should render as a live caption
in `LiveRoomAudio.jsx` for every seated student, in near real time.

**Observed behavior:** No live captions ever appear during a session, for any
student, even though:
- the room's LiveKit dispatch succeeds (confirmed via the live
  `/health/agent` endpoint: `dispatchSuccesses` incrementing, `healthy: true`
  on the actual Render production deployment),
- transcript lines are correctly persisted to `transcript_lines` with correct
  per-speaker attribution (confirmed directly against the live Supabase
  project for the most recent completed room — 10/10 lines attributed to the
  single real participant, timestamps consistent with a live conversation),
- feedback generation completes and reads coherently against that same
  transcript (confirmed: the live `feedback` row for that room correctly
  references the participant by name and the actual content of what they
  said).

So every server-side stage of the pipeline (LiveKit connect, AssemblyAI
transcription, DB persistence, Gemini feedback) is healthy. The break is
isolated to the client-side live-caption display path only.

**Affected users:** Every student in every live session, on both the
deployed frontend and local dev (this reproduces from the client code alone,
independent of environment).

**Frequency:** 100% — this is a deterministic bug in the client-side sender
check, not intermittent.

## Root cause

PR #52 (N13, 2026-07-30) changed `LiveRoomAudio.jsx`'s
`RoomEvent.DataReceived` handler from ignoring the sender entirely to
requiring `participant?.identity === 'transcriber'` before accepting a
caption message — a real security improvement in isolation (defense against
a forged data message, in case a student token ever regressed to carrying
`canPublishData`).

The bug: the transcriber agent's LiveKit token
(`apps/server/src/agent/roomAgent.js`, `mintTokenFn('transcriber', roomId,
{ ..., hidden: true })`) has always been minted with `hidden: true`. Per
LiveKit's own protocol documentation
(`@livekit/protocol`'s `ParticipantInfo.hidden` field: "indicates that it's
hidden to others"), a hidden participant is not surfaced to *other*
participants' clients at all — the LiveKit server never sends a
`ParticipantConnected` update (nor an entry in the initial
`otherParticipants` list) for a hidden participant to anyone else in the
room. Confirmed directly in the installed `livekit-client@2.21.0` bundle:
`RoomEvent.DataReceived`'s `participant` argument is resolved via
`this.remoteParticipants.get(packet.participantIdentity)` — a lookup in a
map that a hidden participant's identity is never added to on any other
client. That lookup returns `undefined` for every message the transcriber
ever sends, so `participant?.identity` is always `undefined`, never equals
`'transcriber'`, and the guard silently drops every caption message the
transcriber ever broadcasts.

This was invisible before PR #52 because the old handler
(`(payload) => {...}`) never read the `participant` argument at all — the
`hidden: true` flag was already there (original W5 design, so the bot
wouldn't show up as a "person" in the room to students) and was already
inert with respect to `DataReceived`; PR #52 is what made it load-bearing,
without anyone checking whether a hidden participant's identity actually
resolves client-side.

**Confirmed not the cause:** AssemblyAI key/quota (tested live: WebSocket
handshake succeeds), LiveKit credentials (dispatch succeeds live), CORS/
`trust proxy` (PR #50 — unrelated code path, no client-facing symptom
matches), lobby nav guard (PR #56 — blocks navigation, not caption receipt),
process safety net (PR #46 — the two fixed dispatches are unrelated to the
data channel).

## Goals

- Restore live captions rendering during a session, for every seated
  student, without reopening the N13 vulnerability the sender check closes.
- Keep the fix minimal and targeted at the actual defect (the token's
  visibility flag), not a rewrite of the identity-check logic itself, which
  is otherwise correct.

## Non Goals

- Any change to transcript persistence, attribution, or feedback generation
  — all three are confirmed working and untouched by this fix.
- Any change to `LiveRoomAudio.jsx`'s own participant list rendering, which
  is sourced entirely from `GET /api/rooms/:id/participants` (a DB-backed
  REST call), not from LiveKit's participant list — confirmed unaffected by
  this fix either way.
- Any broader "how visible should the agent be" product decision beyond
  fixing this regression — `hidden` only ever controlled LiveKit-level
  visibility, which nothing in this app's UI currently surfaces.

## Requirements

- **R1:** A genuine transcript message from the transcriber agent must
  render as a caption in every seated student's `LiveRoomAudio` view.
- **R2:** A data message from any LiveKit participant other than the
  transcriber must still be silently dropped (N13's original intent
  preserved).
- **R3:** The transcriber's token grant otherwise stays the same
  (`canPublish: false`, `canSubscribe: true`, `canPublishData: true`) — only
  the `hidden` flag changes.
- **R4:** No change to the app's own (DB-backed) participant list or active-
  speaker indicator behavior.

## Design

### Fix

`apps/server/src/agent/roomAgent.js`'s `mintTokenFn('transcriber', roomId,
{ ... hidden: true })` call changes `hidden: true` → `hidden: false`. This is
the only functional change. The transcriber's `RemoteParticipant` object will
now be created normally on every other client in the room, so
`RoomEvent.DataReceived`'s `participant` argument resolves to a real object
whose `.identity` genuinely is `'transcriber'`, and the N13 check in
`LiveRoomAudio.jsx` (unchanged) starts working as it was originally intended
to.

**Why this doesn't reopen any other concern:**
- The app's participant list UI (`LiveRoomAudio.jsx`'s `participants` state)
  comes from `GET /api/rooms/:id/participants`, which resolves names from
  `room_participants`/`profiles` in Postgres — it has no dependency on
  LiveKit's participant list at all, so a newly-visible transcriber does not
  appear as a "person" anywhere in the UI.
- `RoomEvent.ActiveSpeakersChanged` (drives the small speaking-indicator dot)
  is populated from participants who are actually publishing audio; the
  transcriber's token still has `canPublish: false`, so it can never appear
  there regardless of `hidden`.
- No other code path in this repo branches on the transcriber's `hidden`
  flag or its visibility (grepped: the only occurrences of `hidden` near
  "transcriber" are comments and this one call site).

**Alternative considered and rejected:** teaching the client to trust the
raw LiveKit-protocol sender identity even when the participant isn't tracked
in `remoteParticipants`. Rejected — `livekit-client`'s public API does not
expose the raw packet's `participantIdentity` string separately from the
resolved `Participant` object; there is no supported way to authenticate a
hidden sender's data message client-side without making it non-hidden. Since
nothing in this app relies on the transcriber staying invisible, un-hiding it
is the smaller, more supportable fix.

### Concurrency/failure behavior

No behavior change for any other participant type. No schema, API, or token-
grant-shape change beyond the one boolean.

## Risks

| Risk | Mitigation |
|---|---|
| Un-hiding the transcriber makes it appear somewhere unexpected in the UI | Confirmed via source read: the app's participant list, active-speaker indicator, and room-capacity check (`domain/roomCapacity.js`, DB-row-count based) are all independent of LiveKit's live participant set |
| Regression in the N13 defense (a forged data message from a non-transcriber sender) | Unchanged logic — `LiveRoomAudio.jsx`'s identity check itself is untouched; only the token's own visibility flag changes, which affects whether the *legitimate* sender resolves, not whether an *illegitimate* one would |
| Only reproducible with a real multi-participant LiveKit connection, not unit-testable end-to-end in this sandbox (no real LiveKit/browser here) | Server-side unit test proves the token mint call now requests `hidden: false`; per guardrail #1, this is explicitly **not** marked fully done until a real human confirms captions render live |

## Acceptance Criteria

- [x] `startTranscriptionForRoom` mints the transcriber's token with
      `hidden: false` (regression test).
- [ ] **Guardrail #1 — outstanding:** a real human, in an actual live
      session, confirms captions now render during the session (not just
      after, via history).

## Implementation Tasks

- [x] RED: add a failing assertion to `apps/server/test/roomAgent.test.js`
      that `mintTokenFn` is called with `hidden: false`.
- [x] GREEN: flip `hidden: true` → `hidden: false` in `roomAgent.js`; correct
      the stale "hidden, subscribe-only participant" file-header comment and
      the N13 comment block in `LiveRoomAudio.jsx` that both described the
      transcriber as hidden.
- [x] Full server + web test suite, lint, build.
- [x] Update `docs/engineering/PROGRESS.md` with the incident writeup.

## Testing

- **Unit:** `apps/server/test/roomAgent.test.js` — asserts the `mintTokenFn`
  spy's grant options include `hidden: false` for the transcriber token.
- **Manual/human verification (guardrail #1, outstanding):** join a real
  live session as at least one student, speak, and confirm caption text
  actually appears in `LiveRoomAudio` while the session is live (not only in
  the post-session transcript view, which was never broken).

## Verification

Commands run from repo root after implementation:

```sh
npm test --workspace=@placeme/server
npm test --workspace=@placeme/web
npm run lint
npm run build
```

## Monitoring

No new server-side signal — `/health/agent`'s `dispatchSuccesses` already
looked healthy throughout this outage, which is exactly why this class of
bug is silent. No dashboard change proposed for a client-only display fix;
if this class of regression matters enough to catch automatically in future,
a frontend LiveKit-integration test (mocking `livekit-client`'s `Room`) would
be the way, not a new metric.

## Rollout

Ship on the normal `fix/* → dev` PR path. No migration, no feature flag
(one boolean in a token-grant call, backward compatible). Per guardrail #1,
this is room/audio/transcription-adjacent behavior and is **not** to be
marked fully "done" until a real human confirms live captions render during
an actual session — flagged as the residual open item in the implementation
summary and `PROGRESS.md`.

## Rollback

Revert the PR — `hidden` reverts to `true`, restoring the exact prior
(broken-captions) state. No data/schema impact either direction.
