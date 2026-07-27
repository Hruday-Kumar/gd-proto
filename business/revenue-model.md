# Revenue Model & Financials — PlaceMe

**Author:** CFO (with Board Advisor risk commentary) · **Date:** 2026-07-27
**Status:** v1, for founder review

**Hard inputs from the founders (2026-07-27):**
- Capital: **₹0 raised.** Cash spend to date ≈ Claude Pro (~₹1,700/mo).
- **Runway: 6 months maximum** → **expires ~end of January 2027.**
- Team: 3 people, 2.0 FTE.
- Beachhead batch size: **1,000 final-year students** (2027 batch, home campus).
- Payments: **not built.** No Razorpay/Stripe anywhere in the codebase.

> `[ASSUMPTION]` = my estimate, editable. `[VERIFY]` = go check the vendor's current
> published price before this number enters a deck. Every rupee figure below is
> order-of-magnitude, not accounting.

---

## 0. The finding that outranks everything else in this document

Put your three dates on one line:

| Date | Event |
|---|---|
| **Jan 2027** | **Your runway ends** |
| Apr–Jun 2027 | Colleges allocate training budgets — your primary revenue window |
| Aug 2027 | A college contract would actually start paying |

> **You run out of money 3–6 months before your primary revenue channel opens, and
> ~7 months before it pays.** The 90-day pilot plan is correct and it does not save you.
> It ends in October with a great case study and four months of runway left, pointed at
> a door that opens in April.

This is not a reason to panic — it's a reason to **add a bridge to the plan now**, while
it's cheap, instead of discovering it in December. §5 covers the three bridges. §7 sets
a decision date.

---

## 1. Unit economics — what a session actually costs

### The architectural fact that drives COGS

Your server subscribes to **one STT stream per participant, open for the full room
duration** — not only while that person is speaking. So a 5-person, 15-minute room burns
**75 stream-minutes**, regardless of who talks. Silence costs the same as speech.

That's the correct (and less flattering) way to model it, and it's a direct consequence
of the per-track attribution design that is also your differentiator. Fine trade — but
model it honestly.

### Cost per session `[VERIFY all vendor rates]`

| Component | Rate | Per session (5 × 15 min) |
|---|---|---|
| **AssemblyAI streaming STT** | ~$0.0025/min `[ASSUMPTION]` | 75 min × $0.0025 = **$0.19 ≈ ₹16** |
| **Gemini feedback** (5 calls, ~4k input tokens each) | Free tier today; ~$0.15/M input paid `[VERIFY]` | **<₹1** |
| **Gemini topic generation** | 1 call | **~₹0** |
| **LiveKit audio** (5 participant-minutes × 15) | Free tier; audio-only is cheap | **~₹0** at pilot scale `[VERIFY tier limits]` |
| **Render + Cloudflare + Supabase** | Free tiers | **₹0** (fixed, not per-session) |
| | **Marginal COGS / session** | **≈ ₹17** |
| | **Marginal COGS / student-session** | **≈ ₹3.4** |

### Two conclusions from this

**1. The pilot is affordable. COGS is not your problem.**
40 sessions over 90 days ≈ **₹700 total.** Even 200 sessions ≈ ₹3,400. Your constraint
is *founder time and personal runway*, not infrastructure. Stop optimizing for free tiers
and start optimizing for speed — if paying ₹3,000 removes a week of work, pay it.

**2. Usage-based COGS + flat-rate pricing = your best users destroy your margin.**

| Student's annual usage | COGS/student/yr | Gross margin at ₹200/student/yr |
|---|---|---|
| 5 sessions (typical) | ₹17 | **92%** |
| 15 sessions (engaged) | ₹51 | **75%** |
| 40 sessions (power user) | ₹136 | **32%** |
| 60 sessions | ₹204 | **negative** |

⚠️ **CFO flag:** a flat per-student licence with unlimited sessions has an unbounded
cost tail. Cap it — *"20 sessions/student/year included"* — in the very first contract
you write. It costs nothing to include now and is painful to retrofit later.

---

## 2. Pricing — and which segment is actually a business

