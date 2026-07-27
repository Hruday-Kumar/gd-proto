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

**[E]** The full product vision (`PlaceMe_Product_Context_v2.md`) is much larger than
v1 — five pieces: GD Arena (multiplayer + AI-voice), JAM, Aptitude/Technical tests,
1-on-1 Roleplay Interviews, and the "crown jewel" **Drive Simulator** (paste a real
company's JD + round structure the night before a drive, get a stitched end-to-end
rehearsal). Everything except GD-multiplayer is explicitly deferred.

**[E]** Live routes confirm the shipped surface: signup/login, consent, topic
generate/custom, create room, join by code, random match, start room, LiveKit token
mint, room status/participants/transcript, feedback read, history.

---

## 2. Stage

**Pre-launch. Pre-revenue. Pre-user. Code-complete, not deployed.**

| Signal | Evidence |
|---|---|
| Feature completeness | **[E]** W1–W8 done: auth, consent, topics, rooms, matching, live audio, STT, attribution, LLM feedback, history, deploy config |
| Test coverage | **[E]** 133 test cases / 21 files, server-side. Strict TDD discipline documented and followed |
| Auth | **[E]** Yes — Supabase Auth, JWT verified against JWKS, RLS enforced at DB level (an RLS recursion bug was caught by a real isolation test) |
| Billing / payments | **[E]** **None.** Zero references to Stripe, Razorpay, subscriptions, or pricing anywhere in the codebase |
| Analytics | **[E]** **None.** No PostHog, Mixpanel, GA, Segment. There is no instrumentation to measure a funnel |
| Production config | **[E]** `render.yaml` Blueprint + Dockerfile + CI + keep-alive workflow all written and committed |
| Actually deployed? | **[E]** **No.** `PROGRESS.md` W8: Render project, Cloudflare Pages project, and `RENDER_APP_URL` all still outstanding — needs dashboard access nobody has done yet |
| README | **[E]** No root README. Extensive internal engineering docs, zero external-facing copy |

**[E]** Build history: **57 commits over 3 calendar days** (2026-07-25 → 07-27). This
is an AI-agent-accelerated build, not a 6-month slog — the engineering docs are
unusually rigorous for the elapsed time (8 ADRs, phase plans, guardrails).

**[I]** Translation for a board: you have a technically credible v1 with no
distribution, no instrumentation, no pricing, and no users. The engineering risk is
largely retired; **100% of remaining risk is commercial.**

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

**[E] Effectively zero, and honestly recorded as such.**

- No analytics code → no funnel data exists, even privately.
- Schema has `profiles`, `consents`, `rooms`, `room_participants`, `transcript_lines`,
  `feedback`, `matchmaking_queue` — but the only recorded usage is founders' own
  verification walkthroughs (2 devices, 2 accounts, over Cloudflare tunnels).
- **[E]** Real qualitative signal worth noting: the human-verification gate for
  feedback quality passed with the founder's verdict *"the feedback is excellent."*
  That's n=1 and it's the founder, but the core value artifact demonstrably works.
- **[E]** No changelog, no waitlist, no landing page, no external docs.

---

## 5. Team

**[E]** Git history shows 4 identities, which collapse to **[I] 2 humans**:
`shiva9198` / `Shiva Santosh Reddy Aenugu` (47+26 commits) and `Hruday-Kumar` /
`Hruday Kumar Pagadala` (35+18). **[?]** Confirm: is this 2 co-founders, or 1 founder
across 2 machines?

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

- **Roadmap:** `PlaceMe_Product_Context_v2.md` build order → GD Multiplayer → GD AI
  Voice → JAM/Aptitude/Roleplay → Drive Simulator.
- **Open blockers (from `PROGRESS.md`):**
  1. **Not deployed** — Render + Cloudflare Pages accounts not created.
  2. **Random-match path never tested live** with 3+ real simultaneous students. Only
     the room-code path has been human-verified.
  3. Supabase "Confirm email" is **OFF** — anyone can sign up with any email. Must be
     on before real students.
  4. **AssemblyAI runs on one-time trial credits** that will expire; card-vs-new-trial
     explicitly deferred.
  5. **Gemini free tier** trains on submitted data with human review — students'
     transcripts. Disclosed in consent copy, but flagged in ADR-0008 as needing paid
     tier eventually.
  6. Render free tier sleeps after 15 min; neutralized by a GitHub Actions keep-alive
     ping — **never verified against a real deploy** (pre-flight P4).
- **[E] Budget is a stated hard constraint: $0 out-of-pocket**, not "under $100/mo."
  Plan of record: bootstrap free → demo → raise → then spend.

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
