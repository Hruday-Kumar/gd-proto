# SPEC-0009 — Aggregate stats: streak, avg score, speak-time % (BE-9)

**Status:** Implemented, pending merge (no migration needed)
**Owner:** Claude (agent session)
**Reviewers:** Architect / Reviewer / Security Engineer
**Issue:** `place-me-UI/docs/BACKEND_REQUIREMENTS.md#BE-9`
**Target release:** next `dev` → `main` promotion

## Problem

`/` home and `/history` render four stat tiles (Sessions, Avg. score, Speak
time, Streak). "Sessions" is already real in `history.tsx` (`sessions.length`)
but not in `index.tsx`; the other three are 100% `demo.ts` fixture data in
both places. "Avg. score" and "Streak" are computable from data
`GET /api/history/mine` already returns (`score`, `startedAt`). "Speak-time
%" is not — that response has no per-session talk-time data at all; BE-10
only added `talkShare` to `GET /api/rooms/:id/participants` (all
participants of one room), not to the history list (the caller's own
share across many rooms).

## Goals

- `GET /api/history/mine` additionally returns the caller's own
  `talkShare` (0–100, or `null` if the room has no transcript) per
  session, reusing BE-10's `computeTalkTimeShares` rather than
  reimplementing the aggregation.
- `place-me-UI`'s Sessions/Avg. score/Speak time/Streak tiles on both `/`
  and `/history` compute from real data.

## Non Goals

