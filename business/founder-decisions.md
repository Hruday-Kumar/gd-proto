# Founder Decisions Log — PlaceMe

**Purpose:** a running record of every consequential decision, the framework used, and
what would make us reverse it. Append, never rewrite. Future-you will not remember why.

**Format:** `D<n> · Date · Decision · Framework · Reversibility · Reverse-if`

---

## 0. The meta-rule: almost nothing you decide right now is irreversible

Classify every decision before agonising over it:

| Type | Definition | How to treat it |
|---|---|---|
| **Type 1 — one-way door** | Expensive or impossible to undo | Deliberate. Get input. Sleep on it |
| **Type 2 — two-way door** | Undoable in <2 weeks for <₹20k | **Decide in 10 minutes. Alone. Now** |

**Almost every decision facing you today is Type 2.** Pricing, positioning, which channel,
whether matching is visible, session length, what to call things — all reversible in days.

Your genuine Type 1 decisions are only these: **who's on the cap table**, **whether a
founder leaves**, **taking investor money**, and **anything that burns your one campus
relationship** (a botched TPO pitch, a mass message to a batch group that lands on a
broken product).

> **Diagnostic:** the two "not sure" answers on 2026-07-27 were both Type 2 decisions
> treated as Type 1. That pattern costs weeks. With 6 months of runway, **the cost of
> deciding wrong is almost always lower than the cost of deciding late.**

---

## DECIDED

### D1 · 2026-07-27 · Scheduled sessions become the hero; random matching keeps a soft-landing fallback

**Context:** `POST /api/rooms/match` + `matchmaking_queue` + `MatchPage` are built, but
`PROGRESS.md` records the path has never been tested with 3 live sessions. Pilot size is
10–30 students.

**Framework — *Liquidity precedes discovery*.** In a multi-sided product, matching can
only *discover* liquidity that already exists; scheduling *manufactures* it. Below a
density threshold, matching converts every visit into a wait, and a wait is a failed
first run. At n=10 there is no ambient liquidity, ever.

**Decision:** scheduled cohort sessions become the primary CTA. Matching stays visible,
but the infinite queue is replaced with *"Nobody's free right now — next session is
Thursday 8pm."*

**Reversibility:** Type 2, ~1 day of work. Code stays; only the entry point changes.
**Reverse if:** WAD >100/week with multiple concurrent rooms — real ambient liquidity.
**Cost of being wrong:** ~1 day. **Cost of not deciding:** every early user's first
experience is an empty queue.

---

### D2 · 2026-07-27 · One goal for the next 90 days: a campus pilot + case study

**Context:** stated goals were "users + college contracts + revenue" — three goals at
2.0 FTE and ₹0.

**Framework — *constraint-first goal setting*.** Don't pick the goal you want; pick the
one your constraints permit. College budgets for AY26–27 were allocated Apr–Jun and are
spent, so contracts are *structurally unavailable* this cycle. Revenue requires payments
you haven't built. Users without a case study don't compound into anything.

**Decision:** get your juniors (2027 batch) using PlaceMe during their real placement
season, and produce a case study. Users are the means; contracts and revenue are FY27
outcomes this unlocks.

**Reversibility:** Type 2 in principle, but the *window* is Type 1 — miss Aug–Dec 2026
and the next credible case study is Aug 2027, a 12-month delay on first B2B revenue.
**Reverse if:** a college offers a paid pilot out of cycle (take the money, keep the goal).

---

## OPEN — with deadlines

> An open decision with no deadline is a decision to do nothing. Each of these has a date.

### D3 · 🔴 Does one founder take freelance/part-time income? · **Deadline: 15 Aug 2026**

**Framework — *separate company burn from founder burn*.** Cash burn ≈ ₹3k/month.
Opportunity-cost burn ≈ ₹80k/month. The company isn't running out of money; the founders
are running out of personal runway. So the cheapest lever isn't revenue — it's **income**.

| | Freelance (0.5 FTE) | Stay 2.0 FTE |
|---|---|---|
| Runway | **Jan 2027 → ~May–Jun 2027** | Ends Jan 2027 |
| Reaches Apr–Jun procurement window? | ✅ Yes | ❌ No |
| Execution speed | ~25% slower | Full speed |
| Decision quality under pressure | Calmer | Desperate by November |

