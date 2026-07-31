# SPEC-0003 — Room visibility, public/private (BE-3)

**Status:** Implemented, pending migration + merge
**Owner:** Claude (agent session)
**Reviewers:** Architect / Reviewer / Security Engineer
**Issue:** `place-me-UI/docs/BACKEND_REQUIREMENTS.md#BE-3`
**Target release:** next `dev` → `main` promotion

## Problem

`place-me-UI`'s `/rooms/new` page renders a Public/Private radio group that
does nothing — the choice is never sent anywhere. No `visibility` concept
exists on `rooms` at all; every room today behaves like "private" (reachable
only by exact code, by being matched into it, or by being its own creator).

Note: `BACKEND_REQUIREMENTS.md`'s own BE-3 header says "(P0, depends on
BE-1)", but its content says the opposite — the suggested `visibility`
column is described as something "read by BE-1's listing endpoint," i.e.
BE-1 depends on BE-3, not the reverse. This spec follows the content (and
the order already agreed with the user: BE-2 → BE-3 → BE-1) and treats the
header annotation as a documentation error, corrected in this PR.

## Goals

- A room creator can mark a room `public` or `private` at creation time.
- The value is persisted and returned, ready for BE-1's listing endpoint to
  filter on next.
- Omitting the field preserves today's behavior exactly (defaults to
  `private`).

## Non Goals

- No listing/discovery endpoint yet — that is BE-1, a separate spec, and
  the reason this column needs to exist first.
- No behavior change to who can *join* a room. `visibility` only ever
  controls whether a room appears in a future browsable listing (BE-1); it
  does not relax or restrict `POST /api/rooms/join`'s existing code-based
  access, and does not change matched-room behavior (`POST /api/rooms/match`
  keeps creating rooms with the column's default, `private` — matched
  rooms are system-formed, not creator-configured, and nothing in BE-3
  asks for that to change).
- No UI for changing a room's visibility after creation.

## Requirements

### Functional

- **R1:** `POST /api/rooms` accepts an optional `visibility` string.
- **R2:** If provided, `visibility` must be exactly `'public'` or
  `'private'`; otherwise the request is rejected with `400` and the room is
  not created.
- **R3:** If omitted, the room is created `private` — unchanged from
  today's de facto behavior.
- **R4:** The success response includes `visibility` so the frontend can
  echo it back.

### Security, privacy, and operations

- **R5:** The allowed values are enforced in the database via a `CHECK`
  constraint in addition to route-level validation — same defence-in-depth
  pattern as BE-2 (`SPEC-0002`) and `0009`/`0010`'s duration bounds.
- **R6:** No new authentication/authorization surface — reuses the
  existing `requireAuth` + `roomActionRateLimiter` already on
  `POST /api/rooms`.
- **R7:** `visibility` is metadata about a room, not personal data — no
  consent/retention impact. It does not, by itself, expose anything: no
  listing endpoint exists yet to read it (BE-1).

## Design

`rooms.visibility text not null default 'private'`, added via migration
`0015`, with a `CHECK (visibility in ('public', 'private'))` constraint.
Text + `CHECK`, not a Postgres `enum` type, matching this schema's existing
style for small closed sets (`rooms.status`, `rooms.join_mode` are also
plain `text` with application/route-level validation, not DB enum types) —
consistent, not a new pattern.

`domain/roomVisibility.js` (new file, same shape as `domain/roomDuration.js`
and `domain/roomCapacity.js`): `VALID_VISIBILITIES = ['public', 'private']`,
`DEFAULT_VISIBILITY = 'private'`, `isValidVisibility(value)`.

`POST /api/rooms` validates `visibility` the same way it already validates
`durationSeconds`/`maxParticipants` (BE-2), defaults to `'private'` when
omitted, and passes it to `insertRoom` (`db/rooms.js`, new `visibility`
param → `visibility` column, added to the `.select()` projection so the
create response can echo it).

No other route touches `visibility` in this spec — `getRoomByCode`/
`getRoomById`'s select lists are untouched (nothing currently reads
visibility on the join/status/token paths; BE-1's listing endpoint will add
whatever selects it needs then). `POST /api/rooms/match`'s `insertRoom`
call is also untouched — it doesn't pass `visibility`, so the column's own
`DEFAULT 'private'` applies automatically, matching this spec's Non Goals.

## Risks

| Risk | Likelihood/impact | Mitigation | Owner |
|---|---|---|---|
| A hand-crafted request sends an arbitrary string as `visibility` | Low/Low — same class as BE-2's bound check | Route-level `isValidVisibility` (400, no insert) + DB `CHECK` constraint | — |
| Migration not applied to the live Supabase project before merge to `main` | Medium/Medium — `POST /api/rooms` would 500 on every request (missing column) until applied | Migration is a manual step per `PLAN.md` §3 — called out in the PR, same as `0014` | — |
| Future BE-1 misreads `visibility` as an access-control gate rather than a listing filter | Low/Medium — could accidentally let a "private" room's *join* path change | Explicit Non Goal above; BE-1's own spec must state it only filters the listing endpoint, never `POST /api/rooms/join` | — |

