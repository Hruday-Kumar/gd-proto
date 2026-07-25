# ADR-0007: Hosting / deployment

**Status:** Accepted
**Date:** 2026-07-25
**Category:** Hosting/deployment (see `METHOD.md` for rubric, including
criterion 4 — zero out-of-pocket, and criterion 7 — longevity)

## Context
Two genuinely different things need hosting, with different risk profiles:
1. **The React/Vite frontend** — a static build (HTML/JS/CSS). Simple:
   any static host works.
2. **The Express backend + LiveKit Agent worker** — this is the part that
   matters. Per the Phase 0a spike architecture, the LiveKit Agent worker is
   **a persistent background process that registers with LiveKit and waits
   to be assigned rooms** — confirmed directly from LiveKit's own docs and a
   real "no worker is available" error class in their issue tracker when a
   worker isn't connected [[1]](https://docs.livekit.io/agents/worker.md) [[2]](https://github.com/livekit/livekit/issues/4060).
   **If this process isn't running and connected at the moment a room
   starts, no agent joins that room and transcription simply never starts**
   — a live-room failure of exactly the kind guardrail #1 treats seriously.
   So "does the free tier let a process stay running/connected, or does it
   sleep on inactivity" is the deciding technical question for this half of
   the ADR, on top of the usual budget/longevity checks.

Fixed constraint in play: cloud-agnostic, **containerized (Docker/OCI)**, no
hard vendor lock-in.

## Options considered — backend + agent worker

