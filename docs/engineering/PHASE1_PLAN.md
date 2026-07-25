# Phase 1 — Build Plan (GD Arena Multiplayer)

**Created:** 2026-07-25 · **Status:** Not started
**Prerequisite:** Phase 0b complete — all 8 ADRs Accepted (`docs/engineering/adr/`).

This is the durable plan for Phase 1. It exists so any session can pick up
the build from docs rather than conversation memory. It does not restate the
ADRs — read `adr/0001`–`adr/0008` Decision + Consequences sections before
building; several carry nuance this plan only references.

**How to use this file:** work top-to-bottom. Pre-flight (§2) gates
everything. Workstreams (§5) are ordered by dependency, and per guardrail #9
you do **one workstream's core units at a time**, not several in parallel.
Update `PROGRESS.md` at the end of every session, and tick the checkboxes
here as you go.

---

## 1. What Phase 1 ships

The v1 MVP boundary from `CLAUDE.md`, nothing more:

> Student accounts · GD Arena **Multiplayer only** · LLM-generated topics +
> custom topic entry · random matching **and** shareable room code/link ·
> live audio room with topic + timer · per-speaker transcription +
> attribution · individual written feedback per student · per-student
> session history.

Feedback format is fixed by the product doc (`PlaceMe_Product_Context_v2.md`
§A): **a plain readable paragraph — no numeric scores, no charts** —
answering did they speak clearly, did they stay on topic, did they let
others speak. Constructive, never discouraging.

**Explicitly not in Phase 1** (deferred, named so they aren't silently
skipped): AI Voice Practice mode, JAM, Aptitude/Technical, Roleplay
Interviews, Drive Simulator, payments, notifications, analytics, advanced
observability.

---

## 2. Pre-flight — must happen before any product code

These are carried over from `PROGRESS.md`'s "What's next" and treated here
as gates, not suggestions.

- [x] **P1. Delete the old exposed Deepgram + LiveKit API keys.** Confirmed
      done by the user 2026-07-25 — old keys deleted from both dashboards.
- [x] **P2. AssemblyAI smoke test** (ADR-0002 Consequences). **PASS, run
      twice, 2026-07-25.** Built `spike/selftest-assemblyai.js` +
      `spike/src/assemblyai.js` + `spike/src/transcriber-assemblyai.js`
      (parallel to the Deepgram path, which is untouched and stays the
      documented fallback). Per-speaker attribution correct with no
      leakage both runs; finalization latency ~0.1–0.4s after audio ends,
      matching the Deepgram spike baseline (~0.1–0.7s). One real gotcha
      hit and fixed: AssemblyAI's v3 endpoint requires each audio message
      to carry 50–1000ms of audio (Deepgram has no minimum) — LiveKit's
      ~10ms frames must be buffered before sending. Documented in
      `LESSONS.md`. This is only a *smoke test*, not guardrail #1's human
      gate — W5 still needs multiple real humans confirming attribution in
      a live room before shipping.
- [ ] **P3. Accounts + keys provisioned:** Supabase project (auth + Postgres,
      ADR-0003/0004), AssemblyAI, Google AI Studio (Gemini), Render,
      Cloudflare Pages. All free-tier, no card (except the AssemblyAI trial
      credit situation already documented in ADR-0002).
- [ ] **P4. Render keep-alive verification** (ADR-0007 "Revisit if").
      Deploy a placeholder service, let it sit quiet past 15 minutes,
      confirm the GitHub Actions ping keeps it awake **and** that a LiveKit
      job dispatched right after a quiet period still gets an agent.
      *Not blocking for local development* — can run in parallel with W1–W3
      — but blocking before anything is put in front of real students.

---

## 3. Architecture at a glance

```
Browser (React + Vite)                    Cloudflare Pages
  │  Supabase JS  ── auth ──────────────► Supabase Auth
  │  LiveKit JS SDK ── audio ───────────► LiveKit Cloud
  │  REST + token requests
  ▼
Express 5 API  ─┐
                ├── ONE Node process, ONE container ──► Render (free)
LiveKit Agent  ─┘
  worker
  │  subscribes per-participant track
  ├──────────────────► AssemblyAI streaming WS (one connection per speaker)
  ├──────────────────► Supabase Postgres (transcript lines, sessions)
  └──────────────────► Gemini API (topics, feedback)
```

### 3a. Finding: the API and the agent worker must be ONE Render service

ADR-0007 chose Render's free tier and noted 750 free instance-hours/month.
A single always-on service consumes ~720h/month — **two** always-on
services would need ~1,440h and blow the free allowance. Since the agent
worker must stay continuously connected (ADR-0007 Context: a disconnected
worker means no agent joins the room, i.e. transcription silently never
starts), and the API must be reachable, **both run in a single Node process
in a single container**.

