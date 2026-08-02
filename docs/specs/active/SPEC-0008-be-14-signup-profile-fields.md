# SPEC-0008 — Signup profile fields: college, graduating year (BE-14)

**Status:** Implemented, pending migration + merge
**Owner:** Claude (agent session)
**Reviewers:** Architect / Reviewer / Security Engineer
**Issue:** `place-me-UI/docs/BACKEND_REQUIREMENTS.md#BE-14`
**Target release:** next `dev` → `main` promotion

## Problem

`place-me-UI`'s `/signup` page renders "College" and "Graduating year"
fields that are entirely uncontrolled (no `value`/`onChange`, no state) and
never submitted. `profiles` (`0001_profiles.sql`) only has `id` and
`display_name`; the `handle_new_user()` trigger that auto-creates a
profile row on signup only reads `raw_user_meta_data->>'display_name'`.

Unlike every other BE item this session, this one is **not** an Express
route/domain change — the entire mechanism is a Postgres trigger function
that runs on `auth.users` insert. There is no `apps/server` JS code
involved at all.

## Goals

- `profiles` gains `college text` and `graduation_year int`, nullable
  (signup doesn't mark either field `required` today).
- The signup trigger persists both from `raw_user_meta_data` when
  provided, same as it already does for `display_name`.
- `/signup` actually collects and sends both fields.

## Non Goals

- No API endpoint to read these back (e.g. a profile page) — nothing in
  `place-me-UI` currently displays them anywhere; `GET /api/me` is
  untouched. Out of scope until something actually needs to show them.
- No validation beyond what the DB naturally provides (`graduation_year`
  as `int` rejects non-numeric input at the column-type level; no extra
  range check like "must be between 2024 and 2030" — not asked for, and
  the existing frontend `<select>` already constrains the common case).
- No backfill for existing profile rows — both columns default to `NULL`
  for anyone who already signed up.

## Requirements

### Functional

- **R1:** `profiles.college` and `profiles.graduation_year` exist,
  nullable.
- **R2:** `handle_new_user()` reads `raw_user_meta_data->>'college'` and
  `raw_user_meta_data->>'graduation_year'` (cast to `int`) when signing up
  a new user, same optional/coalesce-to-null pattern already used for
  `display_name` (which coalesces to `email` instead — college/grad year
  have no equivalent fallback, so they're simply `NULL` when absent).
- **R3:** `/signup` collects both fields (uncontrolled today) and passes
  them through `supabase.auth.signUp`'s `options.data`, alongside the
  already-working `display_name`.

### Security, privacy, and operations

- **R4:** No new RLS policy needed — `profiles_select_own`/
  `profiles_update_own` (`0001_profiles.sql`) already cover the whole row,
  including any new column added to it.
- **R5:** College/graduating year are self-reported, non-sensitive
  identity fields the student already sees on the form; no different
  privacy posture than `display_name`.
- **R6:** `security definer` on `handle_new_user()` already exists and is
  unchanged in kind — only the columns it writes grow.

## Design

Migration `0018`: `alter table public.profiles add column if not exists
college text, add column if not exists graduation_year int;`, then
`create or replace function public.handle_new_user()` with the same
structure as today plus the two new fields, `nullif(..., '')::int` for
`graduation_year` so an empty-string metadata value (rather than an absent
key) doesn't throw a cast error.

`place-me-UI`'s `/signup` gets `college`/`graduationYear` state (mirroring
the existing `name`/`email`/`password` pattern exactly), wired to the
existing uncontrolled inputs, and both added to the `signUp(...)` call's
`data` object.

**Testing approach differs from every other item this session**: there is
no JS domain function to unit test (the entire behavior lives in a
Postgres trigger). Verification is a live-Supabase integration test
(`profilesSignupTrigger.test.js`, same `describe.skipIf(!hasLiveCreds)`
pattern as `topicsRlsIsolation.test.js`/`roomParticipantsRlsIsolation.test.js`):
create a real user via `admin.auth.admin.createUser` with
`user_metadata: { display_name, college, graduation_year }`, then query
`profiles` (service role) for that user's row and assert `college`/
`graduation_year` match.

Confirmed manually before adding any guard: run as a bare live test
against the current (unmigrated) project, this genuinely fails with
`column profiles.college does not exist` — real RED, not assumed. But
unlike the other live-RLS files (which test something already live), this
one would then **stay red in CI indefinitely** until a human manually
applies `0018` — CI in this repo has real Supabase secrets configured
(confirmed via `PROGRESS.md`'s N8 entry), so this isn't a local-only
concern. Added a `beforeAll` schema probe (`select college from profiles
limit 0`) that flips a `migrationApplied` flag; each test calls the
Vitest test-context `ctx.skip()` and returns immediately if false, and the
probe logs a `::warning::` annotation so the skip is visible on a PR
rather than a quiet green checkmark — same "warn visibly, don't silently
pass or permanently fail" spirit as N8's `rls-security` CI job.

## Risks

| Risk | Likelihood/impact | Mitigation | Owner |
|---|---|---|---|
| A non-numeric `graduation_year` metadata value crashes the trigger, blocking signup entirely | Low/High if it happened — signup is the most safety-critical path a trigger bug could break | `nullif(value, '')::int` only ever runs on a value the frontend's own `<select>` already constrains to a 4-digit year string; a malformed direct-API signup would still 500 the trigger, same residual risk `display_name` already accepts as a plain string with no equivalent cast | — |
| Migration not applied to the live Supabase project before merge to `main` | Medium/Low — unlike other items, **omitting this migration doesn't break anything**: `handle_new_user()` before this change simply never reads the two new metadata keys, so signup keeps working exactly as today until the migration lands | Still called out in the PR for completeness | — |

## Acceptance Criteria

- [ ] **AC1:** A new signup with `college`/`graduation_year` in metadata
      produces a `profiles` row with both values persisted.
- [ ] **AC2:** A new signup with neither field in metadata still succeeds,
      with both columns `NULL` (unchanged from today's behavior).
- [ ] **AC3:** `/signup`'s College and Graduating year fields are
      controlled inputs and are actually sent on submit.

## Implementation Tasks

- [ ] `supabase/migrations/0018_profiles_college_graduation_year.sql`.
- [ ] `apps/server/test/profilesSignupTrigger.test.js` — new live-Supabase
      test file.
- [ ] `place-me-UI/src/routes/signup.tsx` — wire both fields, remove the
      BE-14 MOCK comment.
- [ ] `docs/engineering/PLAN.md`/`PROGRESS.md` — migration row, session
      summary.

## Testing

- No unit test — no JS logic exists to unit test (Non Goals-adjacent
  note, not an oversight).
- Integration: `profilesSignupTrigger.test.js`, live Supabase only,
  skipped without credentials, and **also skips gracefully (with a
  `::warning::` annotation), not fails,** if migration `0018` isn't
  applied live yet — verified RED without the guard, then confirmed the
  guard turns that into a clean skip instead.
- Manual: sign up a real test account via the deployed UI once migrated,
  confirm the profile row has both fields.

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| AC1–AC2 | `profilesSignupTrigger.test.js` — confirmed RED (bare, no guard) against the current unmigrated project: `column profiles.college does not exist`. With the `beforeAll` schema-probe guard added, the same run now skips cleanly (2 skipped, 0 failed) with a `::warning::` annotation instead of failing CI | RED confirmed pre-guard; skips cleanly post-guard; GREEN (real assertions running) pending the user applying migration `0018` |
| AC3 | Code review (`signup.tsx`'s College/Graduating year fields are now controlled, sent in `signUp`'s `data`) + `npm run build`/`eslint` clean | ✅ Pass |

## Monitoring

None new.

## Rollout

Merge to `dev` as usual. Migration `0018` needed before the trigger
actually persists these fields, but — unlike every other migration this
session — **omitting it doesn't break anything already working**; signup
keeps functioning identically until it's applied. `dev` → `main` stays the
user's own call.

## Rollback

Revert the application-code PR. The migration itself is additive and
backward-compatible; no rollback needed even if applied.

## Approvals

- Specification: pending user review
- Architecture: N/A
- Security: pending
- Pilot: N/A
