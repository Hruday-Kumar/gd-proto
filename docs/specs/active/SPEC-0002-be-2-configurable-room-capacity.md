# SPEC-0002 — Configurable room capacity (BE-2)

**Status:** Implemented, pending migration + merge
**Owner:** Claude (agent session)
**Reviewers:** Architect / Reviewer / Security Engineer
**Issue:** `place-me-UI/docs/BACKEND_REQUIREMENTS.md#BE-2`
**Target release:** next `dev` → `main` promotion

## Problem

`place-me-UI`'s `/rooms/new` page renders a "Seats" select (4/6/8/10) that
does nothing — the value is never sent anywhere. `POST /api/rooms`
(`gd-proto/apps/server/src/api/routes/rooms.js`) has no `maxParticipants`
field at all; every room is capped at a single global constant
(`DEFAULT_MAX_ROOM_PARTICIPANTS = 6`, `domain/roomCapacity.js`), enforced by
`isRoomFull()` inside `POST /api/rooms/join`. A room creator has no way to
actually choose a smaller or larger group.

## Goals

- A room creator can choose a seat cap (3–12) at creation time.
- The chosen cap is the one actually enforced when others join.
- Omitting the field preserves today's behavior exactly (defaults to 6).

## Non Goals

- No UI for *changing* a room's capacity after creation.
- No change to matchmaking's group size (`/api/rooms/match`'s
  `DEFAULT_MIN_GROUP_SIZE`/`DEFAULT_MAX_GROUP_SIZE`) — those stay separate,
  unrelated constants. Matched rooms are system-assigned, not
  creator-configured (out of scope, no BE item covers it).
- No room-listing/visibility work (BE-1/BE-3) — this only makes capacity
  configurable, not discoverable.

## Requirements

### Functional

- **R1:** `POST /api/rooms` accepts an optional `maxParticipants` integer.
- **R2:** If provided, `maxParticipants` must be an integer in `[3, 12]`
  inclusive; otherwise the request is rejected with `400` and the room is
  not created.
- **R3:** If omitted, the room is created with the existing default (6),
  unchanged from today.
- **R4:** The room's own stored `maxParticipants` — not the global constant
  — is what `POST /api/rooms/join` enforces via `isRoomFull()`.
- **R5:** `POST /api/rooms`'s success response includes `maxParticipants` so
  the frontend can echo it back.

### Security, privacy, and operations

- **R6:** The bound is enforced in the database via a `CHECK` constraint in
  addition to the route-level validation — the server writes with the
  service-role key, which bypasses RLS but not check constraints, same
  defence-in-depth pattern `0009`/`0010` (duration bounds) already
  established.
- **R7:** No new authentication/authorization surface — this reuses the
  existing `requireAuth` + `roomActionRateLimiter` already on
  `POST /api/rooms`.
- **R8:** No consent/retention impact — capacity is not personal data.

## Design

`rooms.max_participants integer not null default 6`, added via migration
`0014`, with a `CHECK (max_participants between 3 and 12)` constraint
mirroring `domain/roomDuration.js`'s existing `isValidDurationSeconds`
pattern (`domain/roomCapacity.js` gains `isValidMaxParticipants`,
`MIN_ROOM_PARTICIPANTS = 3`, `MAX_ROOM_PARTICIPANTS = 12`).

`POST /api/rooms` validates `maxParticipants` the same way it already
validates `durationSeconds`, defaults to `DEFAULT_MAX_ROOM_PARTICIPANTS`
when omitted, and passes it to `insertRoom` (`db/rooms.js`, new
`maxParticipants` param → `max_participants` column, added to the
`.select()` projection).

`getRoomByCode` (`db/rooms.js`) adds `max_participants` to its
`.select()` projection so `POST /api/rooms/join` can read it off the
fetched room row. The join handler's capacity checks
(`isRoomFull(before.length, ...)` and the post-insert
`after.length > maxParticipants` guard) switch from the router-level
`maxParticipants` dependency (a fixed constant today) to
`room.max_participants`. Because `isRoomFull`'s second parameter already
defaults via a JS default parameter (triggers specifically on
`undefined`), this is backward compatible with any row that predates the
migration's backfill — though the migration's `NOT NULL DEFAULT 6` backfills
every existing row, so no row should ever actually have a null/undefined
value in practice. The router-level `maxParticipants` injectable dependency
becomes dead code once both call sites are switched, and is removed.

No schema change to `topics`, `room_participants`, or any RLS policy.

## Risks

| Risk | Likelihood/impact | Mitigation | Owner |
|---|---|---|---|
| A hand-crafted request sends a non-integer/out-of-range `maxParticipants` | Low/Low — same class as H3's duration bug, already has a proven mitigation shape | Route-level `isValidMaxParticipants` check (400, no insert) + DB `CHECK` constraint as defence-in-depth | — |
| Migration not applied to the live Supabase project before this ships to `main` | Medium/Medium — `POST /api/rooms` would 500 on every request (missing column) until applied | Migration is a manual step per this repo's process (`PLAN.md` §3) — call out explicitly in the PR and in `PLAN.md`'s migration table as unapplied until confirmed | — |
| Existing tests assume the global constant | Low/Low | Existing `roomsApi.test.js` join-cap tests use room fixtures with no `max_participants` field — `isRoomFull`'s default-parameter fallback (triggers on `undefined`) keeps them passing unchanged; new tests added for the per-room-value path | — |

