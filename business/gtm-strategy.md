# Go-To-Market Strategy — PlaceMe

**Author:** Head of GTM · **Date:** 2026-07-27 · **Status:** v1, for founder review
**Horizon:** 90 days (Aug–Oct 2026), the placement-season window

**Grounded in:**
- Beachhead: **all 3 founders are 2026 graduates of the same campus.** The 2027 batch
  (current final year) were their juniors and are in placement season *now*.
- 90-day goal (decided 2026-07-27): **one campus pilot + a case study.** Not revenue.
- Scheduled sessions are the hero; random matching keeps a soft-landing fallback.
- Budget: **₹0.** Team: **2.0 FTE.** App: **not yet deployed.** Analytics: **none.**

> `[ASSUMPTION]` markers = numbers you should overwrite with your real campus data.
> The funnel model in §6 is built to be edited, not believed.

---

## 1. ICP — who exactly

### Primary user: "the anxious middle"

Not "engineering students." Not even "final-year students." Specifically:

> **A 2027-batch student at your home campus, in a branch that faces mass recruiters
> (TCS / Infosys / Wipro / Accenture / Capgemini / banks), who is confident enough to
> clear the aptitude round and terrified of the GD round, and who does not already have
> a friend group practising together.**

Why this slice:
- **Toppers don't need you.** They're already articulate and have offers.
- **The bottom third never reaches the GD round.** They get filtered at aptitude, so GD
  practice is irrelevant to them.
- **The middle 40–50% is the whole market.** They will face a GD, they know they'll
  face a GD, and they have no way to practise. That is the sharpest pain in the funnel.

**Qualifying signals:** has a drive in the next 4–8 weeks · has never done a real GD ·
isn't in a prep friend-group · has been rejected at a GD round before (your single
hottest lead — they know exactly why they need this).

### Secondary: the gatekeeper (not a user)

The **TPO / placement officer / training coordinator**. They don't use the product. They
control the batch announcement, the training calendar, and — from Apr 2027 — the budget.

**Their actual job:** raise placement percentage and *prove it to the principal.* Every
message to them must land on that number, not on your features.

### Explicitly NOT the ICP for 90 days

Other colleges · MBA aspirants · graduates/off-campus job seekers · anyone outside your
campus. All are real markets (see `market-strategy.md` §2, §7). All are distractions
until the case study exists.

---

## 2. Positioning

**For students (the one-liner that has to work in a WhatsApp message):**

> **You'll practise aptitude 100 times and a group discussion zero times. Then you'll
> get rejected in a GD. PlaceMe is a live GD room with real students, a real timer, and
> feedback that tells you exactly how you came across.**

**The founder credential — use it in every single message. It's your unfair advantage:**

> *"We graduated last year. We sat in those GD rounds. We built the thing we wished we'd
> had."*

No competitor can say this to your juniors. It converts better than any feature.

**For the TPO:**

> **Your students get unlimited aptitude practice and zero group-discussion practice.
> We're 2026 alumni — we built a live GD practice room for the college. It's free for
> this batch, and we'll give you a report on who's participating and who's improving.**

⚠️ **That report does not exist yet.** No cohort entity, no admin view, no reporting
anywhere in the schema. Either build a minimum version (§7, W4) or drop the claim. Do
not promise a TPO something you can't show in the follow-up meeting — you get one shot
at credibility with a gatekeeper.

---

## 3. Channels — ranked, with what to test first

You have ₹0, so every channel here is free and campus-native. Ranked by expected
conversion per hour of founder time.

