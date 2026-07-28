---
name: pr-review
description: >-
  Review a pull request on gd-proto (PlaceMe) end-to-end: triage, reconcile
  the branch against its real base (often a stacked feature branch, not
  `dev`), deep-review against this repo's TDD + guardrail discipline, run
  local gates (vitest/oxlint/build), then draft an inline review — PREVIEW
  it in chat and get explicit yes/no approval BEFORE posting it as a single
  batched pending review with ```suggestion blocks and the right event
  (APPROVE / REQUEST_CHANGES / COMMENT). Use when the user says "review PR
  N", "a PR is up", "review this branch", or similar. Optionally push
  targeted fixes to the PR's own branch afterward (never delete it — see
  BRANCHING.md).
---

# PR Review (PlaceMe / gd-proto house style)

Reviewing a pull request against `github.com/placemestudy1/gd-proto` —
the canonical project repo as of 2026-07-28 (see
`docs/engineering/BRANCHING.md`; the repo moved remotes twice —
`Hruday-Kumar/gd-proto` then `Place-Me-study/gd-proto` then
`placemestudy1/gd-proto` — check `git remote -v` if this drifts again).
**Do not rely on `gh`'s default repo resolution** — this working copy's
`origin` remote points to the first, personal repo
(`Hruday-Kumar/gd-proto`), not this one, so every `gh pr ...`/`gh api
repos/:owner/:repo/...` call in this skill needs an explicit `--repo
placemestudy1/gd-proto` (or the literal owner/repo in the API path)
rather than the `:owner/:repo` shorthand, which resolves against `origin`.
All branches so far are **same-repo task
branches** (no forks) per `docs/engineering/BRANCHING.md` — `feature/<name>`
or `chore/<name>` off `dev`. Some workstreams stack branches on top of each
other (e.g. PR #44's
base was `feature/live-room-ux`'s parent branch, not `dev` directly) — never
assume the base is `dev` without checking. The output is a clean, batched,
inline GitHub review with code suggestions, **but nothing is posted until
the user has seen a full preview in chat and said yes.**

## The non-negotiable rules

1. **Never post anything to GitHub without showing it in chat first and getting an explicit yes/no.** This includes review comments, suggestions, approvals, and `gh pr comment`. Drafting is silent; posting needs a gate.
2. **One batched review, not a stream of comments.** Always use the _pending review_ API (create with all comments → submit). Never post inline comments one at a time — it spams notifications.
3. **Verify claims; don't assert from memory.** If the PR (or you) makes a factual claim — "this migration doesn't collide," "the consent gate covers this route," "tests are green" — prove it against the migrations / code / `gh` / a real test run before stating it as fact.
4. **Distinguish blockers from nits, and say which is which.** A blocker = data loss, prod breakage, security hole (RLS gap, consent bypass, raw-audio retention), missing/duplicate migration, broken build/tests, or a guardrail violation (see below). Everything else is should-fix or nit.
5. **Give credit.** Name what's done well before the problems.
6. **Guardrail compliance is part of the review, not optional extra credit.** Check the PR against `.claude/rules/guardrails.md` explicitly (§Phase 2) and state each relevant guardrail's status in the summary — this repo has already had real incidents (RLS recursion bug, missing `canPublishData`, audio-track-not-attached) that only a specific human/guardrail check would have caught, not generic code quality review.

---

## Phase 0 — Triage

```bash
gh pr list --state open --json number,title,author,headRefName,baseRefName,headRepositoryOwner,createdAt,updatedAt --limit 30
gh pr view <N> --json title,body,baseRefName,additions,deletions,changedFiles,mergeable,mergeStateStatus,commits,maintainerCanModify
gh pr checks <N>
```

- **Base branch check — do this every time.** `baseRefName` may be `dev` or another feature branch (stacked PR, per `BRANCHING.md`'s workstream pattern). Reviewing against the wrong base will show a huge, misleading diff.
- **Fork check (defensive):** if `headRepositoryOwner.login` isn't the repo owner, treat it as a fork PR and use the fork-fetch form in Phase 1/7. Nothing in this repo's history has been a fork so far, but don't assume that never changes.
- **CI reality:** two checks run — `test` (`npm test --workspace=@placeme/server`, Vitest) and `docker-build`. **There is no test/lint job for `apps/web` in CI at all** (`.github/workflows/ci.yml` only runs the server workspace's tests) — a web-only PR can be fully green on CI with zero automated coverage. Don't report this as a defect in the PR; it's a pre-existing repo gap. Run `npm run lint`/`npm run build` for web yourself in Phase 3 since CI won't.
- **The `.github/PULL_REQUEST_TEMPLATE.md` is known-stale** — it references `For_Developers/CONTRIBUTING.md`, `design.md §14`, and `npm run audit:rls`, none of which exist in this repo (flagged in `docs/engineering/PROGRESS.md`, never cleaned up). Don't hold a PR to those specific checklist items; check what's actually real (see Phase 3).

## Phase 1 — Reconcile the branch against its real base

```bash
BASE_REF=$(gh pr view <N> --json baseRefName -q .baseRefName)
git fetch origin <headRefName> "$BASE_REF"
BASE=$(git merge-base origin/<headRefName> origin/"$BASE_REF")

