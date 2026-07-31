# Startup Context Summary — PlaceMe

**Compiled:** 2026-07-27 · **Source:** repo inspection only (no founder input yet)
**Status:** DRAFT — awaiting founder correction before any strategy work proceeds.

Legend: **[E]** = grounded in repo evidence · **[I]** = inference/reasoning · **[?]** = guess, needs confirmation

---

## 1. What we do

**[E]** PlaceMe is an on-demand practice arena for engineering students preparing for
campus placements. v1 ships exactly one module: the **GD (Group Discussion) Arena —
Multiplayer mode**. Real students join a live audio room, get an LLM-generated (or
custom) topic and a server-authoritative timer, discuss, and each receives an
individual written feedback paragraph afterwards, plus a personal session history.

**[E]** The mechanic that makes it non-trivial: **per-speaker transcription and
attribution.** The server subscribes to each participant's audio track separately, so
attribution is structural, not inferred by diarization. That's what makes individual
feedback possible in a group setting.

**[E]** The full product vision (`PRODUCT_CONTEXT.md`) is much larger than
v1 — five pieces: GD Arena (multiplayer + AI-voice), JAM, Aptitude/Technical tests,
1-on-1 Roleplay Interviews, and the "crown jewel" **Drive Simulator** (paste a real
company's JD + round structure the night before a drive, get a stitched end-to-end
rehearsal). Everything except GD-multiplayer is explicitly deferred.

**[E]** Live routes confirm the shipped surface: signup/login, consent, topic
generate/custom, create room, join by code, random match, start room, LiveKit token
mint, room status/participants/transcript, feedback read, history.

---

## 2. Stage

**Updated 2026-07-29 — deployed and instrumented. Still pre-revenue, pre-external-user.**
The section below is left as the original 2026-07-27 snapshot; the table's "Evidence"
column is corrected where reality has since moved. See `PROGRESS.md`/`PLAN.md` for the
full engineering record.

| Signal | Evidence |
|---|---|
| Feature completeness | **[E]** W1–W8 done: auth, consent, topics, rooms, matching, live audio, STT, attribution, LLM feedback, history, deploy config. Since 07-27: a full engineering-audit remediation pass also shipped (security hardening, graceful shutdown + boot recovery, rate limiting, account-deletion path, feedback thumbs-rating) |
| Test coverage | **[E]** 247 test cases, server-side (was 133 on 07-27). Strict TDD discipline documented and followed |
| Auth | **[E]** Yes — Supabase Auth, JWT verified against JWKS, RLS enforced at DB level (an RLS recursion bug was caught by a real isolation test). "Confirm email" is now **ON** in production (was off during dev testing) |
| Billing / payments | **[E]** **None.** Zero references to Stripe, Razorpay, subscriptions, or pricing anywhere in the codebase — unchanged, not scheduled until Nov 2026 (`revenue-model.md` §8) |
| Analytics | **[E]** **Code shipped, not switched on.** `apps/web/src/lib/analytics.js` wires 5 PostHog events (signup funnel, consent funnel, session-join failures), but `VITE_POSTHOG_KEY` is unset in production so it's dead-code-eliminated from the bundle — inert by design until someone sets the key. Separately, `supabase/queries/ceo-dashboard-metrics.sql` packages the 4 Tier-1 SQL metrics (WAD, fill rate, session-2 return, broken-session rate) as paste-and-run, no PostHog needed for those |
| Production config | **[E]** `render.yaml` Blueprint + Dockerfile + CI + keep-alive workflow all written and committed |
| Actually deployed? | **[E]** **Yes, as of 2026-07-29.** Backend live on Render (`gd-proto-1.onrender.com`, healthy, auto-deploys from `main`), frontend live on Vercel (`gd-proto-web.vercel.app`). CORS, Render free-tier sleep risk, and a real crash-mid-session recovery path have all been tested live and pass. `placeme.study` is a separate, deliberate pre-launch waitlist page, not the app |
| README | **[E]** Real root `Readme.md` now exists (was missing on 07-27) — repo layout, dev setup, doc pointers |

