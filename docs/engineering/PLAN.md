# PLAN — audit remediation & road to pilot

**Last updated:** 2026-07-30 (doc-sync pass — corrects the 2026-07-29
entry below, which had gone stale). **`fix/n3-n4-capacity-ratelimit-flush-
race` (N8, N6, N3, N4) merged into `dev` via PR #44 on 2026-07-29** —
confirmed directly via `git log`/`gh pr list`, not just recorded here on
trust. Combined with N2/N7 (PR #42) and N1 (PR #40), **every finding N1–N8
from `AUDIT_COMPARISON_2026-07-29.md` is now done and on `dev`**. `dev` is
6 commits ahead of `main` with zero open PRs. The reference below to
`docs/engineering/CODEX_HANDOVER_2026-07-29.md` was also stale — **that
file was never created**; it doesn't exist in this repo. Whoever wrote
that sentence intended to hand off there but the file itself never
landed. Treat this file and `PROGRESS.md` as the source of truth instead.

A fresh pass on 2026-07-30 re-verified every remaining open finding
(N5, N9, N11–N14, H4's residual gap) directly against current source —
see §4/§5 below for what's still open — and found one new reliability gap
the original audit never flagged: **no process-level `unhandledRejection`/
`uncaughtException` handler anywhere in `apps/server/src`**, plus one
fire-and-forget call (`roomAgent.js`'s duration-timer dispatch of
`stopTranscriptionForRoom`) with no `.catch()` that could trigger it and
crash the whole process, not just one room. See `PROGRESS.md`'s
2026-07-30 entry for the full writeup and the remediation plan (8 small
branches, in priority order, currently in progress).

<details><summary>Original 2026-07-29 entry (superseded, kept for history)</summary>

**Last updated:** 2026-07-29 (reconciled — two parallel work sessions off
the same N1 base are now combined on one branch,
`fix/n3-n4-capacity-ratelimit-flush-race`: **N8, N6, N3, N4** (this
branch — CI hardening, render.yaml/DEPLOYMENT.md sync, room participant
cap + rate limiting, and the feedback-vs-transcription-flush race, all
coded and tested but not yet on `dev`) plus **N2, N7** (already merged
into `dev` via PR #42 and recorded there). All six findings are from
`AUDIT_COMPARISON_2026-07-29.md`, not the 2026-07-28 `AUDIT.md` this file
otherwise tracks. Before all of these: N1 fixed — feedback generation now
retries with backoff instead of failing permanently and silently. See
`PROGRESS.md` for all session records, and
`docs/engineering/CODEX_HANDOVER_2026-07-29.md` for what's still open and
queued up next.)

</details>

This is the **shared checklist and ownership board** for two people working
this repo at the same time. It answers: what is done, what is next, who has
it, and what will break if we both touch the same thing.

## Which file do I read?

| File | What it is | When to update |
|---|---|---|
| **PLAN.md** (this) | The ordered checklist + who owns what | Claim a task, finish a task |
| `PROGRESS.md` | Narrative record — *why* things were done, root causes, what was verified | End of every session (guardrail #9) |
| `AUDIT.md` | The 2026-07-28 audit itself — evidence for each finding | Only to mark a finding RESOLVED |
| `BRANCHING.md` | Git workflow — **read before your first branch** | Rarely |
| `PHASE1_PLAN.md` | The original W1–W8 build plan (all shipped) | Historical |
| `PILOT_READINESS.md` | The earlier pilot-blocker list (B1–B7) | Historical + B-items below |

**Rule of thumb:** PLAN.md says *what and who*. PROGRESS.md says *why and
how it was verified*. Don't duplicate one into the other.

---

## 1. Working agreement (read this before touching anything)

1. **Claim before you start.** Put your name in the Owner column of the task
   below, commit that one-line change, and push it *before* you write code.
   An unclaimed task is fair game; a claimed one is not.
2. **One task, one branch.** Branch off `dev`, name it for the task
   (`fix/h4-rate-limiting`). Never commit to `main` or `dev`. Full flow in
   `BRANCHING.md`.
3. **TDD is not optional here.** RED commit (failing test) then GREEN commit
   (implementation), separately. See CLAUDE.md's TDD rules.
4. **Node 22 or nothing.** `nvm use` before any `npm install` / `npm test`.
   Node 20 installs fine and then fails on the first live Supabase query.
5. **Migrations are a manual step.** Nothing applies them automatically —
   someone has to paste the SQL into the Supabase SQL Editor. Say in the PR
   whether you've run it. See §3.
6. **Guardrail #1 still applies.** No room / audio / transcription /
   attribution / feedback change is "done" on tests alone — a real human has
   to use it. Two people in the repo finally makes this practical.
7. **Run the `pr-review` skill on every PR** before merge (`BRANCHING.md` 5a).

**Test commands** (from repo root, on Node 22):

```
npx vitest run --root apps/server    # 311 tests, all must pass (3 live-RLS test files skip offline/on Node <22 — expected)
npx oxlint apps/server/src           # 1 known pre-existing warning (L5)
npm run build --workspace=apps/web   # must build clean
```

---

## 2. Repo state right now — ⚠️ read before branching

**Updated 2026-07-28.** The three hazards this section used to describe
(branch stack unpushed, `dev` behind `main`, uncommitted `LobbyPage`/vercel
work) are **all resolved** — an intervening commit (`2d2b0ac`) landed the
uncommitted work, and PR #4 plus a second, previously-undocumented PR #5/#6
pushed and merged everything into `placemestudy1/gd-proto`. This section
had never been updated to say so; corrected now rather than left to mislead
the next session. See `PROGRESS.md`'s "Second-session work landed same day"
entry for what PR #5/#6 actually contained.

### Repo identity — read this first if anything below looks wrong
The canonical remote is now **`placemestudy1/gd-proto`** (the repo moved
twice: `Hruday-Kumar/gd-proto` → `Place-Me-study/gd-proto` →
`placemestudy1/gd-proto`). `origin` in most local clones still points at
the first, personal repo — **don't trust `origin` for `gh` commands**, pass
`--repo placemestudy1/gd-proto` explicitly (same fix already applied to
`.claude/skills/pr-review/SKILL.md`). As of this update, `dev`, `main`, and
`placemestudy1/dev`/`placemestudy1/main` are all fully in sync (verified
via `git rev-list --left-right --count`) — there is currently no
branch-stack hazard to warn about. If that's no longer true when you read
this, treat this section as stale and check `git log`/`git branch -a`
yourself rather than trusting it blindly.

### Frontend host — decided 2026-07-28
**Vercel**, not Cloudflare Pages — ADR-0007 updated (see its "Superseded
2026-07-28" section), `apps/web/public/_redirects` deleted,
`apps/web/vercel.json` is the live config. M12 is resolved. Reason on
record: exploratory, per direct user instruction, not a technical failure
of Cloudflare Pages. The **backend** stays Render-only regardless (ADR-0009,
C2) — this only concerns the static frontend build.

### What's still genuinely open from the old §2 (not resolved by the above)
- **Migration `0008` (C1) still needs live-application confirmed** — see §3.
  The code/schema fix is real and merged; whether it's been run against the
  live Supabase project is unverified from here (no raw-SQL access).
- **Migrations `0009` and `0010` (H3, duration bounds) also unverified live**
  — see §3.

---

## 3. Migration status (Supabase — manual SQL Editor step)

| Migration | Applied to live project? | Notes |
|---|---|---|
| `0001`–`0006` | ✅ Yes | Confirmed in earlier sessions |
| `0007_feedback_rating.sql` | ✅ **Yes — verified live 2026-07-28** | `feedback.rating` present. PROGRESS.md's old "PR #54 held, don't merge" warning is **stale**; the code shipped and the column exists. |
| `0008_rooms_created_by_on_delete_set_null.sql` | ✅ **Confirmed applied — live-tested 2026-07-28** | Re-verified after the user ran it: deleting a scratch user who'd created a room now succeeds (was `23503` FK violation before), and the room survives with `created_by` set to `NULL`. Account deletion (DPDP, guardrail #4) is fixed for real. |
| `0009_rooms_duration_seconds_bounds.sql` | ✅ **Confirmed applied — live-tested 2026-07-28** | |
| `0010_tighten_rooms_duration_seconds_bounds.sql` | ✅ **Confirmed applied — live-tested 2026-07-28** | Re-verified after the user ran both: a scratch room now rejects `duration_seconds` updates at both 5000 and 2000 (proving 0010's tighter 1500 ceiling is live, not just 0009's original 3600), and accepts a valid 900. Check constraint `rooms_duration_seconds_bounds` confirmed enforcing 60–1500 in the live DB. |
| `0011_drop_room_participants_client_insert.sql` | ✅ **Confirmed applied — live-verified 2026-07-29 (N7)** | Re-ran the existing `test/roomParticipantsRlsIsolation.test.js` (H8) against the live Supabase project with real credentials, on Node 22: `userB` (never seated in `roomA`) attempting a direct client-side insert into `room_participants` for `roomA` was rejected, and a service-role re-query confirmed no row was written. The pre-0011 policy (`auth.uid() = user_id` only, no room-membership check) would have let this exact insert succeed, so a blocked insert is proof the policy is gone. 1/1 test passed. Closes N7 from `AUDIT_COMPARISON_2026-07-29.md`. |
| `0012_rooms_feedback_retry_tracking.sql` | ✅ **Confirmed run — user applied it 2026-07-29** | N1 fix (`AUDIT_COMPARISON_2026-07-29.md`): adds `rooms.feedback_generated_at`/`feedback_attempts`/`feedback_last_attempted_at`. Not yet independently re-verified against the live schema from this session (no live DB access here) — taken on the user's word, same as every other migration in this table. **Guardrail #1's real-room check for N1 is still outstanding** — planned for tonight (2026-07-29), per the user; PR #40's own test-plan checkbox for this is unchecked until then. |
| `0013_drop_topics_client_insert_add_length_constraint.sql` | ✅ **Confirmed applied — live-verified 2026-07-29** | N2 fix (`AUDIT_COMPARISON_2026-07-29.md`): drops `topics_insert_own_custom` (the client-facing INSERT policy that let any authenticated student bypass H5's 200-char API cap via a direct PostgREST insert) and adds a `topics_text_length` CHECK constraint (≤200 chars) that binds every insert including the server's own service-role writes. **Re-ran `apps/server/test/topicsRlsIsolation.test.js` against the live project on Node 22 after the user applied the migration: all 3 assertions now pass** — a direct client insert is rejected, an oversized service-role insert is rejected by the new constraint, and an in-bounds service-role insert still succeeds (no regression to the real `/api/topics/custom`/`/api/topics/generate` paths). Before the migration, the same test reproduced the vulnerability live (both the client-bypass and the oversized insert succeeded) — see `PROGRESS.md`'s N2 session entry for that before/after evidence. |

---

## 4. DONE ✅

Audit findings closed, newest first. Evidence and root causes are in
`PROGRESS.md`; the code is on the branch stack in §2.

| ID | What | Where |
|---|---|---|
| **N8** (`AUDIT_COMPARISON_2026-07-29.md`) — **merged, PR #44, confirmed via `git log`/`gh pr list` 2026-07-30** | Three CI gaps left the security-critical layers unguarded: `apps/server` was never linted in CI (a required gate per §1, unenforced); the two RLS isolation tests (guardrail #4's own-history-only proof, and the H8/`0011` seating-lockdown regression test) `skipIf`d without live Supabase creds and no CI job ever set them, so they silently reported "skipped" forever; no `npm audit` step existed despite 2 known high advisories in the tree. Fixed: new `server-lint` job (`oxlint`), new `rls-security` job (feeds `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` from GH Actions secrets to the two RLS test files directly, with a `::warning::` annotation if the secrets aren't set yet — no job-level `if:` gate exists because Actions doesn't expose `secrets` to job conditions), new `dependency-audit` job (`npm audit --audit-level=high`, `continue-on-error: true`, reporting-only). **The GH Actions secrets are now set** (2026-07-31, via `gh secret set` — see §6), so `rls-security` provides real coverage as of the next CI run. No application code changed. | `.github/workflows/ci.yml` |
| **N6** (`AUDIT_COMPARISON_2026-07-29.md`) — **merged, PR #44** | `render.yaml` had drifted from the actual production deployment config: the M6 CORS-allowlist fix and the M3 `/health/agent` token gate both added new env vars the app reads in production (`ALLOWED_ORIGINS`, `HEALTH_CHECK_TOKEN`), but neither was ever added to the Blueprint spec. A fresh Blueprint deploy would silently omit both — recreating the exact CORS breakage that was found and fixed live against `gd-proto-1` on 2026-07-29 (see `DEPLOYMENT.md`'s "Status" section). Fixed: both added as `sync: false` entries in `render.yaml`, in the same order `DEPLOYMENT.md`'s secrets checklist already lists them, so a fresh deploy now prompts for both. **Infra-config-only change** — the live `gd-proto-1` service's actual env vars are untouched (it wasn't created from this Blueprint in the first place), no application code changed, no migration. The `placeme-server` vs. `gd-proto-1` service-name mismatch was reviewed and left as-is — already documented in `DEPLOYMENT.md` as an intentional consequence of the live service being a manual "New Web Service" import rather than a Blueprint deploy, not a bug. | `render.yaml`, `DEPLOYMENT.md` |
| **N3** (`AUDIT_COMPARISON_2026-07-29.md`) — **merged, PR #44** — ⚠️ *residual gap found 2026-07-30: `POST /api/topics/custom` was never added to either rate limiter — see the 2026-07-30 entry below* | "No effective participant cap or abuse protection on room creation/join" — `POST /api/rooms/join` (the code/link path) had no participant-count check at all, so a leaked room code let an unbounded number of accounts join a single `waiting` room, each costing a live LiveKit connection, a per-speaker AssemblyAI stream once the room started, and a Gemini feedback call once it ended. Neither `POST /api/rooms` (create) nor `POST /api/rooms/join` had any rate limiting either (unlike the two Gemini-backed routes H4 already covered). Fixed: a new `domain/roomCapacity.js`'s `isRoomFull()` (core, tested) is checked before inserting a new joiner and re-verified after inserting, backing the seat back out (`db/roomParticipants.js`'s new `removeParticipant`) if a concurrent joiner won the race for the room's last spot — bounds the cap tightly without a schema-level atomic count, no migration needed. A rejoin by an already-seated participant is never blocked (reuses the existing `isParticipant` check and `addParticipant`'s existing unique-constraint idempotency — duplicate joins were already handled). A new `createRoomActionRateLimiter` (`api/rateLimit.js`, same per-user keying as H4's `createLlmRateLimiter`, kept separate since neither route is Gemini-backed) now gates both routes. Default cap (6) anchored to the same product-stated range already used for matchmaking's group size (guardrail #10) — no new number invented. No schema change, no API shape change. | `api/rooms.js`, `api/rateLimit.js`, `domain/roomCapacity.js`, `db/roomParticipants.js` |
| **N4** (`AUDIT_COMPARISON_2026-07-29.md`) — **merged, PR #44** | Feedback generation could start before the transcription agent had actually finished flushing a room's last few seconds of speech: the sweeper's `ends_at`-based expiry check and the agent's own stop timer (`durationSeconds + STOP_GRACE_MS`, 4s grace) were two fully independent clocks, and `stopTranscriptionForRoom` never awaited its own `closeAll()`/in-flight DB writes either — a fire-and-forget teardown even by the time it did run. A second, lower-level race in `assemblyai.js`: `close()` sent AssemblyAI's `Terminate` message and called `ws.close()` with zero wait, racing the server's own response containing the last speaker's final turn. Fixed: `roomAgent.js` tracks every `persistAttributedLine` write per room and now exposes `isTranscriptionActive(roomId)` — true until the agent has disconnected *and* every one of its writes has landed; `assemblyai.js`'s `close()` now waits for the socket's own `close` event (bounded by a 2s safety net only for a socket that never closes on its own) instead of racing it; `roomSweeper.js` checks `isTranscriptionActive` before dispatching feedback and, if still active, takes no claim and defers to the next sweep tick — bounded by a new `FEEDBACK_FLUSH_MAX_WAIT_MS` (15s, `domain/roomSweep.js`) so a stuck/crashed agent can't block feedback forever. No schema change, no API change; room-ending still happens exactly on schedule, only feedback generation is deferred. **Guardrail #1's real-room check is outstanding** — this needs a real session where a participant is still speaking right as the timer ends, confirmed by a human that their last words appear in the feedback. | `agent/roomSweeper.js`, `agent/roomAgent.js`, `agent/transcriber.js`, `agent/assemblyai.js`, `domain/roomSweep.js` |
| **N2** (`AUDIT_COMPARISON_2026-07-29.md`) | H5's 200-char custom-topic cap and prompt delimiting are enforced in `api/topics.js`, but `topics_insert_own_custom` (from `0003`) still let any authenticated student bypass that route with a direct PostgREST insert into `topics` — its check (`source = 'custom' and auth.uid() = created_by`) only proves self-identity, the same vulnerability class as H8/`room_participants`, just never cross-checked against this table. Migration `0013` drops that policy (confirmed safe: no `apps/web` code inserts into `topics` directly — only `db/topics.js`'s service-role writes do) and adds a `topics_text_length` CHECK constraint (≤200 chars) — a table constraint, not just an RLS check, so it also binds the server's own service-role writes for LLM-generated topics. Because that constraint applies to *every* insert, `domain/topicPrompt.js`'s `parseTopicResponse` was also updated to reject an oversized Gemini response before it ever reaches the insert — otherwise a verbose model reply could 500 the legitimate `/api/topics/generate` and `/api/rooms/match` paths. `test/topicsRlsIsolation.test.js` proved the vulnerability live before the fix (both the direct client insert and an oversized service-role insert succeeded) and proved it closed after the user applied `0013` (all 3 assertions pass: client insert rejected, oversized insert rejected, in-bounds service-role insert still works). 282/282 server tests green. | migration `0013` (applied), `domain/topicPrompt.js`, `test/topicPrompt.test.js`, `test/topicsRlsIsolation.test.js` |
| **N7** (`AUDIT_COMPARISON_2026-07-29.md`) | Migration `0011` (H8's fix — drops the client-facing `room_participants` insert policy that let any student seat themselves into any room via direct PostgREST) had no recorded live-application status anywhere in the repo — `PLAN.md` §3 stopped at `0010`, so nobody could say whether H8 was actually closed in production. Verified by re-running the existing `test/roomParticipantsRlsIsolation.test.js` against the live Supabase project (real credentials, Node 22, not CI — that test `skipIf`s without live creds): a second real user, never seated in the test room, had a direct client-side insert into `room_participants` rejected, and a service-role re-query confirmed no row was written. The pre-0011 policy would have allowed this exact insert (it only checked `auth.uid() = user_id`, not room membership), so the rejection is direct live proof the policy is gone and `0011` is applied. §3 updated with the row. **No code changed — this was a verification-and-recording task only**, per its own recommended fix. | `docs/engineering/PLAN.md` §3, `apps/server/test/roomParticipantsRlsIsolation.test.js` (unmodified, re-run only) |
| **N1** (`AUDIT_COMPARISON_2026-07-29.md`) | Feedback generation had no retry and no persisted record of completion — a crash mid-call or a Gemini outage (this happened for real: a dead service account 401'd every participant of a real session, see `PROGRESS.md`'s 2026-07-29 B7 entry) meant that room's feedback was gone forever, since `ended` rooms are dropped from the live-room sweep and nothing ever revisited them. Fixed: the sweeper now also retries any `ended` room still missing feedback, bounded by attempt count (5), backoff (60s), and age (24h) — `domain/roomSweep.js`'s `findRoomsReadyForFeedbackRetry`. Each attempt is claimed atomically (same conditional-update pattern as C3/H7) so overlapping sweep ticks can't double-dispatch. `generateAndPersistFeedbackForRoom` now skips participants who already have persisted feedback and returns `{ complete }` instead of void, so the sweeper knows when to stop retrying a room. A room whose retries are exhausted surfaces on `/health/agent` as `feedbackHealthy: false`, alongside the existing transcription `healthy` flag — `keepalive.yml` now checks both. Migration `0012` run against the live project 2026-07-29 (see §3). **Guardrail #1's real-room check is still outstanding** — user plans to run one tonight (2026-07-29); until then this isn't fully closed out per guardrail #1's letter. | `agent/roomSweeper.js`, `agent/feedbackWorker.js`, `domain/roomSweep.js`, `domain/agentWorkerStatus.js`, `db/rooms.js`, `db/feedback.js`, migration `0012`, `.github/workflows/keepalive.yml` |
| **M2** | Global Express error-handling middleware, registered last — an uncaught route error now returns the same JSON `{error}` shape every other endpoint uses (was Express's default HTML error page) with a structured JSON log line, instead of vanishing with nothing logged anywhere the team would see it during a live pilot session | `api/errorHandler.js`, `index.js` |
| **H1** | `PROGRESS.md`'s transcription-outage write-up corrected to name the real cause (`node:22-slim` missing `ca-certificates`, so `@livekit/rtc-node`'s native Rust engine's HTTPS calls failed deterministically on every attempt) instead of the original "transient region-fetch blip" misdiagnosis; the retry logic stays, reframed as protection against genuine transient failures, not credited with fixing this one | `PROGRESS.md`'s "⚠️ Correction" note, `LESSONS.md`'s Docker entry, `Dockerfile` |
| **M4** | Production image no longer installs the frontend toolchain (Vite, Tailwind, oxlint, Vitest, Supertest, `@types`) — `apps/web` excluded via `.dockerignore`, `npm ci --omit=dev` instead of a bare `npm ci`. Verified with a real `docker build`/`run`: 929MB → 454MB, 244 → 122 packages, `npm audit` 2 high → 0, `/health` still responds correctly | `Dockerfile`, `.dockerignore` |
| **M6/M7** | CORS is now an origin allowlist (was wide open) + helmet security headers on every response. `ALLOWED_ORIGINS` (comma-separated) must be set on Render once the frontend's real origin is known — see `DEPLOYMENT.md`'s secrets checklist. Local Vite dev origins always allowed regardless | `domain/corsConfig.js`, `index.js`, `.env.example`, `DEPLOYMENT.md` |
| **H5** | Custom topic length capped (200 chars) + the topic (and topic-generation's category/difficulty) delimited and explicitly framed as data, not instructions, in both Gemini prompts — defense-in-depth against a student's custom topic hijacking every participant's feedback in the room | `domain/topicText.js`, `domain/feedbackPrompt.js`, `domain/topicPrompt.js`, `api/topics.js` |
| **H4** | Rate-limited the two Gemini-backed routes (topic generation, random matching) — keyed per-user, not IP; wiring confirmed via dedicated route-level tests, not just the limiter in isolation | `api/rateLimit.js`, `api/topics.js`, `api/rooms.js` |
| **H7** | Matchmaking claim is now race-safe — atomic `DELETE...RETURNING` claim + retry loop, `matchmake()` itself untouched/pure. Caught and fixed its own data-loss bug (a partially-claimed member silently dropped) before merge | `domain/matchmakingClaim.js`, `db/matchmakingQueue.js` |
| **H8** | Dropped `room_participants`' client-facing insert policy — any authenticated student could self-seat into any room via a direct PostgREST call, reproduced live before fixing, re-verified blocked after | migration `0011`, `test/roomParticipantsRlsIsolation.test.js` |
| **M1** | Student LiveKit tokens no longer grant `canPublishData` — could forge live-caption data messages attributed to a classmate | `api/rooms.js`, `test/roomsApi.test.js` |
| **M11** | LLM fan-out bounded — worker pool, concurrency 2, order + failure-isolation preserved | `domain/feedbackGeneration.js` |
| **H3** | `durationSeconds` validated (whole seconds, 60–1500 i.e. up to 25min — tightened from an initial 60–3600 by `0010`, a same-day follow-up product decision, not a second bug) at **both** `/api/rooms` and `/api/rooms/match`, plus a schema check constraint | `domain/roomDuration.js`, `api/rooms.js`, migrations `0009`, `0010` |
| **H2** | Graceful SIGTERM/SIGINT shutdown + boot recovery of live rooms, re-dispatching with time **remaining**. Also closes the per-speaker AssemblyAI sockets that were being leaked | `shutdown.js`, `domain/roomRecovery.js`, `agent/roomAgent.js`, `db/rooms.js`, `index.js` |
| **C2** | Vercel serverless handler removed; ADR-0009 records why this app cannot run on a function runtime | `index.js`, `adr/0009-*.md` |
| **C3** | Ended-transition is now a conditional claim, so only one poller dispatches feedback | `db/rooms.js`, `api/rooms.js` |
| **C1** | `rooms.created_by` no longer blocks account deletion | migration `0008` |
| **M3** | `/health/agent` no longer unauthenticated — optional `HEALTH_CHECK_TOKEN` shared-secret gate (falls back to open when unset, so local dev/CI can't break); `keepalive.yml` sends it from a new GH Actions secret | `api/health.js`, `.github/workflows/keepalive.yml` |
| **M5** | Render-sleep mitigation no longer a single unguarded cron — tightened `*/10`→`*/5`, added `curl --retry`. **Not fully closed by code**: true redundancy against GitHub Actions itself being unavailable needs an independent watchdog (free UptimeRobot/cron-job.org) — see §6 | `.github/workflows/keepalive.yml`, `DEPLOYMENT.md` |
| **M8** | Consent version bumped 1→2 + a 5th disclosure added for PostHog analytics — closes the gap where existing students would never be re-asked once `VITE_POSTHOG_KEY` goes live | `domain/consent.js`, `ConsentPage.jsx` |
| **M9** | `LIMIT` added to `listQueue` (500), `listRoomIdsForUser`/`listRoomsByIds` (200), `listTranscriptLinesForRoom` (5000) | `db/matchmakingQueue.js`, `db/roomParticipants.js`, `db/rooms.js`, `db/transcriptLines.js` |
| **L1–L8** | Real `Readme.md`; dead `spike/` (21 files) + `packages/shared` removed; dead `remainingQueue` removed; `recordDispatchSuccess` now correlates `roomId`; LiveKit tokens use display name not raw UUID; L7 folded into the new README; L8 already resolved (verified, no action needed) | `Readme.md`, `domain/matchmaking.js`, `domain/agentWorkerStatus.js`, `api/rooms.js` |

**Note on ordering:** H2 is an audit *Phase 4* item, pulled forward ahead of
Phase 3 by direct instruction. H7 is a *Phase 5* item, pulled forward to run
alongside Phase 3's access-control work per the 2026-07-28 pilot-readiness
roadmap review (a matchmaking race is exactly the failure mode a real pilot
kickoff — several students joining at once — would trigger). The audit's
phase numbering and the order we actually worked in differ — trust this
file.

---

## 5. TO DO — in order

Work top to bottom. Each row is one branch, one PR.

### 5a. Unblock the repo — mostly done as of 2026-07-28, see §2

| ✅ | Task | Owner | Notes |
|---|---|---|---|
| ✅ | Reset `dev` to match `main` | — | Done via an intervening commit before this update; verified in sync 2026-07-28. |
| ✅ | Push the branch stack, open PRs, run `pr-review` on each | — | PRs #4, #5, #6 all merged into `placemestudy1/gd-proto`. |
| ✅ | Decide the frontend host | — | Vercel, decided 2026-07-28. See §2. `_redirects` deleted. |
| ✅ | Land the `LobbyPage` `beforeunload` work | — | Landed in commit `2d2b0ac`, before this update. |
| ✅ | Verify migrations `0008`, `0009`, `0010` are applied live | — | §3. **Confirmed applied, live-tested 2026-07-28** (two rounds: first confirmed all three were missing, user ran them, re-test confirmed all three now enforced) — see §3 for the evidence. |

### 5b. Audit Phase 3 — access control & abuse (next real work)

| ✅ | ID | Task | Owner | Fix per audit |
|---|---|---|---|---|
| ✅ | **H8** | RLS lets any student seat themselves in any room | — | **DONE, PR #9.** See §4. |
| ✅ | **M1** | Student LiveKit tokens grant `canPublishData` | — | **DONE, PR #9.** See §4. |
| ✅ | **H4** | No rate limiting on metered LLM routes | — | **DONE, PR #13.** See §4. |
| ✅ | **H5** | Prompt injection via custom topic | — | **DONE, PR #14.** See §4. Also applied the same delimiting to topic-generation's category/difficulty (not reachable via the current web UI, but the API accepts them directly — same vulnerability class). |
| ✅ | **M6** | Wide-open CORS | — | **DONE, PR #15.** See §4. |
| ✅ | **M7** | No security headers | — | **DONE, PR #15.** See §4. |

### 5c. Audit Phase 4 — make failure visible (H2 already done)

| ✅ | ID | Task | Owner | Fix per audit |
|---|---|---|---|---|
| ✅ | **M2** | No Express error-handling middleware | — | **DONE, PR #17.** See §4. |
| ✅ | **H1** | PROGRESS.md records the wrong root cause for the transcription outage | — | **Already done — this row was just never updated.** `AUDIT.md` itself has carried `Status: RESOLVED 2026-07-28` since it was written; `PROGRESS.md`'s "⚠️ Correction, 2026-07-28" note names the `ca-certificates` cause and clarifies the retry logic covers a genuinely different failure, and `LESSONS.md`'s Docker entry has the full "native addons bypass Node's cert store" lesson. Found and corrected in this doc-sync pass, 2026-07-29. |
| ✅ | **M4** | Docker image ships the whole frontend toolchain | — | **DONE, 2026-07-29.** See §4. |

**Deliberate stopping point, 2026-07-28:** M2 (the only Phase 3-adjacent
item still open at session start) is now done and released to `main`.
M4 and all of Phase 5 below were explicitly held back per direct user
instruction that session ("just do not start phase 4/5") — not forgotten,
not blocked on anything. **H1 turned out to already be done** (see above);
M4 was picked up and finished 2026-07-29. **Phase 4 (H1, H2, M2, M4) is
now fully complete.** Next up per the roadmap: Phase 5 (§5d).

### 5d. Audit Phase 5 — guard what exists, then tidy

**✅ Phase 5 fully complete, 2026-07-29.** M3, M5, M8, M9, and the L-series
were the last open rows in this entire audit-remediation checklist (§5b
through §5d) — every finding from the 2026-07-28 engineering audit is now
either fixed or, for M5's external-watchdog half, explicitly tracked as a
human/dashboard follow-up in §6. Full detail in `PROGRESS.md`.

| ✅ | ID | Task | Owner | Notes |
|---|---|---|---|---|
| ✅ | **H6** | CI never builds or lints the frontend | — | **DONE, 2026-07-29.** New `web` job in `ci.yml` (`npm run lint` + `npm run build` for `@placeme/web`), mirrors the existing `test` job's shape. Verified locally before pushing: both pass (one pre-existing lint warning, unrelated). |
| ✅ | **H7** | Matchmaking is check-then-act with no lock | — | **DONE, PR #11.** See §4. Pulled forward ahead of Phase 5 — see the ordering note in §4. |
| ✅ | **M10** | `GET /status` performs writes | — | **DONE, 2026-07-29.** New periodic sweep (`agent/roomSweeper.js`, on a 3s interval matching the client's existing poll cadence) now owns the ended-transition + feedback dispatch; the route is purely read-only. Verified live: real `docker build`/`run` + a real `docker stop` (SIGTERM) showed clean shutdown in <1s, sweeper included. |
| ✅ | **M3** | `/health/agent` unauthenticated, in-memory only | — | **DONE, 2026-07-29.** See §4. `HEALTH_CHECK_TOKEN` still needs setting on Render + as a GH secret — see §6. |
| ✅ | **M5** | Sleep mitigation rests on one GitHub Actions cron | — | **DONE (partially — see §4/§6), 2026-07-29.** Cron tightened + retry added; a genuine second, non-GitHub watchdog is still a human/dashboard follow-up — see §6. |
| ✅ | **M8** | Consent version not bumped when PostHog was added | — | **DONE, 2026-07-29.** See §4. |
| ✅ | **M9** | Unbounded reads (no `LIMIT`) | — | **DONE, 2026-07-29.** See §4. |
| ✅ | **L1–L8** | README placeholder, dead `spike/` + `packages/shared`, dead `remainingQueue`, discarded `roomId`, raw UUID as LiveKit name, nvm friction | — | **DONE, 2026-07-29.** See §4. |

### 5e. Remaining `AUDIT_COMPARISON_2026-07-29.md` findings + new exception-handling gaps (2026-07-30) — ✅ DONE

Picked up per direct user instruction to make the app pilot-ready and
check exception handling across services. A fresh read of current source
(not the docs) confirmed which of the audit comparison's remaining open
findings are still open, and turned up one new reliability gap the
original audit never flagged: **no process-level `unhandledRejection`/
`uncaughtException` handler anywhere**, plus one uncaught fire-and-forget
call (`roomAgent.js`'s duration-timer dispatch of
`stopTranscriptionForRoom`) that could trigger it and crash the *whole*
process, not just one room. Full writeup in `PROGRESS.md`'s 2026-07-30
entry. **All 8 rows below shipped as 8 small branches/PRs into `dev`
(#46–#53), each TDD RED→GREEN where the change was testable core logic,
each with a `pr-review` pass before merge, in priority order
(reliability/crash-risk first). 337/337 server tests green on `dev`
after all eight, `apps/web` build clean.**

| ✅ | ID | Task | Notes |
|---|---|---|---|
| ✅ | — | Process-level safety net + dangling-promise fixes | **PR #46.** `process.on('unhandledRejection'/'uncaughtException')` via new `processSafetyNet.js`; `.catch()` added to `roomAgent.js`'s two uncaught fire-and-forget calls. RED test reproduced a genuine unhandled rejection before the fix. |
| ✅ | **H4 residual** | Rate-limit `POST /api/topics/custom` | **PR #47.** Wired the existing room-action limiter (not the LLM one — this route doesn't call Gemini). |
| ✅ | **N9** | Gemini key in URL + raw upstream error echoed to students | **PR #48.** Key moved to `x-goog-api-key` header; `/api/topics/generate` now returns a generic message, full detail still logged server-side. |
| ✅ | — | Gemini fetch timeout + retry | **PR #49.** 15s `AbortController` timeout; `domain/retry.js`'s `withRetry` extended with a `shouldRetry` predicate (backward-compatible default) so only 429/5xx/network failures retry, not a permanent 4xx. |
| ✅ | **N11 + N12** | Dev CORS origins allowed in prod + no `trust proxy` | **PR #50.** `DEFAULT_DEV_ORIGINS` gated on `NODE_ENV !== 'production'`; `app.set('trust proxy', 1)` added. |
| ✅ | **N5** | `listParticipants` / `getActiveRoomForUser` still unbounded | **PR #51.** Both bounded (`.limit()`); `listRoomsByIds` found with the identical gap during the sweep and fixed in the same pass. |
| ✅ | **N13** | Caption identity trusts payload body, not LiveKit's authenticated sender | **PR #52.** Not a literal 1:1 of the audit's wording — see the PR for why (the LiveKit sender is always the transcriber relay bot, never the speaking student, so the fix verifies the sender is the trusted relay rather than swapping identity sources outright). |
| ✅ | — | `db/*.js` null-safety consistency | **PR #53.** Also caught and fixed a real `SyntaxError` (duplicate `const data` in one scope, introduced mid-fix) before it reached `dev` — 8 test files would have failed to parse. |

**Deliberately not in this sweep:** wiring `withRetry` around AssemblyAI's
WebSocket connect (currently zero retry, unlike LiveKit) — touches the
live transcription pipeline directly, needs its own real-room
verification pass rather than being folded into a reliability sweep.
**N14** (no late-join, no leave-room path): user decision, 2026-07-30 —
**leave as-is for the pilot**. `PILOT_READINESS.md` already expects a
founder watching every early session who can work around it manually;
not worth the build/test surface before a pilot this size. Documented
here, not built.

---

## 6. Blocked on a human — not code

**Two new rows added 2026-07-29 (later same day, Phase 5 close-out)** —
M3 and M5's dashboard-dependent halves. Everything else below was
already fully cleared earlier the same day; kept in full as the record
of what was checked and how.

**Previously: ✅ Section fully cleared, 2026-07-29.** Every row below is now done —
this table drove an entire session's worth of real-deploy verification,
not just dashboard checkbox-ticking. Kept in full (rather than deleted)
as the record of what was actually checked and how, per this file's own
"PROGRESS.md says why and how it was verified" convention. Summary: a
real, live, healthy deploy already existed (frontend on Vercel, backend
on Render as service `gd-proto-1`) that neither this file nor
`PROGRESS.md` had ever recorded — origin unclear, possibly a teammate.
B1/B3's gaps (CORS, Confirm email) were fixed by the user and re-verified
live. B4 (Render sleep risk) and H2 (boot recovery) were both tested
directly against a real live room and passed. B7's real two-person
walkthrough **caught a real, previously-undetected production bug**: the
live `GEMINI_API_KEY`'s backing Google Cloud service account was
deleted/disabled, so 100% of feedback generation was failing with a 401.
User rotated the key; re-verified directly against Gemini's API (200 OK)
and with a second real room that generated feedback successfully. The
`placeme.study` domain question and the AssemblyAI trial-credit question
were both resolved as direct user decisions, not code changes. Full
detail in `PROGRESS.md`.

| ✅ | ID | Task | Owner | Why it's blocked |
|---|---|---|---|---|
| ✅ | **B1** | Deploy: Render + Vercel + `RENDER_APP_URL` | — | **DONE, 2026-07-29.** Backend live at `https://gd-proto-1.onrender.com` (healthy, tracking `main`, auto-deploy on), frontend live at `gd-proto-web.vercel.app`, `RENDER_APP_URL` set, `ALLOWED_ORIGINS` set and verified working live. |
| ✅ | **B3** | Turn Supabase "Confirm email" back ON | — | **DONE, 2026-07-29.** Re-verified live: `mailer_autoconfirm: false`. |
| ✅ | **B4** | Render free-tier sleep vs. the agent worker | — | **DONE, 2026-07-29 — PASS.** Keepalive workflow deliberately disabled, backend left with zero traffic for 18+ min, then a real room started: `dispatchSuccesses: 1, dispatchFailures: 0`. Render logs showed no restart/cold-boot during the idle window at all — the process stayed continuously up, more reassuring than ADR-0007's assumption. Keepalive workflow re-enabled immediately after the test. |
| ✅ | **B7** | Guardrail #1 human gate for the UI/live-room/flows work | — | **DONE, 2026-07-29.** Two real people, two real devices, a real room on the deployed stack (`gd-proto-web.vercel.app`), real conversation. Transcription and speaker attribution both confirmed correct by the user. **Also caught a real bug** — see the Gemini key incident above/in `PROGRESS.md` — fixed and re-verified with a second live room before calling this done. |
| ✅ | — | `placeme.study` custom domain points at a *different* Vercel project (`waitlist`) | — | **Confirmed intentional with the user, 2026-07-29** — pre-launch landing page, not a misconfiguration. `gd-proto-web.vercel.app` is the correct URL for the app until public launch. |
| ✅ | — | Exercise H2's recovery path against a genuinely live room | — | **DONE, PASS, 2026-07-29.** Real room started, service restarted mid-discussion (`render restart`): logs show the new instance's boot recovery re-attached the room with time remaining within 2 seconds of boot, while the old instance's own shutdown log (stopping its transcription) arrived in the same log window — no gap. Both participants confirmed the final transcript was complete despite the restart and a page reload mid-session. One transient artifact noted, not a bug — see `PROGRESS.md`. |
| ✅ | — | Revoke the old `DEEPGRAM_API_KEY` in the Deepgram dashboard | — | **DONE, 2026-07-29** — user deleted it from the Deepgram dashboard. Already removed from `.env` (S2, pilot-readiness pass); now fully dead. |
| ✅ | — | AssemblyAI trial credit will run out | — | **DECIDED, 2026-07-29** — open a fresh trial account rather than add a card, per direct user instruction. See ADR-0002's "Payment decision — RESOLVED" section. Nothing to action until the current $50 credit is actually spent. |
| ☐ | **M3** | Set `HEALTH_CHECK_TOKEN` on the live Render service **and** as a GitHub Actions repo secret | — | Optional — `/health/agent` stays open (previous behavior) until this is set. Needs Render + GitHub dashboard access. See `DEPLOYMENT.md`'s secrets checklist and §3. |
| ✅ | **M5** | Sign up for a free UptimeRobot/cron-job.org monitor pinging `GET /health`, independent of GitHub Actions | — | **DONE, 2026-07-31.** Repository owner set up an independent UptimeRobot monitor, closing the single-point-of-failure gap named in the audit. See `DEPLOYMENT.md`. |
| ✅ | **N8** | Add `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions repo secrets (Settings → Secrets and variables → Actions) | — | **DONE, 2026-07-31.** Set via `gh secret set` from the values already in `apps/server/.env` (values never printed), confirmed present via `gh secret list --repo placemestudy1/gd-proto`. `rls-security`'s real (non-skipped) execution to be confirmed on the next CI run. |

---

## 7. Suggested split for two people

The two tracks below barely touch the same files, so you can work them in
parallel without stepping on each other:

- **Track A — server hardening (§5b + M2):** `api/`, `index.js`, `domain/`.
  Mostly offline-testable, TDD-shaped, no dashboard needed.
- **Track B — infra, record & cleanup (§5a leftovers, H6, M4, L1):** CI, Docker,
  docs, the frontend-host decision. Unblocks Track A's PRs and the deploy.

**Do not both take H8 and M1** — both need the same live DB / live room
re-check, and they're easiest to verify in one session together.
