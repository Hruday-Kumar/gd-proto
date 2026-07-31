# SPEC-0004 — Room discovery, browsable open rooms (BE-1)

**Status:** Implemented, pending merge (no migration needed)
**Owner:** Claude (agent session)
**Reviewers:** Architect / Reviewer / Security Engineer
**Issue:** `place-me-UI/docs/BACKEND_REQUIREMENTS.md#BE-1`
**Target release:** next `dev` → `main` promotion

## Problem

`place-me-UI` renders "rooms open now" on `/`, a room grid on `/join`, and an
aside on `/match` — all backed by mock data, because `gd-proto` has no
room-listing endpoint at all. A room is reachable only by exact code
(`POST /api/rooms/join`), by being matched into it, or by being its own
creator. There is no concept of a publicly browsable, joinable room.

This is the last of the three agreed P0s (BE-2 → BE-3 → BE-1) and the one
BE-3 (`SPEC-0003`) unblocked: `rooms.visibility` now exists, so this spec
can finally filter on it.

## Goals

- An authenticated student can fetch a bounded list of rooms that are
  currently joinable by anyone: `status = 'waiting'` and
  `visibility = 'public'`.
- Each entry carries enough to render a room card: topic text, host display
  name, current/max seat counts, duration, room code (for the existing
  join-by-code flow), and creation time.
- The list only shows rooms a student could actually join right now — a
  full public room is excluded, not shown-then-rejected.

## Non Goals

- No new join mechanism. Joining a discovered room reuses the existing,
  already-tested `POST /api/rooms/join` (by code) — this spec only adds a
  way to *find* a code, not a new way to *use* one.
- No `level`/difficulty filter (BE-4, not built yet) — out of scope,
  matches `BACKEND_REQUIREMENTS.md`'s own scoping.
- No true cursor pagination — a single bounded page (`LIMIT`), consistent
  with this codebase's M9 discipline (`MAX_HISTORY_ROOMS`,
  `listParticipants`'s cap, etc.). See Risks for the one consequence of
  this choice.
- No live/real-time updates to the list (no websocket, no polling
  contract specified here) — the frontend can choose to poll on its own
  cadence, same as it already does for room status.

## Requirements

### Functional

- **R1:** `GET /api/rooms/open` returns every room with
  `status = 'waiting'` and `visibility = 'public'`, newest-created first,
  bounded to a fixed page size.
- **R2:** A room already at its own capacity (`participantCount >=
  maxParticipants`) is excluded from the results — the list only shows
  rooms a caller could actually join.
- **R3:** Each entry includes: `id`, `code`, `topicText`, `durationSeconds`,
  `maxParticipants`, `participantCount`, `hostDisplayName`, `createdAt`.

### Security, privacy, and operations

- **R4:** Requires authentication (`requireAuth`), same as every other
  route in this file — there is no anonymous/public-internet surface in
  this API. No consent gate (browsing isn't mic/audio capture, matching
  the existing `GET /api/rooms/mine/active` precedent).
- **R5:** No new rate limiter — a plain bounded read, same precedent as
  `GET /api/rooms/mine/active` and `GET /api/history/mine` (neither is
  Gemini-backed or mutating).
- **R6:** The result is bounded (`LIMIT`), per M9 discipline — an
  unbounded `SELECT` here would scale with total public-room count, not
  per-caller state.
- **R7:** Only public data already visible to any authenticated student is
  exposed — topic text, host display name (already shown elsewhere, e.g.
  `GET /api/rooms/:id/participants`), and aggregate counts. No other
  student's private data (their own room history, feedback, etc.) is
  touched by this endpoint.

## Design

**`db/rooms.js`**: new `listOpenRooms()` — `rooms` filtered to
`status = 'waiting'` and `visibility = 'public'`, ordered
`created_at desc`, `.limit(MAX_OPEN_ROOMS)` (new constant, same placement
convention as `MAX_HISTORY_ROOMS` in this file). Selects
`id, code, duration_seconds, max_participants, created_by, created_at,
topics(text)` — same embedded-topic-via-foreign-key pattern
`getRoomById`/`listRoomsByIds` already use.

**`db/roomParticipants.js`**: new `listParticipantsForRooms(roomIds)` —
batched sibling of the existing single-room `listParticipants(roomId)`,
`select('room_id, user_id').in('room_id', roomIds)`, empty-array-guarded
like `listProfiles`. One query for however many open rooms exist, not one
query per room.