| # | Channel | Why it works | Cost | Test when |
|---|---|---|---|---|
| **1** | **In-person live demo session** — book a classroom/lab, run a real 10-min GD with 5 students, project the attributed transcript + feedback on screen | Highest-conviction conversion event you own. Watching your own words attributed to you and getting a feedback paragraph is the "aha" — and it's undemonstrable in a screenshot | ₹0 | **Week 1** |
| **2** | **Direct 1-1 WhatsApp to juniors you know** | Warm, personal, ~50–70% response from people who know you. Doesn't scale — which is exactly right for the first 30 users | ₹0 | **Week 1** |
| **3** | **Class Representatives (CRs) as campus champions** | CRs are the actual distribution nodes in an Indian college. 4–5 CRs reach an entire batch with credibility you can't buy | ₹0 | **Week 1–2** |
| **4** | **Batch / branch / placement-prep WhatsApp groups** | Where the anxiety already lives. High trust, instant reach, zero cost | ₹0 | **Week 2** (after you have 1 testimonial — never post cold) |
| **5** | **TPO endorsement → official batch announcement** | The force multiplier. One placement-cell email outperforms 200 DMs and confers institutional legitimacy | ₹0 | **Week 4** (go in with 3 weeks of data, not a pitch) |
| **6** | Faculty who teach soft skills / communication | Often own a training slot they'd happily fill with something free | ₹0 | Week 5+ |
| 7 | LinkedIn founder-story posts | Useful for *recruiting/fundraising* narrative, near-useless for campus acquisition | ₹0 | Opportunistic |
| ❌ | Instagram/paid ads, SEO/content, Product Hunt, cold email to other colleges, app stores | Wrong audience, wrong timescale, or needs money you don't have | — | **Not in 90 days** |

**Test first: #1, #2, #3 — in Week 1.** They're the only three that produce users fast
enough to matter for a case study, and all three run on the asset you actually have
(being known on that campus).

**The sequencing rule that matters:** never open channel #4 or #5 before you have a
real testimonial from channel #1/#2. A cold group post that lands on an empty product
burns the group permanently — and you only have one campus.

---

## 4. Pricing

### During the pilot: free — but anchored, never "free forever"

Say: **"Free for the 2027 batch pilot."** Not "free."

Three reasons:
1. Free-with-an-end-date creates urgency and signals real value.
2. It preserves your ability to charge next batch without an outrage moment.
3. It lets you run a willingness-to-pay test in Week 10 without ever taking money.

**The WTP test (Week 10, costs nothing to run):** after a student's 3rd session, ask —
*"If this cost ₹149 for the season, would you have paid?"* Yes/No/Maybe. A stated-
preference answer is weak evidence, but 40 of them is a real signal, and it's the only
pricing data available to you before you have payments built.

### Future pricing shape (detail and unit economics → `revenue-model.md`)

| Segment | Model | Why this shape | Indicative `[ASSUMPTION]` |
|---|---|---|---|
| **B2B college** (primary) | Per-student-per-year site licence, billed to the college | How campus training is already procured — matches the TPO's existing mental model and budget line | ₹150–400/student/yr |
| **B2C graduate** (secondary) | **Short-duration pass, not a subscription** | Usage is bursty and seasonal — a student needs this intensely for 3 weeks before a drive, then never. A monthly sub gets cancelled after one cycle and feels like a trap | ₹199 / 30-day unlimited |
| Never | Per-minute / credits | Meters the exact behaviour you want to maximise (more reps). Wrong incentive at every stage | — |

⚠️ **Do not build payments in the next 90 days.** You have no pricing evidence, and
building Razorpay integration is ~2 weeks of your 2.0 FTE that produces zero pilot users.

---

## 5. Launch sequence — 90 days, dated

Today is **Mon 27 Jul 2026.** Your juniors' drives start in roughly 3–6 weeks.

### Week 0 — Jul 28 – Aug 3 · "Make it real" (nothing else matters until this is done)

The app is on localhost. Every hour it stays there is an hour of placement season you
cannot get back.

- [ ] **Deploy.** Render + Cloudflare Pages (`DEPLOYMENT.md` has the full checklist)
- [ ] **Turn Supabase "Confirm email" back ON** — currently anyone can sign up as anyone
- [ ] **Add analytics.** PostHog free tier. You currently cannot measure a single thing
      in this document. Non-negotiable before a single user touches it
- [ ] **Ship scheduled sessions + the soft-landing fallback** (the decided change)
- [ ] **Verify the P4 keep-alive risk** — a sleeping Render instance means no
      transcription agent, which means a dead room in front of real students
- [ ] Recruit **4–5 CRs / champions** over WhatsApp
- [ ] Book a classroom for the Week 1 demo

**Gate: do not invite a single student until a founder has run a full session on the
deployed URL from a phone on mobile data.** Not localhost. Not a tunnel.

### Week 1 — Aug 4–10 · "First 10, in a room together"

- [ ] **Live demo session on campus.** 5 students, real GD, transcript + feedback on a
      projector