**Recommendation: yes.** The product is built; the next 90 days need distribution, which
is less FTE-hungry than building. Crossing into the April procurement window alive is
worth more than 25% more velocity in a quarter where velocity isn't the constraint.

⚠️ **Arrange it now, while you're not desperate.** Freelance terms get worse the more you
need them. **Do not let this slip past 15 Aug.**

---

### D4 · 🔴 Does the part-time co-founder move to GTM full-time and stop touching code? · **Deadline: this week**

**Framework — *point capacity at the binding constraint*.** Engineering velocity: 57
commits and a working live-audio product in 3 days. Distribution velocity: zero. Adding
engineering capacity to a team that isn't engineering-constrained produces nothing.

**Recommendation: yes.** They own campus relationships, session scheduling, CR
recruitment, the Week-4 TPO meeting, and testimonial collection. **Nobody currently owns
any of these, which is why none of them are happening.**

⚠️ Interacts with D3 — if one founder freelances *and* one goes full GTM, engineering
drops to ~0.5–1.0 FTE. That is probably correct. Make the trade knowingly.

---

### D5 · 🟠 Commit to the MBA GD-PI bridge for Jan–Mar 2027? · **Deadline: 15 Nov 2026**

**Framework — *find revenue that fits the calendar hole*.** Runway ends Jan 2027;
primary revenue opens Apr 2027. Any bridge must (a) land Jan–Mar, (b) need no new
product, (c) not compete for calendar time with the core motion.

MBA GD-PI hits all three: CAT results early Jan, GD-PI rounds Feb–Apr, same software
unchanged, and counter-cyclical to engineering placement season. Prices at ~₹1,500
against a ₹5–25k coaching alternative. **500 conversions ≈ ₹7.5L ≈ your survival number.**

**Recommendation: yes, conditional on pilot retention (session-2 return ≥25%).**

**Cheap validation before committing (Dec, ~1 day):** put up a landing page for the MBA
segment and count emails. Don't build anything. If 200 CAT aspirants sign up for a
waitlist in two weeks, the bridge is real.

---

### D6 · 🟠 Build payments · **Start: 1 Nov 2026 — not before**

**Framework — *build capture only when there's something to capture*.** Payments produce
zero pilot users in Aug–Oct and cost ~2 weeks of a 2.0 FTE team. But you cannot take
money in January without them, and January is survival.

**Recommendation:** start 1 Nov. Razorpay (Indian cards/UPI). One product: a ₹1,500
season pass. **Resist building tiers, subscriptions, or coupon logic** — that's a
month you don't have.

---

### D7 · 🟠 Start angel conversations · **Start: 1 Nov 2026 · Parallel to D5, never instead of it**

**Framework — *raising is a 2–4 month process, so count backwards*.** Start in November,
money lands Feb–Mar — after your runway ends. **A raise cannot be the only plan.**

**Target: angels and micro-VCs. Not Tier-1 institutional funds.** SAM ~₹22 Cr, no US
market for GD rounds, structural ~100% annual student churn. A Tier-1 fund will pass on
market size, and finding that out will cost you two months you can't spare
(`market-strategy.md` §7).

**What makes you fundable by November:** a working product a competitor can't trivially
copy, a real pilot with usage data, testimonials, and a team that ships anomalously fast.

---

### D8 · 🟡 Cap sessions per student in the first B2B contract · **Deadline: before contract #1**

**Framework — *bound the cost tail before signing, not after*.** Flat pricing over
usage-based COGS goes negative on power users: at ₹200/student/year, 60 sessions/year
puts that student underwater (`revenue-model.md` §1).

**Recommendation: yes — "20 sessions/student/year included."** Costs nothing to add now,
painful to retrofit into a renewal.

---

### D9 · 🚩 **GO / NO-GO REVIEW · 15 Nov 2026**

The most important date in this document. You'll have full pilot data and ~2.5 months of
runway. Decide in one sitting, all three founders present:

