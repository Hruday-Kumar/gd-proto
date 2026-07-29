# PLAN — audit remediation & road to pilot

**Last updated:** 2026-07-29 (Phase 5 close-out — M3, M5, M8, M9, and the
L-series all done; §4/§5d/§6 updated. This is the last open work from the
2026-07-28 audit. See `PROGRESS.md` for the session record.)

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
npx vitest run --root apps/server    # 247 tests, all must pass
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

---

## 4. DONE ✅

Audit findings closed, newest first. Evidence and root causes are in
`PROGRESS.md`; the code is on the branch stack in §2.

| ID | What | Where |
|---|---|---|
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
| ☐ | **M5** | Sign up for a free UptimeRobot/cron-job.org monitor pinging `GET /health`, independent of GitHub Actions | — | Not a blocker (the GH Actions cron already works, per B4's real test) — but the single-point-of-failure gap named in the audit stays open until this exists. Needs a dashboard account. See `DEPLOYMENT.md`. |

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
