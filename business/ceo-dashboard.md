# CEO Dashboard — PlaceMe

**Author:** CEO · **Date:** 2026-07-27 · **Status:** v1
**Review cadence:** 30 minutes, every Monday. One page. No exceptions.

**Stage context:** pre-launch, not deployed, zero instrumentation, 6-month runway
(ends ~Jan 2027), 90-day goal = **one campus pilot + a case study**.

---

## 0. The rule this dashboard exists to enforce

At your stage there is exactly **one** question worth measuring:

> **Does a student who tries a GD on PlaceMe come back and do another one?**

Every metric below either answers that, or tells you whether you'll still be alive to
act on the answer. Anything that does neither is off the page.

You currently cannot answer this question — or any question — because there is **no
analytics and no deployment**. That is the first thing to fix, and §4 is a two-hour job.

---

## 1. The North Star

### 🌟 Weekly Active Discussers (WAD)

> **The number of unique students who completed a full GD session this week.**

Not signups. Not logins. Not page views. **Completed a discussion.**

Why this one: it is the only number that simultaneously proves the product works, the
room filled, the tech held up, and a human found it worth 20 minutes. Every failure mode
in your business shows up as WAD not growing.

| Week | Target | Meaning |
|---|---|---|
| Wk 1 (Aug 4–10) | **10** | The demo cohort |
| Wk 3 | **20** | Cadence is working |
| Wk 6 | **40** | TPO announcement landed |
| Wk 12 (end Oct) | **60–80** | Case-study-grade pilot |

**Honest note:** 60–80 weekly active students out of a 1,000-person batch is ~7%. That
would be a genuinely good pilot. Don't let a big denominator make a real number feel small.

---

## 2. The dashboard — 6 supporting metrics

Each has a **trigger threshold**. A dashboard without triggers is a report.

