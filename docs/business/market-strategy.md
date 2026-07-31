# Market Strategy — PlaceMe

**Author:** Head of Market Strategy (with Board Advisor pushback) · **Date:** 2026-07-27
**Status:** v1 — for founder review
**Inputs:** repo evidence (see `context-summary.md`) + founder answers 2026-07-27

> **Assumptions flagged throughout.** Numbers marked `[EST]` are my estimates from
> general market knowledge, not verified sources. Every one of them is cheap for you
> to validate with 3 phone calls. Do not put them in an investor deck until you have.

---

## 1. What market are we actually in?

Not "AI interview prep." That framing puts you in a knife fight with funded companies
on their terms, and it's the frame your *feature set* invites but your *asset* doesn't
support.

The honest frame:

> **PlaceMe is the practice arena for the placement rounds you physically cannot
> rehearse alone.**

Everything else in placement prep — aptitude tests, coding practice, resume review,
even 1-on-1 mock interviews — is a solved, commoditized, single-player problem. Group
Discussion is the one round that structurally requires *other humans*, which is
exactly why it's the round nobody has built a good product for, and exactly why every
student practices it by not practicing it.

That's your category. It is narrow on purpose. It's also, right now, the only thing
you have that a competitor can't ship in a sprint.

---

## 2. Competitive landscape

### Tier 0 — The real competitor: doing nothing

**~90% of your addressable students currently practice GD via: a WhatsApp group, a
Google Meet link, and four friends — or not at all.**

- Cost: ₹0. Already installed. Zero coordination overhead beyond "who's free at 8pm."
- What it lacks: a topic, a timer, discipline, and *any* feedback.
- **Why you win:** structure + individual attributed feedback. Nobody in a friend-group
  GD tells you "you interrupted twice and spoke 8% of the time."
- **Why you lose:** you are asking for behaviour change against a free default that
  works "well enough." This is the churn risk nobody models.

**Board note:** Your first 100 users will not be won from PrepInsta. They'll be won
from inertia. Position against inertia, not against competitors.

### Tier 1 — Campus training vendors (your B2B competition)

These are who a TPO is *already* paying, and who you must displace or attach to.

| Player | What they sell | Where you beat them | Where they beat you |
|---|---|---|---|
| FACE Prep, Talent Battle, PrepInsta Prime | Full campus training suites (aptitude, coding, soft skills, mock interviews) — often bundled with live trainers | Real live GD with attributed per-speaker feedback; on-demand, unlimited reps | **Breadth.** TPOs buy suites, not point solutions. They have sales teams, brand, existing contracts, and a decade of placement-report case studies |
| Unstop (ex-Dare2Compete) | Campus engagement + hiring + assessments platform | Depth on GD specifically | Massive distribution; they own the campus relationship already |
| CoCubes / SHL / Aspiring Minds | Assessment + employability scoring | You're practice, they're measurement — different job | They're embedded in the hiring pipeline itself |
| Local/regional trainers | Live in-person GD/soft-skills workshops | Scale, cost, availability, consistency | Human relationship with the TPO; the TPO's cousin runs the firm |

**The hard truth:** as a B2B product, a **GD-only tool is a feature, not a platform.**
A TPO comparing you to FACE Prep sees one round out of five. This is the single
biggest obstacle to college contracts and it is not solved by better GD software.
See §6 for the two ways through it.

### Tier 2 — AI speech/interview tools (your B2C competition)

Yoodli, Final Round AI, Google Interview Warmup, Hiration, InterviewBuddy, and the
rapidly growing long tail.

- **What they do well:** solo speaking practice, filler-word detection, 1-on-1 mock
  interviews, polished UX, real funding.
- **What none of them do:** put you in a live room with 4 other real humans and
  attribute the transcript per-speaker.
- **Why:** it's not a modelling problem, it's a **liquidity problem.** Multi-human
  requires simultaneous users, which is operationally miserable and doesn't demo well
  to VCs. They rationally avoid it.
- **Risk:** they're not avoiding it forever. If live group practice starts working,
  a funded player adds it. Your defence is not the code (see §4).

### Tier 3 — Adjacent, high-willingness-to-pay, currently ignored

**MBA admissions GD-PI prep.** CAT/XAT/NMAT results → GD-PI rounds at IIMs and every
B-school, roughly **January–April**. Candidates routinely pay **₹5,000–₹25,000** `[EST]`
for GD-PI coaching from Career Launcher, IMS, TIME. GD is not a side round there — it
is *the* round, and the willingness to pay is an order of magnitude above an
engineering undergrad's.