**[E]** Build history: **57 commits over 3 calendar days** (2026-07-25 → 07-27) for the
original build; a further audit-remediation pass (2026-07-28 → 07-29) added ~35 more
commits across 20 PRs hardening security, reliability, and DPDP compliance. This
is an AI-agent-accelerated build, not a 6-month slog — the engineering docs are
unusually rigorous for the elapsed time (8 ADRs, phase plans, guardrails).

**[I]** Translation for a board: you have a technically credible, **now-live** v1 —
deployed, hardened, and confirmed working end-to-end by two real people on real devices
on the real production URL. There is still no distribution, no active instrumentation,
no pricing, and **no user who isn't a founder or tester**. The engineering risk is
retired; **100% of remaining risk is commercial and distributional**, not "is it built
and does it work."

---

## 3. Target customer

**[E] The user:** final-year and pre-final-year engineering students in India, in the
months before placement season. Nervous, inexperienced at speaking, limited access to
realistic practice ("mock interviews with friends or seniors are hard to schedule and
inconsistent in quality").

**[E] Compliance terminology confirms geography:** India DPDP compliance is a hard
constraint; recorded consent before mic is guardrail #3.

**[I] The buyer is almost certainly not the user.** The product doc's Drive Simulator
section names the **TPO (Training & Placement Officer)** as the person who announces
drives and shares JDs. That is the only named non-student actor in the entire product
vision — and TPOs hold budget, own the student list, and are measured on placement
rates. **[I]** This is the single most important unresolved question in your business:
is PlaceMe B2C (students pay) or B2B2C (colleges pay, students use)? Nothing in the
repo commits either way. There is no college/cohort/institution entity in the schema
at all — the data model is purely individual-student.

---

## 4. Traction signals

**[E] Still effectively zero external usage, and honestly recorded as such — but the
verification bar has moved from local/tunnel to the real deployed product.**

- Analytics code exists but is switched off (`VITE_POSTHOG_KEY` unset) → no funnel data
  exists yet, even privately. The SQL side (Tier 1) is runnable today against the live DB.
- Schema has `profiles`, `consents`, `rooms`, `room_participants`, `transcript_lines`,
  `feedback`, `matchmaking_queue` — the only recorded usage is still founders'/testers'
  own verification walkthroughs, but as of 2026-07-29 those ran **on the live deployed
  URL** (`gd-proto-web.vercel.app`), not localhost/tunnels: two real people, two real
  devices, a real room, transcription and speaker attribution both confirmed correct.
  That same live walkthrough also caught and got a fix shipped for a real production bug
  (an expired Gemini API key that was silently failing 100% of feedback generation) —
  worth citing as evidence the human-verification discipline (guardrail #1) is catching
  real issues, not just a formality.
- **[E]** Real qualitative signal worth noting: the human-verification gate for
  feedback quality passed with the founder's verdict *"the feedback is excellent."*
  That's n=1 and it's the founder, but the core value artifact demonstrably works.
- **[E]** No changelog, no waitlist (aside from the separate `placeme.study` landing
  page), no external docs. **Still zero students who aren't the founding team.**
- **[E] Live database counts, queried directly against the production Supabase project,
  2026-07-29:** 11 `profiles`, 30 `rooms` (28 ended, 2 waiting), 42 `room_participants`
  seatings, 299 `transcript_lines`, 28 `feedback` rows, 6 `consents`. **Read this as
  cumulative dev/testing volume since the project was provisioned 2026-07-26, not pilot
  traction** — every room ever created tops out at **2 participants**; not one has ever
  reached the 3-person minimum a real GD needs. This is expected (all of it is founder/
  agent testing across the W1–W8 build and the audit-remediation pass), but it means
  `ceo-dashboard.md`'s SQL metrics, if run today, would report numbers shaped by test
  data, not by anything resembling a pilot session — see that file's own note on this.
- **[E]** Of the 28 `feedback` rows that exist, **zero have a rating** (the 👍/👎
  feature — checked live, `rating` is `null` on all 28). The mechanism is deployed and
  reachable; nobody, including testers, has clicked it yet.

---

## 5. Team

**Resolved by the founders directly — see §9 below: 3 people (2 co-founders + 1 CTO,
2 full-time).** The open question originally posed in this section is answered there;
kept here only as the paper trail for how the answer was reached.

**[E]** Git history, re-checked 2026-07-29 (`git shortlog -sne --all`), now shows **5
identities**: `shiva9198` (79 commits) / `Shiva Santosh Reddy Aenugu` (41) — same
person, same name pattern as the GitHub-noreply vs. real-name split seen elsewhere in
this repo; `Hruday-Kumar` (7) / `Hruday Kumar Pagadala` (18) — confirmed same person,
identical email on both; and a fifth, **`placemestudy1`** (38 commits,
`place.me.study1@gmail.com`) — new since the 07-27 snapshot (2 identities then). This
is also the name of the GitHub org the repo now lives under, so it may be a shared
company/infra account rather than a third distinct human — **`[?]` not resolved from
git alone; worth a 30-second founder confirmation** rather than assumed to be the CTO.

**[E]** `TEAM.md` states plainly: the builders are **not experienced** in React,
Node/APIs, WebRTC, or TDD, and **rely heavily on AI coding agents to build**. Tech
selection is deliberately constrained to mainstream/managed options for this reason.

**[I]** Implication: you have unusually high *shipping* leverage per person, and
unusually low *debugging-under-pressure* capacity when something breaks in production
with real students in a live room. That asymmetry should shape the launch plan.

---

## 6. Stated problems, TODOs, roadmap

**[E]** No `TODO`/`FIXME` comments in code — the discipline is high. The roadmap lives
in docs:

- **Roadmap:** `PRODUCT_CONTEXT.md` build order → GD Multiplayer → GD AI
  Voice → JAM/Aptitude/Roleplay → Drive Simulator.
- **Open blockers, updated 2026-07-29 (most of the 07-27 list is now closed — see
  `PROGRESS.md`/`PLAN.md` §6 for the full verification record):**
  1. ~~Not deployed~~ **DONE** — live on Render + Vercel, both healthy.
  2. **Random-match path still never tested live with 3+ real simultaneous students.**
     Only the room-code path has been human-verified. (Also now lower-priority
     commercially — `founder-decisions.md` D1 and `market-strategy.md` §8 Q2 both
     concluded random matching should be de-emphasized for the pilot anyway, and the
     soft-landing/demotion changes from that decision have shipped in code.)
  3. ~~Supabase "Confirm email" is OFF~~ **DONE** — turned ON and re-verified live.
  4. **AssemblyAI runs on one-time trial credits.** Decision made (2026-07-29, not
     just deferred): open a fresh trial account when the current ~$50 credit runs out,
     rather than add a card — stays card-free longer at the cost of periodic
     account-rotation overhead.
  5. **Gemini free tier** still trains on submitted data with human review — students'
     transcripts. Still disclosed in consent copy (now consent v2), still flagged as
     needing a paid tier before any B2B contract (`board-governance.md` §2). Unchanged.
  6. ~~Render free tier sleeps after 15 min, never verified~~ **DONE, verified live** —
     18+ minutes idle with the keep-alive deliberately disabled, then a real room still
     got a working transcription agent. Bonus finding: the process didn't even restart
     during the idle window in that test.
  7. **New since 07-27, not yet resolved:** the deployed backend's `GEMINI_API_KEY`
     silently failed for a period (backing service account deleted/disabled) — caught
     by the B7 human-verification walkthrough, fixed by rotating the key, re-verified
     with a second live room. No new blocker from this, but worth knowing a live-key
     health check doesn't currently exist — a silent-failure class that could recur.
- **[E] Budget is a stated hard constraint: $0 out-of-pocket**, not "under $100/mo."
  Plan of record: bootstrap free → demo → raise → then spend. Still holding — the
  live deploy runs entirely on free tiers.

---

## 7. Category and likely competitors **[I — reasoned, not read from repo]**

**Category:** placement/interview prep for Indian engineering students — a large,
crowded, price-anchored-low market. But the *specific* slice — **live multi-human
group discussion practice with per-speaker attribution** — is thin.

- **Direct-ish (Indian placement prep):** PrepInsta, FACE Prep, Talent Battle, Unstop
  (ex-Dare2Compete), GeeksforGeeks placement courses. Mostly content + aptitude tests
  + recorded courses. **[I]** Group discussion is usually a *video lesson about* GDs,
  not a GD you actually do.
- **AI interview practice:** Final Round AI, Interview Warmup (Google), Yoodli,
  Hiration, InterviewBuddy. Strong at 1-on-1 and at speech coaching — **[I]** almost
  none do live multi-human group rooms, because it's a liquidity problem, not a model
  problem.
- **Peer mock marketplaces:** Pramp/Exponent, Meetapro — mostly US, mostly technical
  1-on-1, mostly not GD.
- **The real competitor, and the one to take seriously:** **[I]** a WhatsApp group +
  Google Meet + four friends. It is free, already installed, and socially default.
  Plus the college TPO cell running its own GD rounds for free.
- **Also structurally relevant:** **[I]** Scaler/Coding Ninjas-type outcome-linked
  programs, which own the "get placed" job-to-be-done at a far higher price point.

**[I] Preliminary wedge read:** the defensible thing is *not* the LLM feedback (any
competitor can generate a paragraph). It's **per-speaker attribution in a live
multi-human room** — which requires the WebRTC + per-track STT plumbing you've already
built and validated, and which nobody bothers with because it's operationally annoying.
Whether that's a *durable* moat or a 6-week engineering task for a funded competitor is
a Market Strategy question, not a summary question. **[I] My honest first read: it's a
6–12 month head start, not a moat. The moat, if one exists, is campus-level network
density.** I'll argue that properly in the next section.

---

## 8. What jumps out immediately (operator read, not yet strategy)

Four things I'd raise in the first 10 minutes of a board meeting:

1. **You've built a marketplace and are treating it like a SaaS product.** GD-multiplayer
   needs **3+ real students online at the same moment**. That's a liquidity problem —
   the hardest kind of cold start. And per your own `PROGRESS.md`, the random-match path
   has *never been tested with 3 live sessions*. That is simultaneously the biggest
   product risk and the biggest business risk, and it's currently logged as an
   engineering to-do.
2. **Zero instrumentation.** You cannot run a funnel, a cohort, or a retention curve
   today. Before launch, this is the cheapest high-value thing to fix.
3. **Your COGS are real and per-session.** Unlike a content business, every GD room
   burns streaming-STT minutes × number of speakers, plus an LLM call per student.
   A free-forever consumer plan has a genuine variable cost. **[I]** Rough order: a
   5-person × 20-min room ≈ 100 speaker-minutes of STT. That needs a real model — CFO
   section.
4. **The buyer is undefined.** B2C-student vs B2B-college changes literally every
   downstream decision: pricing, channel, feature order (a college needs cohorts,
   admin views, and reporting — none of which exist in the schema), and even whether
   the Drive Simulator or the AI-voice mode is the right second build.

---

## 9. Founder answers (2026-07-27) — CONFIRMED

| # | Question | Answer | Strategic consequence |
|---|---|---|---|
| 1 | Who pays? | **Colleges** for current students; **graduates pay directly** | Dual GTM: B2B2C (primary) + B2C (secondary). Two different products, two sales motions — see market-strategy.md §6 |
| 2 | Beachhead campus | **None confirmed.** Planning a pilot of **~10 people** | No distribution asset yet. Getting one named campus is now the #1 priority |
| 3 | Team | **3 people: 2 co-founders + 1 CTO. 2 full-time** (one co-founder + the CTO) | ~2.0 FTE. Enough to build, not enough to build + sell + support simultaneously |
| 4 | Capital / runway | **~$0. Just bought Claude Pro (~$20/mo).** No raise, no revenue | Hard constraint. Rules out paid acquisition, paid STT tiers, paid infra. Real runway = how long 2 people can go unpaid |
| 5 | Timeline / season | **Not sure** | ⚠️ Biggest unforced risk. See market-strategy.md §5 — the clock is already running |
| 6 | External users | **Zero.** Still in development | No validation outside the founding team |
| 7 | Optimizing for | **Users + college contracts + revenue** | ⚠️ Three goals = no goal. Board pushback in market-strategy.md §8 |

**Unresolved / still needed:**
- Real runway in months (how long can 2 full-time people go without income?)
- Any personal access to a college — current student, recent alum, faculty, TPO staff?
- Is anyone on the team a current student at a placement-cycle college right now?
