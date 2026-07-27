# Branching workflow

**Decided:** 2026-07-26, per direct user instruction. This is a standing
rule — follow it for every feature or chore, no exceptions, unless the user
explicitly says otherwise for a specific task. **Branch cleanup and the
release step were revised 2026-07-27** — see the per-task flow's step 5
and 6 and the Notes below; the "never delete branches" rule from
2026-07-26 is superseded.

## Repo note (2026-07-27)
This project moved to a new remote, `github.com/placemestudy1/gd-proto`
(now `origin`). Only `main` and a fresh `dev` (reset to match `main`
exactly) were carried over — the dozens of task branches and PRs from the
old repo (`Hruday-Kumar/gd-proto`, no longer a configured remote) were
deliberately left behind, not migrated. Start clean from here.

## The two long-lived branches
- **`main`** — production. Only ever updated via a `dev` → `main` PR when
  a set of work is ready to ship. Never commit to `main` directly.
- **`dev`** — integration branch for all in-progress development. Always
  the base for new work.

## Break each workstream into small task branches (2026-07-26)

A `PHASE1_PLAN.md` workstream (W3, W4, ...) is not one branch — it's a
*sequence* of small task branches, each following the per-task flow below,
each merged into `dev` as it's finished. Don't hold one giant branch open
for an entire workstream. Concretely: split the workstream along its
already-named core/peripheral units (e.g. W4's room-code generation,
matchmaking function, session state machine are three separate
branches/PRs, not one), merge each into `dev` as it lands, and only report
back to the user once the *whole workstream* is done — not after every
small branch. This is about reviewable-diff granularity and steady
progress, not about pausing for a check-in after each piece.

## Per-task flow
1. **Before starting any new feature or chore:** check out `dev`, pull
   latest, and rebase it onto `main` if `main` has moved
   (`git checkout dev && git pull && git rebase main`) — keeps `dev` from
   drifting far from production.
2. **Create a task branch off `dev`**, named for the work:
   `feature/<short-name>` or `chore/<short-name>` (e.g.
   `feature/w3-consent`, `chore/branching-workflow`).
3. **Work only on that branch** for the duration of the task. Don't mix
   unrelated work into it.
4. **Rebase the task branch onto latest `dev`** before opening the PR (and
   again if `dev` moves while the PR is open), so history stays linear:
   `git fetch origin && git rebase origin/dev`.
5. **Open a PR into `dev`** (`gh pr create --base dev`). **Squash merge**
   (`gh pr merge --squash --delete-branch` — deletion is back on, see
   Notes).
5a. **Run the `pr-review` skill on every PR this creates, before it's
    merged** (per direct user instruction, 2026-07-27) — even
    self-authored, even when it feels routine. See
    `.claude/skills/pr-review/SKILL.md`. Its own preview/approval gate
    (Phase 5) still applies — reviewing isn't a reason to skip showing the
    findings and getting a yes before anything is posted or merged.
6. **Releasing to production:** the user decides if/when `dev` → `main`
   happens — never propose it, never ask "is it time" (see Notes). Once
   they say go:
   a. Open and merge the `dev` → `main` PR as normal.
   b. **Delete every task branch already merged into this release**, both
      locally (`git branch -D <branch>`) and on `origin`
      (`git push origin --delete <branch>`) — anything picked up by
      `--delete-branch` at PR-merge time (step 5) is already gone; this
      catches any that weren't.
   c. **Hard-reset `dev` to `main`**, so `dev` starts the next cycle as an
      exact fresh copy with no leftover merge-commit graph:
      `git checkout dev && git pull origin main:dev --ff-only` is not
      enough by itself if `dev` has diverged — use
      `git checkout dev && git reset --hard main && git push origin dev --force-with-lease`.

## Notes
- `gh pr create` defaults to the repo's default branch. Since that's
  `main`, **always pass `--base dev` explicitly** for task PRs — don't
  rely on the default.
- **Delete merged branches, both task branches and (per step 6) `dev`'s
  own stale state** (revised 2026-07-27, reversing the 2026-07-26 "never
  delete" rule — see the memory entry `git-branch-and-main-merge-policy`
  for why). Pass `--delete-branch` to `gh pr merge` for task PRs into
  `dev` again. The point is a clean, easy-to-read branch list — no
  branches lingering after their work has shipped.
- **The `dev` → `main` release merge is the user's call, always.** Never
  initiate it, never ask "is it time to merge to main" — they'll tell
  you. The branch-deletion and `dev`-reset steps (6b/6c) only run *after*
  they've done that, never before or in anticipation of it.
- Force-pushing `dev` is now expected as part of step 6c (it wasn't
  before) — that's the one exception to "never force-push `dev`."
  `main` is still never force-pushed or rebased directly.
- This doesn't relax any other guardrail — e.g. the human-verification
  gate (guardrail #1) still applies before merging room/audio features,
  regardless of branch.
