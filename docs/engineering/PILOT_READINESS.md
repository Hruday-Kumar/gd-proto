# Pilot Readiness Audit — PlaceMe

**Audited:** 2026-07-27 · **Target:** 10–30 real students, home campus, Aug 2026
**Method:** live repo inspection — tests run, builds run, git/PR state checked. Not a
docs review; `PROGRESS.md` was stale in at least one place (see §1).

## VERDICT: **NOT pilot-ready. ~5–8 focused working days away.**

The product is genuinely built and the code is in good shape. **Nothing is deployed, and
you cannot measure anything.** Those two facts — not missing features — are what stand
between you and a pilot.

---

## 1. What's actually GREEN (verified today, not assumed)

| Check | Result |
|---|---|
| Server test suite | ✅ **130/130 passing** on Node 22 (incl. the live RLS isolation test against real Supabase) |
| Web build | ✅ Clean. 483 kB main + 493 kB lazy LiveKit chunk, 136 kB gzip |
| Lint | ✅ Clean (1 cosmetic fast-refresh warning) |
| Docker | ✅ `node:22-alpine`, matches CI and local. No version drift into prod |
| CI | ✅ Node 22, triggers on `dev` and `main` |
| Env keys | ✅ **All 10 present locally, incl. `GEMINI_API_KEY`** — `PROGRESS.md` says it's missing. **That note is stale; delete it** |
| DB migrations | ✅ 0001–0006 all confirmed applied to the live project |
| Core flows | ✅ Human-verified: signup → consent → room → live audio → attribution → feedback → history |

**Read this honestly: the hard engineering is done.** Live multi-human audio with
per-speaker attribution is the difficult part and it works, verified by real people on
real devices. What's left is unglamorous launch work.

---

## 2. 🔴 BLOCKERS — a pilot cannot happen until these are done

### B1. Nothing is deployed, and the work isn't even merged
**Evidence:** current branch `feature/ui-redesign-refresh`; **23 files uncommitted**
including real bug fixes; PR #42 still open against `dev`; `feature/live-room-participants`
and `feature/live-room-ux` stacked on top and not on `dev`; no Render service; no
Cloudflare Pages project.

⚠️ **Immediate risk:** a day's worth of real fixes exists only in your working tree. If
that laptop dies today, it's gone. **Commit before anything else.**

**Effort:** 0.5 day to merge · 1 day to deploy both services.

### B2. Zero instrumentation
You cannot compute a single metric on the CEO dashboard. Running a pilot without this
means that in November you'll have opinions instead of data — and the 15 Nov go/no-go
needs data.
**Effort:** 2 hours (the 4 SQL queries in `business/ceo-dashboard.md` §4) + 1 hour PostHog.

### B3. Supabase "Confirm email" is OFF
Anyone can sign up as anyone, including as a student who doesn't exist. Unacceptable once
non-founders are on it.
**Effort:** 5 minutes. ⚠️ Re-test signup after — it changes the flow.

### B4. Render free-tier sleep is unverified against a real deploy (pre-flight P4)
**This is the highest-severity technical risk in the pilot.** Render sleeps after 15 min
idle. If the agent worker isn't connected when a room starts, **no transcription agent
joins — the room runs with no captions, no transcript, and no feedback.** A silent,
total failure in front of real students.
**Effort:** 1 day (deploy, leave idle >15 min, start a room, confirm the agent joins).
**Do not skip this.** It's ADR-0007's named residual risk and it has never been tested.

### B5. Random matching is the visible default and has never worked with 3 live sessions
`HomePage` shows "Random match" as a top-level card. With 10 pilot users, that queue never
resolves — the student's first experience is an infinite wait.
**Fix (decision D1):** demote it, replace the endless queue with *"Nobody's free right now
— next session is Thursday 8pm."*
**Effort:** 1 day.

### B6. No account deletion (DPDP right to erasure)
No delete path anywhere in server or web. You are storing transcripts of identifiable
students under a consent regime that promises deletion rights.
**Pilot-acceptable fix:** a documented manual process — *"email us and we'll delete your
account within 7 days"* — plus a founder-run SQL script. **Effort: 1 hour.**
A self-serve UI can wait for contract #1.

### B7. Guardrail #1 gate not run on the current build
The UI redesign, the live-room UX work, and the flows fixes have **never been used by a
human in a browser** — no Playwright in this environment, so build + lint + server tests
are the only evidence. Per your own guardrail #1, room/audio features cannot be called
done on automated tests alone.
**Effort:** 0.5 day — 3 real devices, deployed URL, full walkthrough.

---

## 3. 🟡 Should fix, but won't stop a pilot

