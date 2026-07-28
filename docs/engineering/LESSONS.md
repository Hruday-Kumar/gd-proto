# LESSONS — technology glossary

A running, beginner-friendly reference for every library/service this project
touches: what it is, why we picked it, what it costs, whether it's open source,
and anything we learned the hard way. Add an entry here the first time a new
tool is introduced (spike or real build) — don't wait for Phase 0b research to
write it down.

Format per entry: **What it is** (plain language) · **Why we use it** ·
**Free tier / cost** · **Open source?** · **Docs** · **Gotchas we hit**.

---

## LiveKit (Cloud)
**What it is:** A hosted service that lets multiple people join an audio/video
"room" and hear/see each other live — the same category of technology behind
Zoom or Google Meet. We use LiveKit **Cloud**, the managed hosted version.

**Why we use it:** Building real-time audio ourselves (WebRTC) is a genuinely
hard, specialist problem. LiveKit has already solved it. Crucially for us:
every participant's audio arrives as a **separate track**, never mixed — so we
always know whose voice is whose without guessing (no "diarization" needed).

**Free tier / cost:** "Build" plan — permanently free, no credit card. 5,000
WebRTC minutes/mo + 1,000 agent minutes/mo + 50GB egress. Paid tiers start at
$50/mo ("Ship") if we outgrow this.

