# PLAN — audit remediation & road to pilot

**Last updated:** 2026-07-28

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
npx vitest run --root apps/server    # 191 tests, all must pass
npx oxlint apps/server/src           # 1 known pre-existing warning (L5)
npm run build --workspace=apps/web   # must build clean
```

---

## 2. Repo state right now — ⚠️ read before branching

### The branch stack

All audit remediation so far is **stacked on one chain and none of it is
pushed or merged.** 11 commits, 6 findings fixed:

```
origin/main ─── = local dev (22871fd)
                   └── chore/c2-remove-vercel-serverless-handler   [C1, C3, C2, AUDIT.md]
                         └── fix/h2-graceful-shutdown-boot-recovery [H2, H3, M11, docs]  <- HEAD
```

### Three hazards, in order of how easily they bite

1. **`origin/dev` is 3 commits BEHIND `origin/main`.** The `dev` → `main`
   release happened (PRs #1, #3) but step 6c of `BRANCHING.md` — hard-resetting
   `dev` to `main` — was never done. **If you branch off `origin/dev` you will
   silently miss the `ca-certificates` Docker fix**, without which LiveKit's
   native engine fails TLS in the container. Fix once, before anyone branches:
   `git checkout dev && git reset --hard origin/main && git push origin dev --force-with-lease`
2. **Nothing above is on the remote.** Both task branches are local-only, and
   no PRs are open. Until they're pushed, the other person cannot see six
   fixes and will re-diagnose bugs that are already solved.
3. **Uncommitted work sits in the working tree** (audit L8) and is invisible
   to everyone else:
   - `apps/web/src/pages/LobbyPage.jsx` — a real `beforeunload` guard warning
     a student before they refresh out of a live session. **Untracked feature
     work, deliberately left alone by the audit sessions.** Needs an owner,
     a branch and a test.
   - `apps/web/vercel.json` + `apps/web/public/_redirects` — SPA-routing
     configs for **two different frontend hosts at once**. See M12: ADR-0007
     chose Cloudflare Pages, ADR-0009 confirmed the backend is Render-only.
     Someone must decide the frontend host and delete the loser.

---

## 3. Migration status (Supabase — manual SQL Editor step)

| Migration | Applied to live project? | Notes |
|---|---|---|
| `0001`–`0006` | ✅ Yes | Confirmed in earlier sessions |
| `0007_feedback_rating.sql` | ✅ **Yes — verified live 2026-07-28** | `feedback.rating` present. PROGRESS.md's old "PR #54 held, don't merge" warning is **stale**; the code shipped and the column exists. |
| `0008_rooms_created_by_on_delete_set_null.sql` | ❓ **Unverified** | Written for C1. Someone must confirm and record it here. **Account deletion (DPDP, guardrail #4) stays broken until it runs.** |
| `0009_rooms_duration_seconds_bounds.sql` | ❌ **No** | Written 2026-07-28 for H3. Defence in depth only — the route validation is already live in code, so this is not a merge blocker. |

---

## 4. DONE ✅

Audit findings closed, newest first. Evidence and root causes are in
`PROGRESS.md`; the code is on the branch stack in §2.

| ID | What | Where |
|---|---|---|
| **M11** | LLM fan-out bounded — worker pool, concurrency 2, order + failure-isolation preserved | `domain/feedbackGeneration.js` |
| **H3** | `durationSeconds` validated (whole seconds, 60–3600) at **both** `/api/rooms` and `/api/rooms/match`, plus a schema check constraint | `domain/roomDuration.js`, `api/rooms.js`, migration `0009` |
| **H2** | Graceful SIGTERM/SIGINT shutdown + boot recovery of live rooms, re-dispatching with time **remaining**. Also closes the per-speaker AssemblyAI sockets that were being leaked | `shutdown.js`, `domain/roomRecovery.js`, `agent/roomAgent.js`, `db/rooms.js`, `index.js` |
| **C2** | Vercel serverless handler removed; ADR-0009 records why this app cannot run on a function runtime | `index.js`, `adr/0009-*.md` |
| **C3** | Ended-transition is now a conditional claim, so only one poller dispatches feedback | `db/rooms.js`, `api/rooms.js` |
| **C1** | `rooms.created_by` no longer blocks account deletion | migration `0008` |

**Note on ordering:** H2 is an audit *Phase 4* item, pulled forward ahead of
Phase 3 by direct instruction. The audit's phase numbering and the order we
actually worked in differ — trust this file.

---

## 5. TO DO — in order

Work top to bottom. Each row is one branch, one PR.

### 5a. Unblock the repo (do this first — it costs minutes and blocks everyone)

| ✅ | Task | Owner | Notes |
|---|---|---|---|
| ☐ | Reset `origin/dev` to `origin/main` | — | §2 hazard 1. Do before anyone branches. |
| ☐ | Push the branch stack, open PRs, run `pr-review` on each | — | §2 hazard 2. Six fixes are invisible until this happens. |
| ☐ | Verify migration `0008` is applied | — | §3. Account deletion is broken until it is. |
| ☐ | Decide the frontend host; delete `vercel.json` **or** `public/_redirects` | — | M12. ADR-0007 says Cloudflare Pages. |
| ☐ | Branch + test + land the `LobbyPage` `beforeunload` work | — | L8. Real feature sitting untracked. |

### 5b. Audit Phase 3 — access control & abuse (next real work)

| ✅ | ID | Task | Owner | Fix per audit |
|---|---|---|---|---|
| ☐ | **H8** | RLS lets any student seat themselves in any room | — | Drop the client insert policy on `room_participants` — every real seat is written by the service-role client. Re-run `test/historyRlsIsolation.test.js`. **Needs a live DB re-check.** |
| ☐ | **M1** | Student LiveKit tokens grant `canPublishData` | — | Pass `canPublishData: false` for student tokens (`api/rooms.js:80`). Lets any student forge captions attributed to a classmate. **Needs a live re-check.** |
| ☐ | **H4** | No rate limiting on metered LLM routes | — | `express-rate-limit` keyed on `req.userId`, strictest on the two Gemini routes. |
| ☐ | **H5** | Prompt injection via custom topic | — | Cap topic length (~200 chars), delimit untrusted spans, instruct the model to treat the topic as data. |
| ☐ | **M6** | Wide-open CORS | — | Origin allowlist. |
| ☐ | **M7** | No security headers | — | `helmet`. |

### 5c. Audit Phase 4 — make failure visible (H2 already done)

| ✅ | ID | Task | Owner | Fix per audit |
|---|---|---|---|---|
| ☐ | **M2** | No Express error-handling middleware | — | Error handler + structured logging; every route is `async` with no try/catch. |
| ☐ | **H1** | PROGRESS.md records the wrong root cause for the transcription outage | — | Name the CA-certificate cause; note the retry covers a *different* failure. Add the "native addons don't use Node's cert store" lesson to `LESSONS.md`. |
| ☐ | **M4** | Docker image ships the whole frontend toolchain | — | Production-only deps; directly worsens the B4 cold-start risk. |

### 5d. Audit Phase 5 — guard what exists, then tidy

| ✅ | ID | Task | Owner | Notes |
|---|---|---|---|---|
| ☐ | **H6** | CI never builds or lints the frontend | — | Two lines in `ci.yml`; protects half the product. Do early — it's nearly free. |
| ☐ | **H7** | Matchmaking is check-then-act with no lock | — | `SELECT … FOR UPDATE SKIP LOCKED` or an advisory lock. Keep `matchmake()` pure. |
| ☐ | **M10** | `GET /status` performs writes | — | Still open — C3 made the write *conditional*, but it's still a GET with side effects. |
| ☐ | **M3** | `/health/agent` unauthenticated, in-memory only | — | Leaks `roomId` + raw error text; always reports healthy after a restart. |
| ☐ | **M5** | Sleep mitigation rests on one GitHub Actions cron | — | Best-effort, auto-disabled after 60 days idle, currently no-ops. |
| ☐ | **M8** | Consent version not bumped when PostHog was added | — | Inert while `VITE_POSTHOG_KEY` is unset; **a DPDP problem the moment it's set.** |
| ☐ | **M9** | Unbounded reads (no `LIMIT`) | — | Harmless at pilot scale, degrades as history grows. |
| ☐ | **L1–L8** | README placeholder, dead `spike/` + `packages/shared`, dead `remainingQueue`, discarded `roomId`, raw UUID as LiveKit name, nvm friction | — | Cleanup. L1 (README) is the cheapest real win. |

---

## 6. Blocked on a human — not code

These cannot be finished by working in the repo. They are the actual
remaining distance to real students in a live room.

| ✅ | ID | Task | Owner | Why it's blocked |
|---|---|---|---|---|
| ☐ | **B1** | Deploy: Render Blueprint + Cloudflare Pages + `RENDER_APP_URL` | — | Needs dashboard access. `render.yaml` is ready. |
| ☐ | **B3** | Turn Supabase "Confirm email" back ON | — | Dashboard toggle. Off since W2 testing — anyone can sign up as anyone. |
| ☐ | **B4** | Render free-tier sleep vs. the agent worker | — | **Highest technical risk.** Needs B1 first: idle >15 min, then start a room and confirm it still gets a transcription agent. |
| ☐ | **B7** | Guardrail #1 human gate for the UI/live-room/flows work | — | Needs real multiple humans on real devices. Everything so far is solo/headless. |
| ☐ | — | Exercise H2's recovery path against a genuinely live room | — | Start a room, restart the server mid-discussion, confirm transcription resumes. The 2026-07-28 live check confirmed shutdown + the boot scan, but there were no live rooms to re-attach. |
| ☐ | — | Revoke the old `DEEPGRAM_API_KEY` in the Deepgram dashboard | — | Removed from `.env`; the key itself is still live. |
| ☐ | — | AssemblyAI trial credit will run out | — | Card vs. fresh trial account — deferred product decision (ADR-0002). |

---

## 7. Suggested split for two people

The two tracks below barely touch the same files, so you can work them in
parallel without stepping on each other:

- **Track A — server hardening (§5b + M2):** `api/`, `index.js`, `domain/`.
  Mostly offline-testable, TDD-shaped, no dashboard needed.
- **Track B — infra, record & cleanup (§5a, H6, M4, H1, L1):** CI, Docker,
  docs, the frontend-host decision. Unblocks Track A's PRs and the deploy.

**Do not both take H8 and M1** — both need the same live DB / live room
re-check, and they're easiest to verify in one session together.