**Why this matters strategically:** it is **counter-cyclical** to engineering placement
season (Jul–Dec vs Jan–Apr). The same product, unchanged, serves both. Flagging now,
not recommending yet — see §7.

Also adjacent, further out: PSU/banking exam GD rounds, and corporate L&D
communication training.

---

## 3. Why a customer chooses us — and why they don't

**The student's actual choice:**

| They choose PlaceMe when | They don't when |
|---|---|
| They have no group to practise with (the isolated student — your best user) | Their friend group already practises together |
| Their placement drive is in <4 weeks and panic is real | Season is 6 months away |
| They've been rejected in a GD round and want to know *why* | They've never done one and don't know they're bad at it |
| Someone they trust (TPO, senior, friend) told them to use it | They found it in an app store next to 40 similar things |

**The TPO's actual choice:**

| They buy when | They don't when |
|---|---|
| It's free/near-free and makes them look proactive | It requires a procurement process for an unknown 3-person vendor |
| It produces a report they can show the principal | It produces nothing they can put in a placement report |
| A faculty member champions it internally | The champion is an external salesperson |
| It fills a gap their current vendor doesn't cover | It duplicates what they already pay for |

**The most important line in this document:** a TPO's job is not "make students better."
It's **"increase the placement percentage and be able to prove it."** Any pitch that
doesn't connect to that number will be politely ignored. You currently produce zero
artifacts a TPO could show a principal. That's a product gap with commercial
consequences — no cohort entity, no admin view, no reporting exists in your schema.

---

## 4. Defensibility — an honest assessment

I'll be blunt, because a real board would be.

| Candidate moat | Real? | Verdict |
|---|---|---|
| **The tech** (LiveKit + per-track streaming STT + LLM feedback) | ❌ | It's impressive that 3 people built it in days. That's *the problem* — a funded competitor rebuilds it in a quarter. Every component is off-the-shelf and managed. **This is a 6–12 month head start, not a moat.** |
| **Transcript data → better feedback model** | ⚠️ Someday | Genuinely could become one: a corpus of attributed GD transcripts + outcomes is rare and useful. But it needs volume you're nowhere near. Not a moat this year; **worth architecting for now** (you're already storing attributed transcripts — good) |
| **Per-campus network density** | ⚠️ Weak | Once "we practise on PlaceMe" is the batch norm, switching is annoying. But **batches graduate — you face structural ~100% annual churn on the student side.** A moat that resets every 12 months is a treadmill |
| **College contracts / distribution** | ✅ | Procurement inertia is real. Annual renewals, a champion inside the institution, integration into the training calendar. **This is the only durable asset available to you.** |
| **Brand / "the GD app"** | ⚠️ Later | Achievable, cheap-ish, but requires the first two to work |

**Strategic conclusion, and it should drive everything downstream:**

> Your defensibility lives in **college relationships**, not in code. Therefore B2B2C
> is the primary bet and B2C-graduates is opportunistic. Every hour spent on features
> that don't help you win or keep a college is, strictly, a worse hour than one spent
> on features that do.

This directly implies things you have not built and should: a **cohort/college entity**,
a **TPO-facing report**, and **scheduled sessions**. And it implies something you *have*
built may be a distraction — see §8.

---

## 5. Market timing — and your clock is already running

**Is the technology timing right? Yes, unambiguously.** Commodity WebRTC, sub-cent
streaming STT, and free-tier LLMs are all ~24 months old. A 3-person team could not
have built this in 2023. You are not too early.

**Is the *competitive* timing right? Barely.** "AI gives you feedback" is
differentiating today and will be table stakes within 12–18 months. Your differentiation
must migrate from *AI feedback* to *the live multi-human room* — the part that's hard to
copy for structural reasons — and it must migrate before the AI-feedback novelty burns off.

**Is the *seasonal* timing right? No, and this is the finding I most want you to act on.**

Indian campus placement rhythm `[EST — verify with any TPO, one call]`:

