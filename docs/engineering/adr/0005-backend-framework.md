# ADR-0005: Backend framework

**Status:** Accepted
**Date:** 2026-07-25
**Category:** Backend framework (see `METHOD.md` for rubric)

**Budget note:** this category is different from the last four — a backend
framework is a free, open-source library that runs *inside* our own server
process, not a hosted vendor with tiers or a free-vs-paid line. Every option
below is $0 forever, no account, no card, regardless of which one we pick.
The zero-out-of-pocket bar (ADR-0004/`METHOD.md`) is trivially satisfied by
all of them — the real decision criteria here are mainstream fit and
beginner-friendliness (guardrail #7, `TEAM.md`).

**Longevity re-check (2026-07-25, per updated `METHOD.md` criterion 7):**
Express is, if anything, the *safest* pick on this axis, not just the
easiest one. It has been in production at massive scale for well over a
decade, still powers a large share of the production Node.js internet
today, and its API surface changes very slowly — the "maintenance mode"
status flagged in Consequences below is about the *pace of new features*,
not a sign it's being abandoned or about to break existing code (5 known
CVEs as of mid-2026, all patched, is a normal footprint for software this
widely used and audited [[4]](https://www.herodevs.com/blog-posts/express-3-is-eol-express-4-is-next-the-2026-support-reference)).
Hono, by contrast, is still growing 300%+ year-over-year — exciting, but
that pace of change is itself a stability risk for a team that can't afford
to chase breaking changes. NestJS carries the most long-term architectural
surface area (modules/decorators/DI), which is more code that could go
wrong, not less. On production track record specifically, Express is the
most proven option here, which reinforces rather than changes the Decision
below.

## Context
The spike (`spike/`) already has a working Node + Express token server —
LESSONS.md documents it as one of our first tools. This ADR checks whether
that choice still holds up against 2026 alternatives before we build the
real backend on top of it, rather than just assuming the spike's throwaway
choice should become the permanent one.

## Options considered

| Framework | Popularity/mainstream-ness | Beginner fit | Performance | Notes |
|---|---|---|---|---|
| **Express** ✅ chosen | ✅ Dominant — 35M+ weekly downloads, decade-plus in production, 50,000+ middleware packages, by far the most tutorials/examples/Stack Overflow answers/AI-training coverage of any option here [[1]](https://cyberpanel.net/blog/is-express-js-dead-in-2026-why-it-still-powers-half-the-internet) | ✅ **Un-opinionated and simple** — write a route, run it; no required architecture to learn first | ⚠️ Slowest of the group, but framework throughput "rarely matters... unless running hundreds of thousands of requests per second" [[2]](https://encore.dev/articles/nestjs-vs-fastify) — irrelevant at our pilot scale | ✅ Already our working spike code (`spike/` token server) |
| Fastify | ✅ Growing, 1.5M weekly downloads, active core team [[2]](https://encore.dev/articles/nestjs-vs-fastify) | ✅ Also fairly simple, similar shape to Express | ✅ 2–3x Express's throughput on JSON-heavy routes [[2]](https://encore.dev/articles/nestjs-vs-fastify) | Meaningfully smaller community/example base than Express; would mean rewriting the working spike server for a performance gain we don't need |
| NestJS | ✅ Fast-growing, 3M weekly downloads, "default for mid-to-large enterprise Node apps" in 2026 [[1]](https://cyberpanel.net/blog/is-express-js-dead-in-2026-why-it-still-powers-half-the-internet) | ❌ **Opinionated, Angular-style architecture** (modules, decorators, dependency injection) — real concepts to learn before writing a first working route; built for team-scale enterprise APIs, not a 2–4 week MVP with a handful of routes | ✅ Similar to Express (often runs on top of it) | Solving a problem ("keep a large team's large codebase maintainable") we don't have yet — exactly the "don't design for hypothetical future requirements" trap |
| Hono | ✅ Fastest-*growing* (340% YoY) but still ~1.8–2.8M weekly downloads vs. Express's 35M+ — an order of magnitude smaller community/example base [[3]](https://www.pkgpulse.com/guides/express-vs-hono-2026) | ⚠️ Simple API, but purpose-built for edge/serverless/multi-runtime deployments — a good fit *if* we'd already chosen an edge hosting platform, which we haven't (that's the next ADR) | ✅ 2–4x Express's throughput, tiny bundle size | Exactly the "niche/cutting-edge, even if elegant" pattern guardrail #7 says to avoid unless it's the clearly safer *managed* option — it isn't managed at all, just newer with less real-world example coverage |

## Decision
**Express**, continuing what the Phase 0a spike already built.

In plain terms: none of the alternatives solve a problem we actually have.
Fastify and Hono are faster, but our pilot (tens of concurrent users, not
thousands) will never notice — the bottleneck in this product is always
going to be the live audio/STT pipeline, never the plain HTTP routes this
framework serves (token minting, room creation, session history, feedback
retrieval). NestJS solves for large-team maintainability at enterprise
scale, which is the opposite of a solo/small, 2–4 week MVP. Express remains
by far the most mainstream, best-documented, simplest option — exactly what
guardrail #7 and `TEAM.md` ask for — and it's what our own working code
already uses, so this decision costs nothing to keep and everything to
change.

## Consequences
- **Positive:** Zero rewrite of working spike code. Biggest community/
  documentation base of any Node framework, which matters directly for an
  agent-assisted team (more real-world examples for an agent to draw on
  correctly). Simple enough that a first-time Node developer can read the
  whole server file and understand it.
- **Risk to track:** Express's own 4.x line is officially in "maintenance"
  status (patches as volunteer time allows, no formal EOL calendar) while
  5.x is the actively endorsed release [[4]](https://www.herodevs.com/blog-posts/express-3-is-eol-express-4-is-next-the-2026-support-reference).
  Build on Express 5.x from the start of Phase 1, not 4.x, to avoid an
  avoidable future migration.
- If a specific route ever becomes a real, measured performance bottleneck
  (unlikely at this scale), swapping just that route's framework later is a
  small, isolated change — not a reason to over-engineer now.

## Revisit if
- The product outgrows a small team/simple-routes shape and genuinely needs
  enterprise-style structure (NestJS territory), or
- A future hosting choice (next ADR) is edge/serverless-first in a way that
  makes Hono meaningfully easier, or
- A specific, measured performance problem traces back to the framework
  itself rather than the database/STT/room layers.

## Sources
1. [Express.js status 2026](https://cyberpanel.net/blog/is-express-js-dead-in-2026-why-it-still-powers-half-the-internet)
2. [NestJS vs Fastify 2026](https://encore.dev/articles/nestjs-vs-fastify)
3. [Express vs Hono 2026](https://www.pkgpulse.com/guides/express-vs-hono-2026)
4. [Express 4/5 support reference 2026](https://www.herodevs.com/blog-posts/express-3-is-eol-express-4-is-next-the-2026-support-reference)
