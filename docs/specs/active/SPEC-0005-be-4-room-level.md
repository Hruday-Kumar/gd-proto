# SPEC-0005 — Room level/difficulty (BE-4, room-creation half only)

**Status:** Implemented, pending migration + merge
**Owner:** Claude (agent session)
**Reviewers:** Architect / Reviewer / Security Engineer
**Issue:** `place-me-UI/docs/BACKEND_REQUIREMENTS.md#BE-4`
**Target release:** next `dev` → `main` promotion

## Problem

`place-me-UI`'s `/rooms/new` renders a Level select (Beginner/Intermediate/
Advanced) that does nothing — no `level` field exists anywhere on `rooms`,
`topics`, or the matchmaking request body.

`BACKEND_REQUIREMENTS.md`'s BE-4 bundles two behaviors under one item: (a)
a `level` column a room creator picks at creation time, and (b) an optional
`level` filter on `POST /api/rooms/match` that only groups same-level
queue members. **This spec covers (a) only.** (b) is deliberately deferred
— per direct user instruction, 2026-08-01 — because it requires a schema
change to `matchmaking_queue` (which currently stores only `user_id`) and
a change to `domain/matchmaking.js`'s `matchmake()`, the pure, tested,
race-sensitive core of the whole matching system
(`matchmakingClaim.js`'s own comment: "matchmake() itself is untouched --
PLAN.md is explicit that it must stay pure"). That's a materially bigger
and riskier change than a single-table creation-time field, and BE-5
already touches the same `/api/rooms/match` request body (group size,
topic pool) — the match-filtering half of BE-4 is deferred to be folded in
alongside BE-5 rather than done twice.

## Goals

- A room creator can pick a level (`beginner` | `intermediate` |
  `advanced`) at creation time via `POST /api/rooms`.
- Omitting the field preserves today's behavior (defaults to
  `intermediate`, matching `/rooms/new`'s existing `defaultValue`).

## Non Goals

- **No match-side level filtering.** `POST /api/rooms/match` does not
  accept a `level` param in this spec and matched rooms always get the
  column's default — explicitly deferred (see Problem). `/match`'s own
  "Level" preference UI is untouched by this spec.
- No `level` on `topics` — the doc says "rooms (and/or topics)"; this
  spec puts it on `rooms` only, matching the exact pattern BE-2
  (`max_participants`) and BE-3 (`visibility`) already established: a
  creator-time choice stored per room, not a property of the (often
  AI-generated, reusable) topic.
- No change to `domain/matchmaking.js` or `matchmaking_queue` at all.

## Requirements

### Functional

- **R1:** `POST /api/rooms` accepts an optional `level` string.
- **R2:** If provided, `level` must be exactly one of `'beginner'`,
  `'intermediate'`, `'advanced'`; otherwise `400`, room not created.
- **R3:** If omitted, the room is created with `level: 'intermediate'`.
- **R4:** The success response includes `level`.

### Security, privacy, and operations

- **R5:** DB-level `CHECK` constraint in addition to route validation,
  same defence-in-depth pattern as BE-2/BE-3.
- **R6:** No new auth surface — reuses existing `requireAuth` +
  `roomActionRateLimiter`.
- **R7:** `level` is not personal data — no consent/retention impact.

## Design

`rooms.level text not null default 'intermediate'`, migration `0016`,
`CHECK (level in ('beginner', 'intermediate', 'advanced'))`. Text + CHECK,
not a DB enum type — same reasoning as `visibility` (`0015`)'s comment:
matches `status`/`join_mode`'s existing style.

`domain/roomLevel.js` (new file, same shape as `roomVisibility.js`):
`VALID_LEVELS`, `DEFAULT_LEVEL = 'intermediate'`, `isValidLevel(value)`.

`POST /api/rooms` validates/defaults `level` exactly like `visibility`
(BE-3) — optional, `!== undefined` check, `??` default — and passes it to
`insertRoom` (new `level` param → `level` column, added to `.select()`).

`POST /api/rooms/match` is **not touched** (Non Goals) — its `insertRoom`
call never passes `level`, so the column's own `DEFAULT 'intermediate'`
applies, exact same mechanism already proven for `maxParticipants`
(BE-2) and `visibility` (BE-3) on this same route.

`place-me-UI`'s `/rooms/new` Level select becomes a controlled input
(state default `"intermediate"`, lowercase values matching the API,
capitalized display labels — same pattern the Visibility radio group
already uses), sent as `level` on create.

## Risks

| Risk | Likelihood/impact | Mitigation | Owner |
|---|---|---|---|
| A hand-crafted request sends an arbitrary string as `level` | Low/Low | Route-level `isValidLevel` (400) + DB `CHECK` | — |
| Migration not applied live before `main` promotion | Medium/Medium — `POST /api/rooms` 500s on the missing column | Called out in the PR, same as `0014`/`0015` | — |
| Someone later assumes this spec also covers match-side filtering | Low/Medium — could ship an incomplete BE-5 that silently ignores level | Explicit Non Goal here; BE-5's own future spec must state whether it inherits this deferred half | — |

## Acceptance Criteria

- [ ] **AC1:** `POST /api/rooms` with `level: 'advanced'` creates a room
      with that value, echoed in the response.
- [ ] **AC2:** `POST /api/rooms` with no `level` creates an `intermediate`
      room.
- [ ] **AC3:** `POST /api/rooms` with an invalid `level` (e.g. `'expert'`,
      `'Beginner'` wrong-case, `1`) returns `400`, no room created.
- [ ] **AC4:** `POST /api/rooms/match` is unaffected — still never passes
      `level`, relying on the DB default.
- [ ] **AC5:** `place-me-UI`'s `/rooms/new` Level select is wired to state
      and sent as `level` on creation.

## Implementation Tasks

- [ ] `supabase/migrations/0016_rooms_level.sql`.
- [ ] `apps/server/src/domain/roomLevel.js` — new file.
- [ ] `apps/server/src/db/rooms.js` — `insertRoom` accepts/persists
      `level`.
- [ ] `apps/server/src/api/routes/rooms.js` — validate/default `level` on
      create, echo in response.
- [ ] `apps/server/test/roomLevel.test.js` — new file.
- [ ] `apps/server/test/roomsApi.test.js` — create-route + `/match`
      non-interference cases.
- [ ] `place-me-UI/src/routes/rooms.new.tsx` — wire Level select, remove
      any now-stale mock framing for the room-creation half only.
- [ ] `place-me-UI/src/lib/api.ts` — `createRoom`/`RoomSummary` gain
      `level`.
- [ ] `place-me-UI/docs/BACKEND_REQUIREMENTS.md` — update BE-4 to reflect
      the split: room-creation half done, match-filter half still
      explicitly open (not silently dropped).
- [ ] `docs/engineering/PLAN.md`/`PROGRESS.md` — migration row, session
      summary.

## Testing

- Unit: `roomLevel.test.js` (`isValidLevel`, same shape as
  `roomVisibility.test.js`).
- Integration/API: `roomsApi.test.js` — create-route validation/default/
  response; `/match` non-interference regression.
- Manual: create a room at each level via the real UI once migrated,
  confirm persistence.
- Regression: all existing `roomsApi.test.js` cases stay green unchanged.

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| AC1 | `roomsApi.test.js` "passes an explicit level through..." | ✅ Pass |
| AC2 | `roomsApi.test.js` "defaults to DEFAULT_LEVEL..." | ✅ Pass |
| AC3 | `roomsApi.test.js` "rejects a %s level..." (4 cases) + `roomLevel.test.js` (9 cases) | ✅ Pass |
| AC4 | `roomsApi.test.js` "does not pass level to insertRoom..." | ✅ Pass |
| AC5 | Code review (Level select wired, `defaultChecked`→controlled) + `npm run build`/`eslint` clean | ✅ Pass (by review) |

Full server suite: 397/397 tests green (Node 22, live RLS creds present —
0 skipped), `apps/web` unaffected, `place-me-UI` lint/build clean.

## Monitoring

None new — same as BE-2/BE-3.

## Rollout

Merge to `dev` → apply migration `0016` live (manual step) → `main`
promotion is the user's own call, not proposed here.

## Rollback

Revert the application-code PR — additive column, nothing else depends on
it yet (the match-filter half, if ever built, would be the first real
consumer beyond the create/echo path).

## Approvals

- Specification: pending user review
- Architecture: N/A
- Security: pending
- Pilot: N/A