| Window | What happens | What it means for you |
|---|---|---|
| **Apr–Jun** | Colleges plan the training calendar and **allocate vendor budgets for the coming academic year** | **This window has closed for AY 2026–27.** You missed it |
| **Jul–Aug** | Pre-placement training runs; students start panicking | **You are here.** Student demand is spiking *right now* |
| **Aug–Dec** | On-campus drives. Mass recruiters (TCS/Infosys/Wipro/banks) run GD rounds | Peak student urgency and peak product relevance |
| **Jan–Apr** | Off-campus season; MBA GD-PI season | B2C graduates + the MBA segment |

**The consequence, stated plainly:** you will almost certainly **not sell a paid college
contract for this cycle** — the budget is already spent. Trying to is a waste of your
scarcest resource.

But this cycle is *perfect* for the thing you actually need more than money right now:
**a free pilot at a real college, producing a real case study with real placement-season
students.** That case study is the only thing that makes an Apr–Jun 2027 procurement
conversation possible. Miss this cycle's students and you don't get another shot at a
credible case study until August 2027 — a **12-month delay on your first rupee of B2B
revenue.**

> **This reframes "not sure" (your answer to Q5) into a hard deadline: you need
> students using this inside the Aug–Dec window, which starts in days.**

---

## 6. The B2B problem, and the two ways through it

The obstacle from §2: TPOs buy suites; you have one round.

**Path A — Go deeper, become "the GD/soft-skills specialist" and sell as an add-on.**
Don't displace the incumbent vendor; attach to them. Pitch: *"Your current vendor covers
aptitude and coding. Nobody covers the round students actually fail. We're ₹X/student
and we plug the gap."* Cheap, fast, non-threatening, small contract sizes.
→ Low ARPU `[EST ₹100–300/student/yr]`, but a real foot in the door and a fast yes.

**Path B — Go broader, build toward the Drive Simulator and sell the suite.**
Your product doc's Drive Simulator (paste the JD + round structure, get a stitched
end-to-end rehearsal) is, commercially, the actual B2B product — it's the only feature
in your vision that maps directly to a TPO's real job. But it needs aptitude, technical,
and HR roleplay modules first.
→ High ARPU `[EST ₹500–1500/student/yr]`, 12+ months of build with 2.0 FTE and no money.

**My recommendation: A now, B as the 2027 wedge-widening.** You cannot fund B before
you have revenue, and you cannot get revenue without A. Sequencing is not optional here —
it's dictated by having ₹0.

---

## 7. Market size — is this big enough to matter?

`[EST throughout — these are order-of-magnitude, verify before any deck]`

- India graduates roughly **1.5M engineers/year**; final + pre-final year in the
  addressable window ≈ **3M students**.
- Engineering colleges with active placement cells: ~4,000–6,000. Realistically
  **~1,500** have any budget for third-party training tooling.

| Scenario | Math | Result |
|---|---|---|
| **TAM** (all engineering students, GD-included training) | 3M × ₹500/yr | **~₹150 Cr / ~$18M** |
| **SAM** (colleges that actually buy) | 1,500 colleges × ~500 students × ₹300 | **~₹22 Cr / ~$2.7M** |
| **SOM, 3 yrs, good execution** | ~50 colleges × 500 × ₹300 | **~₹75 L / ~$90K ARR** |
| **+ MBA GD-PI B2C** (Tier 3) | 200K serious CAT aspirants × 2% × ₹1,500 | **~₹6 Cr / ~$700K** addressable |

**The honest read a board member owes you:** as scoped today — GD practice for Indian
engineering students — this is a **good bootstrapped business and a marginal
venture-scale one.** ₹5–50 Cr revenue over 5 years with excellent execution. That's a
genuinely great outcome for 3 people with ₹0. It is *not* an obvious VC story, and you
should stop optimizing for one.

**What would make it venture-scale**, in order of leverage:
1. **Expand rounds, not audience** — become the placement-readiness *platform* (the
   Drive Simulator thesis). Raises ARPU 3–5×.
2. **Expand segment** — MBA GD-PI (10× ARPU, counter-cyclical), then PSU/banking.
3. **Expand geography** — GD rounds are a South-Asia/Middle-East hiring convention;
   the US market doesn't run GDs. This caps international expansion hard. **Know this
   before an investor asks it.**
4. **Move up the value chain** — from practice into *assessment* (selling employability
   signal to recruiters). Highest ceiling, biggest strategic shift, don't touch yet.

---

## 8. Board pushback — three questions you're avoiding

**Q1. You picked the hardest possible first product. Why?**