| Option | Stays connected (no sleep)? | Managed vs. self-managed | Zero out-of-pocket? | Docker support | Longevity |
|---|---|---|---|---|---|
| **Render (free Web Service)** ✅ chosen | ⚠️ Sleeps after 15 min idle by default — **mitigated** with a free keep-alive ping (see Decision) | ✅ Managed PaaS — git push, they handle OS/TLS/networking | ✅ No credit card required; 750 free instance-hours/mo, enough for continuous uptime across a month (720h < 750h) [[3]](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026) | ✅ Full Dockerfile-based deploys supported on the free tier [[4]](https://render.com/docs/docker) | ✅ Established host, large user base |
| Oracle Cloud Free Tier (Always Free VM) | ✅ **Only genuinely always-on option with zero sleep risk by design** — it's a real persistent VM, not scale-to-zero | ❌ **Self-managed raw VM** — we'd own OS patching, security updates, Docker install, firewall/networking ourselves, exactly the "self-manage the hard/unfamiliar part" pattern `TEAM.md` says to avoid | ⚠️ Genuinely free resources, but requires a credit card + phone number for identity verification [[5]](https://www.oracle.com/cloud/free/faq/) | ✅ (we'd install Docker ourselves) | ⚠️ Documented risk: Oracle can reclaim "Always Free" instances flagged as **idle on CPU/network utilization** — real user complaints of this in 2025–2026 [[6]](https://forums.oracle.com/ords/apexds/post/always-free-tier-account-suspended-without-clear-reason-3380) — and our workload (waiting for sporadic room dispatches) looks exactly like "idle" most of the time |
| Google Cloud Run | ❌ Scale-to-zero by default (same sleep problem as Render); forcing `min-instances=1` to stay warm burns the Always Free vCPU-second budget in **~50 hours**, not a full month — would start incurring real charges partway through month one | ✅ Managed | ❌ Requires a card for verification, and as shown above, doesn't actually stay in the free tier for a 24/7 process | ✅ Native container platform | ✅ Google, but wrong shape for this workload |
| Fly.io | ✅ Persistent VM, no sleep | ✅ Managed-ish | ❌ **No free tier at all since Oct 2024** — pure pay-as-you-go, real recurring cost even for a tiny always-on instance [[7]](https://expresstech.io/7-fly-io-alternatives-in-2026-real-pricing-after-the-free-tier-died/) | ✅ | — |
| Koyeb | ❌ Free tier explicitly does not support always-running apps — scales to zero after 1hr, **cannot be disabled on the free instance type** [[8]](https://www.srvrlss.io/provider/koyeb/) | ✅ Managed | ✅ No card typically | ✅ | — |
| Railway | ❌ No free persistent compute — one-time trial credit only, same disqualifier already applied in ADR-0004 | ✅ Managed | ❌ | ✅ | — |

## Decision — backend + agent worker
**Render**, deploying the Express API and the LiveKit Agent worker from a
**Dockerfile** (satisfies the containerized constraint directly and keeps
the deployment portable to any other Docker host later — no Render-specific
lock-in in the app code itself).

To neutralize the free tier's 15-minute sleep — which would otherwise be a
real risk to the agent worker's "always connected" requirement — we'll add
a free, no-card keep-alive: a **GitHub Actions scheduled workflow** pinging
the service every ~10 minutes [[9]](https://medium.com/@akildikshan01/i-was-tired-of-my-backend-falling-asleep-a-cron-job-fixed-it-af6c8c01951f).
This is a well-documented, common pattern for exactly this situation, and
750 free instance-hours/month comfortably covers continuous uptime.

**Why not Oracle's Always Free VM**, despite being the only option with
*zero* architectural sleep risk: it fails the same test we've applied
consistently since ADR-0001 (self-hosted SFU), ADR-0002 (self-hosted
Whisper), and ADR-0004 (self-hosted Postgres) — running our own VM means
*we* own OS security patching and server administration, which `TEAM.md`
explicitly says to avoid for a team new to all of this. And it isn't even a
clean escape from risk: Oracle's own users report Always Free instances
being flagged and reclaimed for looking "idle" on CPU/network — which is
almost exactly our workload's shape (a worker that's mostly waiting, with
occasional bursts when a room starts). Trading one operational risk for
another, less-managed one isn't a win. This is the honest "near dead-end"
case in this category, on record rather than glossed over — but unlike the
STT card requirement, it doesn't force any spend, so Render's minor,
well-documented keep-alive workaround is the better trade.

**Residual risk, stated plainly:** the keep-alive ping isn't a mathematical
guarantee — if it's delayed beyond 15 minutes (GitHub Actions' schedule
trigger doesn't guarantee exact timing) the service could still nap briefly.
At pilot scale this is a low-probability, low-blast-radius risk (a room
would need to start in that exact gap), and it's fully solved for **$7/mo**
by upgrading to Render's Starter plan the moment the project has any
funding — which fits the "prove it, then fund it" plan directly.

## Options considered — frontend static hosting
Vercel, Netlify, and Cloudflare Pages are all genuinely free, well-
documented, and stable choices for a static build — this half of the
decision is low-stakes, since a static site has no "must stay connected"
requirement. **Cloudflare Pages** is the pick: free tier is unlimited
bandwidth with no card required [[10]](https://www.cloudflare.com/plans/free/),
matching the zero-out-of-pocket bar most cleanly of the three (Vercel's
free Hobby tier is comparatively more restrictive), and Cloudflare is a
large, financially stable company with a long track record — a solid
longevity bet.

## Consequences
- **Positive:** Fully containerized, portable deployment (Dockerfile),
  genuinely $0, no card anywhere in this category, and the keep-alive
  pattern is simple enough for a first-time team to set up and understand.
- **Risk to track:** the sleep/keep-alive workaround is a real, if small,
  operational risk — worth a note in the Phase 1 build plan to add basic
  monitoring/alerting on the worker's connection status once real students
  depend on it, so a missed room dispatch would be noticed quickly rather
  than silently.
- Splitting frontend (Cloudflare Pages) and backend (Render) across two
  free platforms is normal practice, not added complexity — static assets
  and a persistent API/worker have different hosting needs by nature.

## Revisit if
- Usage grows enough that reliability matters more than $0 cost — at that
  point, Render's $7/mo Starter tier (eliminates sleep entirely) is a small,
  easy upgrade well inside the eventual $100/mo ceiling, consistent with
  "prove it, then fund it."
- The keep-alive workaround proves unreliable in practice during Phase 1
  testing — worth a real smoke test (does a room started right after a
  15+ minute quiet period get an agent successfully) before trusting this
  with real students, similar in spirit to the AssemblyAI smoke test
  flagged in ADR-0002.

## Sources
1. [LiveKit Agents worker docs](https://docs.livekit.io/agents/worker.md)
2. ["no worker is available" dispatch error — livekit/livekit#4060](https://github.com/livekit/livekit/issues/4060)
3. [Render free tier overview 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
4. [Docker on Render](https://render.com/docs/docker)
5. [Oracle Cloud Free Tier FAQ — card/phone required](https://www.oracle.com/cloud/free/faq/)
6. [Oracle Forums — Always Free account suspended without clear reason](https://forums.oracle.com/ords/apexds/post/always-free-tier-account-suspended-without-clear-reason-3380)
7. [Fly.io free tier removed, 2026 status](https://expresstech.io/7-fly-io-alternatives-in-2026-real-pricing-after-the-free-tier-died/)
8. [Koyeb free tier — scale-to-zero cannot be disabled](https://www.srvrlss.io/provider/koyeb/)
9. [Keeping a free-tier backend awake with a cron job](https://medium.com/@akildikshan01/i-was-tired-of-my-backend-falling-asleep-a-cron-job-fixed-it-af6c8c01951f)
10. [Cloudflare Pages free plan](https://www.cloudflare.com/plans/free/)