Practically: `server.js` starts Express *and* registers the LiveKit agent
worker at boot. The spike keeps these separate (`server.js` / `agent.js`) —
Phase 1 merges them. Keep the modules separate in source; only the entry
point is shared, so they can be split into two services trivially the day
there's budget for it.

### 3b. Raw audio never touches disk

Guardrail #4 says delete raw audio immediately after transcription. The
architecture makes this stronger and simpler: audio is streamed from the
LiveKit track straight into the AssemblyAI socket and **never written to
disk or to the database at all**. There is no audio table, no storage
bucket, no deletion job to get wrong. State this in the consent copy and
verify it in review — the guardrail is satisfied by construction, and the
test for it is "no code path writes audio bytes anywhere persistent."

---

## 4. Repo structure & data model

### Repo layout (decision: fresh app, spike frozen as reference)

`spike/` is prototype code that served its purpose. Don't evolve it in
place — freeze it, and port the proven modules into a clean structure:

```
apps/
  web/            React + Vite frontend        → Cloudflare Pages
  server/         Express 5 API + LiveKit agent worker → Render (one Docker image)
    src/
      api/        routes (auth-gated)
      agent/      LiveKit worker + AssemblyAI transcriber
      domain/     pure logic — the tests-first core
      db/         Supabase client + queries
packages/
  shared/         types shared between web and server (topic/session shapes)
spike/            FROZEN — reference only, do not extend
Dockerfile        builds apps/server
```

Worth porting from the spike (already proven): `src/transcriber.js`
per-track subscribe loop, `src/token.js` token minting, `src/wav.js` audio
framing, and the `selftest.js` bot-driven test harness — that harness is
reusable as an automated regression test for the whole room pipeline, which
is unusually valuable given how hard rooms are to test manually.

### Data model (Supabase Postgres, ADR-0004)

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | student identity | 1:1 with `auth.users`; display name |
| `consents` | recorded consent events | `user_id`, `granted_at`, **`consent_version`** — versioned so the Gemini disclosure (§5.2) is a new version requiring re-consent, not a silent edit |
| `topics` | generated + custom topics | `text`, `category`, `difficulty`, `source: llm\|custom` |
| `rooms` | a GD session | `code` (unique), `topic_id`, `duration_seconds`, `status: waiting\|live\|ended`, `join_mode: code\|random`, timestamps |
| `room_participants` | who was in the room | `room_id`, `user_id`, **`livekit_identity`** — the join key that makes attribution work end-to-end |
| `transcript_lines` | attributed speech | `room_id`, `user_id`, `text`, `started_at_ms`, `ended_at_ms` |
| `feedback` | per-student paragraph | `room_id`, `user_id`, `body`, `model`, `generated_at` |

**No audio table by design** (§3b). **RLS on every table** — "a student can
access only their own history" (guardrail #4) is enforced by Postgres row
level security, not by remembering to filter in application code. Treat the
RLS policies as core logic and test them with two real users (§5.8).

---

## 5. Workstreams

Ordered by dependency. Each names its **core** units (tests-first, per
pragmatic TDD) vs **peripheral** (tests before "done") — TEAM.md #4 asks for
this split to be explicit per feature rather than left to judgement.

### W1 — Foundation & scaffolding ✅ DONE 2026-07-25
Monorepo layout, Vite app, Express 5 app (**5.x, not 4.x** — ADR-0005),
Supabase client wiring, Dockerfile, test runner, CI. Merge the spike's
server + agent entry points per §3a.
- **Core:** none — this is setup.
- **Peripheral:** a smoke test that boots the server and hits `/health`.
- **Done when:** `docker build` succeeds locally and the container serves
  `/health`; `npm test` runs green in CI.

**Status:** Built exactly per §4's repo layout — `apps/web` (React 19 +
Vite, via `npm create vite`), `apps/server` (Express 5.2, `src/index.js`
exports `createApp()` for tests + boots via `startAgentWorker()` stub —
real per-track logic deferred to W5 per its own header comment),
`packages/shared` (placeholder, empty until a workstream needs a shared
shape). `apps/server/src/db/supabase.js` wires a lazy Supabase client
(throws only if actually called without env vars — doesn't block boot
before P3 provisions the account). Test runner: Vitest + Supertest (new —
see `LESSONS.md`), one smoke test on `/health`. `Dockerfile` at repo root
builds `apps/server` (`COPY . .` then `npm ci` — see `LESSONS.md`'s Docker
entry for why, not a selective workspace copy). **Verified locally, not
just written:** `docker build` succeeded, a container from that image
served `{"status":"ok"}` on `/health`, and `npm test --workspace=@placeme/
server` passed. `.github/workflows/ci.yml` added (test job + a docker-build
job) — not yet observed green on GitHub itself since nothing's been pushed
this session. `spike/` untouched, left as reference per §4.

