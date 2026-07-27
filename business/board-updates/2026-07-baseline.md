# Board Update #0 — Baseline (July 2026)

**Written:** 2026-07-27 · **Period:** project start → 27 Jul 2026 · **Author:** Board Advisor (on the founders' behalf — replace with a founder for #1)

> This is the **honest zero point.** Every future update is measured against it. Nothing
> here is spun, because there's nobody to spin to yet — the audience is you in November.

---

## TL;DR

- **Product is built; nothing is live.** GD Arena multiplayer is code-complete and
  human-verified end to end — live audio, per-speaker attribution, LLM feedback, history.
  **It is not deployed. Zero students outside the founding team have ever used it.**
- **Runway is 6 months (ends ~Jan 2027) and the primary revenue window opens in Apr 2027.**
  The plan of record doesn't bridge that gap yet. Two bridges identified, neither committed.
- **Strategy work completed this period** (5 documents in `/business`). **The binding
  constraint is now execution, not planning.**

## Metrics

| Metric | This period | Target | 🚦 |
|---|---|---|---|
| 🌟 Weekly Active Discussers | **0** | 10 by Wk 1 (Aug 10) | ⚪ Not started |
| Room fill rate | n/a | ≥70% | ⚪ |
| Show-up rate | n/a | ≥55% | ⚪ |
| Session-2 return | n/a | ≥40% | ⚪ |
| Broken-session rate | n/a | ≤5% | ⚪ |
| **Runway (weeks)** | **~26** | ≥12 | 🟡 Adequate now, structurally short |
| Case-study assets | **0** | 2 by Wk 1 | ⚪ |
| Revenue | **₹0** | ₹0 by design until Nov | 🟢 On plan |
| Cash burn | **~₹1,700/mo** (Claude Pro) | — | 🟢 |
| Deployed? | **No** | Yes by 3 Aug | 🔴 **Critical path** |

## What went well

- **Engineering execution is genuinely exceptional.** 57 commits over 3 days produced a
  working multi-human live audio room with per-speaker STT attribution, LLM feedback,
  RLS-enforced data isolation, 133 tests, 8 ADRs, and container/CI config — built by a
  team that `TEAM.md` records as new to React, Node, WebRTC and TDD.
- **The hard technical risk is retired.** Guardrail #1's human-verification gate passed
  for both attribution and feedback quality with real people on real devices.
- **Engineering discipline is investor-grade** — ADRs, TDD, branch/PR workflow, honest
  progress records including bugs found and constraints missed. Rare at this stage.

## What went badly

- **Nothing is deployed.** The single most important fact in this update. Placement season
  has already started; every day on localhost is a day of the only window that matters.
- **Zero instrumentation.** Not one metric above can be measured today.
- **No external user has ever touched the product.** All validation is founder-internal.
- **Commercial thinking started after the product was built, not before.** Recoverable —
  and the reason this folder now exists.

## What we learned

- **Students never return after being placed** (founder, 27 Jul). Reframes retention
  entirely: the student is a **single-use** customer, the college is a **renewable** one.
  This is the strongest available argument for the B2B motion. → `founder-decisions.md` §10a
- **College budgets for AY26–27 were allocated Apr–Jun and are spent.** No paid college
  contract is realistically available this cycle. This cycle is for a case study.
- **The runway gap is structural, not a cash-management problem** — the company barely
  burns cash (~₹1,700/mo); the founders burn personal runway (~₹80k/mo opportunity cost).

## Decisions made this period

| Decision | Framework | Reversible? |
|---|---|---|
| Scheduled sessions become the hero; matching gets a soft-landing fallback | Liquidity precedes discovery | Type 2, ~1 day |
| Single 90-day goal: campus pilot + case study | Constraint-first goal setting | Type 2; the *window* is Type 1 |

## Decisions due next period

| Decision | Deadline | Leaning |
|---|---|---|
| Founder "what would make you leave?" conversation | 15 Aug | Must happen |
| Confirm equity split + institute vesting | 31 Aug | 4yr / 1yr cliff |
| D3 — one founder freelances to extend runway | 15 Aug | **Yes** |
| D4 — part-time co-founder moves to GTM full-time | This week | **Yes** |
| Recruit 3 advisors (TPO, edtech operator, senior engineer) | 31 Aug | Yes |
| Incorporate (Pvt Ltd) + IP assignment | 30 Sep | Required for any revenue |

## Top 3 risks

1. **🔴 Not deployed while the season runs.** Every other risk is downstream of this one.
2. **🔴 Runway ends Jan 2027; primary revenue opens Apr 2027.** No committed bridge yet.
3. **🔴 Founder attrition.** Three fresh graduates in placement season with 6 months of
   runway and no vesting. Base rate for at least one job offer is high, and the cap table
   is currently unprotected.

## Asks

- An intro to a current/retired TPO (any campus) — would validate most of the pricing
  assumptions in `revenue-model.md` in a single conversation.
- An Indian edtech operator who has sold into institutions.
- A senior engineer willing to be on-call for a live production issue.

## Next period's single goal

> **Deploy by 3 August, and have 10 students complete a real GD session by 10 August.**

Everything else — the MBA bridge, incorporation, fundraising, the TPO meeting — is
downstream of proving that a student who isn't a founder will sit in a room and finish a
discussion.
