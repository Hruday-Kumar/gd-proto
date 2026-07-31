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

Feedback format is fixed by the product doc (`PRODUCT_CONTEXT.md`
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

### W2 — Accounts (ADR-0003) ✅ DONE 2026-07-26
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

**Status:** Real Supabase project provisioned (`uiqshhuiykwopqkrvyci
.supabase.co`). **Core, tests-first:** `apps/server/src/domain/
verifyToken.js` verifies asymmetrically against the project's JWKS (per
Supabase's own current recommendation — see `LESSONS.md`'s Supabase entry
for why, not the legacy shared-secret approach), using `jose`. 5 offline
tests (`test/verifyToken.test.js`) cover missing/malformed/expired/
wrong-signature/valid, all signed with a locally generated keypair — no
network call, no live Supabase project needed to run `npm test`.
`apps/server/src/api/authMiddleware.js` wraps it as Express middleware;
`GET /api/me` is the first protected route, with its own integration test
(`test/authMiddleware.test.js`) proving an unauthenticated request is
rejected. **Peripheral:** `apps/web` got `AuthContext` (supabase-js +
React context), `ProtectedRoute`, and Login/Signup/Home pages wired via
`react-router-dom`. DB: `supabase/migrations/0001_profiles.sql` (profiles
table, RLS scoped to own row, an `on_auth_user_created` trigger so a
profile is created automatically — no app code has to remember that step)
— run manually via the Supabase SQL Editor (no CLI/migration tooling
wired up yet, tracked as a possible future gap in `LESSONS.md`).
**Verified for real, end-to-end, twice:** (1) scripted — real signup,
login, and refresh-token calls directly against Supabase's Auth REST API,
each resulting access token successfully verified by the running
`apps/server`, and a `profiles` row confirmed present via a live,
RLS-scoped query; (2) a human (the user) walked signup → login → page
refresh in an actual browser against both dev servers and confirmed the
session survives a refresh. One real-world snag hit along the way: an
already-created user's `email_not_confirmed` state doesn't clear
retroactively when "Confirm email" is toggled off in the dashboard — only
new signups are affected. Documented in `LESSONS.md`.

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

**Status: ✅ DONE, 2026-07-26.** `supabase/migrations/0002_consents.sql` adds the `consents`
table (own-row RLS, insert-only — a consent event is immutable, a new
version is a new row, never an edit). **Core, tests-first:**
`apps/server/src/domain/consent.js` — `canEnableMic(latestConsent,
currentVersion = CURRENT_CONSENT_VERSION)`, pure, false with no record or a
stale `consent_version`, true only on current
(`test/consent.test.js`). Since the real LiveKit token-mint route doesn't
exist until W5, the "every mint must call it" requirement is satisfied as
composable Express middleware now — `createConsentGate()` in
`apps/server/src/api/consentGate.js`, proven against a stub route in
`test/consentGate.test.js` (403 with no/stale consent, 200 with current);
W5 mounts this in front of the real mint route when it's built.
`GET /api/consent/status` and `POST /api/consent`
(`apps/server/src/api/consent.js`, `apps/server/src/db/consents.js`) let a
student check and record consent, tested in `test/consentApi.test.js` with
`requireAuth` stubbed (network-free, matching the pattern already used for
`/api/me`). **Peripheral:** `apps/web`'s `/consent` route
(`ConsentPage.jsx` + `useConsentStatus.js`) renders all four required
disclosures verbatim and posts agreement; linked from `HomePage` so it's
reachable to walk manually. **Guardrail #1 satisfied:** the user ran
`0002_consents.sql` in the Supabase SQL Editor, then walked signup →
`/consent` → read the copy → agreed → confirmed the page reflects
"Consent recorded" on revisit. **One real bug surfaced and fixed along the
way, unrelated to the consent logic itself:** `@supabase/supabase-js`
requires Node 22+ (native `WebSocket` for its realtime client) — Node 20
boots the server fine but throws on the first actual DB query. Fixed with
`engines` in `apps/server/package.json` + a root `.nvmrc`; see
`LESSONS.md`.

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

**Status: code complete, 2026-07-26 — guardrail #1's human gate still
open.** Six small units, each its own branch/PR into `dev` per
`BRANCHING.md`:
1. **`transcript_lines` schema + db wrapper** —
   `supabase/migrations/0004_transcript_lines.sql` (own-row RLS; feedback
   generation in W6 reads via the service-role key, which bypasses RLS) +
   `db/transcriptLines.js`. **Confirmed run against the live Supabase
   project, 2026-07-26.**
