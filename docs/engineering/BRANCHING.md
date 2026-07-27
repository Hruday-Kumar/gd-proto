# Branching workflow

**Decided:** 2026-07-26, per direct user instruction. This is a standing
rule — follow it for every feature or chore, no exceptions, unless the user
explicitly says otherwise for a specific task.

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
   (`gh pr merge --squash`, **no `--delete-branch`** — see Notes).
5a. **Run the `pr-review` skill on every PR this creates, before it's
    merged** (per direct user instruction, 2026-07-27) — even
    self-authored, even when it feels routine. See
    `.claude/skills/pr-review/SKILL.md`. Its own preview/approval gate
    (Phase 5) still applies — reviewing isn't a reason to skip showing the
    findings and getting a yes before anything is posted or merged.
6. **Releasing to production:** the user decides if/when `dev` → `main`
   happens. Don't propose it, don't open that PR unprompted — see Notes.

## Notes
- `gh pr create` defaults to the repo's default branch. Since that's
  `main`, **always pass `--base dev` explicitly** for task PRs — don't
  rely on the default.
- **Never delete branches**, task branches included, even after their PR
  merges (per direct user instruction, 2026-07-26). Don't pass
  `--delete-branch` to `gh pr merge`.
- **The `dev` → `main` release merge is the user's call, always.** Never
  initiate it, never ask "is it time to merge to main" — they'll tell you.
- Never force-push or rebase `main` or `dev` themselves; rebasing applies
  to task branches (onto `dev`) and to `dev` (onto `main`) only, both of
  which are fast-forward-safe since nobody else pushes directly to them.
- This doesn't relax any other guardrail — e.g. the human-verification
  gate (guardrail #1) still applies before merging room/audio features,
  regardless of branch.
