# Branching workflow

**Decided:** 2026-07-26, per direct user instruction. This is a standing
rule — follow it for every feature or chore, no exceptions, unless the user
explicitly says otherwise for a specific task.

## The two long-lived branches
- **`main`** — production. Only ever updated via a `dev` → `main` PR when
  a set of work is ready to ship. Never commit to `main` directly.
- **`dev`** — integration branch for all in-progress development. Always
  the base for new work.

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
5. **Open a PR into `dev`** (`gh pr create --base dev`). **Squash merge.**
6. **Releasing to production:** periodically, when `dev` is in a good
   state, open a PR from `dev` into `main` (`gh pr create --base main --head dev`)
   and squash merge. This is the only path that updates `main`.

## Notes
- `gh pr create` defaults to the repo's default branch. Since that's
  `main`, **always pass `--base dev` explicitly** for task PRs — don't
  rely on the default.
- Never force-push or rebase `main` or `dev` themselves; rebasing applies
  to task branches (onto `dev`) and to `dev` (onto `main`) only, both of
  which are fast-forward-safe since nobody else pushes directly to them.
- This doesn't relax any other guardrail — e.g. the human-verification
  gate (guardrail #1) still applies before merging room/audio features,
  regardless of branch.