## Acceptance Criteria

- [ ] **AC1:** `POST /api/rooms` with `visibility: 'public'` creates a room
      with that stored value, echoed in the response.
- [ ] **AC2:** `POST /api/rooms` with no `visibility` creates a `private`
      room — unchanged from pre-BE-3 behavior.
- [ ] **AC3:** `POST /api/rooms` with an invalid `visibility` (e.g.
      `'secret'`, `1`, `true`) returns `400` and does not create a room.
- [ ] **AC4:** The DB rejects an out-of-set `visibility` at the constraint
      level (defence-in-depth, verified by migration review — no live-DB
      access this session, see Verification).
- [ ] **AC5:** `POST /api/rooms/match` (matched rooms) is unaffected —
      still creates rooms with no explicit `visibility`, defaulting to
      `'private'` at the DB level.
- [ ] **AC6:** `place-me-UI`'s `/rooms/new` Public/Private radio group is
      wired to state and actually sent as `visibility` on room creation;
      the BE-3 MOCK comment is removed.

## Implementation Tasks

- [ ] `supabase/migrations/0015_rooms_visibility.sql` — new column + check
      constraint.
- [ ] `apps/server/src/domain/roomVisibility.js` — new file:
      `isValidVisibility`, `VALID_VISIBILITIES`, `DEFAULT_VISIBILITY`.
- [ ] `apps/server/src/db/rooms.js` — `insertRoom` accepts/persists
      `visibility`, selects it back.
- [ ] `apps/server/src/api/routes/rooms.js` — validate + default
      `visibility` on create, echo in response.
- [ ] `apps/server/test/roomVisibility.test.js` — new file,
      `isValidVisibility` cases.
- [ ] `apps/server/test/roomsApi.test.js` — create-route validation +
      response + `insertRoom` call shape; matched-room path unaffected.
- [ ] `place-me-UI/src/routes/rooms.new.tsx` — wire the visibility radio
      group to state, send `visibility`, remove the BE-3 MOCK comment.
- [ ] `place-me-UI/src/lib/api.ts` — `createRoom`'s params/`RoomSummary`
      type gain `visibility`.
- [ ] `place-me-UI/docs/BACKEND_REQUIREMENTS.md` — correct BE-3's header
      (it currently says "depends on BE-1", contradicting its own content),
      update status once implemented.
- [ ] `docs/engineering/PLAN.md` / `PROGRESS.md` — record the new migration
      row (§3) and session summary (guardrail #9).

## Testing

- Unit: `roomVisibility.test.js` (`isValidVisibility`, same shape as
  `roomCapacity.test.js`'s `isValidMaxParticipants` tests).
- Integration/API: `roomsApi.test.js` — invalid/omitted/valid `visibility`
  on create; confirms `/match`'s `insertRoom` call is untouched.
- Manual/real-device: create a public and a private room via the real UI
  once the migration is live, confirm both persist correctly (no listing
  endpoint exists yet to browse them — that's BE-1).
- Regression: existing `roomsApi.test.js` cases (BE-2's and pre-existing)
  must stay green unchanged.

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| AC1 | `roomsApi.test.js` "passes an explicit visibility through..." | ✅ Pass |
| AC2 | `roomsApi.test.js` "defaults to DEFAULT_VISIBILITY..." | ✅ Pass |
| AC3 | `roomsApi.test.js` "rejects a %s visibility..." (4 cases) | ✅ Pass |
| AC4 | Migration file review only — **not verified against a live database this session** | Pending (needs the migration applied live + a direct check, same as `0014`) |
| AC5 | `roomsApi.test.js` "does not pass visibility to insertRoom..." | ✅ Pass |
| AC6 | Code review (radio group wired, MOCK comment removed) + `npm run build`/`eslint` clean | Pending manual click-through (needs the migration live first) |

## Monitoring

No new signal needed — same as BE-2, rejections surface as ordinary `400`
responses already covered by existing request logging.

## Rollout

Same sequencing as BE-2 (`SPEC-0002`): merge to `dev` → apply migration
`0015` to the live Supabase project (manual step) → promote `dev` → `main`.
Do not merge to `main` before the migration is confirmed live.

## Rollback

Revert the application-code PR — safe at any time, additive column, nothing
else depends on it yet (BE-1, the first real consumer, doesn't exist).

## Approvals

- Specification: pending user review
- Architecture: N/A (no new provider/architecture)
- Security: pending
- Pilot: N/A (pre-pilot feature work)