- [ ] Personal WhatsApp to 30 juniors → target 15 signups
- [ ] **Run 2 scheduled sessions.** Target: 10 unique students, 2 filled rooms
- [ ] Collect **2 video testimonials** on a phone, immediately after a session — the
      moment feedback lands is the only time you'll get genuine enthusiasm on camera
- 🎯 **Success: 10 students, 2 filled rooms, 2 testimonials, zero broken sessions**

### Weeks 2–3 — Aug 11–24 · "Cadence"

- [ ] **3 scheduled sessions/week, fixed times** (e.g. Tue/Thu/Sun 8pm). Consistency is
      what converts a tool into a habit
- [ ] CRs post in batch groups (now with testimonials in hand)
- [ ] Target **30 unique students, 12 filled rooms**
- [ ] Interview 5 students who **came once and didn't return** — the single most
      valuable conversation available to you, and the one founders skip
- 🎯 **Success: 30 students, ≥60% room fill rate, ≥30% return rate**

### Week 4 — Aug 25–31 · "The TPO meeting"

- [ ] Book 30 minutes with the TPO. Walk in with: students onboarded, sessions run,
      testimonials, and one specific ask
- [ ] **The ask is NOT money.** It's an official batch announcement + a training-calendar
      slot. Money is an Apr–Jun 2027 conversation (`market-strategy.md` §5)
- [ ] Build the minimum TPO artifact first (§7, W4)
- 🎯 **Success: a scheduled batch announcement, or a clear no with a stated reason**

### Weeks 5–8 — Sep · "Scale on the campus"

- [ ] TPO-endorsed announcement → the step-change in volume
- [ ] 4–5 sessions/week, add student-scheduled rooms
- [ ] Target **80–100 unique students, 40+ sessions**
- [ ] **First intensity read** — how many sessions does an active student do inside their
      4–8 week window? ⚠️ **Not** "are Week-1 students still active in Week 6" — students
      who got placed and left are **successes, not churn** (`founder-decisions.md` §10a)
- [ ] **Start capturing exit testimonials** — the moment a student reports a placement,
      ask for a quote and a message to their juniors. That window closes permanently
- 🎯 **Success: 100 students, ≥4 sessions per active student, 5+ placement testimonials**

### Weeks 9–12 — Oct · "Prove it"

- [ ] **Write the case study.** Students onboarded, sessions run, transcripts generated,
      testimonials, and — if you can get it — *placement outcomes for participants vs
      non-participants*. That last comparison is the number a TPO buys on
- [ ] Run the **WTP test** (§4)
- [ ] TPO conversation #2: "here's what happened — can we discuss next year's batch?"
- [ ] Decide: second campus, MBA segment, or build the B2B feature set (→
      `founder-decisions.md`)
- 🎯 **Success: a 2-page case study a stranger's TPO would read**

---

## 6. Funnel model

**All inputs are `[ASSUMPTION]` — overwrite with your real campus numbers.**

### Inputs

| Input | Value | Notes |
|---|---|---|
| Final-year (2027) batch size | **600** | ⚠️ Replace with your actual number |
| Reachable via campus channels | **65%** = 390 | WhatsApp groups + CRs + TPO |
| Founder-hours/week on GTM | **20** | 2.0 FTE, split with ongoing build |
| Sessions runnable/week (Wk 5+) | **5** | Founder-moderated; the real ceiling |
| Seats per room | **5** | 3 min to run, 6 max |

### The funnel

| Stage | Rate | Count | Why this rate |
|---|---|---|---|
| **Reached** | 65% of 600 | **390** | Campus channels are high-coverage |
| **Clicked / visited** | 25% | **98** | Warm, founder-endorsed, in-season |
| **Signed up** | 55% | **54** | Free + no payment friction; email confirm costs some |
| **Consent completed** | 85% | **46** | Your consent flow is a real, human-verified step |
| **Registered for a session** | 70% | **32** | Requires picking a time — first real commitment |
| **⚠️ Actually showed up** | **50%** | **16** | **THE critical drop.** Free student events no-show at 40–60% |
| **Completed a full GD** | 85% | **14** | Needs the room to fill (3+) and not break |
| **Returned for session 2** | 40% | **6** | The retention question that decides everything |
| **Habitual (3+ sessions)** | 45% of returners | **~3** | Your true believers — the testimonial source |

### The three numbers that decide the pilot

1. **Room fill rate** — % of scheduled sessions reaching 3+ people. **Below 60% and the
   product doesn't function.** This is your activation metric, not signups.
