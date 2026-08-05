# STATUS — current state

**Last updated:** 2026-08-05. Short-lived by design — if this looks
stale, trust `git log`/`gh pr list`/`ACTION_PLAN.md` over this file and
update it while you're here.

## Branches & deploys

- **`main`** — production. Render (`apps/server`, `gdarena.placeme.study`)
  and Vercel (`apps/web`, `gd-proto-web.vercel.app`) both auto-deploy
  from `main`.
- **`dev`** — integration branch. Currently **ahead of `main`** by the
  Phase 3 cross-repo-contract work (PRs #100–#103: OpenAPI contract,
  a pre-existing CI test-isolation fix, Node pinning, blocking
  dependency-audit) — not yet released. Release when ready via a
  `dev` → `main` PR, same pattern as prior releases (e.g. PR #99).
- **`placeme-UI`** (sibling repo) — `main` only, no separate `dev`; also
  auto-deploys.

## Migrations

Latest applied to the live Supabase project: **`0022_drop_rooms_
consents_client_insert.sql`**. Everything through `0022` is confirmed
live (Phase 1, 2026-08-04). `0019`–`0021` (SPEC-0011's evaluation
pipeline tables + the evidence-timestamp bigint fix) are also live —
confirmed via a real local run against the same Supabase project
(Phase 0 verification, 2026-08-04).

## What's actually live and human-verified

- Real multiplayer GD rooms end-to-end on `apps/web` (`gd-proto-web.
  vercel.app`): live audio, correct per-speaker attribution, generated
  feedback — two-person walkthrough, 2026-07-29 (guardrail #1).
- SPEC-0011's redesigned evaluation pipeline (grounded, evidence-backed
  scoring instead of the old ungrounded one-shot call) — verified
  against two real participants, 2026-08-04, after fixing two real bugs
  found in that same verification pass (evidence timestamp overflow,
  unrounded scores hitting an `integer` column). Second re-verification
  run after the fix is the next actual next-action — see below.
- `placeme-UI` has **not yet** cleared the same real-audio/transcription/
  feedback bar — every test there mocks the LiveKit connection. This is
  the blocker on retiring `apps/web` (see `ACTION_PLAN.md` Phase 2).

## Known gaps / blockers

- **SPEC-0011 status is still "Draft"** in its own doc despite `phase-2`
  being fully merged and the legacy scoring path already deleted —
  doc/reality drift, not a functional blocker. Update the spec's status
  once AC7's second verification pass (below) closes out.
- **AC7 (human verification of the redesigned pipeline) needs a second
  pass** — the first (2026-08-04) found and fixed two real bugs; nobody
  has re-verified with those fixes in place yet.
- **`placeme-UI` real-audio verification** — see above. Blocks retiring
  `apps/web`.
- **`gd-frontend`** — stale mirror, deliberately left alone until the
  above stabilizes (`ACTION_PLAN.md` decision log, 2026-08-04).
- Cross-repo OpenAPI drift detection is **not fully automated**:
  `placeme-UI`'s CI checks its vendored contract copy against its own
  generated types (catches a stale/hand-edited generated file), but
  can't fetch `gd-proto`'s real HEAD to check the vendored copy itself
  is current — `gd-proto` is a private repo and no cross-repo credential
  exists for that yet. `npm run sync-contract` (in `placeme-UI`, reads a
  sibling `gd-proto` checkout) is the manual step until/unless that's
  worth automating.

## Next action

1. Release `dev` → `main` once Phase 3's remaining item (this doc
   consolidation) lands and CI is confirmed green on `dev`.
2. Re-run AC7's human verification pass against the fixed evaluation
   pipeline; update SPEC-0011's status to Approved once it passes.
3. Verify `placeme-UI` against real audio/transcription/feedback (same
   bar `apps/web` already cleared); only then retire `apps/web`.
4. Phase 4 (the pilot) is gated on all of the above.

Full detail behind every line above: `../../ACTION_PLAN.md` (the live
cross-repo tracker) and `archive/PROGRESS.md`/`archive/PLAN.md` for
everything that happened before 2026-08-05.