| Segment | Price `[ASSUMPTION]` | CAC | LTV | LTV/CAC | Payback | Verdict |
|---|---|---|---|---|---|---|
| **B2B college** | ₹200/student/yr × 1,000 = **₹2L/college/yr** | ~₹40k fully-loaded founder time + travel | ₹2L × 3yr retention = **₹6L** | **~15×** | **<3 months** | ✅ **This is the business** |
| **B2C graduate** (organic/campus) | ₹199 / 30-day pass | ~₹0 (word of mouth) | **₹199 (exactly 1 purchase — see below)** | n/a | Instant | ⚠️ Works only while CAC is zero |
| **B2C graduate** (paid ads) | ₹199 | ₹150–300 `[ASSUMPTION]` | **₹199** | **~1×** | **Never** | ❌ **Structurally dead. You lose money on every customer** |
| **MBA GD-PI aspirant** | **₹1,500 / season pass** | ~₹100–200 (community/organic) | ~₹1,500 (single season) | **~8–15×** | Instant | ✅ **The bridge — see §5** |

> **🔑 Why B2C LTV is exactly one purchase (founder, 2026-07-27): students never return
> once they're placed.** There is no second sale, ever. The lifecycle is panic → practise
> → placed → gone. This isn't churn to be fixed — it's the job completing successfully
> (`founder-decisions.md` §10a).
>
> **The consequence is the cleanest strategic statement in this whole model:**
> **the student is a single-use customer; the college is a renewable one.** Every year the
> institution gets a fresh batch with the identical problem. Recurring revenue exists
> *only* through B2B. Your 100% annual student churn is not a weakness in the B2B pitch —
> it is the reason the B2B pitch exists.

**Two things this table settles:**

1. **B2B college is the business.** ~15× LTV/CAC, sub-3-month payback. Everything in
   `market-strategy.md` §4 (relationships are your only moat) is confirmed by the
   economics, not just the strategy.
2. **B2C with paid acquisition is structurally dead at ₹199.** LTV/CAC of 1–2× means you
   lose money buying users. B2C is viable *only* as an organic, campus-led, word-of-mouth
   motion. **Never spend money acquiring a ₹199 customer.**

**Why MBA GD-PI prices 7.5× higher for the same product:** those candidates already pay
₹5,000–25,000 `[ASSUMPTION]` for GD-PI coaching from CL/IMS/TIME, and a single GD round
stands between them and an IIM seat. Same software, same session, 7.5× the price —
because the willingness to pay is anchored to a different alternative.

---

## 3. Burn — and the distinction that matters most

| Type | Monthly | Notes |
|---|---|---|
| **Cash burn** | **~₹2,000–5,000/mo** | Claude Pro, a domain, STT overage. Genuinely trivial |
| **Opportunity-cost burn** | **~₹80,000/mo** `[ASSUMPTION]` | 2 FTE × ~₹5L/yr forgone salary for a fresh engineering grad |

> **Your company barely burns cash. Your *founders* burn personal runway.**
> That single distinction should drive every financing decision you make.

**The consequence, and it's the cheapest option on the board:** because the constraint is
personal income and not company spend, **any income at all buys enormous time.** One
founder freelancing at ₹30–40k/month cuts you from 2.0 FTE to ~1.5 FTE but can roughly
**double the runway** — from Jan 2027 to somewhere past the April procurement window.

That's unglamorous, and it is almost certainly the highest-expected-value move available
to you. A board would raise it in the first meeting. Full trade-off analysis →
`founder-decisions.md`.

### The survival number

To keep 2 founders going at ~₹30k/month each: **₹60,000/month ≈ ₹7.2L/year.**

That's your break-even, and it's reachable three different ways:

| Path | Volume required | Realistic? |
|---|---|---|
| **B2B colleges** @ ₹2L/yr | **4 colleges** | ✅ Yes — but not before Aug 2027 |
| **MBA GD-PI** @ ₹1,500 | **500 aspirants** (~0.2% of serious CAT takers) | ✅ **Yes, and it lands Jan–Apr 2027** |
| **B2C graduates** @ ₹199 | **3,600 passes** | ❌ Not without paid acquisition, which doesn't work |

**₹7.2L is a small number.** You are not trying to build a rocket in six months — you're
trying to clear a low bar before January. Frame it that way internally; it changes how
the next six months feel.

---

## 4. 12–18 month projection — three scenarios

Fiscal view, Aug 2026 → Dec 2027. All figures ₹ lakh.

### Scenario A — "Execute the pilot plan as written" (BASE CASE)