### W2 — Accounts (ADR-0003)
Supabase Auth signup/login/logout, `profiles` row on signup, Express
middleware that verifies the Supabase JWT on every protected route, React
auth context + protected routes.
- **Core (tests-first):** the JWT verification middleware — rejects missing,
  malformed, expired, and wrong-signature tokens; attaches `user_id` on
  success. This is the gate every other feature sits behind; get it wrong
  and every guardrail about "own history only" collapses.
- **Peripheral:** login/signup UI, session persistence.
- **Done when:** a logged-out request to any protected route is rejected in
  a test, and a real signup→login→refresh cycle works in the browser.

### W3 — Consent (guardrail #3 — hard gate)
A recorded, versioned consent flow shown **before any mic is ever enabled**.
- **The consent copy must disclose all of:** microphone capture; that audio
  is transcribed and the raw audio is never stored (§3b); that the
  transcript is retained until account deletion; **and that transcripts are
  processed by Google's Gemini API under its free-tier terms, where prompts
  may be used to improve Google's products and human reviewers may see
  them** (ADR-0008, decided 2026-07-25 — this disclosure is *required*, not
  optional; shipping feedback without it violates guardrail #3).
- **Core (tests-first):** `canEnableMic(user)` / the consent gate — returns
  false without a consent record, false when the stored `consent_version` is
  older than the current one, true only on a current recorded consent. Every
  LiveKit token mint must call it.
- **Peripheral:** consent UI screen, copy rendering.
- **Done when:** an automated test proves no LiveKit token is issued without
  a current consent record, and a human walks the flow and confirms the copy
  is understandable (not just legally present).

### W4 — Topics + rooms + matching
Gemini topic generation by category/difficulty (ADR-0008 — confirm the
current free-tier model at build time rather than hardcoding a version from
the ADR), custom topic entry, room creation with a shareable code/link, and
random matching.
- **Core (tests-first):**
  - room code generation — format, collision handling on retry;
  - **the matchmaking function** — pure: given the current queue and a
    joiner, return the assignment. Keep the decision logic pure and the
    storage separate so it's testable without a live queue;
  - the session state machine — `waiting → live → ended`, with the
    **timer server-authoritative** (the server decides when a session ends,
    not any client — clients disagree, and the agent needs a single truth
    for when to stop transcribing).
- **Peripheral:** Gemini client wrapper, topic-picker UI, lobby UI.
- **Open decision for this workstream:** where the matchmaking queue lives.
  In-memory is simplest but is lost on Render restart/sleep (§3a risk);
  a DB-backed queue survives restarts at the cost of polling. At pilot
  scale a DB-backed queue is the safer default — decide and record it in
  this file when you build it.
- **Done when:** two browser sessions can join the same room both by code
  and by random matching, and the timer ends the session for everyone at
  the same moment.

### W5 — Live room + transcription + attribution ⚠️ highest risk
The LiveKit room joined with a server-minted token (gated on W2 + W3), the
agent worker subscribing per participant track, AssemblyAI streaming per
speaker, transcript lines persisted attributed to the right `user_id`.
- **Blocked by pre-flight P2** — do not start until the AssemblyAI smoke
  test passes.
- **Core (tests-first):** the **attribution mapping** — LiveKit identity →
  `room_participants.user_id` → `transcript_lines.user_id`. Attribution is
  structural (one track = one participant, proven in Phase 0a) but the
  *mapping to our own user IDs* is our code and is exactly where a silent
  bug would put one student's words under another's name. Test it directly.
- **Peripheral:** the AssemblyAI WebSocket client (validated by the smoke
  test), caption UI.
- **Regression harness:** adapt `spike/selftest.js` so the whole pipeline
  can be re-verified with bots and zero humans on every change. Given how
  expensive multi-person manual testing is, this is worth the effort.
- **Done when:** guardrail #1's gate is met — **multiple real people** in a
  real room on real devices, confirming speech is attributed to the correct
  speaker. Automated tests alone cannot close this workstream.

### W6 — Feedback generation
On session end, generate one plain-paragraph feedback per student from the
session transcript.
- **Blocked by W3's consent-copy update** (ADR-0008) — the disclosure must
  ship *before* the first transcript is sent to Gemini, not alongside it.
- **Core (tests-first):** **prompt assembly** — given a session's transcript
  lines, build that one student's prompt. Two properties to test hard:
  (a) it includes enough group context to judge "did they let others speak,"
  (b) **it never produces or exposes another student's feedback**. Also test
  the failure path: a Gemini error must not lose the transcript or block the
  other students' feedback.
- **Peripheral:** Gemini client, feedback display UI.
- **Done when:** a human reads real generated feedback and confirms it is
  useful **and non-discouraging** (guardrail #1 names this explicitly —
  tone is a correctness property here, not polish).

### W7 — Session history
Per-student list of past sessions with topic, date, and their own feedback.
- **Core (tests-first):** the own-history-only guarantee — an integration
  test with **two real users** proving user A cannot read user B's sessions,
  transcript lines, or feedback, exercised through RLS rather than trusting
  an application-level `where` clause.
- **Peripheral:** history list and detail UI.
- **Done when:** the two-user isolation test passes and history renders.

### W8 — Deploy & operate
Cloudflare Pages for the frontend, Render for the single backend container,
GitHub Actions keep-alive ping (ADR-0007), secrets configured per
environment.
- **Add:** basic monitoring/alerting on the **agent worker's connection
  status** — ADR-0007's Consequences flags this explicitly, because a
  disconnected worker fails *silently*: the room works, students talk, and
  nothing is transcribed. A dead worker must be noticeable without a student
  reporting it.
- **Done when:** the deployed stack passes a full end-to-end run with real
  people, including a session started right after a >15-minute quiet period.

---

## 6. Timeline

The fixed constraint is **~2–4 weeks to real students in a live room**. That
is the commitment; this is the shape of it, not a new estimate.

| When | Work | Gate at the end |
|---|---|---|
| **Days 1–3** (pre-flight) | P1 key deletion, P2 AssemblyAI smoke test, P3 accounts, W1 scaffolding | Container builds; AssemblyAI attribution reconfirmed |
| **Week 1** | W2 accounts, W3 consent, W4 topics/rooms/matching | Two students can get into the same room together |
| **Week 2** | W5 live room + transcription + attribution | **Guardrail #1 human gate: multiple real people, correct attribution** |
| **Week 3** | W6 feedback, W7 history | A human confirms feedback is useful and non-discouraging |
| **Week 4** | W8 deploy, P4 keep-alive verification, end-to-end hardening | Real students, deployed, end to end |

**Critical path:** pre-flight P2 → W5 → W6. Everything else (accounts,
consent UI, topics, history, deploy config) can move around it. If time
compresses, protect W5 and W6 and let polish slip — those two are the
product.

**Where this slips, honestly:**
1. **W5 is the only workstream touching genuinely unfamiliar territory.**
   Phase 0a de-risked it — the same architecture already ran end-to-end with
   real humans — but it ran against Deepgram, and the vendor swap is
   unvalidated until P2 passes. If P2 surfaces a regression, ADR-0002's
   "Revisit if" applies and Deepgram is the working fallback; budget a few
   days, not a rewrite.
2. **W6 tone quality is not a code problem.** Getting feedback that reads as
   useful and non-discouraging is prompt iteration with a human in the loop,
   and iterations are slow because each one needs a real session's
   transcript. Start collecting real transcripts in W5 so W6 has material.
3. **Matchmaking (W4) is deceptively fiddly** — it's the only stateful,
   concurrent thing in the product. The queue-storage decision above is
   worth making deliberately rather than discovering under time pressure.
4. Weeks 1, 3, and 4 are mostly standard CRUD, API wiring, and UI — the
   parts an agent-assisted team moves fastest on.

---

## 7. Definition of done for Phase 1

- [ ] A student can sign up, log in, and see only their own data.
- [ ] No mic is ever enabled without current recorded consent, and the
      consent copy discloses Gemini free-tier processing.
- [ ] Students can join a room by code/link **and** by random matching.
- [ ] A live audio room runs with a topic and a server-authoritative timer.
- [ ] Every transcript line is attributed to the correct student —
      **confirmed by multiple real humans in a real room** (guardrail #1).
- [ ] Each student receives their own written feedback paragraph, confirmed
      by a human as useful and non-discouraging (guardrail #1).
- [ ] Each student can see their own session history, and only their own.
- [ ] No raw audio is persisted anywhere (guardrail #4).
- [ ] Deployed on Render + Cloudflare Pages, keep-alive verified, agent
      worker connection monitored.
- [ ] `LESSONS.md` has an entry for every new library/service introduced
      (guardrail #11) and `PROGRESS.md` reflects final state.

---

## 8. Open decisions to make during the build

Recorded here so they're made deliberately and written down, not discovered
late. Update this section with the answer when each is decided.

1. **Matchmaking queue storage** — in-memory vs. DB-backed (W4). Leaning
   DB-backed for restart-survival on Render's free tier.
2. **AssemblyAI trial credit exhaustion** — card vs. fresh trial account.
   Explicitly deferred by the user on 2026-07-25 (ADR-0002); decide when the
   credit actually runs low, not before.
3. **Gemini paid tier for feedback** — currently free tier with disclosure
   (ADR-0008). Revisit once there's funding; the disclosure requirement
   disappears on the paid tier.
4. **Render Starter ($7/mo)** — eliminates the sleep risk entirely
   (ADR-0007). The first thing to buy when there's any budget.