2. **Show-up rate (50%)** — the biggest single leak. → **Overbook every room: 10
   registrations for 5 seats.** Plus a WhatsApp reminder 1 hour before. These two
   mechanical fixes are worth more than any product feature this quarter.
3. **Session-2 return rate (40%)** — if this comes in under ~25%, you have a value
   problem, not a marketing problem, and no amount of GTM fixes it. That's a
   pivot-vs-persist trigger → `founder-decisions.md`.

### Output

**~54 signups, ~16 active students, ~3 habitual users from a 600-person batch.**

Modest. **It is also exactly right.** A case study built on 16 students who genuinely used
it beats 500 signups who never entered a room — because the TPO's question won't be
"how many signed up," it'll be *"did it help anyone."*

**Sensitivity:** halve the show-up rate to 25% and you get 8 active students — a pilot too
thin to prove anything. **Show-up rate is the highest-leverage number in this document.**

---

## 7. What kills this — ranked

| # | Risk | Kill probability | Mitigation |
|---|---|---|---|
| 1 | **Rooms don't fill** — students register, don't show, first-runs see an empty room | **High** | Overbook 2×; 1-hour WhatsApp reminders; founder joins every early session so it's never empty; hard-commit to fixed weekly times |
| 2 | **Still not deployed by mid-August** | **High** | Week 0 is deploy-only. Nothing else. Placement season does not wait |
| 3 | **A session breaks live** (Render asleep → no transcription agent → dead room) | Medium | Verify P4 keep-alive before Week 1; a founder monitors every early session; have a "we'll rerun it" recovery script ready |
| 4 | **TPO says no** | Medium | You don't need them for Weeks 1–3. Channels #1–4 work without institutional permission. Ask in Week 4 from a position of data |
| 5 | **Students try it once and don't come back** | Medium | Interview the churned in Week 3. If session-2 return is <25%, stop scaling and fix the product |
| 6 | **Founder-moderation doesn't scale** — 5 sessions/week is a hard human ceiling | Medium | Fine at pilot scale. Becomes the #1 product problem in Q4. Note it, don't solve it now |
| 7 | AssemblyAI trial credits run out mid-pilot | Low | ~₹300 of usage at pilot volume (→ `revenue-model.md`). Track the balance weekly |

---

## 8. Do this week (Jul 28 – Aug 3)

Ordered. Do not start item 6 before item 1 is done.

1. **Deploy to Render + Cloudflare Pages.** Blocks everything else.
2. **Turn on Supabase email confirmation.**
3. **Install PostHog.** You cannot run any of §6 blind.
4. **Ship scheduled sessions + soft-landing fallback.**
5. **Full session test on the deployed URL, from a phone, on mobile data.** Not localhost.
6. **WhatsApp 5 CRs/juniors** — book the Week 1 demo, confirm the classroom.

### Copy you can send today (edit the brackets)

**WhatsApp, 1-1 to a junior:**
> Hey [name] — [founder] here, [branch] 2026 batch. Me and 2 others built something for
> placement prep and I wanted you to try it before anyone else.
>
> It's a live GD practice room — real students, real topic, real timer — and afterwards
> it tells you individually how you did (did you interrupt, did you stay on topic, did
> you actually speak). We built it because we bombed our own GD rounds last year and had
> no way to practise.
>
> Doing a live session on campus [day] at [time], 5 people. Want a seat? Free, takes 20
> minutes.

**Email/message to the TPO (send in Week 4, not now):**
> Respected [name],
>
> I'm [founder], [branch] 2026 batch — placed at [X] last year. Two batchmates and I
> built a tool for the round students get least practice on: group discussion.
>
> Over the last three weeks, [N] students from the 2027 batch have used it for [M]
> practice sessions. Each student gets individual written feedback on how they
> participated. [Quote a student testimonial here.]
>
> It's free for this batch — we're not selling anything. I'd like 20 minutes to show you
> what we're seeing, and to ask whether the placement cell would consider announcing it
> to the batch.

---

## Open items → other docs

- Per-session COGS, the ₹0-budget collision, 12–18mo projection → `revenue-model.md`
- Which metrics to instrument in PostHog on day one → `ceo-dashboard.md`
- Pivot triggers if session-2 return < 25% → `founder-decisions.md`