| # | Item | Why | Effort |
|---|---|---|---|
| S1 | **Feedback 👍/👎 + one-line "why"** | Your whole promise is "useful feedback" and the only evidence is one founder's opinion. Highest value-per-hour item on this page | 1 hr |
| S2 | Remove `DEEPGRAM_API_KEY` from `.env` | Unused since ADR-0002 superseded it. Live credential with no purpose | 5 min |
| S3 | Local shell defaults to **Node 20** | Tests fail and DB queries break silently on the first query. Prod is fine (Docker/CI pin 22) — this is a dev footgun. Add a `preinstall` engine check or a README line | 15 min |
| S4 | LiveKit chunk is 493 kB | Fine on wifi, slow on campus mobile data — which is how your students will join | Defer |
| S5 | Cohort / TPO report | Not needed Week 1. **Needed for the Week-4 TPO meeting** (`gtm-strategy.md` §2 promises it) | 2 days, do in Wk 3 |

---

## 4. ✅ Do NOT build this before the pilot

**Scheduled sessions — the D1 "hero" — do not need to be a feature.**

For 10–30 students, scheduling is: **a founder creates a room at 7:55pm and drops the code
into WhatsApp.** That's the entire feature. Zero code, and it works better than software
would at this size because a human is chasing no-shows.

Build the real thing once you're running 5+ sessions/week and manual scheduling actually
hurts. **This saves you roughly a week of the critical path** — the single biggest
schedule win available.

Also deferred: AI voice mode · payments · mobile app · dark-mode polish · self-hosted
fonts · shared UI primitives · multi-language STT.

---

## 5. The Week-0 plan (Mon 28 Jul → Sun 3 Aug)

| Day | Task | Output |
|---|---|---|
| **Mon** | Commit the working tree. Merge PR #42 + both stacked branches into `dev`. Delete the stale `GEMINI_API_KEY` note in `PROGRESS.md` | All work safe on `dev` |
| **Tue** | Deploy Render (Blueprint, `render.yaml` is ready) + Cloudflare Pages. Set `RENDER_APP_URL`, confirm `keepalive.yml` runs green | Live URLs |
| **Wed** | **P4 test (B4).** Deploy idle >15 min → start a room → confirm the agent joins and captions appear. Turn Supabase email confirmation ON, re-test signup | Sleep risk closed |
| **Thu** | B5 (demote matching + soft landing). B6 (manual deletion process). S1 (feedback 👍/👎). S2 (drop Deepgram key) | Pilot-safe UX |
| **Fri** | B2: 4 SQL queries saved as a Supabase snippet + PostHog on the web app | Dashboard live |
| **Sat** | **B7 dry run.** 3 founders + 2 friends, 5 devices, **deployed URL, mobile data, not wifi.** Full flow. Log every defect | Go/no-go evidence |
| **Sun** | Fix what Saturday broke. Book the classroom, message the CRs | Ready |

**Gate for Week 1:** *"Five people who are not all founders completed a GD on the deployed
URL from their own phones, everyone was audible, every transcript line was attributed
correctly, and everyone got feedback."* **Until that's true, do not invite a student.**

---

## 6. Operational readiness — the part that isn't code

Reliability *is* marketing at n=10. One dead room costs a testimonial and a friendship.

- **Every early session needs a founder in it**, on a laptop, watching. Not as a
  participant — as an operator.
- **Have a recovery script:** if a room breaks, what do you say in the next 60 seconds?
  Draft it: *"Sorry — technical issue on our side. Rejoining in 2 minutes."*
- **Know your ceilings before you hit them:** LiveKit free-tier participant-minutes and
  AssemblyAI concurrent-stream limits `[VERIFY on both dashboards]`. At 2 concurrent
  5-person rooms you're at 10 simultaneous STT streams — fine, but know the number.
- **Check the AssemblyAI trial balance weekly.** ~₹17/session means the pilot costs ~₹700
  total, but a surprise zero-balance mid-session is a dead room.
- **Watch `/health/agent`** — the agent-worker dispatch tracker from W8 already exists.
  Use it. Check it before every session.

---

## 7. Bottom line

| Question | Answer |
|---|---|
| Is the product built? | **Yes.** 130/130 tests, builds clean, core flows human-verified |
| Is it pilot-ready today? | **No** |
| What's missing? | Deployment, instrumentation, and 3 safety fixes — **not features** |
| How long? | **5–8 focused working days** |
| Biggest technical risk | **B4** — Render sleep → no transcription agent → silently dead room |
| Biggest non-technical risk | Spending these days on polish instead of the list above |

> **You are much closer than the empty deployment makes it feel.** The genuinely hard
> thing — live multi-human audio with correct per-speaker attribution — works. What's
> left is a week of unglamorous launch work, and it's all on this page.