| Pilot signal | Decision |
|---|---|
| Session-2 return **≥40%**, fill rate ≥70% | **Persist + scale.** Execute D5 + D7. Second campus in Jan |
| Session-2 return **25–40%** | **Persist + fix.** No new campuses. Fix retention, run the bridge, extend runway |
| Session-2 return **<25%** | **PIVOT REVIEW.** See §10 below |
| Fewer than 30 students ever used it | **Distribution failure, not product failure.** Different diagnosis, different fix — don't confuse the two |

---

## 10. Pivot-vs-persist framework (for 15 Nov, or any time metric 3 trips)

Do not use gut feel. Run these four questions in order.

**Q1 — Did enough people try it for the signal to be real?**
<30 students → you don't have data, you have noise. This is a *distribution* problem.
Fix distribution first; do not pivot on n=12.

**Q2 — Did the ones who tried it get the intended experience?**
Check broken-session rate. If >20% of sessions failed technically, **you measured your
infrastructure, not your value proposition.** Fix and re-measure.

**Q3 — Why exactly did they not return?** (Interview 10. No substitutes.)

| Stated reason | Diagnosis | Response |
|---|---|---|
| "Couldn't find a time / room was empty" | **Liquidity** | Persist. Fix scheduling. Not a product failure |
| "Feedback wasn't useful/specific" | **Core value** | Persist + fix. The feedback prompt is one file and iterable |
| "It was useful, but I only needed it once" | **Frequency** | ⚠️ Serious. GD prep may be inherently low-frequency — pivot the *model* (one-time pass, not subscription), not the product |
| "Too awkward speaking to strangers" | **Format** | ⚠️ Serious. Points at AI-voice mode as primary, not secondary |
| "I forgot / got busy" | **Weak pull** | The most common and most honest. Needs a scheduled ritual, not a feature |

**Q4 — Is there a pivot with real evidence behind it?** Never pivot toward a hypothesis
you haven't tested. Ranked by how much you'd keep:

| Pivot | Keeps | Trigger |
|---|---|---|
| **Segment pivot → MBA GD-PI as primary** | Everything. Same product | Engineering students won't pay/return, but MBA waitlist converts |
| **Format pivot → AI Voice Practice mode as primary** | Rooms, STT, attribution, feedback. Loses the liquidity requirement entirely | Q3 says "awkward with strangers" or liquidity is unfixable |
| **Module pivot → 1-on-1 roleplay interview** | Auth, consent, STT, feedback, history. Loses multiplayer differentiation | GD proves too low-frequency to build a business on |
| **Model pivot → sell to colleges as a service you operate** | Everything. You run the sessions | Students won't self-organise but the TPO wants the outcome |
| ❌ Abandon | — | Only if Q1–Q3 all fail after honest effort |

**Note:** every pivot on that list reuses most of what you've built. **This codebase is
unusually pivot-friendly** — auth, consent, live audio, per-speaker STT, LLM feedback,
and history are all module-independent. That is a real asset and it should lower your
fear of the November review considerably.

---

## 10a. 🔑 STRUCTURAL CONSTRAINT (founder, 2026-07-27): students never return after placement

**The fact:** a student stops using PlaceMe the moment they get placed. Permanently.

This is not churn. It is the **job-to-be-done completing successfully.** A student who
practises six times in October, gets placed in November, and never opens the app again is
your **best possible outcome**, not a retention failure. Treating it as churn would send
you chasing a metric you should never move.

**What it changes — five things, all of them important:**

1. **The user lifecycle is fixed and short.** Panic (~Aug) → intense practice (4–8 weeks)
   → placed → gone. **Maximum realistic lifetime: one season.** Every student is
   single-use by design.
2. **Long-term retention is the wrong metric and must come off the dashboard.**
   The right ones are *intensity inside the window* (sessions per student during their
   active 4–8 weeks) and *completion* (did they get placed). See `ceo-dashboard.md` §2a.
3. **Subscriptions are structurally wrong** — confirmed, not guessed. A season pass is the
   only honest B2C shape. A monthly subscription bills people after their need has ended,
   which is both bad business and bad faith.
4. **B2C LTV is one purchase. Ever. Never two.** This makes paid B2C acquisition
   *worse* than modelled — LTV/CAC drops to ~1×. B2C is organic-only, permanently.