**`domain/roomListing.js`** (new file, same "pure assembly, no DB" shape as
`domain/sessionHistory.js`'s `buildSessionHistory`): `buildOpenRoomsList
(rooms, participantRows, profiles)` — counts `participantRows` per
`room_id` into a `Map`, maps `profiles` by `id` for host display names,
**filters out any room where the count has already reached
`max_participants`** (R2), and shapes the rest into the response contract
(R3). Kept pure/storage-agnostic and unit-testable without a live DB, same
reasoning as every other `domain/*.js` file in this codebase.

**`api/routes/rooms.js`**: `router.get('/api/rooms/open', requireAuth,
async (req, res) => {...})` — fetches `listOpenRoomsFn()`, then in
parallel `listParticipantsForRoomsFn(roomIds)` and
`listProfilesFn(uniqueCreatedByIds)`, and responds
`{ rooms: buildOpenRoomsList(...) }`. No mutation, no new dependency
injection surprises — follows `createHistoryRouter`'s exact wiring shape.

Room code is included in the response deliberately (R3) — the frontend
joins a discovered room by feeding that code straight into the existing
`POST /api/rooms/join`, reusing its full capacity-check/race-safety logic
untouched (Non Goals).

## Risks

| Risk | Likelihood/impact | Mitigation | Owner |
|---|---|---|---|
| Filtering full rooms out *after* the bounded fetch could return fewer than `MAX_OPEN_ROOMS` results even if more open rooms exist beyond the page | Low/Low at pilot scale (5–10 concurrent rooms per `CLAUDE.md`) — a full page of `MAX_OPEN_ROOMS` *public, waiting* rooms is already an unlikely pilot scenario | Accepted simplification, named explicitly (Non Goals) rather than silently wrong; revisit with real cursor pagination if the pilot ever approaches this scale | — |
| A room's host has no `profiles` row (shouldn't happen, but `listProfiles` can return fewer rows than requested ids) | Low/Low | Same fallback pattern already used everywhere else in this file (`resolveParticipantNames`): `nameById.get(id) || id`, never throws on a missing profile | — |
| N+1 query risk if implemented naively (one participant-count query per room) | Would become real at any meaningful room count | Avoided by design — `listParticipantsForRooms` is one batched query for every open room's participants, not one query per room | — |

## Acceptance Criteria

- [ ] **AC1:** `GET /api/rooms/open` returns only rooms with
      `status: 'waiting'` and `visibility: 'public'` — a private or a
      live/ended public room never appears.
- [ ] **AC2:** A public waiting room already at capacity
      (`participantCount >= maxParticipants`) is excluded.
- [ ] **AC3:** Each returned entry has the full R3 shape, with
      `hostDisplayName` resolved from the creator's profile (falling back
      to the raw id if no profile exists).
- [ ] **AC4:** The query is bounded — confirmed via `MAX_OPEN_ROOMS` and a
      test asserting `.limit()` is actually called with it.
- [ ] **AC5:** Requires authentication — an unauthenticated request never
      reaches the handler (reuses `requireAuth`, already covered by this
      file's existing auth-wiring tests elsewhere).

## Implementation Tasks

- [ ] `apps/server/src/db/rooms.js` — `listOpenRooms`, `MAX_OPEN_ROOMS`.
- [ ] `apps/server/src/db/roomParticipants.js` — `listParticipantsForRooms`.
- [ ] `apps/server/src/domain/roomListing.js` — new file,
      `buildOpenRoomsList`.
- [ ] `apps/server/src/api/routes/rooms.js` — `GET /api/rooms/open`.
- [ ] `apps/server/test/roomListing.test.js` — new file, `buildOpenRoomsList`
      cases (capacity filtering, host-name fallback, shape).
- [ ] `apps/server/test/roomsApi.test.js` — route-wiring cases.
- [ ] `place-me-UI/src/lib/api.ts` — new `listOpenRooms` call + type.
- [ ] `place-me-UI/src/routes/index.tsx`, `join.tsx`, `match.tsx` — wire the
      "rooms open now" / room grid / aside to the real endpoint, remove
      the BE-1 MOCK comments.
- [ ] `docs/engineering/PLAN.md` / `PROGRESS.md` — session summary
      (guardrail #9). No new migration row (no schema change).

## Testing

- Unit: `roomListing.test.js` (`buildOpenRoomsList` — capacity filtering,
  count aggregation, host-name resolution/fallback, empty input).
- Integration/API: `roomsApi.test.js` — `GET /api/rooms/open` wiring
  (auth required, response shape, bounded query call).
- Manual/real-device: create a public room, confirm it appears in a second
  account's `/join` grid; fill it to capacity, confirm it disappears.
- Regression: no existing route touched except adding one new handler —
  every pre-existing `roomsApi.test.js` case must stay green unchanged.

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| AC1 | `db/rooms.js`'s `listOpenRooms` filters `status='waiting'`/`visibility='public'` at the query level; code review + route test | ✅ Pass |
| AC2 | `roomListing.test.js` "excludes a room that has already reached its own max_participants" | ✅ Pass |
| AC3 | `roomListing.test.js` shape/host-fallback cases + `roomsApi.test.js` route-wiring case | ✅ Pass |
| AC4 | `MAX_OPEN_ROOMS` + `.limit()` in `listOpenRooms`, code review (no dedicated call-args test — same pattern as `MAX_HISTORY_ROOMS`, untested at the `.limit()` call-arg level elsewhere in this codebase either) | ✅ Pass (by code review) |
| AC5 | `requireAuth` is the route's first middleware, same construction as every other route in this file | ✅ Pass (by construction) |

Full server suite: 381/381 tests green (Node 22, live RLS creds present in
this environment — 0 skipped), `apps/web` lint/build clean, `place-me-UI`
lint/build clean.

## Monitoring

No new signal needed — a plain bounded read, already covered by existing
request logging.

## Rollout

No migration, no schema change — this ships as a pure code addition. Safe
to merge to `dev` and promote to `main` on the same schedule as any other
PR (unlike BE-2/BE-3, nothing here is blocked on a manual Supabase step).

## Rollback

Revert the application-code PR — safe at any time, purely additive (one
new route, two new DB helpers, one new domain file).

## Approvals

- Specification: pending user review
- Architecture: N/A (no new provider/architecture)
- Security: pending
- Pilot: N/A (pre-pilot feature work)
