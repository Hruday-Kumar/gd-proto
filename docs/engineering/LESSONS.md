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

**Open source?** No — proprietary SaaS API, same category of vendor
dependency as Deepgram.

**Docs:** https://www.assemblyai.com/docs

**Gotchas we hit:** None yet — not integrated into code as of this ADR
(2026-07-25). Per ADR-0002, before Phase 1 build leans on it for real rooms,
re-run a small smoke test (same shape as `spike/selftest.js`, pointed at
AssemblyAI's streaming endpoint instead of Deepgram's) to reconfirm
attribution and latency, since the human-verification gate so far only ran
against Deepgram.

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

**Gotchas we hit:** None yet — not integrated into code as of these ADRs
(2026-07-25). Compliance note carried over from ADR-0003: choosing Supabase
doesn't by itself satisfy India DPDP — we still need our own recorded-consent
flow before mic access (guardrail #3) and to confirm Supabase's data
processing terms during the build phase.

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

**Why we use it:** All mainstream, extremely well-documented, huge community —
exactly what an agent-assisted, stack-new team needs (see `TEAM.md`).
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

**Gotchas we hit:** None yet — not integrated into code as of this ADR
(2026-07-25). One to remember for later: don't reach for `create-react-app`
out of habit/old tutorials — it's unmaintained; scaffold with Vite instead.

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
**What it is:** The AI model we call to generate GD topics, and later
(pending a decision — see below) to write each student's individual
feedback paragraph.

**Why we use it:** Chosen in ADR-0008 (`docs/engineering/adr/0008-llm-
provider.md`) over OpenAI's and Anthropic's APIs (neither has a permanent
free tier — every call is paid), Groq (free, but its free tier is explicitly
positioned as prototyping-only, not production), and OpenRouter's free
models (real models, but only 50 requests/day by default, likely too tight
at our scale). Gemini's free tier is the only one of the group that's
genuinely free forever with no credit card.

**Important nuance — read before wiring up feedback generation:** on the
free tier, Google's terms allow prompts/responses to be used to improve
their products, and human reviewers may see them; the **paid** tier
explicitly excludes this. For **topic generation** (no personal data
involved) this doesn't matter. For **feedback generation**, the LLM call
sends a student's own transcript — a real personal-data question on top of
guardrail #3's mic-consent requirement. ADR-0008 deliberately leaves this
as an **open decision for whoever builds the feedback feature**: either
extend the consent flow to disclose free-tier processing explicitly, or
switch that specific call to the paid tier (cheap in practice — likely a
few dollars a month at pilot volume). Don't default to the free tier for
this call without making that choice consciously.

**Free tier / cost:** Genuinely free forever, no credit card. Generous
limits for our scale (e.g. Gemini 2.5 Flash: hundreds to ~1,500
requests/day depending on model, 1M tokens/minute). Paid tier available
per-token whenever the feedback-generation decision above calls for it.

**Open source?** No — proprietary API, but swapping LLM providers later is
a small, isolated code change (unlike a foundational platform choice), so
lock-in risk here is low.

**Docs:** https://ai.google.dev/gemini-api/docs

**Gotchas we hit:** None yet — not integrated into code as of this ADR
(2026-07-25).