5. **🌟 The strategic consequence — this is the big one:**

> **The student is a single-use customer. The college is a renewable one.**
> Every year the college gets a fresh batch with the identical problem. The institution
> is the only customer that can ever renew, which means recurring revenue is *only*
> available through B2B. Your 100% annual student churn isn't a weakness in the B2B
> pitch — **it's the reason the B2B pitch exists.**

**Two new mechanics this creates:**

- **The exit testimonial.** A newly-placed student is at peak goodwill and about to
  vanish forever. **Capture them on the way out** — the moment they report a placement,
  ask for a testimonial and a message to their juniors. This is your only window, it
  closes permanently, and it's the highest-quality case-study asset available
  (*"I used PlaceMe and got placed at X"* beats every usage statistic).
- **Annual empty-out.** Your user base drains to near-zero every December. Revenue is a
  pure annual-cohort business with two dead quarters. **This upgrades the MBA GD-PI
  bridge (D5) from opportunistic to structural** — it's what fills Jan–Apr every year,
  not just this once.

**Corrects:** `gtm-strategy.md` Wk 5–8 success criterion · `ceo-dashboard.md` §2
retention framing · `revenue-model.md` §2 B2C LTV.

---

## 11. Anti-scope-creep register — decided NOT to do, and why

Revisit only at the 15 Nov review. Adding to this list is a decision; removing from it
requires one.

| Shiny object | Why not now | Revisit |
|---|---|---|
| **GD AI Voice Practice mode** | Genuinely exciting, and #2 in the product doc. Also the hardest thing in the vision. Doesn't serve the 90-day goal | 15 Nov (pivot option) |
| **JAM / Aptitude / Roleplay modules** | Breadth is the B2B need, but you can't build 3 modules on 1.0 FTE before January | Q2 2027, post-revenue |
| **Drive Simulator** | Commercially the real B2B product. Needs the other modules first | 2027 |
| **Mobile app** | The web app works on phones. A native app is months for near-zero incremental conversion | Not in 12 months |
| **Payments now** | Zero pilot users produced | 1 Nov (D6) |
| **Second campus** | Dilutes liquidity across two campuses; neither fills a room. **Density beats reach** | Jan 2027, post case study |
| **Tier-1 VC fundraising** | Will pass on market size; costs 2 months to learn | Not on current SAM |
| **Self-hosted fonts, UI primitives, dark-mode polish** | Real engineering debt from the last session. Zero students are blocked by it | Whenever it blocks a user |
| **Multi-language transcription** | Flagged in PROGRESS.md. GD rounds are conducted in English | Only if a pilot student is blocked |

**The filter for anything new:** *"Does this get a student into a filled room before
31 Oct 2026?"* If no, it goes on this list.

---

## 12. Decisions you made implicitly and should now own explicitly

Recorded because unexamined defaults become permanent.

| Implicit decision | Made when | Status |
|---|---|---|
| GD multiplayer first, despite being the hardest liquidity problem | Product doc, on **technical** sequencing grounds | ✅ Keep — it's your differentiator. But own that the rationale was engineering, not commercial |
| B2B2C primary over B2C | Never explicitly | ✅ **Confirmed by economics** — B2B LTV/CAC ~15× vs B2C-paid 1–2× |
| Free tiers everywhere | ADR-0002/0007/0008, when budget was ₹0 | ⚠️ **Revisit.** COGS ≈ ₹17/session. The pilot costs ~₹700 total. Paying to remove a week of work is now correct |
| Students' transcripts processed under Gemini's free tier (trainable, human-reviewed) | ADR-0008, disclosed in consent | ⚠️ **Becomes a blocker at contract #1.** A college will require a DPA. Budget the paid tier |
| No cohort/college entity in the data model | By omission | ❌ **Blocks the TPO report you plan to promise** (`gtm-strategy.md` §2). Decide by Week 4 |

---

## Append new decisions below

```
### D<n> · <date> · <decision>
**Context:**
**Framework:**
**Decision:**
**Reversibility:** Type 1 / Type 2
**Reverse if:**
```
