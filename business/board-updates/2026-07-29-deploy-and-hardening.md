# Board Update #1 — Deploy & Hardening (2026-07-29)

**Written:** 2026-07-29 · **Period:** 27 Jul – 29 Jul 2026 (3 days) · **Author:** Board Advisor (on the founders' behalf — replace with a founder for #1)

> Measured against Board Update #0's baseline. Short period, but the single fact the
> baseline update named as critical-path — "Deployed? No" — has flipped.

---

## TL;DR

- **The app is deployed, live, and human-verified end to end.** Backend on Render,
  frontend on Vercel, both healthy. Two real people on real devices ran a real room on
  the production URL — transcription and speaker attribution both confirmed correct.
- **A parallel, unplanned-for engineering-audit remediation pass also shipped** —
  security hardening, graceful shutdown/boot recovery, rate limiting, an account
  deletion path (DPDP), and the feedback thumbs-rating feature — none of which was in
  the original 90-day plan, all of which close real gaps `board-governance.md` and
  `ceo-dashboard.md` had flagged.
- **Still zero students who aren't founders/testers.** The binding constraint has moved
  cleanly from "is it built" to "is anyone using it" — exactly the transition the
  baseline update predicted, just faster than the Week-0 deadline implied.

## Metrics

| Metric | This period | Last period | Target | 🚦 |
|---|---|---|---|---|
| 🌟 Weekly Active Discussers | **0** (founders/testers only, not counted) | 0 | 10 by Wk 1 (Aug 10) | ⚪ Not started |
| Room fill rate | **0%** on live data, but meaningless — see note | n/a | ≥70% | ⚪ |
| Show-up rate | n/a | n/a | ≥55% | ⚪ |
| Session-2 return | n/a | n/a | ≥40% | ⚪ |
| Broken-session rate | **79%** on live data, but meaningless — see note | n/a | ≤5% | ⚪ |
| **Runway (weeks)** | **~25.7** | ~26 | ≥12 | 🟡 Adequate now, structurally short — unchanged |
| Case-study assets | **0** | 0 | 2 by Wk 1 | ⚪ |
| Revenue | **₹0** | ₹0 | ₹0 by design until Nov | 🟢 On plan |
| Cash burn | **~₹1,700/mo** (Claude Pro; deploy runs on free tiers) | ~₹1,700/mo | — | 🟢 |
| **Deployed?** | **✅ Yes** | No | Yes by 3 Aug | 🟢 **Cleared, ahead of deadline** |
| Instrumented? | **SQL: yes, live. PostHog: code-complete, key unset.** | No | — | 🟡 One flip away from live |

**Note on the 0%/79% figures:** these are what the dashboard's own SQL actually returns
when run against production today, not placeholders. They're meaningless as a pilot
signal — every room in the database so far tops out at 2 participants (all founder/
tester testing volume from the build, no room has ever hit the 3-person minimum a real
GD needs). Recorded here anyway, per this document's own rule (state it, don't explain
it away) — and flagged as an action item: **clear this test data before Week 1** so the
first real dashboard run isn't reading test artifacts as pilot failure.

## What went well

- **The deploy gate closed faster than the plan required.** Board Update #0 set "deploy
  by 3 Aug" as the single next-period goal; it landed 2026-07-29, several days early.