| # | Metric | Definition | Green | 🚩 Trigger | Action if triggered |
|---|---|---|---|---|---|
| 1 | **Room fill rate** | % of scheduled sessions that reached ≥3 participants | ≥70% | **<60%** | Stop adding sessions. Cut to 2/week at fixed times and overbook 2×. A session that doesn't fill is worse than one you never scheduled |
| 2 | **Show-up rate** | Registered → actually joined | ≥55% | **<40%** | Mechanical fixes first: 1-hour WhatsApp reminder, 2× overbooking, founder joins every room. Not a product problem |
| 3 | **⭐ Session-2 return (W2)** | % of first-time discussers who complete a 2nd session within 14 days | ≥40% | **<25%** | **PIVOT TRIGGER.** Stop all growth work. Interview 10 churned students. This is a value problem and no GTM fixes it → `founder-decisions.md` |
| 4 | **Broken-session rate** | % of sessions with a technical failure (no audio, no transcript, no feedback, agent didn't join) | ≤5% | **>10%** | Freeze the invite list. At n=16 every user is a personal favour — one dead room costs you a testimonial and a friendship |
| 5 | **Runway (weeks)** | Weeks until founders can't continue | ≥12 | **<12** | Execute the freelance decision and the MBA bridge (`revenue-model.md` §5, §8). No drifting |
| 6 | **Case-study assets** | Testimonials + participant outcome data collected | On pace | 0 by Wk 3 | You're building a product, not the deliverable. **The case study is the 90-day output** — collect as you go, it's unrecoverable later |

## 2a. 🔑 Retention means something different here — read this before using metric 3

**Founder input, 2026-07-27: students never return once they're placed.**

That is the job-to-be-done completing, not churn. A student who does six sessions in
October, gets placed in November, and never opens PlaceMe again is your **best possible
outcome.** Do not chase them. Do not build re-engagement emails. Do not put long-term
retention on this page — you would be optimising against your own success
(`founder-decisions.md` §10a).

**So retention splits into two metrics, and only one is on the dashboard:**

| | Metric | On the page? |
|---|---|---|
| ✅ **In-window return** (metric 3) | Do they come back for session 2 within 14 days, *while still job-hunting*? | **Yes — this is the value signal** |
| ✅ **Intensity** | Sessions per active student across their 4–8 week window. Target **≥4** | **Yes — add it** |
| ❌ Long-term / month-6 retention | Structurally impossible. Measuring it will make a healthy business look broken | **No. Never** |
| ✅ **Placement outcomes** | Students who used PlaceMe and got placed | **Yes — it's the case study** |

**The mechanic this creates:** a newly-placed student is at peak goodwill and about to
disappear permanently. **Ask for the testimonial the day they tell you.** *"I used
PlaceMe and got placed at X"* is worth more than every usage number on this page, and
the window closes for good.

### Why these six and not others

- **1 and 2 are your activation metrics.** In a multiplayer product, activation isn't
  "signed up," it's "was in a room that actually worked." A signup who never sat in a
  filled room has not activated.
- **3 is the business.** Everything else is recoverable. This one isn't.
- **4 exists because your infrastructure is free-tier and untested in production**
  (Render sleeps, the agent dispatch is fire-and-forget, the random-match path has never
  run with 3 live sessions). At pilot scale, reliability *is* marketing.
- **5 is on the CEO page because of your runway, not because CEOs love finance.** With
  6 months, runway is an operating metric.
- **6 is on the page because the 90-day goal is a case study**, and founders reliably
  finish the quarter with a working product and no evidence.

---

## 3. Actively do NOT measure these (yet)

| Vanity metric | Why it will mislead you |
|---|---|
| Total signups | You can get 200 from a WhatsApp blast and still have empty rooms. **Signups are not the product** |
| Page views / traffic | Irrelevant with a campus-native, warm-intro motion |
| Total transcript lines / minutes transcribed | Measures your infrastructure, not their value |
| NPS | Statistically meaningless at n<50, and it'll be flattering because they know you |
| MRR | It's ₹0 by design until November. Watching it will only make you build payments early |
| Social followers, waitlist size | Not your channel |
| Feature count / velocity | You already ship fast. That is not your constraint |

---

## 4. Instrumentation — the 2-hour job that unblocks everything

**Key insight: you already have the data for 5 of the 6 metrics.** `rooms`,
`room_participants`, `transcript_lines`, and `feedback` are all in Postgres. You don't
need a fancy analytics stack — **you need six SQL queries.**

### Tier 1 — SQL on Supabase (free, ~2 hours, covers metrics 1–4 + WAD)

```sql
-- 🌟 WAD: unique students who completed a full GD this week
select count(distinct rp.user_id) as weekly_active_discussers
from room_participants rp
join rooms r on r.id = rp.room_id
where r.status = 'ended'
  and r.ended_at >= date_trunc('week', now())
  and exists (                       -- they actually spoke; presence isn't participation
    select 1 from transcript_lines t
    where t.room_id = r.id and t.user_id = rp.user_id
  );

-- 1. Room fill rate: sessions that reached >=3 participants
select
  count(*) filter (where p >= 3)::float / nullif(count(*), 0) as fill_rate
from (
  select r.id, count(rp.user_id) as p
  from rooms r
  left join room_participants rp on rp.room_id = r.id
  where r.created_at >= now() - interval '7 days'
  group by r.id
) s;

-- 3. ⭐ Session-2 return within 14 days (the pivot-trigger metric)
with firsts as (
  select rp.user_id, min(r.ended_at) as first_session
  from room_participants rp
  join rooms r on r.id = rp.room_id
  where r.status = 'ended'
  group by rp.user_id
)
select
  count(*) filter (where exists (
    select 1 from room_participants rp2
    join rooms r2 on r2.id = rp2.room_id
    where rp2.user_id = f.user_id
      and r2.status = 'ended'
      and r2.ended_at >  f.first_session
      and r2.ended_at <= f.first_session + interval '14 days'
  ))::float / nullif(count(*), 0) as session_2_return
from firsts f
where f.first_session < now() - interval '14 days';   -- only cohorts that had the chance

-- 4. Broken sessions: ended rooms with no transcript, or participants with no feedback
select count(*) as broken
from rooms r
where r.status = 'ended'
  and r.ended_at >= now() - interval '7 days'
  and (
    not exists (select 1 from transcript_lines t where t.room_id = r.id)
    or exists (
      select 1 from room_participants rp
      where rp.room_id = r.id
        and not exists (select 1 from feedback f
                        where f.room_id = r.id and f.user_id = rp.user_id)
    )
  );
```

Save these as a Supabase SQL snippet. Run them Monday morning. **That's your dashboard.**

### Tier 2 — PostHog free tier (~1 hour)

Only needed for what the database genuinely cannot see: **pre-signup behaviour.**

| Event | Why |
|---|---|
| `page_viewed` (landing) | Metric 2's top of funnel |
| `signup_started` / `signup_completed` | Where the signup form leaks |
| `consent_viewed` / `consent_granted` | Consent drop-off — a DPDP-mandated step you can't remove |
| `session_registered` | Registered vs joined = **show-up rate**. Needs scheduling shipped first |
| `session_join_failed` (+ error type) | Feeds metric 4 |

### Tier 3 — one small feature worth building (~1 hour)

**A 👍/👎 on the feedback paragraph, plus an optional one-line "why."**

This is the highest-value-per-hour thing you can build all quarter. Your entire product
promise is *"feedback that's actually useful."* Right now the only evidence for that is
one founder saying *"the feedback is excellent."* Twenty student thumbs-ups are a
case-study asset, a product signal, and a sales quote generator all at once.

---

## 5. Weekly ritual — Monday, 30 minutes

1. **Run the SQL** (5 min). Fill in the six numbers.
2. **Check triggers** (5 min). Any red → that's the week's priority. No debate.
3. **One number, one action** (10 min). Pick the *worst* metric and name one thing
   you'll do this week to move it. Not three things.
4. **Runway check** (2 min). Weeks remaining. Say it out loud.
5. **Log it** (8 min). Append to `business/board-updates/`. Six numbers and two
   sentences. This becomes your investor update in November — written weekly, it's free;
   reconstructed in November, it's fiction.

**The discipline that matters:** never let a green metric distract from a red one. If
signups are booming and fill rate is 45%, **you have a fill-rate problem.**

---

## 6. Hiring — the honest answer

### You cannot hire. You have ₹0 and 6 months. So the real question is where the 2.0 FTE points.

**Your gap is not engineering.** You built a live multi-human WebRTC room with per-speaker
STT and LLM feedback, with 133 tests, in three days. Engineering velocity is anomalously
high. **Distribution velocity is zero.** Nobody on this team owns getting students into rooms.

### The three moves available at ₹0

| Move | What it is | Cost | Do it |
|---|---|---|---|
| **1. Redirect the part-time co-founder to GTM entirely** | They stop touching code. They own: campus relationships, scheduling sessions, CR recruitment, the TPO meeting, testimonial collection | ₹0 | **This week** |
| **2. Recruit 4–5 student campus ambassadors** | 2027-batch students who fill rooms and run sessions. Pay in certificates, LinkedIn recommendations, "founding user" status, and genuine involvement — this currency is real to a final-year student | ₹0 | Week 1–2 |
| **3. Freelance for runway** | One founder takes part-time income (`revenue-model.md` §3). Costs 0.5 FTE, roughly doubles runway | Negative cost | Decide by **15 Aug** |

⚠️ **Moves 1 and 3 collide.** You have 2.0 FTE. If one founder freelances *and* one goes
full-time GTM, engineering drops to ~0.5–1.0 FTE. **That is probably correct** — the
product is built; the next 90 days are a distribution problem, not a build problem. But
make the trade consciously rather than discovering it in September.

### First paid hire, when revenue allows (~Q2 2027)

**A campus partnerships / sales person who has sold to TPOs before. Not an engineer.**

They bring the one thing you can't self-teach or agent your way to: existing TPO
relationships and knowledge of how college procurement actually works. Expect
₹4–8L/year + commission `[ASSUMPTION]`.

### And when you *do* eventually hire an engineer — hire for a different skill than you have

`TEAM.md` records that the team is new to React/Node/WebRTC and builds via AI agents.
That produces excellent *feature velocity* and a real gap in **production debugging under
time pressure.** Your failure mode isn't "can't build it" — it's *"a room broke during a
live session with 5 students in it and nobody knows why."*

> So the eventual engineering hire should be an **ops/reliability** engineer, not a
> feature engineer. That's a non-obvious call, and it follows directly from how this
> codebase was built.

---

## 7. What a board would ask at the first review

Have answers by the Monday after you deploy:

1. What is WAD this week, and what was it last week?
2. What % of scheduled sessions filled?
3. Of everyone who did one GD, how many did a second?
4. How many weeks of runway are left?
5. What did you learn from a student who *stopped* using it?
6. What's the one thing you'll do this week to move the worst number?

**If you can't answer #1–#4 from a query in under five minutes, the dashboard isn't built
yet — and until it is, every strategic decision you make is a guess.**