GD-multiplayer requires **3+ real students online simultaneously.** That's a two-sided
liquidity problem — the hardest cold start in consumer software. Your product doc
justifies the sequencing on *technical* grounds ("proves the core loop without requiring
the hardest technical problem"). **That is an engineering rationale for a commercial
decision.** A 1-on-1 AI roleplay module would have zero liquidity requirement, would work
with your first single user, and would demo to a TPO on a laptop with nobody else present.

I'm not saying reverse it. Multiplayer is genuinely your differentiator, and it's built
and validated. **But you must stop pretending it's an on-demand consumer product.**
Which leads to:

**Q2. Kill random matching?**

Your repo has `POST /api/rooms/match`, a `matchmaking_queue` table, a `MatchPage` — and
`PROGRESS.md` admits the random-match path **has never been tested with 3 live sessions.**

Random matching only works with continuous ambient liquidity. With 10 pilot users you
will have *zero* liquidity, ever. A student who clicks "Find a group" and waits alone in
a queue has a first-run experience of **failure** — and first-run failure at n=10 is fatal.

> **Recommendation: hide random matching from the UI for the pilot.** Ship
> **scheduled cohort sessions** instead — "GD room, Thursday 8pm, 5 seats, here's the
> link." Scheduling manufactures liquidity that matchmaking can only discover. It's also
> exactly how a TPO wants to run a training programme.
>
> This is a GTM decision more than a product one, and it costs you roughly a day of work.
> The code stays; the entry point goes.

**Implemented, 2026-07-29 — partially.** Random matching now soft-lands (90s timeout,
honest messaging, demoted below the two paths that always work) instead of hanging in
an infinite queue — the failure mode this question was raised about is fixed. **A real
scheduled-sessions feature (pick a fixed time slot) was not built** — the substitute is
manual coordination via create-room + share-code, same shape as a WhatsApp-organized
session. Good enough for n=10 launched by founders; revisit if the TPO relationship
(§6, Path A) wants something more structured to point students at.

**Q3. You said you're optimizing for "users + college contracts + revenue." Pick one.**

With 2.0 FTE and ₹0, three goals is zero goals. And per §5, **college contracts for this
cycle are structurally unavailable** — the budget is spent. So the sequence isn't a
preference, it's arithmetic:

> **One goal for the next 90 days: get one real college's students using PlaceMe in a
> real placement season, and produce a case study.** Users are the *means*. Contracts
> and revenue are FY2027-08 outcomes that this case study unlocks. Anything that doesn't
> serve that goal — including polishing the UI, including AI voice mode, including
> pricing pages — is a distraction until it's done.

---

## 9. Positioning statements — to pressure-test

**For students (B2C / in-app):**
> *For final-year students who freeze up in group discussions — PlaceMe is a live
> practice room where you actually do a GD with other real students, and get told
> exactly how you came across. Unlike watching GD tips on YouTube, you leave knowing
> whether you interrupted, rambled, or never spoke at all.*

**For TPOs (B2B):**
> *Your students practise aptitude a hundred times and a group discussion never. PlaceMe
> gives every student unlimited attributed GD practice with individual written feedback —
> and gives you a report showing who's actually ready before the drive.*
> ⚠️ **The second half of that sentence is a promise your product does not yet keep.**
> No cohort entity, no admin view, no report exists. Either build it or cut the claim.

**For graduates (B2C paid):**
> *You've got a GD round next week and nobody to practise with. Join a live room in the
> next 30 minutes.*
> ⚠️ Depends entirely on liquidity you don't have. Do not lead with this yet.

---

## 10. What I'd do this week

1. **Name one target campus** and identify your human path into it. This is priority
   zero and the only real blocker on everything else. Ask: which college can a founder
   walk into, or call a faculty member at, tomorrow?
2. **Validate the season assumptions in §5** with one 20-minute TPO or faculty call.
   Every number I marked `[EST]` is guessed. Cheap to fix, expensive to be wrong about.
3. **Decide Q2 (random matching)** — my recommendation is hide it, ship scheduled
   sessions.
4. **Commit to the single 90-day goal in Q3** or tell me why I'm wrong.
5. Deploy. Nothing in this document works while the app is on localhost.

---

## Open items carried to other docs

- Pricing, funnel, channel sequencing → `gtm-strategy.md`
- Per-session COGS vs ₹0 budget (the STT/LLM collision) → `revenue-model.md`
- Metrics + instrumentation gap → `ceo-dashboard.md`
- Decision log for Q1–Q3 above → `founder-decisions.md`
