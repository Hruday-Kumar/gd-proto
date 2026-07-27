# Board Review & Governance — PlaceMe

**Author:** Board Advisor · **Date:** 2026-07-27 · **Status:** v1
**Framing:** you have no formal board. You should still be governed like you do — because
the habits you build at 3 people are the ones an investor will diligence at 30.

---

## 1. The question you didn't ask, and it's the urgent one

Everything so far has been about strategy. **The things most likely to kill this company
in the next six months are not strategic.** They're structural, boring, and cheap to fix
today — and expensive-to-impossible to fix later.

### 🔴 Blind spot #1: You are three fresh graduates in placement season

You graduated in 2026. Your peers are getting placed *right now.* Your runway ends in
January. **The probability that at least one of you receives a real job offer in the next
six months is high** — and nothing in your plan accounts for it.

This isn't hypothetical risk. It's the base rate for your exact situation.

**What a board would insist on, this month:**
- Have the explicit conversation: *"What offer would make each of us leave?"* Name the
  number out loud. Founders who avoid this conversation discover the answer at the worst
  possible moment.
- Agree what happens to equity if someone leaves at month 4 (see #2).
- Decide whether any of you are actively interviewing. **Not a judgement — a planning input.**
  An undisclosed job search is the single most common way a 3-person team dies.

### 🔴 Blind spot #2: No vesting = a company that can't be funded

`[ASSUMPTION — confirm]` I see no cap table, founder agreement, or vesting schedule in the
repo or the docs.

**The scenario:** one founder leaves in November holding ~33% of a company they worked on
for four months. That equity is gone forever. Every subsequent investor sees a dead 33%
on the cap table and passes — not because the business is bad, but because the structure
is unfixable without that person's goodwill.

> **4-year vesting with a 1-year cliff, on all three founders, backdated to when you
> started.** This is standard, it protects each of you from the others equally, and it
> costs a lawyer's afternoon. **Do it before anyone has a reason to object.**

The window where this is an easy conversation is *now*, while everyone is committed and
nobody's leaving. That window closes silently.

### 🔴 Blind spot #3: You may not be able to legally accept money

`[VERIFY]` Is PlaceMe an incorporated entity — Pvt Ltd or LLP?

If not:
- **A college cannot pay you.** Institutional procurement requires an invoice from a
  registered entity with a GSTIN. No entity = no B2B revenue, regardless of how good the
  pilot is.
- **An angel cannot invest in you.**
- **A payment gateway won't onboard you.** Razorpay needs entity documentation — which
  means D6 (build payments, 1 Nov) has a hidden dependency that takes 2–4 weeks.
- **Nobody owns the IP.** Three individuals wrote this code with no assignment agreement.
  That's a diligence failure and, in a bad falling-out, a genuine ownership dispute.

**Recommendation:** incorporate a Pvt Ltd by **30 September 2026** — before the November
payments build, well before any contract. Cost is roughly ₹15–25k `[VERIFY]`, which is
real money at ₹0 but it is a hard prerequisite for every revenue path in the model.

⚠️ **Sequencing note:** this collides with the ₹0 budget. It's the one expense I'd argue
is genuinely non-optional, because it gates *all* revenue.

---

## 2. Legal & compliance — what a college contract will demand

You've handled consent well (guardrail #3, recorded consent, four disclosures, DPDP-aware
schema). That's better than most seed-stage companies. **The gap is what happens when an
institution signs.**

| Issue | Status | What a college will require |
|---|---|---|
| Recorded mic consent | ✅ Built and human-verified | — |
| Raw audio never persisted | ✅ By construction | Will need to be stated in writing |
| Own-data-only access | ✅ Enforced at DB level via RLS | Evidence, not a claim |
| **Gemini free tier trains on student transcripts** | ⚠️ Disclosed to students in consent copy | ❌ **A college will not accept this.** Expect to move feedback generation to a paid tier. Budget it (`revenue-model.md` §7) |
| **Data Processing Agreement** | ❌ Doesn't exist | Standard ask in any institutional contract |
| **Named grievance officer** (DPDP) | ❌ Doesn't exist | Required of a data fiduciary |
| **Documented retention & deletion policy** | ⚠️ Implemented in product, not written down | Will be asked for |
| **Account deletion path** | ⚠️ `[VERIFY]` — is there a user-facing delete? | DPDP gives a right to erasure |

**None of this blocks the pilot.** All of it blocks contract #1. Handle it in
November–December, not in April when a TPO is waiting on you.

---

## 3. Skeptical review of the plan I just helped you write

A board that only validates is worthless. Here's where I'd push on my own advice.

**"The campus pilot is a great plan — but it has no failure branch."**
Everything assumes the TPO is receptive, the CRs help, and students show up. What if you
run three sessions in August and get four people total? There's no defined *abort*
condition before the 15 Nov review. **Add one: if WAD is under 15 by 15 September, stop
executing and re-diagnose.** Six weeks of empty rooms is enough information.

**"The MBA bridge is a plan built on zero evidence."**
I recommended it enthusiastically. It rests on: 400–500 conversions at ₹1,500 from a
segment you've never spoken to, through channels you've never used, with payments you
haven't built. **That's three unvalidated assumptions stacked into your survival plan.**
The December landing-page test is not optional — it's the whole basis for betting on it.
If it fails, D3 (extend runway) becomes the *only* plan, which is another argument for
deciding D3 in August rather than November.

**"Your unfair advantage has a 12-month expiry."**
Alumni access to one campus is genuinely strong — this year. Next year you're strangers
to the incoming batch, with no student network and one TPO relationship. **The case study
isn't just a sales asset; it's the thing that replaces your unfair advantage when it
expires.** That raises the stakes on collecting it properly.