2. **Attribution mapping (core, tests-first)** —
   `domain/attribution.js`'s `resolveSpeakerUserId(participants,
   livekitIdentity)`, pure, returns `null` (never a guess) on no match. 4
   tests.
3. **LiveKit join-token route (tests-first)** — `POST
   /api/rooms/:id/token`, gated on the W3 consent gate + a new
   `isParticipant()` check; 404 unknown room / 403 no consent / 403 not a
   participant / 409 already ended / 200 mints. Token identity is the
   student's own `user_id` (already what `room_participants
   .livekit_identity` stores from W4), so attribution needs no separate
   identity-mapping table. Added `livekit-server-sdk` +
   `src/livekit/token.js` (ported from the validated spike). 5 tests.
4. **Agent worker** — `agent/handleTranscript.js`'s
   `persistAttributedLine()` (core, tests-first — the glue between
   attribution and persistence, 3 tests) plus peripheral pieces ported
   from the Phase 0a/P2 spike (`agent/assemblyai.js`,
   `agent/transcriber.js`, now also reporting each turn's own
   `startedAtMs`/`endedAtMs`) and new orchestration
   (`agent/roomAgent.js`): `POST /api/rooms/:id/start` dispatches
   `startTranscriptionForRoom()` fire-and-forget right after flipping the
   room live — a dispatch failure logs but never fails the start response
   (room still goes live for participants; a dead agent is a silent
   failure mode flagged for W8 monitoring, per ADR-0007's Consequences).
   The agent self-disconnects once `durationSeconds` elapses (+ a 4s
   flush grace) — server-authoritative, no client vote. Added
   `@livekit/rtc-node` + `ws` (both already validated in the spike). 2
   more wiring tests on the `/start` route.
5. **Web room UI (peripheral)** — `LobbyPage`'s `live` branch now renders
   `LiveRoomAudio.jsx`: fetches a token from the gated route, joins via
   `livekit-client`, publishes the mic, and renders live captions from
   the agent's `"transcript"` data broadcasts. `npm run build`/`lint`
   clean on `apps/web`. **Not yet walked through in a real browser.**
6. **Regression harness** — `npm run regression:room`
   (`scripts/regression-room.js`) adapts the spike's bot-driven selftest
   to exercise the *actual production entry point*
   (`startTranscriptionForRoom`) rather than the raw LiveKit/AssemblyAI
   layer directly; only the DB write is faked (in-memory) so it needs no
   live Supabase room fixture. **Ran once against real credentials: PASS**
   — 3/3 bot speakers transcribed correctly, zero cross-speaker leakage,
   first-caption latency ~6–7s, final line within ~1s of audio ending
   (consistent with the original spike's numbers). Speech clips are
   generated locally (`scripts/regression/gen-voices.sh`, macOS `say` +
   `afconvert` — a Mac-native equivalent of the spike's Windows-only
   `gen-voices.ps1`) and gitignored, not committed — regenerate before
   running.

**78/78 server tests green** after all six units (verified after each
merge, no regressions).

**What's genuinely still open before W5 can be called done** (this is the
one workstream where automated tests + a bot regression pass are
explicitly *not* enough — guardrail #1):
1. ~~Run `0004_transcript_lines.sql` against the live Supabase
   project~~ **DONE, 2026-07-26.**
2. **Guardrail #1's human-verification gate itself: multiple real people,
   real devices, a real room** — confirming speech is attributed to the
   correct speaker and the live captions/mic experience actually works
   outside a bot simulation. The regression harness (unit 6) proves the
   code path is correct; it does not and cannot satisfy this gate. **This
   is the only thing left before W5 is done.**

### W6 — Feedback generation

**Status: DONE, 2026-07-26.** Five units, each its own branch/PR (stacked,
since `gh` CLI wasn't available at first in this session to open PRs
directly — see note below):
1. **Prompt assembly (core, tests-first)** — `domain/feedbackPrompt.js`'s
   `buildFeedbackPrompt()` + `parseFeedbackResponse()`
   (`feature/w6-feedback-prompt`). Attributes the full transcript by
   speaker name for group context, but scopes the actual feedback request
   to exactly one target student per call and asks for a single plain
   paragraph, no scores, constructive/non-discouraging tone. 10 tests.
2. **Feedback table schema + db wrappers (peripheral)** —
   `supabase/migrations/0005_feedback.sql` (own-row RLS, unique per
   room+user, insert-only via service role) + `db/feedback.js` + new
   `db/profiles.js` (feedback generation needs display names, not just
   user_ids) (`feature/w6-feedback-schema`). **Confirmed run against the
   live Supabase project, 2026-07-26.**
3. **Generation orchestration (core, tests-first)** —
   `domain/feedbackGeneration.js`'s `generateFeedbackForRoom()`
   (`feature/w6-feedback-generation`). This is the failure-path property
   named above: one student's Gemini error must not lose the shared
   transcript or block any other student's feedback, and must never leak
   into another student's result. Per-student try/catch inside
   `Promise.all`, keyed by `userId` regardless of outcome. 5 tests.
4. **Gemini client + worker wiring (peripheral)** —
   `llm/geminiClient.js`'s `generateFeedback(prompt, opts)` (takes an
   already-built prompt string, not structured filters like
   `generateTopic`, since the orchestrator builds the prompt itself;
   factored the shared fetch/error-status handling into a `callGemini()`
   helper both functions now use) + `agent/feedbackWorker.js`'s
   `generateAndPersistFeedbackForRoom()` (fetches topic/participants/
   transcript, calls the orchestrator, persists each successful result,
   logs — doesn't throw — on a failed generation or a failed insert) +
   dispatched fire-and-forget from `GET /api/rooms/:id/status` exactly
   when a poll flips a room to `ended`, mirroring how `/start` dispatches
   transcription (`feature/w6-feedback-worker`). 7 new Gemini-client tests
   + 3 new wiring tests on the status route.
5. **Read endpoint + UI (peripheral)** — `GET
   /api/rooms/:id/feedback/mine` (scoped to `req.userId` explicitly, not
   just the room, so it can never return another participant's paragraph
   even though the server-side client bypasses RLS) + `LobbyPage`'s
   `ended` branch polls it and shows the paragraph, with a "Generating…"
   placeholder until it lands (`feature/w6-feedback-worker`, same branch
   as unit 4). 3 more wiring tests.

**102/102 server tests green** after all five units. `npm run build`/`lint`
clean on `apps/web`.

**Note on branch stacking this session:** `gh` (GitHub CLI) wasn't
available at first in this environment, so the five units above were built
as a **stacked** chain (`w6-feedback-prompt` → `w6-feedback-schema` →
`w6-feedback-generation` → `w6-feedback-worker` → `w6-progress-update`)
rather than each branching independently from `dev`, to keep dependent
work unblocked. Once the user installed and authenticated `gh` mid-session,
all six PRs (#25–#30, including the unrelated `chore/vite-allowed-hosts`)
were opened and merged into `dev` in order — **this is all on `dev` now.**

**Both pre-conditions below closed 2026-07-26 (later same session):**
1. ~~Run `supabase/migrations/0005_feedback.sql`~~ **DONE** — user ran it
   against the live Supabase project.
2. ~~`GEMINI_API_KEY` not provisioned~~ **DONE** — user added a real key.
   **Live smoke test — PASS:** a one-off script (not committed) called
   `generateTopic` and `generateFeedback` through the real API with the
   real key; both returned genuine, well-formed responses — feedback in
   particular came back specific, constructive, and non-discouraging on a
   synthetic 5-line test transcript. Closes W4's equivalent open item too.

**Guardrail #1's human-verification gate — DONE, 2026-07-26 (same
session).** Two real devices, two real accounts, over Cloudflare Quick
Tunnels (same pattern as W5's human-verification session): joined a real
room by code, had a short real discussion, let the server-authoritative
timer end the session, and each device's Lobby page showed "Generating
your feedback…" followed by the real Gemini-generated paragraph. **User
confirmed the feedback was excellent** — useful, specific to what was
actually said, and non-discouraging in tone. **W6 is DONE.**
- **Done when:** a human reads real generated feedback and confirms it is
  useful **and non-discouraging** (guardrail #1 names this explicitly —
  tone is a correctness property here, not polish). **Confirmed
  2026-07-26.**

### W7 — Session history

**Status: DONE, 2026-07-26.** Two stacked branches, both merged into
`dev` (PR #33, then #34 — confirmed 112/112 server tests green directly
on `dev` after merge):
- **`feature/w7-history-rls-test`** — **core, tests-first:**
  `test/historyRlsIsolation.test.js`. Two *real* Supabase Auth users
  (admin-created, signed in for real access tokens) queried via clients
  scoped to their own JWTs — not the server's service-role client, which
  bypasses RLS entirely and would pass even if the policies were broken.
  Proves user A cannot read user B's rooms, transcript lines, or feedback
  through Postgres RLS itself. **Skipped when live Supabase credentials
  aren't set** (e.g. CI has none configured) — same reasoning as
  `npm run regression:room` needing live LiveKit/AssemblyAI creds; runs
  for real locally against `apps/server/.env`.
  - **Found and fixed a real production bug along the way:** the first
    run failed with `infinite recursion detected in policy for relation
    "room_participants"` — `rooms_select_participant_or_creator` and
    `room_participants_select_fellow_participants` (0003) each query
    `room_participants` from inside their own `USING` clause, which
    re-triggers the same RLS-protected query forever. This was never hit
    before because every existing app read of these tables goes through
    the server's service-role client (bypasses RLS) — this test is the
    first thing to ever exercise these policies as a real user. Fixed via
    `supabase/migrations/0006_fix_room_participants_rls_recursion.sql`, a
    `SECURITY DEFINER` helper function whose internal query runs as the
    table owner (exempt from the table's own RLS by default), breaking the
    recursion. **User ran the migration live; all 4 isolation assertions
    now pass for real.**
- **`feature/w7-session-history`** (stacked on the above) — **peripheral:**
  `domain/sessionHistory.js`'s `buildSessionHistory()` (pure assembly, unit
  tested), three new scoped db reads (`listRoomIdsForUser`,
  `listRoomsByIds`, `listFeedbackForUserAndRooms`), `GET /api/history/mine`
  (router-level tests, same pattern as `roomsApi.test.js`), and
  `HistoryPage.jsx` (linked from `HomePage`, new `/history` route).
  **Verified against the real running server**, not just mocks: a genuine
  Supabase user (admin-created), a fixture room/feedback row inserted via
  the service-role client, and a real HTTP call to `/api/history/mine`
  with that user's real JWT returned the correctly assembled session
  (topic text, status, feedback body). `npm run build`/`lint` clean on
  `apps/web`. **Not walked through by a human in an actual browser
  window** — no browser-automation tooling (Playwright/chromium-cli) was
  available in this session to screenshot it, and this isn't itself a new
  mic/audio/attribution surface so guardrail #1's hard human gate doesn't
  strictly apply, but a quick human look before calling this fully done is
  still worthwhile.

**112/112 server tests green** (102 going into this session + 4 RLS
isolation + 3 `sessionHistory` unit + 3 `historyApi` wiring).

**What's left, not blocking:** a human should glance at `/history` in a
real browser at least once — no browser-automation tooling was available
this session to screenshot it, and this isn't a guardrail #1 hard gate for
this particular feature (history-viewing isn't a new mic/audio/attribution
surface), but it's still worth a quick look before treating the UI as
fully proven.

- **Original plan (for reference):** Per-student list of past sessions
  with topic, date, and their own feedback.
  - **Core (tests-first):** the own-history-only guarantee — an
    integration test with **two real users** proving user A cannot read
    user B's sessions, transcript lines, or feedback, exercised through
    RLS rather than trusting an application-level `where` clause.
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
- **Pre-launch checklist item:** turn Supabase's "Confirm email" back **on**
  (Authentication → Sign In / Providers → Email) — it was switched off
  2026-07-25 to make W2's automated/manual testing possible, and anyone can
  currently sign up with an unconfirmed email. Tracked in PROGRESS.md's
  Blockers section so it isn't missed.
- **Done when:** the deployed stack passes a full end-to-end run with real
  people, including a session started right after a >15-minute quiet period.

**Status: code/config complete, 2026-07-26 — actual deploy still needs the
user's dashboard access.** Four small PRs, each its own branch per
`BRANCHING.md` (#36–#39, all merged into `dev`):
1. **Agent worker dispatch status tracker (core, tests-first)** —
   `domain/agentWorkerStatus.js`'s `createAgentWorkerStatus()`: pure,
   tracks active-room count and dispatch success/failure, with a
   `healthy` flag driven by *sequence order* (not wall-clock time, so
   same-millisecond calls still order correctly) rather than a raw
   failure count — one old failure followed by a working dispatch
   shouldn't keep paging anyone forever. 7 tests. Wired into
   `agent/roomAgent.js`'s `startTranscriptionForRoom`/
   `stopTranscriptionForRoom` (both call sites named "degraded state to
   alert on (W8)" directly in `rooms.js`'s existing comments — this
   closes that gap) and exposed at `GET /health/agent` via
   `createHealthRouter()` (2 more tests, injectable like every other
   router).
2. **`render.yaml`** — a Render Blueprint for the single free Docker Web
   Service (Express + in-process agent, PHASE1_PLAN.md §3a), health
   check on `/health`, every secret `sync: false` (never in git).
3. **`.github/workflows/keepalive.yml`** — pings `/health` every 10
   minutes (ADR-0007's sleep mitigation) and checks `/health/agent`;
   fails the run (→ GitHub's default failure email to watchers) if the
   dispatch tracker reports unhealthy. No-ops safely if the
   `RENDER_APP_URL` repo variable isn't set yet, so it merged before
   any real deploy exists.
4. **`docs/engineering/DEPLOYMENT.md`** — the actual how-to: Render
   Blueprint setup + secrets checklist, Cloudflare Pages build
   settings + env vars (this is a monorepo — build command
   `npm run build --workspace=@placeme/web`, output `apps/web/dist`,
   **not** a root-directory override), setting `RENDER_APP_URL`, and
   the pre-launch checklist (Confirm-email toggle, pre-flight P4's
   quiet-period smoke test, first green keep-alive run, full deployed
   E2E pass).

**Also fixed along the way:** `.github/workflows/ci.yml` triggered only on
`main`, but every task PR in this project merges into `dev`
(`BRANCHING.md`) — meaning **CI had never actually run on any merged task
PR up to this point**, only local `npm test`. Fixed to trigger on both
`main` and `dev`; verified live on the fix's own PR (#39) before merging
it — both `test` and `docker-build` jobs ran and passed for the first
time.

**121/121 server tests green** after all of the above.

**What's still open — needs the user, not more code:**
1. Actually create the Render Blueprint deploy (`render.yaml` is ready,
   needs a Render account + the secrets checklist in `DEPLOYMENT.md`).
2. Actually create the Cloudflare Pages project (needs a Cloudflare
   account; build settings documented in `DEPLOYMENT.md`).
3. Set the `RENDER_APP_URL` GitHub Actions repository variable once #1
   is done, then confirm `keepalive.yml` gets a first green run.
4. Pre-flight **P4**: after a real deploy exists, let it sit quiet
   >15 minutes and confirm a room started right after still gets a
   transcription agent (ADR-0007's "Revisit if" risk).
5. Turn Supabase's "Confirm email" back **on** before real students use
   the deployed app (still off from W2 testing).
6. The actual W8 "done when": a full end-to-end pass on the **deployed**
   stack with real people, not local dev.

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

1. **Matchmaking queue storage — DECIDED 2026-07-26: DB-backed.** Per
   direct user confirmation. Survives Render free-tier restarts/sleep
   (§3a risk) at the cost of a polling loop instead of instant in-memory
   matching — an acceptable tradeoff at pilot scale (~5–10 concurrent
   rooms). A `matchmaking_queue` table (user_id, joined_at) backs it; the
   pure `matchmake()` function (already built, `src/domain/
   matchmaking.js`) stays storage-agnostic — the API layer reads the
   queue, calls `matchmake()`, and writes back the result.
   **Group-size numbers** (also required by `matchmake()`): the product
   doc doesn't specify a minimum/maximum for real-human multiplayer
   matching (only the *AI Voice Practice* mode states min 3 / max 5–6
   participants — PRODUCT_CONTEXT.md). Using that as the
   closest available anchor, **`minGroupSize: 3, maxGroupSize: 6`** for
   random-matched rooms as an interim default — easy to tune later since
   it's a config value passed into a pure function, not hardcoded logic.
   Code/link-created rooms have **no cap** (per the product doc: "no
   fixed cap on how many students can be in a room" for multiplayer) —
   the group-size limit applies only to the random-matching path.
2. **AssemblyAI trial credit exhaustion** — card vs. fresh trial account.
   Explicitly deferred by the user on 2026-07-25 (ADR-0002); decide when the
   credit actually runs low, not before.
3. **Gemini paid tier for feedback** — currently free tier with disclosure
   (ADR-0008). Revisit once there's funding; the disclosure requirement
   disappears on the paid tier.
4. **Render Starter ($7/mo)** — eliminates the sleep risk entirely
   (ADR-0007). The first thing to buy when there's any budget.