git diff --stat "$BASE"..origin/<headRefName>                       # true PR footprint
git log --oneline "$BASE"..origin/<headRefName>                     # the PR's commits
git log --diff-filter=AD --oneline "$BASE"..origin/<headRefName> -- 'path/glob'   # files ADDED or DELETED
```

- **Scan for accidental damage.** Check whether any commit deleted a file the runtime still references (a migration, a shared component) via a broad `git add -A`/`git add .`.
- **Migration discipline** (`supabase/migrations/`): sequential `000N_*.sql` numbering — check for a **number collision** against files already on `dev` (or the real base) and against any other open PR touching migrations. Existing migrations follow `create table if not exists` / policy-drop-then-create idempotent style (see `0001_profiles.sql`) — a new migration should match that, not assume a fresh DB. **Migrations are never auto-applied** — nothing in CI or app boot runs them; the user manually pastes them into the Supabase SQL Editor. If the PR adds or changes one, the review must explicitly flag: *"this migration still needs to be run in the Supabase SQL Editor before this feature works against the live project"* — don't assume it's already applied just because the PR merges.
- **TDD commit trail (guardrail: Red→Green→Refactor).** For PRs touching `apps/server/src/domain/**` (core logic), check the commit log for a failing-test commit before the implementation commit, per `CLAUDE.md`'s mandatory TDD rules. Its absence isn't automatically a blocker (some peripheral UI work in this repo has an explicit no-test-first precedent — Login/Signup/Consent/Lobby pages) but core domain logic without a test-first trail is worth calling out.
- **Stale-branch / parallel-work check.** If the PR conflicts with its base, find the culprit: `git log --oneline "$BASE"..origin/"$BASE_REF" -- <file>` per conflicting file.

## Phase 2 — Deep review

- Read the diff (`gh pr diff <N>`), and cross-reference every change against the existing codebase: the migration that backs a new table, the RLS policy shape used by sibling tables, the established pattern for a similar route (e.g. compare a new `/api/rooms/:id/*` route to the existing consent-gated ones in `apps/server/src/api/rooms.js`).
- **Run the guardrails checklist (`.claude/rules/guardrails.md`) against the diff and state each applicable one's status in the summary:**
  - **#1 Human verification gate** — if the PR touches room/audio/transcription/attribution/feedback code, it cannot be called "done" on tests alone. Check the PR body / `PROGRESS.md` for evidence of a real multi-person walkthrough. If there's none yet, that's expected at PR-merge time in this repo's established pattern (code merges first, the human gate runs as a documented follow-up) — but the review must say so explicitly rather than silently approving it as fully verified.
  - **#3 Consent before mic** — any new code path that can enable a mic or start capturing audio/transcript must go through the existing consent gate (`createConsentGate()` / `canEnableMic` in `apps/server/src/domain/consent.js`) or the web `/consent` flow. Verify it's actually wired into the route, not just present elsewhere in the file.
  - **#4 Minimize retention** — raw audio must never be written to disk or the DB. Confirm any new audio-handling code streams straight to the STT client and never persists the buffer (the existing pattern in `apps/server/src/agent/`).
  - **#2 No scope creep** — flag anything building toward AI Voice Practice, JAM, Aptitude/Technical, 1-on-1 Roleplay, Drive Simulator, payments, notifications, or analytics (all explicitly deferred in `CLAUDE.md`) unless the PR body shows explicit user approval to break scope.
  - **#7 Mainstream + maintainable** — flag any new dependency in a `package.json` diff that's niche, unmaintained, or duplicates something already chosen by an ADR (e.g. a second HTTP client, a second test runner).
  - **#12 Branch/PR discipline** — base should be `dev` or a named parent feature branch, never `main` directly; no `--no-verify`/hook-skipping in the commit history without explicit justification recorded somewhere.
- **RLS, checked by hand (no `audit:rls` script exists in this repo).** For any new/changed table: confirm `alter table ... enable row level security` is present, confirm policies scope to `auth.uid()` (own-row-only, matching `profiles`/`consents`/`transcript_lines`/`feedback`), and confirm the **service-role client is only used server-side** where RLS genuinely needs bypassing (worker/feedback-generation code), never shipped to the browser bundle.
- Build the finding list: **🔴 Blockers**, **🟠 Should-fix**, **🟡 Nits**, **✅ Credit**, **♻️ Recurring habits**, **🏗 Systemic root causes** (repo-level gaps, not this PR's fault — e.g. "web has no CI test coverage" or "the PR template references files that don't exist").

## Phase 3 — Local verification gates

```bash
npm test --workspace=@placeme/server      # vitest — report the pass count, e.g. "130/130 green"
npm run lint --workspace=@placeme/web     # oxlint (the only lint config in the repo — server has none)
npm run build --workspace=@placeme/web    # vite build — the closest thing to a type-check; there's no tsc, this is a plain-JS/JSX repo
```

- There is **no ESLint, no TypeScript, no Prettier config** anywhere in this repo — don't invent gates that don't exist or demand a formatting style the project never adopted. Match whatever style surrounds the changed lines.
- There is **no `audit:rls` script** — the RLS check from Phase 2 is manual; say so plainly rather than trying to run a command that isn't there.
- If `apps/server/.env`/`apps/web/.env` values are needed for a fuller local run (e.g. Supabase, LiveKit, Gemini keys), note what's missing rather than guessing — same pattern as the `GEMINI_API_KEY` gap already documented in `PROGRESS.md`.

## Phase 4 — Draft the review (do not post)

Write, in chat, a structured summary the user can read top-to-bottom:

- Verdict line (mergeable? blockers? proposed event).
- 🔴 / 🟠 / 🟡 findings with `file:line` links and _why_ each matters.
- Guardrail status line(s) from Phase 2 (e.g. "Guardrail #1: still outstanding, flagged — not a blocker for merge given this repo's established code-first/verify-after pattern, but must not be forgotten").
- ✅ credit, ♻️ recurring habits, 🏗 systemic roots.
- The exact **inline comments** you intend to post (path, line(s), body, and any ```suggestion block rendered in full).
- The exact **summary body** and the **event** (APPROVE / REQUEST_CHANGES / COMMENT).

## Phase 5 — Preview + explicit approval ← the gate

Show the full preview (Phase 4), then ask with **AskUserQuestion** (yes/no style), e.g.:

- _"Post this review to PR #N?"_ → options: **Post it** · **Change something first** · **Cancel**.
- If the event is REQUEST_CHANGES or APPROVE, confirm that too (it carries a verdict).

Only proceed to Phase 6 on an explicit **Post it**.

## Phase 6 — Post as a single pending review

`commit_id` must be the PR head:

```bash
N=<pr-number>
SHA=$(gh pr view "$N" --json headRefOid -q .headRefOid)
```

**Preferred: JSON payload via `--input`** (reliable with multi-line ```suggestion bodies and backticks — the CLI `-f` form mangles them). Write `review.json`:

````json
{
  "commit_id": "<SHA>",
  "comments": [
    {
      "path": "apps/server/src/api/rooms.js",
      "line": 88,
      "side": "RIGHT",
      "body": "This route reads `req.user.id` before the consent gate runs — swap the middleware order so `createConsentGate()` sees it first.\n\n```suggestion\nrouter.get('/:id/token', requireAuth, createConsentGate(), async (req, res) => {\n```"
    },
    {
      "path": "supabase/migrations/0007_new_table.sql",
      "start_line": 1,
      "start_side": "RIGHT",
      "line": 6,
      "side": "RIGHT",
      "body": "Multi-line replacement:\n\n```suggestion\n…replacement for lines 1–6…\n```"
    }
  ]
}
````

```bash
# Step 1 — create the PENDING review (omit "event" so it stays pending / invisible to the author)
REVIEW_ID=$(gh api repos/:owner/:repo/pulls/$N/reviews --input review.json --jq '.id')

# Step 2 — submit with the chosen event + overall message
gh api repos/:owner/:repo/pulls/$N/reviews/$REVIEW_ID/events \
  -X POST \
  -f event="REQUEST_CHANGES" \
  -f body="$(cat summary.md)"
```

**Alternative (simple comments, no/short suggestions):**

```bash
gh api repos/:owner/:repo/pulls/$N/reviews -X POST \
  -f commit_id="$SHA" \
  -f 'comments[][path]=apps/server/src/domain/consent.js' \
  -F 'comments[][line]=42' \
  -f 'comments[][side]=RIGHT' \
  -f 'comments[][body]=Comment text' \
  --jq '{id, state}'
```

### Code-suggestion rules

- A ```suggestion block **replaces exactly the anchored line(s)**. Single line → `line`+`side: RIGHT`. Multiple lines → `start_line`..`line`, covering that whole range. Double-check the range against the diff — off-by-one anchoring breaks the "Apply" button.
- Suggestions are for **small, contiguous, same-file** edits. For new files, multi-file, or structural changes, **don't suggest — push a commit** (Phase 7).
- Indentation inside the suggestion must be the final intended indentation.

### Event types (from §4 blockers-vs-nits)

- **REQUEST_CHANGES** — any 🔴 blocker present.
- **APPROVE** — only 🟡 nits / optional suggestions, nothing blocking.
- **COMMENT** — neutral notes, no verdict (e.g. you'll merge regardless, or it's FYI).

## Phase 7 — Optional: push targeted fixes (only when the user asks to "fix")

Same-repo branches only (adjust for a fork per Phase 0's fork check):

```bash
git fetch origin <headRefName>
git checkout -B <headRefName> origin/<headRefName>
# … make MINIMAL, targeted edits (match file style; don't reformat unrelated lines) …
git commit -F -              # do NOT pass --no-verify unless the user explicitly approves it —
                              # per CLAUDE.md's Git Safety Protocol, hooks are never skipped silently
git push origin <headRefName>
git checkout dev              # return to dev; do NOT delete <headRefName> — BRANCHING.md forbids
                              # deleting branches, task branches included, even after merge
```

- Push straight to the PR's own branch — never create a stray branch on `origin`.
- After fixing, re-run the Phase 3 gates and state the results (vitest pass count, oxlint clean, `vite build` clean) in the review.
- Big/structural fixes → a commit; small inline fixes → a ```suggestion. Don't mix a commit _and_ a contradicting suggestion for the same lines.
- If a migration file was the thing fixed, remind the user in your summary that the corrected version still needs a manual Supabase SQL Editor run.

---

## Tone & teaching

- Lead with credit, then blockers, then nits. Be specific and link `file:line`.
- For recurring habits, give the _why_ and the one-habit fix (e.g. "commit the failing test before the implementation, per `CLAUDE.md`'s TDD rules"; "check `baseRefName` before diffing — this repo stacks branches"; "new migrations need a Supabase SQL Editor run, not just a merge").
- Separate **this PR's issues** from **systemic repo gaps** (no web CI coverage, the stale PR template, no `audit:rls` script) — those are the maintainer's to fix, not the PR author's fault.
- Offer a short, forwardable plain-text summary when useful.
