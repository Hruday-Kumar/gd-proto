# PROGRESS

_Durable state so any session can resume from docs, not conversation memory._

**Last updated:** 2026-07-29 (M4/H6/M10 shipped to `main` — see the release
note immediately below; older "Last updated" context — audit Phase 4
close-out, doc-sync + Vercel frontend decision — is preserved further down)

## Released to `main`, 2026-07-29

PRs #19 (M4), #20 (H6), #21 (M10) merged into `dev`, then `dev` → `main`
via PR #22 (regular merge commit, matching this repo's existing release
style) — all per direct user instruction ("approve all prs, push and merge
to main branch"), the explicit go-ahead `BRANCHING.md` requires before any
release. CI green on `main` at the release commit (`805031c`). Per
`BRANCHING.md` step 6b/6c: all three task branches were already deleted at
PR-merge time (`--delete-branch`); `dev` was then hard-reset to `main`
(fast-forward, no force actually needed since `dev` was only one commit —
the release merge itself — behind) — confirmed byte-for-byte identical
afterward (`git rev-list --left-right --count` → `0 0`).

**One thing discovered and worth recording:** attempting to post a GitHub
PR *review* (approve/comment) from this session hit a hard wall —
`gh`'s authenticated identity is the same one that authored the PRs, and
GitHub disallows self-approval/self-review regardless of tooling. That
turned out not to matter for actually shipping, though: this repo has no
branch protection configured (private repo on the free plan can't enable
it — confirmed via `gh api repos/.../branches/dev/protection` → 403 "
Upgrade to GitHub Pro"), so `reviewDecision` is empty on every PR and
`gh pr merge` works directly with no review required. The `pr-review`
skill's *findings* (drafted in-chat for #19/#20/#21) are still real and
were still produced; only the "post it to GitHub" step is impossible from
this identity. Worth knowing for any future session that hits the same
wall — don't burn time retrying the post, just hand the draft to the user
directly, and merging doesn't need the review anyway.

## Phase 4 close-out (2026-07-29)

Picked up per `PLAN.md` §5c ("pick up at H1 next"). Two findings, both
resolved differently than expected:

- **H1 — turned out to already be done.** `AUDIT.md` itself has carried
  `Status: RESOLVED 2026-07-28` since the audit was written — the
  `ca-certificates` root-cause correction and the `LESSONS.md` lesson were
  already in place (see the "⚠️ Correction, 2026-07-28" note further down
  this file). Only `PLAN.md`'s checklist had never been updated to say so.
  Fixed the doc, no code change needed.
- **M4 — production image installed the entire frontend toolchain. FIXED,
  branch `chore/m4-trim-docker-image`.** Root cause was two-layered: `npm
  ci` ran before `NODE_ENV=production` was set, and separately, plain `npm
  ci` doesn't reliably honor `NODE_ENV` for the dev/prod split across npm
  versions anyway (that behavior is deprecated) — needs `--omit=dev`
  explicitly. Fixed: `apps/web` (the frontend never runs in this container
  — it deploys separately on Vercel per ADR-0007) added to `.dockerignore`
  as a whole directory, `npm ci --omit=dev` replaces the bare `npm ci`.
  **Verified with a real `docker build` + `docker run` + `curl
  /health`, not just a Dockerfile read** — built both the before and after
  images locally to compare: **929MB → 454MB**, 244 → 122 installed
  packages, `npm audit` 2 high-severity findings → 0 (both were in
  frontend-only deps), install step in the build ~109s → ~26s. The running
  container still serves `/health` correctly and `/app/apps/` contains
  only `server/`. Full detail in `LESSONS.md`'s Docker entry. 225/225
  server tests still green (Node 22) — this was a pure infra/build change,
  no application code touched, so no TDD unit was applicable; the
  human-equivalent verification here was the live build/run/curl above.
  **Not yet done:** PR opened and merged into `dev`.

**Also found this session, flagged for the user, not fixed:** the local
`main` git branch (and `origin` remote) still point at the old personal
repo, `Hruday-Kumar/gd-proto` — not the canonical `placemestudy1/gd-proto`
that `dev` tracks. Running `BRANCHING.md`'s literal step 1
(`git rebase main` from `dev`) against that stale local `main` produced
real merge conflicts (replaying already-squash-merged commits against an
unrelated, further-diverged history), because local `main` is a completely
different lineage, not just a stale copy of the real one. **No damage
done** — the rebase was aborted immediately, `dev` was never touched past
the conflict, and this task branch was recreated cleanly off `dev`. But
this is a live footgun for the next person or session who runs the literal
`BRANCHING.md` step 1 without noticing `main` resolves to the wrong repo.
The canonical main is `placemestudy1-main` (local) / `placemestudy1/main`
(remote); `dev` is legitimately ~12 commits ahead of it right now (all the
unreleased Phase 2–4 audit work), which is expected, not a problem — the
release to `main` is the user's call per `BRANCHING.md`, not something to
fix by rebasing. **Recommend:** either repoint local `main` to track
`placemestudy1/main` (or delete it and rename `placemestudy1-main` →
`main`), or update `BRANCHING.md` to say explicitly which remote/branch
"main" means — not done here since it's a branch/remote config change,
not something to do silently.

> **Two people work this repo.** `docs/engineering/PLAN.md` is the shared
> checklist and ownership board — what's done, what's next, who has it, and
> the repo hazards to know before branching. **Claim your task there before
> writing code.** This file stays the narrative record: *why* things were
> done and what was actually verified. PLAN.md says what and who.

## Current phase

**Audit remediation, Phase 2 (Reliability), 2026-07-28.** Working the
`docs/engineering/AUDIT.md` roadmap in order, one verified finding at a
time, TDD RED→GREEN with a separate commit per phase. Branch
`fix/h2-graceful-shutdown-boot-recovery`, stacked on the earlier
C1/C3/C2 work (which is **not yet merged into `dev`** — see below).
**187/187 server tests green on Node 22** (was 151), lint clean.

- **H2 — no graceful shutdown, no boot recovery. FIXED.** Root cause
  re-confirmed before touching anything: no `SIGTERM`/`SIGINT` handler
  existed anywhere in `apps/server/src`, and `activeRooms` (the in-memory
  map holding every live room's agent) had no reconciliation on boot. A
  Render deploy, free-tier sleep, or crash mid-session therefore dropped
  LiveKit + AssemblyAI sockets with no disconnect, left the room row saying
  `live`, and wrote zero transcript lines for the rest of the session —
  invisibly, since browsers talk to LiveKit directly and students notice
  nothing. This compounds the still-untested **B4** risk.
  - *Down:* `src/shutdown.js`'s `createGracefulShutdown()` — stops
    accepting connections, disconnects every active agent, exits; bounded
    by a force-exit deadline so a hung disconnect can't hold the process
    open until SIGKILL. `stopAllTranscriptions()` sweeps with `allSettled`
    so one dead socket doesn't strand the rest.
  - *Up:* `recoverLiveRooms()` + the new pure `domain/roomRecovery.js`
    (core, tests-first) + `db/rooms.js`'s `listLiveRooms()`. **The
    important detail:** a recovered agent is dispatched with the time
    **remaining** (from `ends_at`), not the room's original duration —
    the agent's stop timer runs from the moment it connects, so passing
    the original duration would transcribe well past the room's real end.
    Sequential on purpose (AssemblyAI free-tier connection rate limit, see
    `LESSONS.md`). Nothing in it throws: a DB hiccup degrades to "no
    recovery", never a server that won't boot.
  - *Found while checking consistency:* `attachTranscriber()` returns a
    `closeAll()` handle for the per-speaker AssemblyAI sockets that
    `roomAgent.js` was dropping on the floor — teardown depended on
    `TrackUnsubscribed` events that may never arrive during shutdown.
    Now captured and called explicitly on stop.
  - **Verified live**, not just in tests: the real process logged its
    boot-recovery scan against Supabase and exited cleanly on a real
    `SIGTERM`.
- **H3 — `durationSeconds` entirely unvalidated. FIXED.** Reproduced first:
  `2000000000`, `-5`, `0.5` and `"600"` all got past the route into the DB
  layer. Two invisible failures at once — `ends_at` lands far enough out
  that `isTimerExpired()` never fires (room stays `live` forever, feedback
  never dispatched), *and* the agent's `setTimeout(duration * 1000)`
  overflows int32 and fires at 1 ms, disconnecting the transcriber
  immediately. New pure `domain/roomDuration.js` (whole seconds, 60–3600
  inclusive) applied at **both** `POST /api/rooms` and `POST
  /api/rooms/match` — the audit named only the first, but `/match` is
  worse: a matched room's duration comes from whichever caller completed
  the group, so one bad value breaks the session for up to six students.
  Bounds are wider than the UI picker (5/10/15/20 min) so options can be
  added without a server change.
- **M11 — unbounded LLM fan-out. FIXED.** Reproduced: a six-person room
  peaked at six simultaneous Gemini calls against a rate-limited free
  tier, and a throttled call fell into the existing per-student error path
  — that student silently got no feedback at all. Replaced the
  `Promise.all` with a fixed-size worker pool over a shared cursor,
  `DEFAULT_FEEDBACK_CONCURRENCY = 2` (three small waves instead of one
  burst, well inside the ~2 min window the lobby polls). Both prior
  guarantees preserved and regression-tested: results stay in participant
  order, and one student's failure still can't abort the pool or leak into
  anyone else's feedback.

**Open follow-ups from this session:**
1. **`supabase/migrations/0009_rooms_duration_seconds_bounds.sql` has not
   been run** — needs the usual manual Supabase SQL Editor step. The
   server-side validation is the primary fix and is already live in code,
   so this is defence in depth, not a blocker for merging.
2. **None of the audit-remediation work (C1, C3, C2, H2, H3, M11) has been
   merged into `dev` yet** — it's all stacked on
   `chore/c2-remove-vercel-serverless-handler` →
   `fix/h2-graceful-shutdown-boot-recovery`. PRs still need opening (and
   the `pr-review` skill run on each, per `BRANCHING.md` 5a).
3. `AUDIT.md` still marks **C1, C3 and C2 as OPEN** even though the prior
   session fixed them; only H2/H3/M11 were updated here. Worth correcting
   so the record doesn't mislead the next session (the exact failure mode
   H1 is about).
4. **H2's recovery path has never run against a room that was actually
   live** — the live check confirmed the scan, the shutdown, and a clean
   exit, but there were no live rooms to re-attach. Worth exercising once
   during the next real-room session: start a room, restart the server
   mid-discussion, confirm transcription resumes.
5. Next in the roadmap after this: **Phase 3** (H8, M1, H4, H5, M6, M7).
6. **`origin/dev` is 3 commits behind `origin/main`** — the `dev` → `main`
   release ran but `BRANCHING.md` step 6c (hard-reset `dev` to `main`) never
   did. Anyone branching off `origin/dev` silently misses the
   `ca-certificates` Docker fix. Reset it before the next branch.
7. **Migration `0008` (C1) has never been confirmed applied** — account
   deletion stays broken until it is. `0007` *was* verified applied this
   session; see `PLAN.md` §3 for the full migration table.

## Earlier phases

### Transcription-resilience bug fix (2026-07-27)
**Transcription-resilience bug fix, 2026-07-27 (separate session, after the
pilot-readiness pass below).** User report: "the room sharing and code
works, but the transcription fails, since the transcription is failing the
feedback is assuming we are not participating." Diagnosed with real
credentials, not guessed:
- Isolated AssemblyAI auth (direct WS test) and the LiveKit connect path
  (direct connect test) both worked individually; the full production
  pipeline (`npm run regression:room`, real LiveKit + AssemblyAI, 3 bots)
  passed end-to-end too — so the agent pipeline itself was sound.
- Found this environment's `apps/web`/root `node_modules` were stale
  (`@tailwindcss/vite` missing, blocking `npm run dev` entirely) —
  unrelated to the bug, fixed with `npm install` so local dev works here
  again.
- **User then supplied the real server log from their own repro:** `[agent]
  failed to start transcription for room ...: engine: signal failure:
  failed to retrieve region info: error sending request for url
  (https://.../settings/regions)`. This is `@livekit/rtc-node`'s Rust
  engine failing the region-pinning HTTP request it makes before actually
  connecting — confirmed transient, not a config/credentials problem: the
  user's own browser connected fine to the same LiveKit project seconds
  apart (console log showed a successful `region: India South` connect),
  and this exact error **reproduced again, spontaneously, during this
  session's own regression-harness re-run** (`region fetch timed out`).
  `startTranscriptionForRoom()` had zero retry, so one blip permanently
  killed transcription for the whole room -- silently, since the room and
  its audio keep working fine (the browser SDK connects independently of
  the server-side agent).
- **Root cause, two layers, both fixed (TDD RED→GREEN, branch
  `fix/transcription-resilience`):**
  1. `domain/retry.js`'s `withRetry()` (new, small, generic, tested) is now
     wrapped around the agent's `room.connect()` call in
     `agent/roomAgent.js` (3 attempts, 1s backoff by default). Also made
     `startTranscriptionForRoom()` unit-testable for the first time — it
     previously constructed a real, un-injectable `Room()` inline, which is
     exactly why this had zero test coverage before a live failure exposed
     it. **Verified live:** the fix caught and recovered from the exact
     same transient failure when it recurred during this session's own
     regression re-run, and the pipeline then passed end-to-end (3/3
     speakers, correct attribution).
  2. Independent of *why* transcription fails, `domain/feedbackGeneration.js`
     used to send Gemini "(no speech was transcribed in this session)" and
     ask it to write feedback anyway whenever `transcriptLines` was empty —
     which the model reasonably (and wrongly) read as "this student didn't
     participate" and said so. That's the literal mechanism producing the
     misleading feedback in the bug report, and it would recur for *any*
     future transcription failure (network blip, STT outage, anything), not
     just this one. Fixed: an empty transcript now short-circuits before
     Gemini is ever called, returning a fixed, honest, non-blaming
     "technical issue on our end, not a reflection of your participation"
     message for every participant instead.
- Also hit and documented (not fixed, self-inflicted test load not a real
  usage pattern): AssemblyAI's free dev tier rate-limits to 5 new
  connections/minute; ~10 rapid diagnostic/regression runs in a few minutes
  produced one run with zero transcription and zero logged errors (our WS
  code only logs on the `error` event, not an unexpected `close` code). See
  `LESSONS.md`'s AssemblyAI entry.
- **151 tests (147 passing + 4 pre-existing skipped) green** after the fix,
  `apps/server` full suite. No migration needed — this is pure application
  logic, nothing schema-related.
- **Not yet done:** PR opened and merged into `dev`; guardrail #1's
  human-verification gate for this specific fix (a real person hitting the
  actual retry path live, not just the regression harness) — the
  regression-harness catch of the real recurrence is strong evidence but
  isn't a substitute per guardrail #1's letter for a *feedback*-adjacent
  change. Recommend a quick real-room human check next time this comes up
  naturally, not necessarily its own dedicated session.

**⚠️ Correction, 2026-07-28 (audit finding H1):** the "confirmed transient"
diagnosis above was wrong. The 2026-07-28 engineering audit (`AUDIT.md`)
flagged that the region-fetch failure recurred identically across two
different Render regions — not what a transient network blip looks like.
The real cause, found and fixed the same day (PR #5,
`fix/english-only-transcription-and-duration-cap`): `node:22-slim` ships
without `ca-certificates`, and `@livekit/rtc-node`'s native Rust engine
uses the OS cert store, not Node's bundled one — so every one of its HTTPS
requests failed, deterministically, until the image installs
`ca-certificates`. See `LESSONS.md`'s Docker entry for the full
explanation. **The retry logic above (`domain/retry.js`) is not wrong and
stays** — it's real protection against genuine transient failures — but it
was papering over this bug rather than fixing it: a missing OS package
fails the same way on every attempt, so retrying just delayed the same
failure instead of resolving it. Both fixes are complementary, now both
live. H1 is RESOLVED as of this correction — see `AUDIT.md`.

### Second-session work landed same day, undocumented until now (2026-07-28)
A second person (`placemestudy1` account) pushed and merged PR #5/#6
(`fix/english-only-transcription-and-duration-cap` → `dev` → `main`)
directly against the `placemestudy1/gd-proto` remote, in parallel with the
Phase 2 audit-remediation session recorded above — neither this file nor
`PLAN.md` had been updated to reflect it until this correction pass. What
it actually contains, found by reading the merged commits directly since
neither doc mentioned it:
- **The `ca-certificates` Docker fix** — see the H1 correction just above.
- **Actually created migration `0008`** (`rooms.created_by` blocking
  account deletion) — checked via `git log` on the file: this PR's commit
  (`a877734`) is the *only* commit that ever created
  `supabase/migrations/0008_rooms_created_by_on_delete_set_null.sql`.
  `PLAN.md`'s DONE table had already credited C1 as fixed "via migration
  0008" *before* this PR existed — a doc claim written ahead of the code
  that made it true. No actual conflict or duplicate fix, just confirms
  the migration file genuinely exists now and matches what `AUDIT.md`'s
  C1 finding specifies (drops `NOT NULL`, adds `ON DELETE SET NULL`).
- **Session duration cap tightened 60min → 25min** — new migration
  `0009_rooms_duration_seconds_bounds.sql` → **`0010_tighten_rooms_duration
  _seconds_bounds.sql`**, direct user request: a GD Arena practice round
  was never meant to run half an hour or more. `domain/roomDuration.js`'s
  `MAX_DURATION_SECONDS` now `25*60 = 1500`. **Neither `0009` nor `0010`
  has a confirmed live-application status** — same manual Supabase SQL
  Editor step as every other migration in this project.
- **English-only transcription** — a fix landed per the PR title; not yet
  cross-referenced against what was "noted, not investigated" in the W5
  human-verification session's record above. Worth reading the actual
  commit next time this area is touched, rather than relying on this
  summary.
- **192/192 server tests green** on `dev`/`main` as of this merge (was 187
  at the end of the Phase 2 session recorded above).

**Also this session (2026-07-28, doc-sync + Vercel frontend decision):**
found the repo state was significantly ahead of what `PLAN.md` described —
`dev`/`main`/the working branch were already fully synced with
`placemestudy1/gd-proto` (the branch-stack-not-pushed hazard `PLAN.md`
§2 warned about had already been resolved by an intervening commit,
`2d2b0ac`, that also silently landed the `LobbyPage` `beforeunload` guard
and both `apps/web/vercel.json`/`public/_redirects` — none of which
`PLAN.md`'s checklist was ever updated to reflect). Also found a live,
untracked Vercel CLI project link (`.vercel/`, project `gd-proto-web`) and
a `.gitignore` change for it sitting in the working tree — that change was
in `apps/web/.gitignore`, but `vercel link` had actually created `.vercel/`
at the **repo root**, so the existing ignore rule never matched it and
`git add -A` would have committed `.vercel/project.json` by accident.
Fixed by adding `.vercel` to the **root** `.gitignore` instead (root
`.gitignore` previously had no vercel-related entries at all). **Per direct
user instruction: adopted Vercel for the frontend, superseding ADR-0007's
original Cloudflare Pages pick** (reason on record: exploratory, not a
technical failure of Cloudflare Pages — see the ADR's "Superseded
2026-07-28" section). Deleted `apps/web/public/_redirects` (the now-dead
Cloudflare Pages config) so only one host's routing config exists. Also
corrected a stale repo reference in `.claude/skills/pr-review/SKILL.md`
(pointed at `Place-Me-study/gd-proto`, an intermediate remote the project
had already moved past — `placemestudy1/gd-proto` is current). `AUDIT.md`
and `PLAN.md` were also brought in line with reality in this pass — see
their own change history rather than duplicating it here.

## Earlier phases

### Pilot-readiness pass (2026-07-27, previous session)
**Pilot-readiness pass, 2026-07-27.** The user asked to make the app
"pre-production ready apart from deploying — complete rest [that's] in
your hand." Found a pilot-readiness audit already sitting in an open PR
(`docs/pilot-readiness-audit`, #48 — apparently produced by an earlier,
un-recorded session; this file never mentioned it) that verdicted **not
pilot-ready, ~5–8 working days away**, with a punch list split into
deploy-dependent blockers (B1/B3/B4/B7 — need dashboard access or real
humans, not attempted) and everything else. This session cleared the
backlog and worked the non-deploy items:
- **Merged the whole stacked backlog into `dev`:** PR #42 (UI redesign,
  carrying the already-recorded #43/#44) → PR #46 (flows/bug-fix pass,
  rebased off the squashed #42 with `git rebase --onto`) → PR #47
  (pr-review skill) → PR #48 (the pilot-readiness audit itself) → PR #49
  (business planning docs — governance, GTM, revenue, market strategy, CEO
  dashboard spec). **147 tests green on `dev`** after.
- **S3 (Node 20 dev footgun):** `apps/server`'s `engines: >=22.0.0` was
  declared but never enforced — Node 20 silently passed `npm install` and
  only broke on the first live Supabase query at runtime. Root `engines` +
  a new root `.npmrc` (`engine-strict=true`) turns this into a loud
  install-time failure; verified both directions (Node 20 → `EBADENGINE`,
  Node 22 → clean install). PR #50.
- **S2 (dead credential):** removed the unused `DEEPGRAM_API_KEY` from
  this environment's `apps/server/.env` (nothing under `apps/server`
  references it — Deepgram is spike-only, ADR-0002 superseded it with
  AssemblyAI). ⚠️ **The key itself still needs revoking in the Deepgram
  dashboard — user action, not done here.** Also documented
  `SUPABASE_ANON_KEY` in `.env.example`, which `test/
  historyRlsIsolation.test.js` needs but which a fresh clone had no way to
  discover (the test just silently skips without it). PR #51.
- **B5 (random-match dead end):** random matching was `HomePage`'s third
  top-level action, but only forms a room when ≥3 students are online at
  once — rare at pilot scale, so a student's first try was often an
  infinite queue. New `DELETE /api/rooms/match` (TDD RED→GREEN, idempotent
  — a no-op on a non-queued user) lets `MatchPage` leave the queue on
  unmount, so a student who navigates away can't later be matched into a
  room they're not watching (which would've wasted the whole group's
  session, not just theirs). `MatchPage` now gives up after 90s with an
  honest "nobody else is free right now" state pointing at "start a room
  and share the code" instead of spinning forever. `HomePage` demotes
  random match to a secondary link under the two paths that always work.
  **Verified in a real browser** (Playwright, headless Chromium, fresh
  signup → home → queue → soft landing after timeout, screenshots
  reviewed, zero console errors). PR #52.
- **B6 (no DPDP deletion path):** despite the consent copy already
  promising transcript+feedback are kept only "until you delete your
  account," no delete path existed anywhere. Found the schema already has
  every identifying table (`profiles`, `consents`, `room_participants`,
  `transcript_lines`, `feedback`, `matchmaking_queue`) wired `on delete
  cascade` back to `auth.users`, and rooms a student *created* wired `on
  delete set null` — so deleting the `auth.users` row via Supabase's admin
  API cascades correctly with no orphaned data and no collateral damage to
  groupmates' history. Core, TDD RED→GREEN: `domain/
  accountDeletion.js`'s `findUserByEmail()` (paginates `listUsers` since
  this `supabase-js` version has no `getUserByEmail` — wrong-account risk
  if this lookup is wrong, so it's tested even though the CLI around it
  isn't). `scripts/delete-account.js` — dry run by default, `--confirm` to
  actually delete. `docs/engineering/ACCOUNT_DELETION.md` is the process a
  founder follows. **Verified for real against the live Supabase
  project:** ran the dry run and then `--confirm` against a genuine test
  account, confirmed a follow-up dry run correctly reported no account
  found. PR #53.
- **S1 (feedback has no usefulness signal):** the only evidence PlaceMe's
  feedback is actually useful was one founder's opinion. Core, TDD
  RED→GREEN: `GET /feedback/mine` now surfaces a prior rating; new `PATCH
  /feedback/mine/rating` (404 if there's nothing to rate yet, 400 if
  `rating` isn't a boolean, otherwise records it scoped to the caller's
  own row — `feedback` has no client-writable RLS policy and none was
  added; ownership is checked in the route, same pattern as every other
  mutation in `api/rooms.js`). New web `components/FeedbackRating.jsx` —
  thumb saves immediately on click, an optional one-line reason saves on
  blur/Enter. **PR #54 is OPEN, MERGE HELD — see the flag below.**
- **B2 (zero instrumentation):** `supabase/queries/ceo-dashboard-metrics.sql`
  packages the four Tier-1 SQL queries from the newly-merged
  `business/ceo-dashboard.md` §4 (WAD, room fill rate, session-2 return,
  broken-session rate) as paste-and-run for the Monday dashboard ritual —
  verified every referenced column exists against the live schema (no
  raw-SQL execution path available to actually run them here). New
  `apps/web/src/lib/analytics.js` wires the five Tier-2 PostHog events
  (`page_viewed`, `signup_started`/`completed`, `consent_viewed`/`granted`,
  `session_join_failed`) — **no-op with `VITE_POSTHOG_KEY` unset**,
  confirmed `posthog-js` is fully dead-code-eliminated from the production
  bundle in that case. Flagged, not decided: the existing consent copy
  covers mic/Gemini processing, not general behavioural analytics — worth
  a look before actually setting the key live. Verified in a real browser:
  signup + consent flows complete with zero console errors, key unset. PR
  #55, merged.

### ~~⚠️ PR #54 (S1, feedback rating) is open but NOT merged~~ — RESOLVED, see below

**Superseded 2026-07-28.** Verified directly against the live Supabase
project: `feedback.rating` and `feedback.rating_reason` both exist, so
`0007_feedback_rating.sql` **has been run** and the S1 code shipped. The
warning below is kept only as the record of why the migration had to go
first; it is no longer an action item. (Note the repo also moved remotes
since — the PR numbers in this file refer to the old
`Hruday-Kumar/gd-proto` repo and no longer resolve. See `BRANCHING.md`.)

<details><summary>Original warning (historical)</summary>
Unlike every prior migration in this project (which only added tables new
endpoints touched), `0007_feedback_rating.sql` adds columns
(`rating`/`rating_reason`) that an **already-working, already-live**
endpoint (`GET /api/rooms/:id/feedback/mine`) now selects. Verified live
against this environment's Supabase project: merging PR #54's server code
without running the migration first makes that endpoint 500 with `column
feedback.rating does not exist`. **Run
`supabase/migrations/0007_feedback_rating.sql` in the Supabase SQL Editor
first**, same manual step as every other migration, then merge #54. I
don't have raw-SQL access to the project to run it myself.

</details>

### What's still genuinely open (needs the user or real deploy — not attempted)
Everything else in `PILOT_READINESS.md`'s blocker list needs dashboard
access or real people, both outside what this session could do:
- **B1 (deploy):** Render Blueprint (`render.yaml` ready) + Cloudflare
  Pages project + `RENDER_APP_URL` repo variable — all need the user's
  dashboard access.
- **B3:** Supabase "Confirm email" is still OFF — a dashboard toggle.
- **B4 (highest technical risk):** Render free-tier sleep vs. the
  transcription agent has never been tested against a real deploy — needs
  B1 done first.
- **B7:** guardrail #1's human-verification gate for the UI-redesign +
  live-room-UX + flows-fix work (PRs #42/#43/#44/#46) has still never run
  with real multiple humans on real devices — everything so far is
  solo/headless Playwright verification, which is real evidence but not a
  substitute for the guardrail. Needs a real multi-device walkthrough
  before this body of UI work can be called done per guardrail #1.

Once #54 merges (after the migration runs) and B1–B4/B7 are cleared, this
project should be at or very close to the audit's "Week-0 plan" endpoint.

### UI/flows fix pass (superseded — now merged, see Current phase above)
**2026-07-27, originally recorded as "uncommitted."** This work was
subsequently committed, branched (`feature/ui-flows-fixes`), opened as PR
#46, and merged into `dev` in the pilot-readiness pass above. Kept here
for the detailed by-file breakdown. What changed:
- **Server (TDD RED→GREEN, 130/130 green):** `GET /api/rooms/:id/status`
  now requires the caller to be seated in the room (403 otherwise) — that
  route is *not* read-only (it lazily flips an expired room to `ended` and
  dispatches feedback generation), so anyone holding a room id could drive
  another group's session state and read their topic. It also now returns
  `code`, `topicText`, `durationSeconds`, and `isCreator`; `getRoomById`
  embeds `topics(text)` on the existing query (no extra round trip), so
  the lobby survives a browser refresh — previously the room code, topic
  heading, and creator-only start button all came from react-router
  navigation state and vanished on reload.
- **Web flows (the gaps flagged by the previous session's UI review):**
  catch-all `*` route → new `NotFoundPage`; `ProtectedRoute`/`ConsentPage`
  render a real `LoadingScreen` instead of a blank white page; a failed
  consent-status load is now its own retry card instead of letting a
  student agree into a second failure; the raw seconds duration input is
  now a minutes picker (`components/DurationPicker.jsx`, 5/10/15/20); the
  dev "Backend connection: …" diagnostic is gone from `HomePage`,
  replaced by a plain-language offline banner; a consent-blocked mic error
  in the live room now links to `/consent` instead of showing a raw
  `consent_required` string.
- **Real bugs fixed:** `LiveRoomAudio`'s join effect was keyed on the
  Supabase `session` object, so a mid-discussion token refresh would have
  torn down and rejoined the LiveKit room (reads through a ref now, keyed
  on `roomId` alone); the lobby polled `/status` forever after a room
  ended; the ended view showed "Loading…" permanently if the transcript
  fetch failed; feedback polling never gave up (now bounded, ~2 min).
- **Perf/system:** `LiveRoomAudio` is `React.lazy`-loaded, splitting
  livekit-client into its own chunk — main bundle 976 kB → **483 kB**
  (136 kB gzip); `AuthContext`'s value is memoized; dark mode via
  `prefers-color-scheme` token overrides in `index.css`; global
  `:focus-visible` rings (several controls set `outline: none` with no
  replacement) and a `prefers-reduced-motion` block; `display=block` on
  the Material Symbols font (icons rendered as raw ligature text —
  "mic_off", "arrow_forward" — while the font loaded); dead
  `src/App.css`, `public/icons.svg`, and `src/assets/*` deleted.
- **Not done / still open:** self-hosted fonts and a shared
  `components/ui/` primitives layer (both recommended by the earlier
  review) were skipped. **No browser verification this session** —
  Playwright is not installed in this environment (the previous session
  used a global install that isn't present here), so `npm run build` +
  `npm run lint` (both clean) and 130/130 server tests are the only
  evidence. Dark mode and the new flows have never been looked at by a
  human. Guardrail #1's multi-device human gate for the live-room UX
  remains outstanding, unchanged from the previous session.

### Post-W8 UI polish (2026-07-27, now fully merged via the pilot-readiness pass)
Between W8 (deploy/operate, done) and
whatever the user picks up next, this session ran a UI review of the app
(`feature/ui-redesign-refresh`, PR #42, still open against `dev`) and fixed
the highest-value gap it found: the live room screen showed almost nothing
during an actual GD. Two stacked branches, both merged into
`feature/ui-redesign-refresh` (not `dev` yet, since #42 itself hasn't
merged):
- **`feature/live-room-participants`, PR #43 (merged)** — core, TDD
  RED→GREEN. `GET /api/rooms/:id/status` now includes `endsAt` (ms) once a
  room has started; new `GET /api/rooms/:id/participants` and
  `GET /api/rooms/:id/transcript` resolve a room's seated user ids to
  profile display names (reusing the same participants+profiles join the
  W6 feedback worker already does), both gated on actually being seated in
  the room. 127/127 server tests green (Node 22).
- **`feature/live-room-ux`, PR #44 (merged)** — peripheral, no test-first
  ceremony (same precedent as the existing Login/Signup/Consent pages).
  `LiveRoomAudio.jsx` now shows real display names in captions (was a
  truncated user id), a participant list with an active-speaker dot
  (`RoomEvent.ActiveSpeakersChanged`), a mute/unmute button, `role="log"
  aria-live="polite"` + auto-scroll on captions, and a real bug fix: the
  caption list's `key={i}` over a sliding window reused the wrong DOM
  nodes as it slid — now a monotonic id per caption. `LobbyPage.jsx` shows
  a countdown to the server-authoritative `endsAt` while live, and the
  attributed transcript alongside feedback once ended. `HistoryPage.jsx`
  gets a lazy per-session "View transcript" toggle. New shared
  `components/TranscriptList.jsx`.
- **Verified solo via Playwright** (no `chromium-cli` in this environment;
  used the user's globally-installed `playwright` package directly,
  headless Chromium with `--use-fake-ui-for-media-stream
  --use-fake-device-for-media-stream` + granted mic permission) against
  both dev servers: signup → consent → create room → start → live →
  ended → history. Zero console errors; countdown, participant list, mute
  button, and transcript panels (including the correct empty-transcript
  fallback text) all rendered correctly. **Found, not fixed, this
  session:** this dev environment's `apps/server/.env` is missing
  `GEMINI_API_KEY` (feedback generation logged `Missing GEMINI_API_KEY`
  and the UI correctly showed "Generating your feedback…" indefinitely) —
  a pre-existing environment gap, not a regression from this session; the
  key exists in whatever environment W6's original human-verification
  session ran in, just not in this one. Whoever picks this up next should
  add it here too if further live testing is needed.
- **Guardrail #1 still outstanding for this UI work**, same as W5/W6's
  pattern of merging code first and running the human gate in a follow-up
  session: multi-speaker audibility and attribution weren't exercised by
  this solo/headless run (a fake audio device produces no real speech).
  Needs a real multi-device walkthrough, same shape as the earlier W5/W6
  sessions, before this can be called fully done.
- **Not done in this session** (flagged, from the same UI review, for
  whoever picks this up next): the reviewed "flows" gaps (consent-error
  dead-end UX, no catch-all route, blank-screen loading states, raw
  seconds duration input, dev diagnostics leaking to students on
  `HomePage`) and "system-level" cleanup (dark mode, a shared
  `components/ui/` primitives layer, self-hosted fonts, focus-visible
  rings, dead `App.css`/`public/icons.svg`) were recommended as two
  further follow-up branches, not attempted here.

### W8 and earlier
**W8 (Deploy & operate) — code/config complete, 2026-07-26; actual deploy
still needs the user's dashboard access.** Four PRs merged into `dev`
(#36–#39, plus a docs PR #40): the agent-worker dispatch health tracker
(`domain/agentWorkerStatus.js`, core/tests-first, exposed at
`GET /health/agent`), `render.yaml` (Render Blueprint), the GitHub
Actions keep-alive + agent-health-check workflow, and
`docs/engineering/DEPLOYMENT.md` (the actual how-to + secrets checklist).
Also found and fixed a real pre-existing gap: `ci.yml` only triggered on
`main`, so **no task PR merged into `dev` had ever actually run CI**
before this session — fixed and verified live on its own PR. **121/121
server tests green.** Full detail in `PHASE1_PLAN.md`'s W8 section. What's
left is not more code — see "What's next" below.

**W7 (Session history) — DONE, 2026-07-26 (previous session).** Found and
fixed a real RLS recursion bug in the process, history list/API/UI built
and verified against the real running server. Both branches' PRs (#33,
#34) opened and merged.

**Phase 1 build — in progress.** Pre-flight P1 + P2 done; W1 (Foundation &
scaffolding) done 2026-07-25; W2 (Accounts) done 2026-07-26; **W3 (Consent)
— DONE 2026-07-26**, human-verification walkthrough passed. **W6 (Feedback
generation) — DONE, 2026-07-26** (see below, after W5 — built out of order
relative to this file's earlier draft since W5 was already DONE and W6 was
next per `PHASE1_PLAN.md`). Guardrail #1's human gate passed: two real
devices/accounts over Cloudflare tunnels, a real room, real feedback read
and confirmed excellent. **W4 (Topics +
rooms + matching) — code complete 2026-07-26.** `0003_topics_rooms_matching
.sql` is now confirmed run against the live Supabase project (a real
policy-ordering bug was hit and fixed along the way — see the migration
file's history). No Google AI Studio key exists yet so Gemini topic
generation has never been smoke-tested live, and the room/matching UI has
not been walked through in a real browser — both still open. **W5 (Live
room + transcription + attribution) — DONE, 2026-07-26.** All six units
(transcript schema, attribution mapping, LiveKit join-token route, agent
worker, web room UI, regression harness) built, tested (78/78 server tests
green), and merged to `dev` across 6 small PRs (#16–#21). The bot
regression harness passed against live LiveKit + AssemblyAI credentials
(3/3 speakers, zero cross-speaker leakage) and both migrations
(`0003`/`0004`) are confirmed run against the live Supabase project.
**Guardrail #1's human-verification gate itself then ran in a follow-up
session (real people, real devices, real room, joining by room code):
participants could hear each other, transcription quality was good, and
— the specific thing the gate requires — each speaker's words were
confirmed attributed to the correct person.** Two real bugs surfaced and
were fixed during that walkthrough (see "What's done" for detail): remote
audio tracks were never attached to a playable element on the web client
(mic worked, but nobody could hear anyone), and the transcription agent's
LiveKit token had `canPublishData: false` while the code tried to
broadcast live captions over data messages, so captions silently never
rendered even when transcription itself was working server-side. **Noted,
not blocking:** transcription is English-only (expected — not
investigated further this session), and both STT paths have latency the
user wants improved, AssemblyAI noticeably more than Deepgram; one root
cause was found and fixed (see below), the rest is now down to an
explicit accuracy/latency trade-off that can be revisited if it's still
not fast enough. **W6 (Feedback generation) — DONE, 2026-07-26; see
"What's done" below for detail. Next: W7 — Session history.**
`docs/engineering/PHASE1_PLAN.md` is the durable build plan; work from that
file, this file stays the "where are we right now" record.

**Phase 0b (formal research + ADRs) — ✅ COMPLETE.** All 8 categories done
(real-time/WebRTC, live STT, auth, DB/storage, backend framework, frontend
framework, hosting/deployment, LLM provider). Eight ADRs live in
`docs/engineering/adr/0001–0008-*.md`.

**Phase 1 is now planned (2026-07-25):** `docs/engineering/PHASE1_PLAN.md`
is the durable build plan — pre-flight gates, architecture, data model, 8
dependency-ordered workstreams (each naming its tests-first core vs.
peripheral units), the 4-week timeline with critical path, and a
definition-of-done checklist. **Work from that file during Phase 1**; this
file stays the "where are we right now" record.

**Longevity criterion added 2026-07-25 (per direct user guidance):**
`adr/METHOD.md` now has a 7th rubric criterion — production stability/
abandonment risk, weighted explicitly alongside cost and mainstream-fit for
every remaining (and re-checked) ADR. Saved as memory entry
`longevity-as-decision-criterion`.

**Budget note added 2026-07-25:** the project's real budget is **$0
out-of-pocket**, not just "under $100/mo" — see the memory entry
`budget-zero-out-of-pocket` and the updated rubric in `adr/METHOD.md`. Every
remaining ADR should weight "free forever, no credit card" far above
"cheap." Plan is: bootstrap on free/OSS tools → demo → attract funding →
then real spend becomes available.

**Re-checked ADR-0001–0003 against this tightened bar (2026-07-25):**
LiveKit (ADR-0001) and Supabase Auth (ADR-0003) both re-confirmed genuinely
free-forever, no credit card — no changes to either decision. **ADR-0002
(live STT) is the one exception** — added a "Budget re-check" section to
that file: no viable STT vendor offers unlimited-free-forever streaming
transcription, only one-time trial credits (AssemblyAI $50/~333hrs,
Deepgram $200/~430hrs) that eventually require a card. The one truly $0
option (browser Web Speech API) was already tried and rejected on
reliability grounds in the Phase 0a spike, not cost. Self-hosting Whisper
doesn't actually dodge this either — server rental cost would likely exceed
the API bill it replaces, on top of ops complexity the team doesn't have.
Conclusion recorded in the ADR: STT will need a small real card-based spend
eventually (~$10–30/mo at realistic pilot volume) — flagged as the
"last-resort, small and unavoidable" case per the user's explicit guidance,
not a blanket exception to the free-tools-first rule.

## What's done
- Read `PlaceMe_Product_Context_v2.md` in full.
- Established MVP boundary and in-scope tech categories (see CLAUDE.md).
- Gathered and confirmed all Phase -1 blocking inputs from the user (below).
- Created agent context files: `CLAUDE.md`, `.claude/rules/guardrails.md`, `docs/engineering/TEAM.md`, this file.
- Chose spike stack (LiveKit Cloud + Deepgram, both free tier) — see `docs/engineering/SPIKE_PLAN.md`.
- Built **Stage 1 spike** in `spike/`: Node token server + web client, LiveKit audio room, consent gate.
- Built **Stage 2** in `spike/`: server-side Deepgram transcriber (`src/transcriber.js`, `agent.js`) that subscribes per participant track → attribution is structural.
- Built a **headless self-test** (`selftest.js` + TTS bot speakers via `src/speaker-bot.js` + `media/gen-voices.ps1`) so the room can be validated with **zero humans** (user is solo).
- **Ran the self-test twice → PASS both times.** Per-speaker attribution perfect, finalization latency ~0.1–0.7s, cost ~$0.002/run. Full results in `docs/engineering/SPIKE_PLAN.md`.
- **Real-human confirmation → PASS.** Exposed the local server via a free Cloudflare Quick Tunnel (real `https://` needed for mic access off-localhost), user joined from a real device on a real network and spoke live — captions appeared, correctly attributed. Spike is now fully validated (automated + human).
- **Conclusion: the core risky assumption HOLDS.** LiveKit + Deepgram is a validated front-runner for the real-time + STT ADRs.
- Started `docs/engineering/LESSONS.md` — a running, beginner-friendly glossary of every library/service used (what it is, cost, open-source status, gotchas). Populated with LiveKit, Deepgram, cloudflared, Node/Express/dotenv/ws, Windows SAPI. Guardrail #11 added so it's kept current going forward.
- **Phase 0b started.** Wrote `docs/engineering/adr/METHOD.md` (shared ADR format + plain ✅/⚠️/❌ rubric derived from the fixed constraints, used for every category going forward).
- **ADR-0001 (real-time/WebRTC) — Accepted.** `docs/engineering/adr/0001-realtime-webrtc.md`. Compared LiveKit Cloud against Daily.co, Agora, Amazon Chime SDK, Twilio Programmable Video (ruled out — sunsetting), Vonage/OpenTok, and self-hosted Jitsi/mediasoup (ruled out — too much unmanaged complexity for the team), all via live-sourced 2026 pricing/status with citations. **Decision: LiveKit Cloud**, on the strength of (a) the already-validated spike, (b) its Agents framework being purpose-built for live per-participant server-side audio access (competitors mostly offer post-hoc per-track *recording*, not a live-subscribe primitive), and (c) its Apache-2.0 OSS core giving a real self-host escape hatch that no proprietary competitor offers. No new LESSONS.md entry needed — LiveKit was already documented there; evaluated-but-rejected alternatives aren't things we're using.
- **ADR-0002 (live STT) — Accepted.** `docs/engineering/adr/0002-live-stt.md`. Compared Deepgram (spike incumbent) against AssemblyAI, Google Cloud STT, Azure AI Speech, AWS Transcribe, OpenAI gpt-4o-transcribe, Speechmatics, and self-hosted Whisper (ruled out — same unmanaged-complexity reasoning as self-hosted WebRTC). **Decision: AssemblyAI Universal-Streaming, superseding Deepgram.** Key reasoning: our architecture opens one STT connection *per speaker*, so concurrent streams scale with rooms × participants — worst case ~25–50 at launch, ~100–150 at 3 months. Deepgram's pay-as-you-go concurrency cap (50 streams, not self-serve-raisable) sits right at our launch ceiling and well under our 3-month target; AssemblyAI auto-scales concurrency with no hard cap, and is also cheaper (~$0.0025/min vs ~$0.005–0.008/min) with competitive accuracy. This is a genuine pivot away from the spike-validated vendor — flagged explicitly in the ADR's Consequences: before Phase 1 build leans on it for real rooms, re-run a small smoke test (reuse `selftest.js`'s pattern against AssemblyAI's endpoint) since the human-verification gate (guardrail #1) so far only ran against Deepgram. Updated `LESSONS.md`: added an AssemblyAI entry, and noted the supersession on the existing Deepgram entry (kept as a documented fallback, not deleted).
- **ADR-0003 (auth) — Accepted.** `docs/engineering/adr/0003-auth.md`. Compared Firebase Auth, Supabase Auth, Clerk, Auth0, AWS Cognito (ruled out — documented DX/pricing-complexity complaints, bad fit for a beginner team), and the open-source Auth.js/Better Auth libraries (ruled out — Auth.js is now maintenance-mode only; Better Auth shifts real security/ops ownership onto a first-time team, contrary to "managed for the hard parts"). **Decision: Supabase Auth**, managed (not self-hosted for now). All of Firebase/Supabase/Clerk are free and fine at our pilot scale — the tiebreaker was the fixed "no hard vendor lock-in" constraint: Supabase is the only one with a genuine open-source self-host escape hatch. Noted (not decided) a possible synergy with the upcoming DB/storage ADR since Supabase bundles a Postgres database. Flagged a build-phase to-do: choosing a vendor doesn't satisfy India DPDP by itself — still need our own recorded-consent flow and to confirm Supabase's data processing terms. Updated `LESSONS.md` with a Supabase Auth entry.
- **User clarified the real budget (2026-07-25): $0 out-of-pocket**, not just "under $100/mo" — bootstrap on free/OSS tools, demo the product, use that to attract funding before any real spend. Saved as a memory entry (`budget-zero-out-of-pocket`) and folded into `adr/METHOD.md`'s cost criterion so every remaining ADR applies this automatically, not just this one.
- **ADR-0004 (DB/storage) — Accepted.** `docs/engineering/adr/0004-db-storage.md`. Compared Supabase Postgres against Neon, MongoDB Atlas, PlanetScale (free-tier status too unclear in current sources to rely on), Turso, Render (disqualified — free Postgres expires after 30 days, incompatible with our retention rule), Railway (disqualified — no free managed DB at all), and self-hosted Postgres (disqualified — same unmanaged-ops reasoning as self-hosted WebRTC/STT). **Decision: Supabase Postgres** — same project as Auth (ADR-0003), zero new vendor accounts, genuinely free forever, and a direct fit for our relational data shape (students → sessions → transcript lines → feedback). Rough capacity check: ~10,000+ sessions before the 500MB free limit, comfortably past pilot scale. No audio storage decision needed — raw audio is deleted immediately after transcription (guardrail #4) and never reaches the database. Merged into the existing Supabase entry in `LESSONS.md` rather than creating a duplicate.
- **ADR-0005 (backend framework) — Accepted.** `docs/engineering/adr/0005-backend-framework.md`. Compared Express (already used in the spike) against Fastify, NestJS, and Hono. This category has no budget dimension — all are free open-source libraries regardless of choice, so the decision turned entirely on mainstream fit and beginner-friendliness. **Decision: Express**, staying with the spike's existing choice — it remains by far the most mainstream/documented Node framework, un-opinionated and simple enough for a first-time Node developer, and the performance/enterprise-structure benefits of the alternatives solve problems this MVP doesn't have. One actionable note: build on **Express 5.x**, not 4.x, since 4.x is maintenance-only now. Updated the existing Express entry in `LESSONS.md` rather than duplicating it. **Later re-checked against the new longevity criterion (below) — Express confirmed as the most production-proven option of the group, reinforcing rather than changing the decision.**
- **User guidance (2026-07-25): weigh longevity/production-stability explicitly** in every ADR — "explore alternatives and longevity for the app not to break or crash in future... best option for production and life too." Added as rubric criterion 7 in `adr/METHOD.md` and saved as memory (`longevity-as-decision-criterion`). Also: **STT payment decision explicitly deferred** — run on AssemblyAI's current trial credit as-is; when it runs out, decide then whether to add a card or open a fresh trial account (noted in ADR-0002, not resolved).
- **ADR-0006 (frontend framework) — Accepted.** `docs/engineering/adr/0006-frontend-framework.md`. Compared React against Vue, Svelte 5, and SolidJS, with longevity weighted explicitly per the new criterion. **Decision: React, built with Vite** (not Create React App — unmaintained since 2023; not Next.js — its SSR/SEO strengths don't apply to a logged-in practice tool with no public content pages). React wins on both the largest example/documentation base (directly useful for an agent-assisted team) and the strongest longevity story of any option: as of Feb 2026 it moved from single-company (Meta) ownership to the independent, multi-company-backed React Foundation under the Linux Foundation — reducing abandonment risk rather than adding it. Added a new React + Vite entry to `LESSONS.md`, including a flag not to default to Create React App out of old habit/tutorials.
- **ADR-0007 (hosting/deployment) — Accepted.** `docs/engineering/adr/0007-hosting-deployment.md`. Split into two sub-decisions: **frontend → Cloudflare Pages** (free, unlimited bandwidth, no card — easy call). **Backend + LiveKit Agent worker → Render**, deployed via Dockerfile. The hard part: the LiveKit Agent worker must stay continuously connected to receive room dispatches (confirmed from LiveKit's own docs — an unavailable worker means no agent joins the room, a live-room failure), which ruled out every scale-to-zero free tier (Google Cloud Run, Koyeb) and Fly.io (no free tier since 2024). The only option with zero sleep risk by design, Oracle Cloud's Always Free VM, was rejected anyway: it's a self-managed raw server (exactly the "self-manage the hard part" pattern avoided everywhere else in this project) and has documented reports of Oracle reclaiming instances that look "idle" — which matches our worker's actual usage pattern. **Named as an honest near-dead-end, on record.** Landed on Render (managed, free, no card, real Docker support) with its 15-minute sleep neutralized by a free GitHub Actions keep-alive ping — a well-documented pattern, not a fragile hack — with the residual risk stated plainly and a cheap ($7/mo) fix flagged for whenever there's funding. Added Render and Cloudflare Pages entries to `LESSONS.md`.
- **ADR-0008 (LLM provider) — Accepted. Phase 0b is now COMPLETE (8/8).** `docs/engineering/adr/0008-llm-provider.md`. Compared Google Gemini API against OpenAI and Anthropic (both disqualified outright — neither has a permanent free API tier, only small one-time trial credits requiring a card for continued use), Groq (free but its own docs position it as prototyping-only, not production), and OpenRouter's free models (real but only 50 requests/day by default, likely too tight at our scale). **Decision: Gemini's free tier** — the only major provider with a genuinely indefinite, no-card free API tier, backed by a large stable company. **Split by use case, and one open item flagged rather than resolved:** topic generation (no personal data) uses the free tier with no reservation. Feedback generation sends a student's own transcript, and Gemini's free-tier terms allow that data to be used to improve Google's products with human review — a real privacy question on top of the mic-consent guardrail. This is the project's **second flagged "small real spend may be the honest answer" case** (after STT in ADR-0002): either extend student consent to disclose free-tier processing, or use Gemini's paid tier for that one call (cheap — likely a few dollars/month at pilot volume, and paid-tier prompts are contractually excluded from training use). Left as an explicit decision for whoever builds the feedback feature in Phase 1, not resolved unilaterally here. Added a Gemini entry to `LESSONS.md` with this nuance spelled out.
- **Version control set up (2026-07-25).** `git init`, verified nothing sensitive staged (`.env` correctly gitignored, no hardcoded keys in source — only `process.env.*` references), initial commit made, pushed to `github.com/Hruday-Kumar/gd-proto` (user confirmed push completed after fixing a stale cached GitHub credential in Windows Credential Manager). Repo is live.
- **Phase 1 pre-flight started (2026-07-25).** **P1 (old key deletion) confirmed done by user.** **P2 (AssemblyAI smoke test) — PASS, run twice.** Built `spike/selftest-assemblyai.js` + `spike/src/assemblyai.js` + `spike/src/transcriber-assemblyai.js`, parallel to the existing Deepgram path (left untouched — stays the documented ADR-0002 fallback). Per-speaker attribution correct with no leakage on both runs; finalization latency ~0.1–0.4s after audio ends, matching the original Deepgram spike baseline. Hit and fixed one real integration gotcha: AssemblyAI's v3 endpoint requires 50–1000ms of audio per message (Deepgram has no minimum) — LiveKit's ~10ms frames needed client-side buffering first. Documented in `LESSONS.md`'s AssemblyAI entry. **Note:** this smoke test satisfies P2, not guardrail #1 — W5 still needs the full human-verification gate (multiple real people, live room) before shipping real transcription. P3 (remaining account provisioning: Supabase, Google AI Studio, Render, Cloudflare Pages) and P4 (Render keep-alive verification) still outstanding.
- **W1 (Foundation & scaffolding) — DONE, 2026-07-25.** Skipped straight here from pre-flight per user's explicit choice (P3/P4 don't block local dev). Built the monorepo exactly per `PHASE1_PLAN.md` §4: `apps/web` (React 19 + Vite), `apps/server` (Express 5.2 + a `/health` route + a clearly-labeled agent-worker boot stub, real logic deferred to W5), `packages/shared` (empty placeholder). New test runner: **Vitest + Supertest** (chosen because the frontend already committed to Vite in ADR-0006 — one toolchain, not two; documented in `LESSONS.md`). Root-level `Dockerfile` builds `apps/server`; **verified for real, not just written** — `docker build` succeeded and a container from that image served `{"status":"ok"}` on `/health`. `.github/workflows/ci.yml` added (test job + docker-build job) but not yet observed green on GitHub since nothing's pushed this session. Full detail (including the Docker `COPY . .` gotcha with npm workspaces) is in `PHASE1_PLAN.md`'s W1 section and `LESSONS.md`'s new Vitest/Supertest and Docker entries. `spike/` untouched.
- **W2 (Accounts) — DONE, 2026-07-26.** Provisioned a real Supabase project (user did this — see credentials note below). **Core, tests-first:** `apps/server/src/domain/verifyToken.js` verifies Supabase JWTs asymmetrically against the project's JWKS using `jose` — the approach Supabase's own docs now recommend over the legacy shared-secret method. 5 fully offline tests (locally generated test keypair, no network) cover missing/malformed/expired/wrong-signature/valid tokens. Wired as Express middleware (`authMiddleware.js`) gating a first protected route, `GET /api/me`, with its own rejection test. **Peripheral:** `apps/web` got a Supabase-backed `AuthContext`, `ProtectedRoute`, and Login/Signup/Home pages via `react-router-dom` (new dependency — flagged an inapplicable `npm audit` finding about React Router's RSC/Framework-Mode CSRF issue; we only use client-side SPA routing, documented in `LESSONS.md`). Added `cors` to the backend so the Vite dev server can call it locally. DB: `supabase/migrations/0001_profiles.sql` — `profiles` table + RLS (own-row-only) + an `on_auth_user_created` trigger; **the user ran it manually via the Supabase SQL Editor** (no migration tooling wired up yet — noted as a possible gap to revisit). **Verified end-to-end, twice:** scripted signup→login→refresh directly against Supabase's Auth REST API (each token verified correctly by the running backend; the `profiles` row confirmed present via a live RLS-scoped query) *and* the user manually walked signup→login→page-refresh in a real browser and confirmed the session survives a refresh. One real snag: toggling "Confirm email" off doesn't retroactively unblock already-created unconfirmed users — only affects new signups; cost some back-and-forth during testing, documented in `LESSONS.md` so it doesn't surprise anyone again. **Credentials note:** the user pasted the Supabase URL + anon/publishable key directly in chat — safe, since publishable keys are meant to be client-exposed (not a secret leak like the earlier AssemblyAI-key situation, which was handled by asking them to edit `.env` directly instead).
- **W3 (Consent, guardrail #3) — DONE, 2026-07-26.** `supabase/migrations/0002_consents.sql` — `consents` table, own-row RLS, insert-only (a consent event is immutable; a version bump is a new row, never an edit to an old one) — **not yet run against the live Supabase project** (needs the same manual SQL-Editor step as `0001_profiles.sql`). **Core, tests-first:** `apps/server/src/domain/consent.js`'s `canEnableMic(latestConsent, currentVersion)` — pure, false with no record or a stale `consent_version`, true only on current (`test/consent.test.js`, 3 tests). Since the real LiveKit token-mint route doesn't exist until W5, "every mint must call it" is satisfied now as composable Express middleware — `createConsentGate()` (`apps/server/src/api/consentGate.js`), proven against a stub route in `test/consentGate.test.js` (403 with no/stale consent, 200 with current); W5 mounts this in front of the real mint route when it's built. `GET /api/consent/status` + `POST /api/consent` (`apps/server/src/api/consent.js`, `apps/server/src/db/consents.js`) let a student check/record consent, tested offline in `test/consentApi.test.js` with `requireAuth` stubbed (same pattern already used for `/api/me`). All 17 server tests green. **Peripheral:** `apps/web`'s `/consent` route (`ConsentPage.jsx` + `useConsentStatus.js`) renders all four required disclosures verbatim (mic capture, no raw audio storage, transcript retention until account deletion, Gemini free-tier processing per ADR-0008) and posts agreement; linked from `HomePage`. `npm run build`/`lint` on `apps/web` both clean. **Both outstanding items closed 2026-07-26 (guardrail #1 satisfied):** the
user ran `0002_consents.sql` in the Supabase SQL Editor, then walked
signup → `/consent` → read the copy → agreed → confirmed the page flipped
to "Consent recorded... you're clear to join a mic-enabled room" on
revisit. **A real blocker surfaced and was fixed along the way:** the
Node-20-vs-22 engine mismatch (flagged earlier as a maybe-later CI risk)
actually broke local dev — `@supabase/supabase-js`'s realtime client needs
a native `WebSocket` global, only present in Node 22+, and the failure
only appears on the *first DB-backed request* (`getSupabase()`), not at
boot, so the server looks fine until `/api/consent` is actually hit. Fixed
by adding `engines: {node: ">=22.0.0"}` to `apps/server/package.json` and a
root `.nvmrc` pinning `22`; documented as a gotcha in `LESSONS.md`. Also
found and fixed this session: the checked-out working tree had no
installed dependencies at all (`npm install` at the repo root was required
before any test could run, even pre-existing ones) — worth remembering if
a fresh clone/session hits the same "Cannot find package" error. Also added
`.github/PULL_REQUEST_TEMPLATE.md` per user request — references
`For_Developers/CONTRIBUTING.md` and `npm run lint`/`npm run
audit:rls`/`design.md §14`, none of which exist in this repo yet; left
as-is pending user follow-up.
- **W4 (Topics + rooms + matching) — core units done, 2026-07-26.** Each
built and merged into `dev` as its own small task branch/PR per
`BRANCHING.md`, one at a time, TDD RED→GREEN commits per unit:
  - **Room code generation** (`feature/w4-room-codes`, PR #5) —
    `apps/server/src/domain/roomCode.js`. `generateRoomCode()` picks a
    fixed-length code from an alphabet that excludes visually ambiguous
    characters (0/O/1/I/L — this is the shareable-link join path, so a
    misread/mistyped code matters). `generateUniqueRoomCode(codeExists, {
    maxAttempts })` retries on collision with an injected DB-check
    function (testable with no live DB) and throws rather than looping
    forever if attempts are exhausted. 6 tests.
  - **Matchmaking function** (`feature/w4-matchmaking`, PR #6) —
    `apps/server/src/domain/matchmaking.js`. `matchmake(queue, joiner, {
    minGroupSize, maxGroupSize })` is pure — returns `{type: 'queued'}`
    below threshold or `{type: 'matched', members, remainingQueue}` once
    enough candidates exist, FIFO-capped at `maxGroupSize`. Deliberately
    does **not** hardcode the actual group-size numbers (guardrail #10) —
    those are a product decision still open, to be made when the
    persistence/wiring layer is built (see "What's next"). Queue storage
    itself is a separate concern, also still open (§8 of
    `PHASE1_PLAN.md`). 5 tests.
  - **Session state machine** (`feature/w4-session-state-machine`, PR #7)
    — `apps/server/src/domain/sessionStateMachine.js`. `startSession`/
    `endSession`/`isTimerExpired`: waiting → live → ended, illegal
    transitions rejected. Timer is server-authoritative by construction —
    every function takes `now` as an argument rather than reading a clock
    or trusting any client timestamp; `isTimerExpired` is what the server
    polls to decide when to end a session, no client vote. 7 tests.
  - All 35 server tests green after these three merges (verified after
    each PR, no regressions).
  - **Queue storage + group size — DECIDED 2026-07-26** (per direct user
    confirmation): matchmaking queue is **DB-backed** (`matchmaking_queue`
    table, survives Render restarts/sleep). Group-size numbers set as an
    interim default, `minGroupSize: 3, maxGroupSize: 6`, anchored to the AI
    Voice Practice mode's stated participant range since the product doc
    has no explicit number for real-human multiplayer matching. Recorded
    in `PHASE1_PLAN.md` §8.
  - **DB schema** (`feature/w4-topics-rooms-schema`, PR #10) —
    `supabase/migrations/0003_topics_rooms_matching.sql`: `topics`,
    `rooms`, `room_participants`, `matchmaking_queue`, all with RLS. **Not
    yet run against the live Supabase project** — needs the same manual
    SQL Editor step as `0001`/`0002`.
  - **Gemini topic generation + custom topic entry**
    (`feature/w4-gemini-topics`, PR #11) — `src/domain/topicPrompt.js`
    (pure prompt/response handling), `src/llm/geminiClient.js` (thin fetch
    wrapper, injectable), `POST /api/topics/custom` and `POST
    /api/topics/generate`. **Model note:** ADR-0008 picked
    `gemini-2.5-flash`; a live check this session
    (ai.google.dev/gemini-api/docs/deprecations) showed it's slated to
    shut down 2026-10-16, with Google's own recommended replacement being
    `gemini-3.6-flash` (GA, free tier, launched 2026-07-21) — used as the
    new default, overridable via `GEMINI_MODEL`, per `PHASE1_PLAN.md`'s own
    instruction to confirm the current model at build time. **Still
    blocked:** no Google AI Studio key exists yet (`GEMINI_API_KEY` not in
    `.env`, pre-flight P3) — this code is unit-tested with an injected
    fetch/generate function, never smoke-tested against the live API.
  - **Rooms/matching API** (`feature/w4-rooms-api`, PR #12; `GET
    /api/rooms/mine/active` added in PR #13) — `src/api/rooms.js` wires all
    three core functions to persistence: create-by-code, join-by-code,
    random-match (generates a topic + creates the room + seats every
    member + clears the queue), creator-only start, and a status-poll
    endpoint that lazily flips a room to `ended` on read once the server
    clock says the timer's up — whichever client polls first writes it,
    so every other poller sees the same answer. A real gap surfaced while
    building this: a student sitting in the queue had no way to learn that
    someone else's request completed a match including them (their queue
    row is just gone) — fixed with `GET /api/rooms/mine/active`
    (`getActiveRoomForUser`, `db/roomParticipants.js`), tests-first.
  - **Topic-picker + lobby UI** (`feature/w4-room-ui`, PR #13, peripheral —
    no test-first ceremony, same precedent as the existing Login/Signup/
    Consent screens) — `NewRoomPage`, `JoinRoomPage`, `MatchPage` (polls
    `/api/rooms/mine/active` while queued), `LobbyPage` (polls room
    status, share code, creator-only start button). `npm run build`/`lint`
    clean on `apps/web`; dev server boots and serves without crashing.
    **Not yet walked through in a real browser.**
  - **64/64 server tests green** after all of the above (verified after
    each PR, no regressions).
  - **What's genuinely still open before W4 can be called done:** (1)
    ~~run `0003_topics_rooms_matching.sql` against the live Supabase
    project~~ **DONE** — user confirmed it's applied (a policy-ordering
    bug was hit and fixed in the migration file along the way); (2)
    provision a Google AI Studio key and smoke-test topic generation
    live; (3) a human walkthrough in a real browser — create a room, share
    the code, a second session joins, creator starts it, status reflects
    live then ended; and separately the random-match path with enough
    sessions to cross `minGroupSize`.
- **W5 (Live room + transcription + attribution) — code complete,
  2026-07-26.** Six units, each its own branch/PR into `dev` per
  `BRANCHING.md` (#16–#21). Full detail in `PHASE1_PLAN.md`'s W5 section;
  summary here:
  - `transcript_lines` schema + db wrapper (own-row RLS; **confirmed run**
    against the live Supabase project, 2026-07-26 — same manual SQL
    Editor step as 0001–0003).
  - **Attribution mapping (core, tests-first):** `domain/attribution.js`'s
    `resolveSpeakerUserId()` — pure, returns `null` (never a guess) on no
    match. 4 tests.
  - **LiveKit join-token route (tests-first):** `POST
    /api/rooms/:id/token`, gated on the W3 consent gate + a new
    `isParticipant()` check. Token identity is the student's own
    `user_id` — already what `room_participants.livekit_identity` stores
    from W4 — so attribution needs no separate mapping table. 5 tests.
  - **Agent worker:** `agent/handleTranscript.js`'s
    `persistAttributedLine()` is the core, tests-first glue between
    attribution and persistence (3 tests). Peripheral pieces ported from
    the Phase 0a/P2 spike (`agent/assemblyai.js`, `agent/transcriber.js`)
    plus new orchestration (`agent/roomAgent.js`): `POST
    /api/rooms/:id/start` dispatches transcription fire-and-forget right
    after the room goes live; a dispatch failure logs but never fails the
    start response. The agent self-disconnects once `durationSeconds`
    elapses — server-authoritative, no client vote.
  - **Web room UI (peripheral):** `LobbyPage`'s `live` branch now joins
    the real LiveKit room and shows live captions. `npm run build`/`lint`
    clean.
  - **Regression harness:** `npm run regression:room` exercises the real
    production agent pipeline (not just the raw LiveKit/AssemblyAI layer)
    with bots and zero humans. **Ran once against live credentials: PASS**
    — 3/3 speakers transcribed correctly, zero cross-speaker leakage,
    latency consistent with the original spike.
  - **78/78 server tests green** after all six units.
  - ~~run `0004_transcript_lines.sql` against the live Supabase project~~
    **DONE, 2026-07-26** — user confirmed it's applied.
  - **Guardrail #1's human-verification gate — DONE, follow-up session,
    2026-07-26.** Multiple real people, real devices, a real room, joined
    by room code: speech confirmed attributed to the correct speaker. Two
    real bugs surfaced and were fixed in that session — remote audio was
    never attached to a playable element (`LiveRoomAudio.jsx`, mic worked
    but nobody could hear anyone), and the transcription agent's LiveKit
    token had `canPublishData: false` while trying to `publishData(...)`
    live captions (`roomAgent.js`), so captions silently never rendered.
    Both fixed; 78/78 server tests still green after. **W5 is DONE.** User
    also flagged transcription latency (AssemblyAI slower than the earlier
    Deepgram spike) and English-only transcription — see "What's next" for
    the latency root-cause and fix; English-only wasn't investigated
    further this session.

## Confirmed inputs (user, 2026-07-24)
| Dimension | Decision |
|---|---|
| v1 scope | GD Arena — Multiplayer mode only, + student accounts |
| Scale | ~5–10 concurrent rooms (~30–75 users) at launch; ~20–30 rooms at 3 months (tiny single-campus pilot) |
| Budget | <~$100/mo infra + tooling (shoestring) |
| Retention | Raw audio deleted immediately after transcription; transcript + feedback kept until account deletion; student sees only own history |
| Compliance | India DPDP + explicit recorded consent before mic enabled |
| Timeline | ~2–4 weeks to real students in a live room |
| Team | Agent-dependent, new to React/Node/WebRTC/TDD → mainstream + managed + well-documented tech only |
| Codebase | Fully greenfield; no infra/vendor commitments |

## What's next
**Immediate next steps from the 2026-07-27 pilot-readiness pass** (see
"Current phase" above for full detail):
1. **Run `supabase/migrations/0007_feedback_rating.sql`** in the Supabase
   SQL Editor, then merge PR #54 (S1, feedback rating) — held open
   specifically because merging its server code first would 500 the
   already-working `GET /feedback/mine` endpoint.
2. **Deploy** (B1): Render Blueprint (`render.yaml` is ready) + Cloudflare
   Pages project + set the `RENDER_APP_URL` repo variable. Needs the
   user's dashboard access, not attempted this session.
3. **Turn Supabase's "Confirm email" back on** (B3) — a dashboard toggle,
   currently OFF since W2 testing.
4. **B4, the highest technical risk named in `PILOT_READINESS.md`:** once
   deployed, let it sit idle >15 min, then confirm a room started right
   after still gets a transcription agent (Render free-tier sleep vs. the
   agent worker). Silent total failure if this doesn't hold.
5. **Guardrail #1's human-verification gate (B7)** for the whole UI-
   redesign + live-room-UX + flows-fix body of work (PRs #42/#43/#44/#46)
   — still only solo/headless-verified, never run with real multiple
   humans on real devices.
6. `GEMINI_API_KEY` is confirmed present in this environment now (the
   pilot-readiness audit, PR #48, flagged and corrected an earlier stale
   note here saying otherwise).

**Phase 1 is underway. Follow `docs/engineering/PHASE1_PLAN.md` §5 from
here** — one workstream's core units at a time (guardrail #9). Pre-flight
recap: P1 and P2 done; Supabase (part of P3) now provisioned and wired
(W2). Google AI Studio/Render/Cloudflare Pages accounts and P4 (Render
keep-alive check) remain non-blocking for local dev, deferred until the
workstream that needs them. W1 and W2 are both done — see "What's done"
above.

**W3 — Consent (guardrail #3 — hard gate): DONE, 2026-07-26.** Migration
run, human walkthrough passed (see "What's done" above).

**W4 — Topics + rooms + matching: code complete, 2026-07-26; verification
remaining.** Everything named in `PHASE1_PLAN.md` §5 is built, tested, and
merged (see "What's done" above for the full PR-by-PR breakdown: #5–#13).
**What's left before this workstream can be called done:**
1. ~~Run `supabase/migrations/0003_topics_rooms_matching.sql`~~ **DONE** —
   confirmed applied to the live project.
2. ~~Provision a Google AI Studio key, smoke-test `POST
   /api/topics/generate` for real~~ **DONE, 2026-07-26** — live smoke test
   of `generateTopic` passed (see W6's session entry above for detail).
3. ~~A human walkthrough in a real browser: create a room, share the
   code, a second session joins, the creator starts it, status reflects
   `live` then `ended` for both sessions~~ **DONE, 2026-07-26** —
   confirmed as a side effect of W6's human-verification walkthrough (two
   real devices, two real accounts, room created, joined by code,
   started, timer ended for both). **Still open:** the random-match path
   specifically, with enough real sessions to cross `minGroupSize`
   (currently 3) — the walkthrough so far only exercised code/link
   joining.
- **Done when** (per `PHASE1_PLAN.md` §5 W4): two browser sessions can
  join the same room both by code and by random matching, and the timer
  ends the session for everyone at the same moment. **Code/link path
  confirmed; random-match path still needs a 3+-session live test.**

**W5 — Live room + transcription + attribution: DONE.** Everything named
in `PHASE1_PLAN.md` §5 W5 is built, tested (78/78), and merged (PRs
#16–#21 — see "What's done" above for the per-unit breakdown). Both
migrations are confirmed run against the live project, and guardrail #1's
human-verification gate has now run for real: multiple real people, real
devices, real room, joined by room code, and — the specific thing the
gate requires — each person's speech was confirmed attributed to the
correct speaker. **Two real bugs found and fixed during that walkthrough
(this session):**
1. `apps/web/src/rooms/LiveRoomAudio.jsx` enabled the local mic and
   subscribed to the LiveKit room, but never attached any remote
   participant's audio track to a playable element — so mic capture
   worked but nobody could hear anyone else. Fixed: `RoomEvent
   .TrackSubscribed` now calls `track.attach()` into a hidden container
   (`TrackUnsubscribed` cleans it up).
2. `apps/server/src/agent/roomAgent.js` minted the transcription agent's
   LiveKit token with `canPublishData: false`, then called `room
   .localParticipant.publishData(...)` to broadcast live captions —
   permission mismatch, so captions silently never reached the browser
   even when server-side transcription and DB persistence were working.
   Fixed: `canPublishData: true`.
- **Done when** (per `PHASE1_PLAN.md` §5 W5): multiple real people in a
  real room on real devices confirm speech is attributed to the correct
  speaker. **Confirmed 2026-07-26 — W5 is DONE.**

**Latency, noted not blocking:** the user compared this session's
AssemblyAI-based transcription against the earlier Deepgram spike and
found AssemblyAI noticeably slower to finalize captions, on top of both
having room to improve. One real, fixable cause: our Deepgram config
explicitly finalizes after 300ms of silence (`endpointing: '300'` in
`spike/src/deepgram.js`), while `apps/server/src/agent/assemblyai.js` was
running on AssemblyAI's own defaults (`min_turn_silence` 400ms), plus
AssemblyAI's v3 API requires ≥50ms of audio per message so we were
buffering client frames up to `chunkMs = 100` before sending (Deepgram has
no such minimum, so that path sent every ~10ms frame immediately). Fixed
this session: `min_turn_silence` now explicitly set to `300` (matching
Deepgram) and `chunkMs` lowered to `50` (AssemblyAI's own floor). Live
sources consulted for the current parameter names/defaults (AssemblyAI's
docs, since these are exactly the kind of numbers guardrail #6 says not to
recall from training data) — see the AskUserQuestion exchange this session
for the citations. **Trade-off flagged, not resolved:** AssemblyAI's own
docs recommend the *opposite* direction (560ms) for multi-speaker
captioning, to avoid splitting a turn on a mid-sentence pause — 300ms
trades some of that safety margin for snappier captions, on the theory
that GD Arena's fast back-and-forth matters more here. **Not yet
re-verified live** — needs another real-room pass to confirm the tuning
actually helped and didn't introduce new mid-sentence splitting.
Transcription being English-only was also noted by the user but not
investigated this session (not currently blocking — flag if multi-language
support becomes a real requirement).

**W6 — Feedback generation: DONE, 2026-07-26.** See
`PHASE1_PLAN.md`'s W6 section for the full five-unit breakdown; summary:
prompt assembly (core, `domain/feedbackPrompt.js`, 10 tests), the
`feedback` table + db wrappers (peripheral, migration `0005_feedback.sql`),
generation orchestration (core, `domain/feedbackGeneration.js`'s
`generateFeedbackForRoom()` — isolates one student's Gemini failure so it
can't lose the transcript or block anyone else's feedback, 5 tests),
Gemini client + worker wiring (peripheral, dispatched fire-and-forget from
the room-ended transition in `GET /api/rooms/:id/status`, same pattern as
W5's `/start` → transcription dispatch), and a read endpoint +
`LobbyPage` display so a human can actually see generated feedback.
**102/102 server tests green**, `apps/web` build/lint clean. Built as a
stacked branch chain (`w6-feedback-prompt` → `w6-feedback-schema` →
`w6-feedback-generation` → `w6-feedback-worker` → `w6-progress-update`,
plus an unrelated `chore/vite-allowed-hosts` for a pre-existing
uncommitted change found sitting on `dev`) because `gh` CLI wasn't
available at first in this session; once the user installed and
authenticated it mid-session, all six PRs (#25–#30) were opened and merged
into `dev` in order, so this is now fully on `dev`.

**Both previously-open pre-conditions closed 2026-07-26 (later same
session):** the user ran `0005_feedback.sql` in the Supabase SQL Editor and
added a real `GEMINI_API_KEY` to `apps/server/.env`. **Live smoke test —
PASS:** a one-off script (not committed) called the real Gemini API
through both existing call sites with the real key — `generateTopic`
(W4) returned a genuine GD topic, and `generateFeedback` (W6), given a
synthetic 5-line multi-speaker transcript, returned a well-formed,
specific, constructive, non-discouraging paragraph referencing the
target student's actual contributions by name. This closes W4's
previously-open "smoke-test topic generation live" item too.

**Guardrail #1's human-verification gate for W6 — PASS, 2026-07-26 (later
same session).** Two real devices, two real accounts, exposed over
Cloudflare Quick Tunnels (same pattern as the earlier W5 human-verification
session — `apps/web/vite.config.js`'s `allowedHosts: true` from
`chore/vite-allowed-hosts` made this possible again): joined a real room by
code, had a short real discussion, let the server-authoritative timer end
the session, and watched each device's Lobby page go from "Generating your
feedback…" to the real Gemini-generated paragraph. **User confirmed: "the
feedback is excellent."** This is the specific thing guardrail #1 requires
for a feedback feature — useful and non-discouraging tone, judged by a real
human reading real output from a real session. **W6 is DONE.**

**W7 — Session history: code complete, 2026-07-26 (later session).** Full
detail in `PHASE1_PLAN.md`'s W7 section; summary: the core unit
(`test/historyRlsIsolation.test.js`, two real Supabase Auth users proving
"own history only" through actual Postgres RLS, not an app-level filter)
**found a real production bug on its first run** — `rooms` and
`room_participants`'s SELECT policies (from 0003) recursed infinitely for
any authenticated-user query, because every existing app read of those
tables goes through the server's RLS-bypassing service-role client, so
this was the first thing to ever exercise the policies as a real user.
Fixed via `supabase/migrations/0006_fix_room_participants_rls_recursion.sql`
(a `SECURITY DEFINER` helper function) — **user ran it live, all 4
isolation assertions now pass for real.** Peripheral: `domain/
sessionHistory.js`'s `buildSessionHistory()`, three new scoped db reads,
`GET /api/history/mine`, and `HistoryPage.jsx` (linked from `HomePage`).
Verified against the real running server with a genuine Supabase user and
real fixture data, not just mocks. **112/112 server tests green** (also
reconfirmed directly on `dev` after merge), `apps/web` build/lint clean.
**PR #33** (`feature/w7-history-rls-test` → `dev`) **and PR #34**
(`feature/w7-session-history` → `feature/w7-history-rls-test`, stacked)
**are both merged — W7 is fully on `dev`.** (`gh` CLI turned out to be
installed and authenticated the whole time; it just wasn't on this
session's tool `PATH` at first — see the `gh-cli-not-persistent` memory.)
**One thing still open, not blocking further work:** `/history` hasn't
been looked at by a human in an actual browser window — no Playwright/
chromium-cli was available this session to screenshot it — worth a quick
glance, though this isn't a guardrail #1 hard gate since history-viewing
isn't itself a new mic/audio/attribution surface.

**W8 — Deploy & operate: code/config complete, 2026-07-26.** Everything
buildable without dashboard access is done and merged — see the "Current
phase" section above and `PHASE1_PLAN.md`'s W8 section for the full
breakdown. **What's left needs the user, not more code** (all documented
step-by-step in `docs/engineering/DEPLOYMENT.md`):
1. Create the actual Render Blueprint deploy (`render.yaml` is ready —
   needs a Render account + the secrets checklist).
2. Create the actual Cloudflare Pages project (needs a Cloudflare account
   — build settings documented, including the monorepo build-command/
   output-dir gotcha).
3. Set the `RENDER_APP_URL` GitHub Actions repository variable once #1
   is live, then confirm `keepalive.yml` gets a first green run.
4. Pre-flight **P4**: after a real deploy exists, let it sit quiet
   >15 minutes with no traffic, then confirm a room started right after
   still gets a transcription agent (ADR-0007's "Revisit if" risk).
5. Turn Supabase's "Confirm email" back **on** before real students use
   the deployed app.
6. The actual W8 "done when": a full end-to-end pass on the **deployed**
   stack with real people — not local dev.

Once those are done, Phase 1's full definition-of-done checklist
(`PHASE1_PLAN.md` §7) can be walked top to bottom.

**Note on how W5 got built this session:** at the user's direction
(2026-07-26), task granularity changed mid-project — workstreams complex
enough to have several named core/peripheral units (like W5) still get
split into small per-unit branches/PRs, but small single-unit tasks no
longer get artificially sub-divided (see the memory update, [[workstream-
task-breakdown]]). Also worth knowing: two commits briefly landed
directly on local `dev` by mistake during this session (guardrail #12
slips) — both were caught before being pushed to `origin/dev` and moved
onto their own branches before merging; no bad history reached the
remote.

**Carry-forward for whoever builds W4/later workstreams:** local dev now
requires **Node 22+** (a root `.nvmrc` pins `22`; run `nvm use` — or
`nvm install 22 && nvm use` — before `npm run dev`/`npm test` in any
package). Node 20 boots the server fine but throws on the first real
Supabase DB query (`getSupabase()` in any `db/*.js` module), since
`@supabase/supabase-js`'s realtime client needs a native `WebSocket`
global only present in Node 22+. See `LESSONS.md`'s Node.js entry.

**Historical pre-flight items, now closed:**
1. ~~Set up version control (git)~~ **DONE 2026-07-25** — repo is live at
   github.com/Hruday-Kumar/gd-proto.
2. ~~Delete the old Deepgram/LiveKit keys~~ **DONE 2026-07-25.**
3. ~~Run the AssemblyAI smoke test~~ **DONE 2026-07-25 — PASS, twice.**
4. Verify the Render keep-alive pattern (ADR-0007) — **still open**, tied
   to P4/W8, not urgent until there's a real deploy.
5. ~~Decide the feedback-generation LLM data-privacy question~~ **DECIDED
   2026-07-25** — free tier + disclosure, see ADR-0008. Required follow-up
   still pending: the consent copy (W3) must include that disclosure.

**Two things the Phase 1 planning pass surfaced that the ADRs didn't
settle:**
- **The Express API and the LiveKit agent worker must run as ONE Render
  service, in one container.** Render's free tier gives 750 instance-hours/
  month; one always-on service uses ~720h, so two would exceed it. ADR-0007
  assumed one service's worth of hours without stating that both processes
  have to share it. Keep the modules separate in source, share only the
  entry point, so they can be split when there's budget. (PHASE1_PLAN §3a.)
- **Raw audio never needs a deletion job** — it's streamed from the LiveKit
  track straight to AssemblyAI and never written to disk or DB at all, so
  guardrail #4 is satisfied by construction rather than by remembering to
  clean up. (PHASE1_PLAN §3b.)

**To resume efficiently next session:** just point the agent at this file (`docs/engineering/PROGRESS.md`) — no need to replay this conversation. `CLAUDE.md` loads automatically and covers the fixed constraints/MVP boundary.

## Blockers / open items
- ~~Security — old exposed Deepgram + LiveKit keys still active~~ **DONE 2026-07-25** — user confirmed both old keys deleted from their dashboards.
- ~~Not yet set up: version control (git), repo hosting.~~ **DONE 2026-07-25** — pushed to github.com/Hruday-Kumar/gd-proto.
- rtc-node prints `lk-rtc` pino debug lines; set `NODE_ENV=production` to silence.
- **STT (ADR-0002):** AssemblyAI's one-time trial credit will eventually run out; card-vs-fresh-trial-account is a build-phase decision (user already deferred this on 2026-07-25).
- ~~LLM feedback generation (ADR-0008): free tier vs. paid tier decision~~ **DECIDED 2026-07-25** — free tier for now, paid tier later once funded. **New follow-up requirement:** consent flow must disclose free-tier processing before feedback generation ships — see W3 in "What's next". Don't build this feature without that disclosure added.
- **Supabase "Confirm email" is currently OFF** (toggled 2026-07-26 for W2 testing — see PHASE1_PLAN.md's W2 section). **Must be turned back on before real students use the app** — right now anyone can sign up with any email, confirmed or not. On the W8 pre-launch checklist in `DEPLOYMENT.md`.
- ~~`GEMINI_API_KEY` still not provisioned~~ **DONE 2026-07-26** — user provisioned the key, live smoke test of both topic generation and feedback generation passed (see W6 entry above).
- ~~W6's five branches need PRs opened and merged into `dev`~~ **DONE 2026-07-26** — `gh` CLI installed and authenticated mid-session; all six PRs (#25–#30) merged into `dev` in order.
- ~~Guardrail #1's human-verification gate for W6~~ **PASS, 2026-07-26** — two real devices/accounts over Cloudflare tunnels, real room, real feedback confirmed excellent. **W6 is DONE.**
- ~~W7's two branches need PRs opened and merged into `dev`~~ **DONE 2026-07-26** — PR #33 and PR #34 both merged; W7 confirmed fully on `dev` (112/112 tests green there too).
- **`/history` hasn't been looked at by a human in a real browser yet** — no browser-automation tooling was available this session to screenshot it; build/lint and a real end-to-end API check (real Supabase user, real fixture data) both passed, but a quick human glance is still worth doing.
- **W8 needs dashboard access the agent doesn't have:** Render account/Blueprint deploy, Cloudflare Pages project, and setting the `RENDER_APP_URL` repo variable are all still open — full checklist in `docs/engineering/DEPLOYMENT.md`. Not blocking further code work, but blocking the actual "real students, deployed" milestone.
- **CI never ran on any merged task PR until this session** — `ci.yml` only triggered on `main`; fixed 2026-07-26 (verified live on the fix's own PR, #39). Worth knowing if past "green tests" claims in this file were ever based on CI rather than local `npm test` — they weren't; CI simply hadn't been exercised.
- ~~**PR #54 (S1, feedback rating) is open, not merged — `supabase/migrations/0007_feedback_rating.sql` must run first.**~~ **CLOSED 2026-07-28** — probed the live project directly: `feedback.rating` and `feedback.rating_reason` both exist, so the migration ran and the S1 code shipped. Migration status for every file now lives in `PLAN.md` §3.
- **DEEPGRAM_API_KEY still needs revoking in the Deepgram dashboard** — removed from this environment's `.env` (PR #51, S2) since nothing references it, but the key itself is a user action in Deepgram's console, not something this session could do.
- **B1/B3/B4/B7 from `PILOT_READINESS.md` are still open** — deploy (Render + Cloudflare Pages + `RENDER_APP_URL`), the Supabase "Confirm email" toggle, the post-deploy Render-sleep-vs-agent-worker test, and guardrail #1's human-verification gate for the UI-redesign/live-room-UX/flows-fix body of work. All need dashboard access or real humans, not attempted this session — see "What's next" above.

## Deferred (not v1, tracked so they aren't forgotten)
GD AI Voice Practice · JAM · Aptitude/Technical · 1-on-1 Roleplay · Drive Simulator · payments · notifications/SMS/push · analytics · advanced observability.