## Acceptance Criteria

- [ ] **AC1:** `POST /api/rooms` with `maxParticipants: 4` creates a room
      whose stored capacity is 4, and the response echoes `maxParticipants: 4`.
- [ ] **AC2:** `POST /api/rooms` with no `maxParticipants` creates a room
      capped at the existing default (6) — unchanged from pre-BE-2 behavior.
- [ ] **AC3:** `POST /api/rooms` with an out-of-range or non-integer
      `maxParticipants` (e.g. `2`, `13`, `4.5`, `"6"`) returns `400` and does
      not create a room.
- [ ] **AC4:** `POST /api/rooms/join` rejects a joiner once a room created
      with a *non-default* `maxParticipants` (e.g. 3) reaches that room's own
      cap, even though it's below the global default of 6.
- [ ] **AC5:** The DB rejects an out-of-range `max_participants` at the
      constraint level (defence-in-depth, verified by reading the migration —
      no live-DB access in this session to verify directly, see Verification).
- [ ] **AC6:** `place-me-UI`'s `/rooms/new` "Seats" select is wired to state
      and actually sent as `maxParticipants` on room creation; the BE-2 MOCK
      comment is removed.

## Implementation Tasks

- [ ] `supabase/migrations/0014_rooms_max_participants.sql` — new column +
      check constraint.
- [ ] `apps/server/src/domain/roomCapacity.js` — `isValidMaxParticipants`,
      `MIN_ROOM_PARTICIPANTS`, `MAX_ROOM_PARTICIPANTS`.
- [ ] `apps/server/src/db/rooms.js` — `insertRoom` accepts/persists
      `maxParticipants`; `getRoomByCode` selects `max_participants`.
- [ ] `apps/server/src/api/routes/rooms.js` — validate + default
      `maxParticipants` on create, echo in response; join handler reads
      `room.max_participants` instead of the router-level constant; remove
      the now-dead `maxParticipants` router dependency.
- [ ] `apps/server/test/roomCapacity.test.js` — `isValidMaxParticipants`
      cases.
- [ ] `apps/server/test/roomsApi.test.js` — create-route validation +
      response + `insertRoom` call shape; join-route per-room-cap
      enforcement.
- [ ] `place-me-UI/src/routes/rooms.new.tsx` — wire the Seats select to
      state, send `maxParticipants`, remove the BE-2 MOCK comment.
- [ ] `place-me-UI/src/lib/api.ts` — `createRoom`'s params/`RoomSummary`
      type gain `maxParticipants`.
- [ ] `docs/engineering/PLAN.md` / `PROGRESS.md` — record the new migration
      row (§3) and session summary (guardrail #9).

## Testing

- Unit: `roomCapacity.test.js` (`isValidMaxParticipants` bounds, same shape
  as `roomDuration.test.js`).
- Integration/API: `roomsApi.test.js` — invalid/omitted/valid
  `maxParticipants` on create; join-cap enforcement using a room's own
  stored value rather than the global default.
- Manual/real-device: create a room with 4 seats via the real UI once the
  migration is live, confirm a 5th joiner is rejected while a 4th succeeds.
- Regression: existing join-cap tests (rejoin-at-cap, concurrent-join
  race-back-out) must stay green unchanged.

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| AC1 | `roomsApi.test.js` "passes an explicit maxParticipants through..." | ✅ Pass |
| AC2 | `roomsApi.test.js` "defaults to DEFAULT_MAX_ROOM_PARTICIPANTS..." | ✅ Pass |
| AC3 | `roomsApi.test.js` "rejects a %s maxParticipants..." (4 cases) | ✅ Pass |
| AC4 | `roomsApi.test.js` "enforces the room's own max_participants..." | ✅ Pass |
| AC5 | Migration file review only — **not verified against a live database this session** | Pending (needs the migration applied live + a direct check, same as every other migration in `PLAN.md` §3) |
| AC6 | Code review (Seats select wired, MOCK comment removed) + `npm run build` clean | Pending manual click-through (needs the migration live first) |

## Monitoring

No new signal needed — capacity rejections surface as ordinary `400`/`409`
responses, already covered by existing request logging. No new dashboard.

## Rollout

Ship behind no flag (additive, backward-compatible: omitted field ⇒ old
behavior). Sequencing: merge code to `dev` → apply migration `0014` to the
live Supabase project (manual SQL Editor step, per `PLAN.md` §3) → promote
`dev` → `main`. `POST /api/rooms` will 500 if code referencing the new
column ships before the migration is applied — do not merge to `main`
before the migration is confirmed live.

## Rollback

Revert the application-code PR (route/domain/db changes) — safe at any
time, since the column is additive and nothing else depends on it yet. The
migration itself is not rolled back (dropping a column after it may hold
real room data is a separate, deliberate decision, not a reflexive
rollback step) unless a follow-up migration explicitly does so.

## Approvals

- Specification: pending user review
- Architecture: N/A (no new provider/architecture)
- Security: pending
- Pilot: N/A (pre-pilot feature work)