**"Two of my recommendations conflict and I flagged it too lightly."**
D3 (freelance, −0.5 FTE) and D4 (co-founder to GTM, −1.0 FTE from engineering) together
leave roughly 0.5–1.0 FTE of engineering — while you still have to ship scheduling,
instrumentation, a TPO report, payments, and fix whatever the pilot breaks. **That may be
too thin.** A board would ask you to sequence them: D4 now, D3 only if the pilot confirms
the product works. I'd defend the original recommendation, but you should make that call
consciously.

---

## 4. Pushback on your ask

You asked for a full executive team: strategy, GTM, financial models, dashboards,
governance. You got it, and I think it was worth the two hours.

**It is also, right now, the highest-quality form of procrastination available to you.**

You have five well-written documents and **zero deployed software**. Not one student can
use PlaceMe today. Your juniors' drives start in three to six weeks. Every document in
this folder is worth exactly ₹0 until Week 0 ships.

> **A board's job is to say this plainly: stop planning. Deploy. Come back to these
> documents on 15 September with real numbers in them.**

If the next thing you do is ask me to build a pitch deck, a competitor teardown, or a
financial model with more scenarios — **that's the tell.** Push back on yourselves.

---

## 5. Decision rights — what shouldn't be decided alone

You have no formal board, so there's no legal approval requirement. But some decisions are
too consequential for one founder in a WhatsApp message.

| Decision | Who decides |
|---|---|
| Day-to-day product, GTM tactics, pricing experiments | **Any founder, alone, fast.** Type 2 (`founder-decisions.md` §0) |
| The 15 Nov go/no-go, any pivot | **All three, in a room, same day** |
| A founder leaving or going part-time | **All three, disclosed early** |
| Equity, cap table, vesting | **All three + a lawyer** |
| Taking investor money, or any term sheet | **All three + an outside advisor** |
| Signing the first college contract | **All three** — it sets precedent for every contract after |
| Anything touching your one campus relationship | **All three.** It's your only Type 1 asset |

---

## 6. Build an advisory board — it's free and you're missing one

At your stage, three advisors are worth more than any amount of strategy documentation,
because they bring things you cannot generate: real TPO relationships, pattern-matching on
Indian edtech, and someone who will tell you an uncomfortable truth.

| Advisor | Why | Where to find | Cost |
|---|---|---|---|
| **A current or retired TPO** | Tells you what colleges actually pay, how procurement really works, and whether your pitch lands. **Would collapse half the `[ASSUMPTION]` tags in `revenue-model.md` in one conversation** | Your own campus. You have the relationship | ₹0 — most will just help |
| **An Indian edtech operator** who has sold to institutions | Sales cycles, contract structure, seasonality, what breaks at 10 colleges | LinkedIn, alumni network, edtech communities | ₹0 or 0.1–0.25% equity |
| **A senior engineer / CTO-type** | Your production-debugging gap (`ceo-dashboard.md` §6). Someone to call when a room breaks live | Seniors from your campus now working in industry | ₹0 |

**Ask:** one hour a month, no equity initially. Most people say yes to fresh graduates
building something real — and you have the strongest possible opener: *"we just graduated,
we built this, we'd value 30 minutes."*

**Do this in August.** An advisor recruited in November, when you're desperate, is worth a
fraction of one recruited now.

---

## 7. Pre-mortem — it's 15 Nov 2026 and this failed. Why?

Ranked by likelihood. Written now so you can watch for them.

| # | Cause of death | Leading indicator | Prevention |
|---|---|---|---|
| 1 | **Never actually deployed in time.** August passed in polish and planning | Not live by 3 Aug | Week 0 is deploy-only. Nothing else |
| 2 | **Rooms never filled.** Students signed up, nobody showed | Fill rate <60% in Wk 2 | Overbook 2×, fixed weekly times, founder in every room |
| 3 | **A founder took a job.** Placement season, 6-month runway | Someone quietly interviewing | Have the conversation in August. Vesting |
| 4 | **Ran out of money with a great case study and no bridge** | Runway <12 weeks with no payments built | D3 by 15 Aug, D6 by 1 Nov |
| 5 | **Burned the campus.** A broken session in front of a batch group | Broken-session rate >10% | Founder monitors every early session |
| 6 | **Built features instead of getting users** | Commits rising, WAD flat | The §11 anti-scope-creep register |
| 7 | **TPO said no and the plan had no branch** | No batch announcement by Wk 6 | Channels #1–4 work without permission |

**The most useful thing on this page:** #1, #2, #3 and #6 are all *behavioural*, not
market risks. **You are far more likely to be killed by your own habits than by a
competitor.**

---

## 8. Governance checklist — next 60 days

| # | Item | Owner | Deadline |
|---|---|---|---|
| 1 | Founder conversation: "what offer would make you leave?" | All three | **15 Aug** |
| 2 | Confirm equity split in writing | All three | **15 Aug** |
| 3 | 4-year vesting, 1-year cliff, backdated | All three | **31 Aug** |
| 4 | Clarify: is the CTO a co-founder with equity, or an employee? | All three | **15 Aug** |
| 5 | Decide D3 (freelance / runway extension) | All three | **15 Aug** |
| 6 | Recruit 3 advisors | 1 founder | **31 Aug** |
| 7 | Incorporate (Pvt Ltd) + IP assignment | 1 founder | **30 Sep** |
| 8 | Written retention/deletion policy + named grievance officer | 1 founder | **30 Nov** |
| 9 | Draft DPA template for college contracts | 1 founder | **31 Dec** |
| 10 | First monthly board update written | CEO | **31 Aug** |

**Items 1–5 cost nothing but an uncomfortable evening.** They are the highest
expected-value hours in this entire folder.
