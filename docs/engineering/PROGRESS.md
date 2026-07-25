# PROGRESS

_Durable state so any session can resume from docs, not conversation memory._

**Last updated:** 2026-07-25

## Current phase
**Phase 0b (formal research + ADRs) — ✅ COMPLETE.** All 8 categories done
(real-time/WebRTC, live STT, auth, DB/storage, backend framework, frontend
framework, hosting/deployment, LLM provider). Eight ADRs live in
`docs/engineering/adr/0001–0008-*.md`. Next session: **Phase 1 setup** — see
"What's next" below before writing any product code.

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
**Phase 0b is done. The 8 ADRs in `docs/engineering/adr/` are the full tech
stack: LiveKit Cloud + LiveKit Agents (room/WebRTC), AssemblyAI (STT),
Supabase (auth + Postgres database), Express 5.x (backend), React + Vite
(frontend), Render + Cloudflare Pages (hosting), Google Gemini API (LLM).
Read the ADRs' Decision/Consequences sections, not just this summary, before
building — each has nuance (e.g. two of them flag a small real cost as the
honest last resort; see Blockers below.**

**Before Phase 1 build work starts (per guardrail #9, treat as its own
session):**
1. Set up version control (git) before any real build work — currently
   unset, no safety net for lost work.
2. Rotate the leaked Deepgram/LiveKit keys (see Blockers) before any public
   repo.
3. Run the AssemblyAI smoke test (ADR-0002) — same pattern as
   `spike/selftest.js`, pointed at AssemblyAI's streaming endpoint instead
   of Deepgram's — to reconfirm per-speaker attribution and latency, since
   guardrail #1's human-verification gate so far only ran against Deepgram.
4. Verify the Render keep-alive pattern (ADR-0007) — deploy a placeholder
   service, let it sit quiet past 15 minutes, confirm the GitHub Actions
   ping keeps it awake and a LiveKit job dispatched right after a quiet
   period still succeeds.
5. **Decide the feedback-generation LLM data-privacy question (ADR-0008)**
   before building that specific feature — free tier + expanded consent
   disclosure, vs. Gemini's paid tier for that one call. Not yet decided;
   needs the user's input, not just an agent's.
6. Then start Phase 1 — one feature's core units at a time, tests-first
   where it's core logic (guardrail #9).

**To resume efficiently next session:** just point the agent at this file (`docs/engineering/PROGRESS.md`) — no need to replay this conversation. `CLAUDE.md` loads automatically and covers the fixed constraints/MVP boundary.

## Blockers / open items
- **Security:** the Deepgram key + LiveKit secret were shared in chat / a non-gitignored file. Rotate both before any public repo. Real secrets now live only in `spike/.env` (gitignored).
- Not yet set up: version control (git), repo hosting.
- rtc-node prints `lk-rtc` pino debug lines; set `NODE_ENV=production` to silence.
- **Two "small real spend may be needed" flags, both deliberately left as open decisions, not resolved by the agent:**
  - STT (ADR-0002): AssemblyAI's one-time trial credit will eventually run out; card-vs-fresh-trial-account is a build-phase decision (user already deferred this on 2026-07-25).
  - LLM feedback generation (ADR-0008): Gemini's free tier's data-use terms are a real question for a call that touches student transcripts specifically — free tier + disclosure, or cheap paid tier. Not yet decided.

## Deferred (not v1, tracked so they aren't forgotten)
GD AI Voice Practice · JAM · Aptitude/Technical · 1-on-1 Roleplay · Drive Simulator · payments · notifications/SMS/push · analytics · advanced observability.
