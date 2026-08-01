# SPEC-0007 — Per-participant talk-time share (BE-10)

**Status:** Implemented, pending merge (no migration needed)
**Owner:** Claude (agent session)
**Reviewers:** Architect / Reviewer / Security Engineer
**Issue:** `place-me-UI/docs/BACKEND_REQUIREMENTS.md#BE-10`
**Target release:** next `dev` → `main` promotion

## Problem

`place-me-UI`'s `/ended` page renders a "Talk-time split" card with a
percentage bar per participant, entirely from `src/lib/demo.ts` fixture
data — the page never fetches real participants for the room at all
(`import { participants } from "@/lib/demo"`). `transcript_lines` has
`started_at_ms`/`ended_at_ms` per line, but nothing aggregates that into a
"share of total session talk time" anywhere, and `GET
/api/rooms/:id/participants` doesn't expose it.

`BACKEND_REQUIREMENTS.md` lists three UI spots for this item, but two of
them (`ParticipantTile`'s live `talkShare` %, `/session`'s live "Your
speak time" card) are explicitly the *live, mid-session* version, which
the doc itself calls out as BE-17 — "a separate, harder real-time version
of this same computation" needing a push mechanism (LiveKit data-channel),
not a polled endpoint. **This spec covers the post-session computation
only** (`/ended`'s Talk-time split), matching the doc's own scoping split.

## Goals

- `GET /api/rooms/:id/participants` returns each participant's share of
  total attributed talk time in the room, as an integer percentage.
- `/ended`'s Talk-time split card renders real participants and real
  shares instead of fixture data.

## Non Goals

- Live/mid-session speak-time (BE-17) — not attempted here. This spec's
  computation could theoretically be polled during a live session too
  (nothing prevents it), but building an actual live-updating experience
  (push over the LiveKit data-channel, `/session`'s "Your speak time"
  card, `ParticipantTile`'s live badge) is explicitly out of scope and
  left to BE-17's own spec.
- No change to transcript attribution (`domain/attribution.js`) or to what
  gets written to `transcript_lines` — this only aggregates data that
  already exists.
- No new API route — extends the existing `GET /api/rooms/:id/participants`
  rather than adding a dedicated endpoint, since it already returns
  exactly one row per participant.

## Requirements

### Functional

- **R1:** `GET /api/rooms/:id/participants`'s response gains `talkShare`
  (integer, 0–100) per participant: that participant's total attributed
  speaking duration (sum of `ended_at_ms - started_at_ms` across their own
  transcript lines) as a percentage of the room's total attributed
  speaking duration across all participants.
- **R2:** A room with no transcript lines at all (never started, or
  transcription produced nothing) returns `talkShare: 0` for every
  participant — never a divide-by-zero, never `NaN`.
- **R3:** A transcript line attributed to a user not in the room's current
  participant list (should not happen given `domain/attribution.js`'s
  existing guarantees, but defensively) does not affect any listed
  participant's share.

### Security, privacy, and operations

- **R4:** No new authorization surface — reuses this route's existing
  `isParticipant` gate (only someone seated in the room may see who else
  is seated in it, unchanged).
- **R5:** No new data exposed beyond what's already computed from data the
  route's caller could already read as an aggregate of their own room's
  transcript (this route never returns line-level text, only a per-person
  percentage).

## Design

`domain/talkTime.js` (new file, pure, no DB — same shape as every other
`domain/*.js` aggregation function in this codebase):
`computeTalkTimeShares(transcriptLines, participantUserIds)` — sums
`ended_at_ms - started_at_ms` per `user_id` (ignoring any line whose
`user_id` isn't in `participantUserIds`, R3), then divides each
participant's total by the sum across all participants, rounded to the
nearest integer percent. Returns a `Map<userId, number>` seeded with every
requested `participantUserIds` at `0` first, so an unattributed
participant (nobody heard from them at all) still gets an explicit `0`
entry rather than being silently absent.

`GET /api/rooms/:id/participants` (`api/routes/rooms.js`) fetches
`listTranscriptLinesForRoomFn(roomId)` alongside the existing
`resolveParticipantNames(roomId)` call (parallel, `Promise.all`, same
pattern the `/transcript` route already uses), computes shares, and merges
`talkShare` onto each returned participant object.

`place-me-UI`'s `ended.$roomId.tsx` fetches real participants via the
existing `getRoomParticipants` API call (already exists in `lib/api.ts`,
just never wired into this specific page) instead of importing
`demo.ts`'s fixture `participants`, and `RoomParticipant`'s type gains
`talkShare`.

## Risks

| Risk | Likelihood/impact | Mitigation | Owner |
|---|---|---|---|
| Rounding independent percentages can sum to slightly off 100% (e.g. 99% or 101% across all bars) | Low/Low — cosmetic only, same class of rounding quirk any percentage-bar UI has | Accepted, not solved with remainder-distribution logic — not worth the complexity for a v1 display | — |
| A caller mistakes this for live/real-time data | Low/Medium — could look like BE-17 shipped when it hasn't | `/ended` only ever renders this after a room has ended (transcript is complete by then); not wired into any live-session view in this spec | — |

## Acceptance Criteria

- [ ] **AC1:** A room where one participant spoke twice as long as another
      shows roughly a 2:1 `talkShare` ratio between them.
- [ ] **AC2:** A room with zero transcript lines returns `talkShare: 0`
      for every participant.
- [ ] **AC3:** A transcript line for a user not in the participant list
      does not change any listed participant's share.
- [ ] **AC4:** `/ended`'s Talk-time split card renders real participants
      and real percentages once wired.

## Implementation Tasks

- [ ] `apps/server/src/domain/talkTime.js` — new file,
      `computeTalkTimeShares`.
- [ ] `apps/server/src/api/routes/rooms.js` — merge `talkShare` into
      `GET /api/rooms/:id/participants`'s response.
- [ ] `apps/server/test/talkTime.test.js` — new file.
- [ ] `apps/server/test/roomsApi.test.js` — route-wiring case.
- [ ] `place-me-UI/src/lib/api.ts` — `RoomParticipant` gains `talkShare`.
- [ ] `place-me-UI/src/routes/ended.$roomId.tsx` — fetch real participants,
      remove the BE-10 MOCK comment.
- [ ] `docs/engineering/PLAN.md`/`PROGRESS.md` — session summary (no
      migration — no schema change, transcript_lines already has the
      needed columns).

## Testing

- Unit: `talkTime.test.js` (share ratios, zero-transcript case, stray
  unlisted user_id, single-participant room).
- Integration/API: `roomsApi.test.js` — `/participants` response includes
  `talkShare`.
- Manual: after a real multi-person session ends, confirm the bars
  roughly match who actually spoke more.
- Regression: existing `/participants` and `/transcript` tests stay green
  unchanged.

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| AC1 | `talkTime.test.js` "splits share proportionally to speaking duration" | ✅ Pass |
| AC2 | `talkTime.test.js` "returns 0 for every participant when there are no transcript lines" | ✅ Pass |
| AC3 | `talkTime.test.js` "ignores a transcript line for a user not in the participant list" | ✅ Pass |
| AC4 | Code review (`ended.$roomId.tsx` wired to real `getRoomParticipants`, MOCK comment removed, `* 3` fixture-era scaling removed) + `npm run build`/`eslint` clean | ✅ Pass (by review) |

Full server suite: 415/415 tests green (Node 22, live RLS creds present —
0 skipped), `place-me-UI` lint/build clean.

## Monitoring

None new.

## Rollout

No migration — pure code addition. Merge to `dev` as usual; `dev` → `main`
stays the user's call.

## Rollback

Revert the application-code PR — additive field, no consumer beyond the
new frontend wiring depends on it yet.

## Approvals

- Specification: pending user review
- Architecture: N/A
- Security: pending
- Pilot: N/A