**Open source?** Partially. **LiveKit Server** (the core engine) is open
source (Apache 2.0) — we *could* self-host it later for zero vendor lock-in,
which is why it fits the project's "no hard vendor lock-in" constraint. LiveKit
**Cloud** (the hosted version we're using now) is a paid/free-tier SaaS product
on top of that open-source core.

**Docs:** https://docs.livekit.io

**Gotchas we hit:**
- The Node **client** SDK (`@livekit/rtc-node`, used for our bots/agent) is
  different from the **browser** SDK (`livekit-client`, used in the webpage).
  Similar concepts, different packages/imports — don't mix them up.
- `AccessToken.toJwt()` (server-side token minting) is **async** — needs `await`.
- The SDK prints noisy `lk-rtc` debug logs by default; set `NODE_ENV=production`
  to quiet them.
- **The Node client's `room.connect()` can throw `engine: signal failure:
  failed to retrieve region info: ...` on a transient network blip** (seen
  live, twice, 2026-07-27: `error sending request for url` once, `region
  fetch timed out` another time) — before actually joining, the client
  fetches LiveKit Cloud's region-pinning info over plain HTTP, and if that
  one request has a bad moment the whole `connect()` throws, even though
  the exact same URL/credentials succeed again seconds later (confirmed:
  the browser's own connection, and repeat connect attempts, weren't
  affected). Since our agent (`agent/roomAgent.js`) previously had zero
  retry, one of these blips permanently killed transcription for the whole
  room — the room and its audio kept working fine (the browser SDK
  connects independently), so this failed **silently** from a student's
  point of view. Fixed by wrapping `room.connect()` in a bounded retry
  (`domain/retry.js`, 3 attempts / 1s backoff by default).

---

## Deepgram
**What it is:** A service that turns spoken audio into written text, live, as
people talk (not after the fact). This is called "speech-to-text" or STT.

**Why we use it:** Building accurate live transcription ourselves would mean
training/running our own speech-recognition AI model — completely impractical
for a small team. Deepgram rents this out via an API: send audio, get text back
in real time.

**Status update (2026-07-25):** Validated here in the Phase 0a spike, but
**ADR-0002 chose AssemblyAI over Deepgram for the real build** — see
`docs/engineering/adr/0002-live-stt.md`. Short version: our one-streaming-
connection-per-speaker architecture means Deepgram's 50-concurrent-stream
pay-as-you-go cap becomes a real ceiling at our 3-month scale target, and
AssemblyAI is both cheaper and auto-scales concurrency with no hard cap.
Keeping this entry (and the Deepgram key) as a documented fallback.

**Free tier / cost:** $200 free credit, no credit card required, credits don't
expire. Nova-3 model (what we use) costs ~$0.0077/minute for live streaming —
the free credit covers roughly **430 hours** of transcription.

**Open source?** No — proprietary SaaS API. There's no free self-hosted
equivalent of comparable quality; this is a vendor dependency to track (Phase
0b should confirm this against alternatives like AssemblyAI, Google STT, etc.).

**Docs:** https://developers.deepgram.com

**Gotchas we hit:**
- Their official `@deepgram/sdk` npm package (v5) is a large generated REST
  client, awkward for the simple "stream audio, get text back" use case we
  need. We instead talk to their **streaming WebSocket API directly** (`wss://
  api.deepgram.com/v1/listen`) using the plain `ws` package — simpler, fully
  transparent, and not tied to SDK version churn.
- We run **one Deepgram connection per speaker** (not one shared connection),
  which is what makes attribution automatic — each connection's output is
  already known to belong to one specific person.

---

## AssemblyAI
**What it is:** Another live speech-to-text (STT) API, same category as
Deepgram above — send streaming audio, get transcript text back in real
time.

**Why we use it:** Chosen in ADR-0002 (`docs/engineering/adr/0002-live-stt.md`)
over Deepgram for the real build. Our architecture opens one streaming
connection per speaker (not per room), so the thing that matters most at our
scale isn't just per-minute price — it's how many *simultaneous* streaming
connections a plan allows. AssemblyAI's pay-as-you-go tier auto-scales
concurrency with usage and has no hard ceiling; Deepgram's default cap (50
concurrent streams) sits right at our launch-scale worst case and would need
a sales call to raise before our 3-month target. AssemblyAI is also cheaper
per minute and benchmarks competitively on accuracy.

**Free tier / cost:** Universal-Streaming model: **$0.15/hour (~$0.0025/min)**,
billed per second, same price for all supported languages. Free plan exists
for development (rate-limited to 5 new connections/minute); pay-as-you-go
removes that limit.

**Note (2026-07-27):** hit this 5-connections/minute dev-tier limit myself
while debugging the LiveKit connect issue below -- ~10 rapid regression-
harness/diagnostic runs in a few minutes produced one run with **zero
transcription and zero logged errors** (agent joined fine, tracks
subscribed fine, AssemblyAI just never returned a `Turn`). Our WS handling
(`agent/assemblyai.js`) only logs on the `error` event, not on an
unexpected `close` code, so a rate-limit rejection can currently be
silent. Didn't chase a fix -- this was self-inflicted test load, not a
real usage pattern -- but worth knowing if "everything connects but
nothing transcribes, no errors at all" recurs.

**Open source?** No — proprietary SaaS API, same category of vendor
dependency as Deepgram.

**Docs:** https://www.assemblyai.com/docs

**Gotchas we hit:** Integrated 2026-07-25 for the P2 pre-flight smoke test
(`spike/selftest-assemblyai.js`, `spike/src/assemblyai.js`,
`spike/src/transcriber-assemblyai.js`) — **PASS, twice, per-speaker
attribution correct with no leakage**, finalization latency ~0.1–0.4s after
audio ends (matches the Deepgram spike baseline).
- **Minimum chunk duration, unlike Deepgram:** AssemblyAI's v3 streaming
  endpoint rejects any single audio message outside **50–1000ms** of audio
  (error 3007, `Input Duration Violation`). Deepgram has no such minimum.
  LiveKit's `AudioStream` delivers ~10ms frames, so sending each frame
  straight through (the pattern that works for Deepgram) fails immediately.
  Fix: buffer frames client-side and flush in ~100ms chunks — see the
  `pending`/`flush` logic in `spike/src/assemblyai.js`. Anything building a
  new AssemblyAI streaming integration needs this buffering step; it isn't
  optional.
- Auth is a raw `Authorization: <api_key>` header (no `Bearer ` prefix) —
  different from some other vendors' convention.
- Endpoint is v3: `wss://streaming.assemblyai.com/v3/ws`, with
  `format_turns=true` for punctuated/cased final text (Deepgram's
  equivalent is `smart_format`). A `Turn` message with `end_of_turn: true`
  is the finalized-line signal (Deepgram's equivalent is `is_final`).

---

## Cloudflare Tunnel (`cloudflared`)
**What it is:** A free tool that takes something running on your own laptop
(like our local web server) and gives it a real internet address
(`https://something.trycloudflare.com`) that anyone, anywhere, can open.

**Why we use it:** Browsers refuse to allow microphone access on a page loaded
over plain `http://`, *unless* that page is `localhost` on the very same
device. So a friend's phone can't use the mic on `http://192.168.x.x:3000`
(your laptop's local network address) — but it can on a real `https://` link.
`cloudflared` gets us that real HTTPS link in one command, free, no account.

**Free tier / cost:** Completely free for the "Quick Tunnel" mode we used
(`cloudflared tunnel --url http://localhost:3000`). No account, no signup.
Note: Cloudflare states quick tunnels have no uptime guarantee — fine for
testing, not for anything that needs to always be up.

**Open source?** Yes — Apache 2.0 licensed (https://github.com/cloudflare/cloudflared).

**Docs:** https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/

**Gotchas we hit:**
- Only the *webpage* and the small "give me a room ticket" request travel
  through the tunnel. The actual voice audio goes directly from each device to
  LiveKit's own servers — so testing over a tunnel is still a legitimate test
  of real audio quality, not a shortcut.
- The generated URL is random and only shown once per run (changes every time
  you restart `cloudflared`) — fine for one-off testing, not for a stable link.

---

## Supabase (Auth + Postgres database)
**What it is:** A hosted backend platform. We're adopting two pieces of it:
**Supabase Auth** — a managed "student accounts" system (sign-up, login,
sessions) so we don't hand-roll password storage or session security
ourselves — and its bundled **Postgres database**, for everything
structured we need to store (profiles, rooms/sessions, transcripts,
feedback).

**Why we use it:**
- *Auth* — chosen in ADR-0003 (`docs/engineering/adr/0003-auth.md`) over
  Firebase Auth, Clerk, Auth0, AWS Cognito, and the open-source Auth.js/
  Better Auth libraries. It's free at our pilot scale like Firebase and
  Clerk, but it's the only one of the mainstream managed options that's
  fully open source — genuinely self-hostable later if we ever need to
  leave, which fits the project's "no hard vendor lock-in" constraint
  better than the alternatives.
- *Database* — chosen in ADR-0004 (`docs/engineering/adr/0004-db-storage.md`)
  over Neon, MongoDB Atlas, PlanetScale, Turso, Render, and Railway. Our
  data (students → sessions → transcript lines → feedback) is naturally
  relational, which favors any SQL database over MongoDB's document model —
  and since we already have a Supabase project for Auth, using its bundled
  Postgres adds zero new vendor accounts. Render/Railway were ruled out
  outright (no genuine free-forever managed database); PlanetScale's
  free-tier status was too unclear in current sources to plan around.

**Free tier / cost:** Auth: 50,000 monthly active users, free, permanently.
Database: 500MB storage + 1GB file storage, free, permanently. No credit
card required for any of this. Free projects pause after 7 days of
inactivity (irrelevant once real students are using it regularly) and are
capped at 2 active free projects per account. **Note (2026-07-25): the
project's real budget is $0 out-of-pocket** — free tiers aren't just
preferred, they're required until the product can attract funding, so this
free tier is load-bearing, not a nice-to-have.

**Open source?** Yes — Supabase (Auth and the underlying Postgres) is open
source and can be self-hosted, unlike Firebase or Clerk.

**Docs:** https://supabase.com/docs/guides/auth ·
https://supabase.com/docs/guides/database

**Gotchas we hit:** Integrated 2026-07-25 (W2 — accounts). Compliance note
carried over from ADR-0003: choosing Supabase doesn't by itself satisfy
India DPDP — we still need our own recorded-consent flow before mic access
(guardrail #3, due in W3) and to confirm Supabase's data processing terms.
- **How the backend verifies a user's session token:** Supabase's own docs
  now recommend *against* verifying tokens with the legacy shared JWT
  secret (HS256) and recommend asymmetric verification against the
  project's JWKS endpoint instead
  (`https://<project>.supabase.co/auth/v1/.well-known/jwks.json`), using
  the `jose` library. We followed that — `apps/server/src/domain/
  verifyToken.js` + `apps/server/src/api/authMiddleware.js`. One upside
  worth knowing: `jose`'s JWKS resolver is dependency-injectable, so the
  middleware's tests (`test/verifyToken.test.js`) sign fixture tokens with
  a locally generated keypair and never touch the network — fast,
  deterministic, no Supabase project needed to run `npm test`.
- **New table needs a manual step:** we don't have Supabase CLI/migrations
  wired up yet, just a plain SQL file (`supabase/migrations/0001_profiles
  .sql`) that has to be pasted into the dashboard's SQL Editor by hand.
  Revisit if this becomes a recurring source of drift between environments.
- **Email confirmation is on by default** for new projects — blocks a
  freshly-signed-up user from logging in until they click a confirmation
  link. Turned off during Phase 1 dev (Authentication → Sign In / Providers
  → Email) to allow scripted signup→login testing; **must be turned back on
  before real students use the app** (tracked in PROGRESS.md).

---

## Node.js + npm ecosystem basics (Express, dotenv, ws)
**What it is:** Node.js runs JavaScript outside a browser (e.g. as a server).
`npm` is its package manager — how we install libraries like the ones below.
- **Express** — a minimal framework for building a web server (routes like
  "when someone requests `/api/token`, run this code").
- **dotenv** — loads secret values (API keys) from a local `.env` file into
  the program, so secrets never get hard-coded into source code.
- **ws** — a low-level library for WebSockets (a way for a program to keep an
  open, two-way connection to a server — what we use to talk to Deepgram).

**Gotcha (hit 2026-07-26, W3):** `@supabase/supabase-js`'s `createClient()`
always spins up a realtime client under the hood, which needs a native
`WebSocket` global — only present in Node **22+**. On Node 20 (or lower),
any code path that calls `getSupabase()` (i.e. anything touching the DB,
not just auth/JWKS verification) throws `Error: Node.js detected but
native WebSocket not found` at the point of the *first real query*, not at
boot — so a server can look like it's running fine until the first
DB-backed route is hit. `@supabase/realtime-js`'s own `package.json`
already declares `engines: {node: ">=22.0.0"}` (an `npm install` warning
you'll see even before hitting the runtime error) — this is why. Fixed by
adding an `engines` field to `apps/server/package.json` too, plus a root
`.nvmrc` pinning `22` —
run `nvm install 22 && nvm use` (or `nvm use` if 22+ is already installed)
in the repo root before `npm run dev`.

**Why we use it:** All mainstream, extremely well-documented, huge community —
exactly what an agent-assisted, stack-new team needs (see `TEAM.md`).
Also using **npm workspaces** (built into npm itself, no extra tool) to
manage the monorepo — `apps/web`, `apps/server`, `packages/shared` — so one
`npm install` at the repo root wires up all three, and a package in one
workspace can depend on another (e.g. `apps/server` on `@placeme/shared`)
without publishing anything.
**Express specifically confirmed as the backend framework in ADR-0005**
(`docs/engineering/adr/0005-backend-framework.md`), compared against
Fastify, NestJS, and Hono — none solve a problem this MVP actually has
(we're not bottlenecked on HTTP throughput, and don't need enterprise-scale
team structure). **Build on Express 5.x, not 4.x**, once real build work
starts — 4.x is in maintenance-only status; 5.x is the actively endorsed
line.

**Free tier / cost:** Free — these are libraries you run yourself, not hosted
services. No usage limits or costs of their own.

**Open source?** Yes, all three — MIT licensed, free to use commercially.

**Docs:** https://expressjs.com · https://github.com/motdotla/dotenv ·
https://github.com/websockets/ws

**Gotchas we hit:** None yet.

---

## Vitest + Supertest (testing)
**What it is:** Vitest runs our automated tests (the "tests-first" half of
the project's pragmatic-TDD approach — see guardrail #9 / `TEAM.md` #4).
Supertest lets a test make fake HTTP requests against an Express app
in-process (no real port/network needed) and assert on the response.

**Why we use it:** Vitest is the standard test runner in the Vite ecosystem
we already committed to for the frontend (ADR-0006), so the team learns one
tool instead of two, and its docs/examples assume Vite-shaped projects.
Supertest is the long-standing, most-documented way to test an Express app.
Both are free, MIT-licensed, and require no service account.

**Free tier / cost:** Free — local dev-only tooling, no hosted component.

**Open source?** Yes, both MIT licensed.

**Docs:** https://vitest.dev · https://github.com/ladjs/supertest

**Gotchas we hit:** None yet. First used 2026-07-25 for `apps/server`'s
`/health` smoke test (W1).

---

## Docker
**What it is:** Packages `apps/server` (the Express API + LiveKit agent
worker) and everything it needs to run into one portable image, built from
the `Dockerfile` at the repo root. Render (ADR-0007) runs that image in
production; the same image can be built and run identically on a laptop.

**Why we use it:** A fixed project constraint (`CLAUDE.md`: "cloud-agnostic,
containerized, no hard vendor lock-in") — Docker is the industry-standard
way to satisfy that, and Render's free tier deploys directly from a
Dockerfile with no extra glue.

**Free tier / cost:** Free — Docker Desktop/Engine are free for individual
use. No cost of their own; hosting cost is Render's (see that entry).

**Open source?** Docker Engine itself is Apache-2.0 open source. Docker
Desktop (the GUI app installed locally on Windows/Mac) is free for
individual/small-team use but is proprietary, not OSS — worth knowing if
the team ever grows past Docker's free-usage terms.

**Docs:** https://docs.docker.com

**Gotchas we hit:** The monorepo (npm workspaces) needs every workspace's
`package.json` present for `npm ci` to resolve correctly inside the image —
simplest fix was `COPY . .` before `npm ci` (via a `.dockerignore` that
excludes `node_modules`, `.git`, and `spike/`) rather than trying to
selectively copy just `apps/server`'s manifest, which breaks workspace
resolution. Slightly larger image than a hand-tuned multi-stage build, but
far more robust for a team new to Docker — revisit only if image size or
build time actually becomes a problem.

**Gotcha (hit 2026-07-28, real production outage):** `node:22-slim` (the
base image) ships **without** the `ca-certificates` package. Most Node
code doesn't notice, because Node's own HTTPS client bundles its own root
certificate store — but `@livekit/rtc-node`'s native Rust engine does
**not** use Node's cert store, it uses the OS's, and `node:22-slim` has
none. Every HTTPS request that engine makes (including the region-info
fetch it does right before `room.connect()`) failed with a generic
`reqwest`/TLS error — reproduced identically across two different Render
regions, ruling out a regional network fluke. This was originally
misdiagnosed in `PROGRESS.md` as a transient network blip and "fixed" with
a connection retry (`domain/retry.js`) — the retry is real and still
useful for genuine transient failures, but it was masking, not fixing,
this root cause, since a missing OS package fails the same way on every
attempt, not intermittently. Actual fix: install `ca-certificates` in the
`Dockerfile` (`apt-get install -y ca-certificates`, or the Alpine
equivalent if the base image ever changes). **General lesson: any native
addon/Rust/Go binary bundled into a Node app may bypass Node's own
"batteries included" TLS handling — don't assume `node:*-slim` has
everything a native dependency needs just because plain Node code works
in it.**

---

## React + Vite
**What it is:** React is the library we'll build the actual student-facing
app UI in (login screens, the GD room, feedback/history pages). Vite is the
tool that turns our React source code into something a browser can run,
with fast reload during development.

**Why we use it:** Chosen in ADR-0006 (`docs/engineering/adr/0006-frontend-
framework.md`) over Vue, Svelte, and SolidJS. React has by far the largest
community/example base of any frontend framework (useful for an
agent-assisted beginner team) and, as of Feb 2026, moved from single-company
(Meta) ownership to the independent React Foundation under the Linux
Foundation — multiple major companies now back its long-term maintenance,
which is a *stronger* longevity story than before, not a weaker one. Vite
(not Create React App, which is unmaintained, and not Next.js) fits because
GD Arena is a logged-in practice tool with no public pages that need
search-engine optimization — Next.js's main advantage doesn't apply here,
and skipping it avoids real added complexity for a first-time team.

**Free tier / cost:** Free — both are open-source libraries/tools you run
yourself, not hosted services.

**Open source?** Yes — React (MIT) and Vite (MIT).

**Docs:** https://react.dev · https://vite.dev

**Gotchas we hit:** Integrated 2026-07-25 (W1 scaffolding via `npm create
vite`, W2 auth pages). One to remember: don't reach for `create-react-app`
out of habit/old tutorials — it's unmaintained; scaffold with Vite instead.

---

## React Router
**What it is:** Client-side routing for the React app — which page renders
for `/login`, `/signup`, `/` (the protected home page) etc, without a full
page reload.

**Why we use it:** The standard, most-documented routing library in the
React ecosystem — same "mainstream, well-documented" reasoning as every
other pick (`TEAM.md`). We use it purely as a client-side SPA router
(`BrowserRouter` + `<Routes>`) — no server-side "Framework Mode," no React
Server Components, no server actions.

**Free tier / cost:** Free, MIT-licensed library, no hosted component.

**Open source?** Yes, MIT.

**Docs:** https://reactrouter.com

**Gotchas we hit:** `npm install` flags a **high-severity `npm audit`
finding** (GHSA-qwww-vcr4-c8h2, a CSRF issue in React Router's RSC
"Framework Mode" server-action request handling) against the latest
version (7.18.1, the one we use). **Assessed as not applicable to us** —
the vulnerable code path only triggers for apps using React Router's
server-side Framework Mode / server actions, which this project doesn't
use at all (plain client-side SPA routing only). `npm audit fix --force`
would "fix" it by downgrading to 7.11.0, which is actually vulnerable to a
*different* CSRF CVE (2026-22030, affects 7.0.0–7.11.0) — so downgrading
trades one inapplicable advisory for one that's inapplicable for the same
reason. Staying on latest. Revisit if this project ever adopts React
Router's Framework Mode/server actions.

---

## Render (backend hosting)
**What it is:** A hosted platform that runs our Express API + LiveKit Agent
worker as a container, built from a Dockerfile in our repo — push code, it
builds and runs it, and handles the server/networking/TLS for us.

**Why we use it:** Chosen in ADR-0007 (`docs/engineering/adr/0007-hosting-
deployment.md`) over Oracle Cloud's Always Free VM (rejected — it's a raw
self-managed server, which is exactly the "self-manage the hard part"
pattern we've avoided everywhere else in this project, plus documented
reports of Oracle reclaiming "idle" free instances — a real risk for a
worker that spends most of its time waiting), Google Cloud Run (its free
tier doesn't actually cover a 24/7 process without extra charges), Fly.io
(no free tier since 2024), Koyeb, and Railway (neither offers free
always-on compute).

**The one thing to know:** Render's free tier **sleeps after 15 minutes of
no traffic**, which would break the LiveKit Agent worker (it needs to stay
connected to receive room assignments — see the LiveKit entry below). We
work around this with a **free GitHub Actions scheduled job that pings the
server every ~10 minutes**, keeping it awake within the free 750
instance-hours/month. This is a well-known pattern, not a fragile hack, but
it's not a 100% guarantee — see ADR-0007's "Residual risk" note. The real
fix, whenever there's budget, is Render's $7/mo Starter tier, which removes
the sleep behavior entirely.

**Free tier / cost:** 750 free instance-hours/month (enough to run one
service 24/7 all month), no credit card required. Starter tier (no sleep)
is $7/mo whenever that becomes worth paying for.

**Open source?** No — Render itself is a proprietary hosting platform, but
our app code stays portable (it's just a Dockerfile) — no Render-specific
lock-in in the code itself.

**Docs:** https://render.com/docs

**Gotchas we hit:** None yet — not deployed as of this ADR (2026-07-25).

---

## Cloudflare Pages (frontend hosting)
**What it is:** Free static-site hosting for the built React/Vite frontend
— push code, it builds and serves it from Cloudflare's global network.

**Why we use it:** Chosen in ADR-0007 alongside Vercel and Netlify as
equally solid options — Cloudflare Pages won on the cleanest fit for our
zero-budget rule (unlimited bandwidth, genuinely no credit card required)
and Cloudflare's long track record as a large, stable company.

**Free tier / cost:** Free forever, unlimited bandwidth, no credit card
required.

**Open source?** No — Cloudflare Pages itself is proprietary, but (like
Render) our frontend code is a plain static build with no platform-specific
lock-in.

**Docs:** https://developers.cloudflare.com/pages

**Gotchas we hit:** None yet — not deployed as of this ADR (2026-07-25).

---

## Windows SAPI (text-to-speech, used for spike testing only)
**What it is:** A speech-synthesis engine **built into Windows itself** — it
can read text out loud in a synthetic voice. We used it to generate fake
"speaker" audio clips (`media/gen-voices.ps1`) so we could test a 3-person
conversation without needing 3 real humans.

**Why we use it:** Free, offline, already installed — no account or internet
needed, perfect for throwaway test fixtures.

**Free tier / cost:** Free — it's a built-in OS feature, not a paid service.

**Open source?** No — proprietary, part of Windows. Not relevant to the actual
product (this is a spike-only testing tool, not something students will use).

**Docs:** N/A (internal Windows COM API — see `spike/media/gen-voices.ps1` for
the exact usage).

**Gotchas we hit:** Only 2 distinct voices were available on this machine, so
our 3rd bot re-used a voice — fine for a keyword-matching test, wouldn't matter
for the real product anyway since this tool isn't part of it.

---

## Google Gemini API (Google AI Studio)
**What it is:** The AI model we call to generate GD topics, and — per a
2026-07-25 decision — also to write each student's individual feedback
paragraph, both on the free tier for now.

**Why we use it:** Chosen in ADR-0008 (`docs/engineering/adr/0008-llm-
provider.md`) over OpenAI's and Anthropic's APIs (neither has a permanent
free tier — every call is paid), Groq (free, but its free tier is explicitly
positioned as prototyping-only, not production), and OpenRouter's free
models (real models, but only 50 requests/day by default, likely too tight
at our scale). Gemini's free tier is the only one of the group that's
genuinely free forever with no credit card.

**Important nuance — required before wiring up feedback generation, not
optional:** on the free tier, Google's terms allow prompts/responses to be
used to improve their products, and human reviewers may see them; the
**paid** tier explicitly excludes this. For **topic generation** (no
personal data involved) this doesn't matter. For **feedback generation**,
the LLM call sends a student's own transcript — a real personal-data
question on top of guardrail #3's mic-consent requirement. **Decision
(user, 2026-07-25): stay on the free tier for both, move feedback
generation to the paid tier later once there's budget.** Because of that,
the recorded-consent flow (guardrail #3) **must** be extended to disclose
that session transcripts are processed by Gemini under free-tier terms
before this feature ships — this isn't a nice-to-have, it's what makes
staying on the free tier here compliant with "explicit recorded consent."

**Free tier / cost:** Genuinely free forever, no credit card. Generous
limits for our scale (e.g. Gemini 2.5 Flash: hundreds to ~1,500
requests/day depending on model, 1M tokens/minute). Paid tier available
per-token whenever the feedback-generation decision above calls for it.

**Open source?** No — proprietary API, but swapping LLM providers later is
a small, isolated code change (unlike a foundational platform choice), so
lock-in risk here is low.

**Docs:** https://ai.google.dev/gemini-api/docs

**Gotchas we hit:** Google's model lineup moves fast — worth checking
live before trusting any hardcoded model name. When W4 actually wired up
`src/llm/geminiClient.js` (2026-07-26), a live check of
ai.google.dev/gemini-api/docs/deprecations showed ADR-0008's pick,
`gemini-2.5-flash`, is slated to shut down 2026-10-16, with Google's own
recommended replacement being `gemini-3.6-flash` (GA, launched just days
before, free tier available). Used `gemini-3.6-flash` as the new default,
kept overridable via a `GEMINI_MODEL` env var rather than hardcoded, since
this is clearly going to keep happening. Not yet smoke-tested against the
live API — no Google AI Studio key provisioned yet (pre-flight P3); all
tests so far use an injected fetch function.