- **The human-verification walkthrough (guardrail #1) caught a real production bug
  before any real student could hit it** — the deployed Gemini API key's backing
  service account had been deleted/disabled, silently failing 100% of feedback
  generation. Found, fixed, and re-verified with a second live room in the same
  session. This is the guardrail doing exactly its job, not a formality.
- **All three tiers of the CEO dashboard's instrumentation plan are now built** —
  Tier-1 SQL metrics, Tier-2 PostHog events (dormant, ready), Tier-3 feedback rating.
  Board Update #0 flagged zero instrumentation as a top risk; that risk is now
  mechanically closed, pending real usage to measure.
- **A full engineering-audit remediation pass landed in parallel**, closing items this
  folder had flagged: account deletion (DPDP right-to-erasure, `board-governance.md`
  §2), CORS/security headers, rate limiting on the metered LLM routes, and a
  matchmaking race condition. None of this was asked for by the 90-day GTM plan, but
  all of it reduces the "broken-session-rate" and "burned the campus" risks named in
  `board-governance.md` §7.

## What went badly

- **Zero external users, still.** Deployment removes the *excuse*, not the outcome —
  distribution work (CRs, the classroom demo, the TPO meeting) shows no evidence of
  having started, at least not from anything in this repo.
- **PostHog is built but not switched on.** Pre-signup funnel data (why a signup
  doesn't convert) is still invisible until `VITE_POSTHOG_KEY` is set — a one-line
  config change, not an engineering task, but it hasn't happened.
- **No real scheduling feature.** `founder-decisions.md` D1 called for "scheduled
  cohort sessions" as the primary CTA; what shipped was a soft-landing fix for random
  matching, not an actual time-slot scheduler. The manual-coordination substitute
  (create-room, share code at an agreed time) is probably fine at n=10, but it's a
  gap between what was decided and what was built, worth naming rather than losing
  track of.

## What we learned

- **The human-verification gate (guardrail #1) is not theatre.** It found a live,
  100%-of-feedback-broken bug that automated tests had no way to catch (the tests mock
  the Gemini call; only a real API key against a real Google Cloud project would fail
  this way). Worth treating as validation of the process the engineering docs insist
  on, not just a compliance checkbox.
- **Deploying surfaced the gap between "code complete" and "operationally trustworthy"**
  — graceful shutdown, boot recovery, and Render-sleep behavior all needed a real
  deploy to test for real, and all three were genuinely unverified before this period.

## Decisions made this period

| Decision | Framework | Reversible? |
|---|---|---|
| Vercel replaces Cloudflare Pages for the frontend | Exploratory choice, not a technical failure of the original pick | Type 2 |
| AssemblyAI: open a fresh free-trial account when the current credit runs out, rather than add a card | Stay card-free as long as possible; small rotation overhead accepted | Type 2 |
| `placeme.study` stays a separate pre-launch waitlist page; the working app lives at `gd-proto-web.vercel.app` until public launch | Deliberate, confirmed with the founders | Type 2 |

## Decisions due next period

*(Unchanged from Board Update #0 — none of these are engineering-resolvable and none
show evidence of being closed yet.)*

| Decision | Deadline | Leaning |
|---|---|---|
| Founder "what would make you leave?" conversation | 15 Aug | Must happen |
| Confirm equity split + institute vesting | 31 Aug | 4yr / 1yr cliff |
| D3 — one founder freelances to extend runway | 15 Aug | **Yes** |
| D4 — part-time co-founder moves to GTM full-time | This week (now overdue) | **Yes** |
| Recruit 3 advisors (TPO, edtech operator, senior engineer) | 31 Aug | Yes |
| Incorporate (Pvt Ltd) + IP assignment | 30 Sep | Required for any revenue |
| Clear pre-pilot test data from the production DB (30 rooms, all founder/tester) | Before Week 1 | **Yes** — otherwise the first real dashboard run reads test artifacts as a 79% broken-session rate |

## Top 3 risks

1. **🔴 Zero students, and no confirmed distribution motion yet.** This is now the
   single largest gap between the plan and reality — not deployment, not
   instrumentation, not product risk. Everything the repo can verify is done; everything
   left is founder-executed and off-repo.
2. **🟡 Runway keeps ticking regardless of engineering progress.** ~25.7 weeks left,
   same structural gap to the Apr 2027 revenue window as Board Update #0 flagged.
   D3/D4 above are still undecided and now slightly overdue against their own deadlines.
3. **🟡 PostHog and a real scheduling feature are "almost done."** Both are cheap to
   finish (a config flip; a UI feature) but neither is finished, and "almost done" has
   a way of staying almost done once distribution work starts eating founder time.

## Asks

*(Unchanged from Board Update #0 — still open.)*

- An intro to a current/retired TPO (any campus).
- An Indian edtech operator who has sold into institutions.
- A senior engineer willing to be on-call for a live production issue.

## Next period's single goal

> **Get the first real, non-founder student into a completed GD session on the
> deployed app.** Everything engineering-side that was blocking this is now done. If
> this doesn't happen in the next period, the diagnosis is distribution, not product —
> and should be treated as such, not as a reason to keep polishing the app.