- No `delta` text (the mock's "+4 this week", "+6 vs last month", etc.) —
  that's a period-over-period comparison, a separate, larger feature this
  item doesn't ask for. `StatCard`'s `delta` prop is optional; real tiles
  simply omit it rather than fabricate a comparison.
- No dedicated `GET /api/me/stats` endpoint — the doc's own suggested
  shape only wants one if history is ever paginated, which it isn't
  (`MAX_HISTORY_ROOMS = 200`, well within one response at pilot scale).
- No change to `GET /api/rooms/:id/participants`'s existing `talkShare`
  (BE-10) — this is a second, differently-scoped computation (one room,
  every participant vs. many rooms, one participant), not a refactor of
  the first.

## Requirements

### Functional

- **R1:** Each `GET /api/history/mine` session gains `talkShare: number |
  null` — the caller's own share of that room's total attributed
  speaking time, or `null` if the room has no transcript lines at all
  (never a fabricated `0`, same rule already applied to `score`).
- **R2:** `place-me-UI` computes, from the already-fetched history list:
  average score (over sessions with a non-null `score`), average
  talk-time share (over sessions with a non-null `talkShare`), and
  current streak (consecutive calendar days with at least one `ended`
  session, active if the most recent practiced day is today or
  yesterday).
- **R3:** Any stat with no underlying data (no scored sessions, no
  practiced days) renders an honest placeholder ("—" or "0"), never a
  fabricated number.

### Security, privacy, and operations

- **R4:** No new authorization surface — `GET /api/history/mine` already
  scopes everything to `req.userId`; the new field follows the same
  scoping.
- **R5:** The batched transcript-line fetch backing this is bounded (M9
  discipline) — see Design.

## Design

`db/transcriptLines.js` gains `listTranscriptLinesForRooms(roomIds)` — one
batched query (`select('room_id, user_id, started_at_ms, ended_at_ms')
.in('room_id', roomIds)`), not one query per history room (the same
batch-don't-loop lesson BE-1/BE-10 already established in this codebase),
bounded by a new `MAX_HISTORY_TRANSCRIPT_LINES` ceiling.

`domain/talkTime.js` gains `computeMyTalkShareByRoom(transcriptLines,
userId)` — groups a flat multi-room line list by `room_id`, and for each
room calls the existing `computeTalkTimeShares` (BE-10) with the caller's
id explicitly included in the participant set (so a room where the caller
was silent still reports a real `0`, not an absence) and reads back just
that one id's share. A room with zero lines in the input never appears in
the returned map at all, letting the caller distinguish "no transcript"
from "spoke 0%."

`domain/sessionHistory.js`'s `buildSessionHistory` gains a third,
default-empty-`Map` parameter, `talkShareByRoomId`, and adds `talkShare:
talkShareByRoomId.get(room.id) ?? null` to each session.

`api/routes/history.js`'s `GET /api/history/mine` fetches
`listTranscriptLinesForRoomsFn(roomIds)` alongside its two existing
fetches (three-way `Promise.all`), computes the map, passes it through.

`place-me-UI`: `HistorySession` gains `talkShare: number | null`. Both
`history.tsx` and `index.tsx` compute `avgScore`/`avgTalkShare`/`streak`
from the fetched session list and render them via `StatCard` in place of
the three remaining fixture tiles (`stats.slice(1)`/`stats`), with
`index.tsx`'s "Sessions" tile also switched from fixture to
`sessions.length` while this file is already being touched for the
others.

## Risks

| Risk | Likelihood/impact | Mitigation | Owner |
|---|---|---|---|
| Batched transcript fetch across up to 200 history rooms returns a very large row set | Low/Low at pilot scale (a 25-min room realistically has well under 200 lines; even a worst case is bounded by the new ceiling) | `MAX_HISTORY_TRANSCRIPT_LINES` ceiling, same M9 "generous headroom, not expected to bind" reasoning as every other bound in this codebase | — |
| Streak semantics (does missing today still count if you practiced yesterday) are a real design choice, not specified anywhere | Low/Low — cosmetic stat, not a graded/scored behavior | Implemented as "active through the end of the day after your last practiced day" (standard habit-tracker semantics), documented here and in code rather than silently picked | — |

## Acceptance Criteria

- [ ] **AC1:** A session whose room has transcript lines returns a
      non-null `talkShare` reflecting the caller's real share.
- [ ] **AC2:** A session whose room has no transcript lines returns
      `talkShare: null`.
- [ ] **AC3:** `place-me-UI`'s Avg. score / Speak time / Streak tiles show
      real computed values on both `/` and `/history`.
- [ ] **AC4:** A student with no scored sessions / no talk-time data / no
      practice days sees an honest placeholder, not a fabricated number.

## Implementation Tasks

- [ ] `apps/server/src/db/transcriptLines.js` —
      `listTranscriptLinesForRooms`.
- [ ] `apps/server/src/domain/talkTime.js` — `computeMyTalkShareByRoom`.
- [ ] `apps/server/src/domain/sessionHistory.js` — third param, `talkShare`
      field.
- [ ] `apps/server/src/api/routes/history.js` — wire the new fetch/compute.
- [ ] `apps/server/test/talkTime.test.js` — `computeMyTalkShareByRoom`
      cases.
- [ ] `apps/server/test/sessionHistory.test.js` — `talkShare` field cases.
- [ ] `apps/server/test/historyApi.test.js` — route-wiring case.
- [ ] `place-me-UI/src/lib/api.ts` — `HistorySession` gains `talkShare`.
- [ ] `place-me-UI/src/routes/history.tsx`, `index.tsx` — real stat tiles.
- [ ] `docs/engineering/PLAN.md`/`PROGRESS.md` — session summary (no
      migration — no schema change).

## Testing

- Unit: `talkTime.test.js` (multi-room grouping, silent-caller-gets-zero,
  room-with-no-lines-absent-from-map), `sessionHistory.test.js`
  (`talkShare` present/null).
- Integration/API: `historyApi.test.js` — route wiring.
- Manual: after a couple of real sessions, confirm the home/history stat
  tiles show sensible, non-fabricated numbers.
- Regression: all existing `history`/`sessionHistory` tests stay green
  unchanged.

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| AC1 | `talkTime.test.js`/`historyApi.test.js` new `talkShare`-computation cases | ✅ Pass |
| AC2 | `sessionHistory.test.js` "attaches talkShare from the given map, or null when a room is absent" | ✅ Pass |
| AC3 | Code review (`history.tsx`/`index.tsx` real stat tiles) + `npm run build`/`eslint` clean | ✅ Pass (by review) |
| AC4 | `average()`'s null-for-empty-input + `streak > 0` conditionals render "—" placeholders, code review | ✅ Pass (by review) |

Full server suite: 421/421 tests green (Node 22, live RLS creds present),
2 skip cleanly (BE-14's guard, unrelated). `place-me-UI` lint/build clean.

## Monitoring

None new.

## Rollout

No migration — pure code addition. `dev` → `main` stays the user's call.
Depends on migration `0017` (BE-6/BE-7) being live for "Avg. score" to
show anything but a placeholder.

## Rollback

Revert the application-code PR — additive field, existing `feedback`/
`score` consumers of `GET /api/history/mine` unaffected.

## Approvals

- Specification: pending user review
- Architecture: N/A
- Security: pending
- Pilot: N/A