| Period | Activity | Revenue | Runway |
|---|---|---|---|
| Aug–Oct 26 | Campus pilot, case study | ₹0 | 3 months left |
| Nov–Dec 26 | Polish, approach colleges | ₹0 | 1 month left |
| **Jan 27** | **Runway exhausted** | ₹0 | ❌ **DEAD** |
| Apr–Jun 27 | *(Procurement window you're not alive for)* | — | — |

> **The base case fails.** Not because the plan is wrong — the pilot plan is right — but
> because it has no revenue event before January. Naming this now is the entire point of
> building a model.

### Scenario B — "Pilot + MBA bridge" (RECOMMENDED)

| Period | Activity | Revenue | Cumulative |
|---|---|---|---|
| Aug–Oct 26 | Campus pilot + case study (unchanged) | ₹0 | ₹0 |
| Nov 26 | Build payments (~2 wks); open to off-campus 2026 grads — **your own batch, still job-hunting** | ₹0.3L `[ASSUMPTION: 150 × ₹199]` | ₹0.3L |
| Dec 26 | CAT results imminent; launch MBA GD-PI positioning | ₹0.5L | ₹0.8L |
| **Jan–Mar 27** | **MBA GD-PI season — peak** | **₹6.0L** `[400 × ₹1,500]` | ₹6.8L |
| Apr–Jun 27 | College procurement using the Oct case study | ₹2L (1 contract signed, paid Aug) | ₹6.8L cash |
| Jul–Dec 27 | 2027–28 campus season, 3–5 colleges live | ₹8L | ₹14.8L |

**Survives, thin.** Requires payments built by November and MBA positioning by December.
**₹6.8L by March vs a ₹7.2L survival bar — you clear it by a nose.** No margin for a
slipped month, which is exactly why the November decision date in §7 matters.

### Scenario C — "Pilot + raise" (PARALLEL, not alternative)

| Period | Activity | Revenue/Capital |
|---|---|---|
| Aug–Oct 26 | Pilot + case study | ₹0 |
| Nov 26–Jan 27 | Angel/pre-seed on the case study | **₹25–50L** `[ASSUMPTION]` |
| Feb 27+ | 18–24 months runway; hire; multi-campus | — |

**Honest read on your fundability:** by November you'd have a real product, a real pilot,
real usage data, a technical team that ships fast, and a genuinely hard-to-copy live
multi-human room. That's a credible **angel/pre-seed** story in the Indian edtech market.

It is **not** a credible institutional-VC story, for the reasons in `market-strategy.md`
§7 — SAM ~₹22 Cr, GD rounds are a South-Asia hiring convention with no US market, and
100% annual student churn. **Target angels and micro-VCs. Don't burn two months chasing
Tier-1 funds who will pass on market size.**

Also: raising takes 2–4 months. Starting in November means money in Feb–Mar at best —
**after** your runway ends. Scenario C **cannot be the only plan.** Run B and C together.

---

## 5. The three bridges across Feb–Jun 2027

| Bridge | Revenue potential | Effort | Timing fit | Verdict |
|---|---|---|---|---|
| **1. MBA GD-PI season** | **₹6L (Jan–Mar)** | Low — **same product, zero new features**; new positioning + payments | ⭐ **Lands exactly in the gap** | ✅ **Primary** |
| **2. Extend runway via freelance** | ₹0 revenue, but **+4–6 months of time** | Low — costs 0.5 FTE | Immediate | ✅ **Do this too** |
| **3. Angel raise on the case study** | ₹25–50L | High — 2–4 months of founder time | Money lands Feb–Mar, post-runway | ⚠️ Parallel, never sole |
| ~~4. Out-of-cycle college contract~~ | ₹0.5–2L | High | Unreliable | ❌ Possible, don't plan on it |

**The MBA bridge deserves emphasis.** It requires **no new product** — a GD is a GD. It
needs (a) payments, (b) different positioning, (c) a different acquisition channel
(CAT/MBA prep communities, not your campus). It is counter-cyclical to the engineering
placement season, so it doesn't compete with your core motion for calendar time. And it
prices at 7.5× your B2C rate.

**It is the single highest-leverage unexplored idea in this business**, and it was
invisible until the runway number made the gap visible.

---

## 6. Benchmarks — how you compare at this stage

| Metric | You | "Good" at pre-seed | Read |
|---|---|---|---|
| Gross margin | 75–92% (at ≤15 sessions) | 70–80% SaaS | ✅ Healthy — **if you cap sessions** |
| LTV/CAC — B2B | ~15× | ≥3× | ✅ Excellent |
| LTV/CAC — B2C paid | 1–2× | ≥3× | ❌ Don't do it |
| CAC payback — B2B | <3 months | <12 months | ✅ Excellent |
| Revenue at pre-seed | ₹0 | ₹0–50L | ✅ Normal — pilots raise |
| Runway | **6 months** | **12–18 months** | ❌ **Well below bar** |
| Burn multiple | n/a (no revenue) | <2× | — |
| Free→paid conversion | Untested | 2–5% student edtech | ⚠️ Unknown; a Scenario-B risk |
| B2B sales cycle | Untested | 3–9 months, seasonal | ⚠️ Assume 9, not 3 |

**Bottom line:** your *unit economics are genuinely good* and your *balance sheet is
genuinely dangerous.* Investors will believe the first and price the second.

---

## 7. Financial risks a board would flag

Ranked by what actually kills you.

1. **🔴 Runway ends before primary revenue opens (§0).** The defining risk.
   → Bridges 1 and 2, decision date below.
2. **🔴 No payment infrastructure.** You cannot capture revenue even if demand appears
   tomorrow. → Build in November. Not now — it produces zero pilot users in Aug–Oct.
3. **🟠 Single-campus, single-segment concentration.** One TPO's "no" is 100% of your
   B2B pipeline. → The MBA bridge diversifies segment; campus #2 waits for the case study.
4. **🟠 Founder attrition.** At 3 people, one departure is −33% capacity and likely
   fatal. The 6-month clock makes this a live risk, not a theoretical one.
   → Have the conversation *now*, at month 0, not at month 5.
5. **🟠 Free-tier dependency.** Gemini free-tier terms permit training on submitted data
   (your students' transcripts — already flagged in ADR-0008), AssemblyAI trial credits
   expire, Render free tier sleeps. **A paying college will require a DPA.** DPDP
   compliance for a B2B contract will likely force a paid Gemini tier.
   → Budget ~₹5–10k/mo `[ASSUMPTION]` from your first contract. Don't let it surprise you.
6. **🟡 Revenue seasonality.** Procurement Apr–Jun, usage Aug–Dec, MBA Jan–Apr. Lumpy,
   with two dead quarters. → Plan cash across the year, not month to month.
7. **🟡 Unbounded COGS tail** from power users under flat pricing (§1).
   → Cap sessions in contract #1.
8. **🟡 Founder-moderated sessions don't scale.** 5 sessions/week is a human ceiling.
   At 4 colleges it's a wall. → Not a Q3 problem. It is a Q1-2027 problem.

---

## 8. Decisions this model forces

| # | Decision | Deadline | My recommendation |
|---|---|---|---|
| 1 | Does one founder take freelance/part-time income to extend runway? | **15 Aug 2026** | **Yes.** Cheapest survival insurance available. Costs 0.5 FTE, buys 4–6 months |
| 2 | Commit to the MBA GD-PI bridge for Jan–Mar 2027? | **15 Nov 2026** | **Yes**, conditional on pilot retention holding up |
| 3 | Build payments? | Start **1 Nov 2026** | Yes — November, not before |
| 4 | Start angel conversations? | **1 Nov 2026** | Yes, in parallel. Angels/micro-VCs only |
| 5 | Cap sessions/student in the first B2B contract? | Before contract #1 | **Yes, 20/year.** Free to add now |

### 🚩 The go/no-go date: **15 November 2026**

At that point you'll have the pilot data and ~2.5 months of runway. Decide, in one
sitting:

- **Retention good + bridge viable** → execute Scenario B, raise in parallel.
- **Retention good + no bridge traction** → extend runway (freelance) and push everything
  to the Apr–Jun 2027 window.
- **Retention poor (<25% session-2 return)** → this is a **pivot trigger**, not a funding
  problem. See `founder-decisions.md`.

**Do not let this date pass undiscussed.** With 6 months of runway, the most expensive
thing you can do is drift.

---

## Assumptions you should overwrite

| Assumption | Used | How to check |
|---|---|---|
| AssemblyAI $0.0025/min | COGS | Their pricing page, today |
| LiveKit free-tier limits | COGS ≈ 0 | Your LiveKit dashboard |
| ₹200/student/yr B2B | All B2B economics | **Ask your TPO what they pay their current vendor.** One question, transforms this model |
| ₹1,500 MBA season pass | Bridge revenue | Ask 5 CAT aspirants what they paid for GD-PI coaching |
| ₹30k/month founder minimum | Survival number | Only you know this |
| 3-year college retention | B2B LTV | Unknowable yet; 3 yrs is standard-ish for edtech B2B |
| 400 MBA conversions | Scenario B | The biggest unknown in the model — test in Dec with a landing page before you build anything |
