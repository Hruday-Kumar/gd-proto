# ADR-0006: Frontend framework

**Status:** Accepted
**Date:** 2026-07-25
**Category:** Frontend framework (see `METHOD.md` for rubric, including
criterion 7 — longevity/production stability, added this session)

**Budget note:** same as backend framework (ADR-0005) — a frontend
framework is a free, open-source library bundled into the app we ship, not
a hosted vendor. Every option here is $0 forever regardless of pick. The
deciding criteria are mainstream fit, longevity, and beginner-friendliness.

## Context
TEAM.md already names React specifically when describing the team's
situation ("new to... frontend (React)"), suggesting some prior familiarity
with the name — but that's a hint, not a fixed decision, so this ADR
genuinely compares it against current alternatives rather than rubber-
stamping it. Per the user's direct guidance this session, longevity is a
first-class criterion here: framework choice is expensive to change later,
so "will this still be safe to build on in a year, with people who can be
hired or who can get unstuck via Stack Overflow/AI tooling" matters as much
as today's feature set.

## Options considered

| Framework | Market share / adoption | Longevity & production stability | Beginner fit | Ecosystem depth |
|---|---|---|---|---|
| **React** ✅ chosen | ✅ **68% market share**, ~9M weekly npm downloads, growing YoY [[1]](https://tech-insider.org/react-vs-vue-2026/) [[2]](https://www.javascriptdoctor.blog/2026/05/the-react-foundation-is-here-react.html) | ✅ **Strongest of the group.** As of Feb 2026, React moved out from under single-company (Meta) ownership into the independent **React Foundation** under the Linux Foundation, backed by Amazon, Microsoft, Huawei, Vercel, and others [[2]](https://www.javascriptdoctor.blog/2026/05/the-react-foundation-is-here-react.html) — this *reduces* single-vendor abandonment risk rather than adding it, the same "no single point of failure" property we valued in LiveKit's open-source core (ADR-0001). 13 years in production, follows semantic versioning with security fixes backported to prior majors [[2]](https://www.javascriptdoctor.blog/2026/05/the-react-foundation-is-here-react.html) | ✅ Largest tutorial/course/Stack-Overflow/AI-training-data base of any frontend framework — directly useful for an agent-assisted first-time team | ✅ By far the deepest — component libraries, meta-frameworks, hiring pool |
| Vue | ✅ 18% market share, stable, mature, community-governed (not single-company either) [[1]](https://tech-insider.org/react-vs-vue-2026/) | ✅ Also a safe, proven choice — "React and Vue remain the two safest choices in 2026" for teams that value hiring/long-term support/ecosystem maturity [[1]](https://tech-insider.org/react-vs-vue-2026/) | ✅ Also beginner-friendly, arguably gentler template syntax than JSX | ⚠️ Real but smaller than React's — fewer examples for an agent to draw on |
| Svelte (5, runes) | ⚠️ ~8% adoption, fastest-growing, highest developer satisfaction (88%) [[1]](https://tech-insider.org/react-vs-vue-2026/) | ✅ Genuinely stable now — 5.0 shipped Oct 2024 with a year+ of patch releases, "not experimental anymore" [[3]](https://listiak.dev/blog/the-state-of-solid-js-in-2026-signals-performance-and-growing-influence) | ✅ Low learning curve | ❌ Ecosystem meaningfully smaller — SvelteKit has ~20K GitHub stars vs. React meta-frameworks' much larger footprint; "ecosystems, job markets, and enterprise adoption remain significantly smaller than both React and Vue" [[1]](https://tech-insider.org/react-vs-vue-2026/) |
| SolidJS | ❌ Smallest adoption of the group, ~2.4–3.5x smaller community than Svelte by GitHub stars [[3]](https://listiak.dev/blog/the-state-of-solid-js-in-2026-signals-performance-and-growing-influence) | ✅ SolidStart reached a stable 1.x line, technically sound | ⚠️ React-like API eases the syntax, but smallest support community of any option here | ❌ Weakest — least material for a beginner+agent team to lean on |

## Decision
**React**, with **Vite** as the build tool (not Create React App, which has
been effectively unmaintained since 2023 and is no longer recommended by
the React team [[4]](https://saurabhnativeblog.medium.com/vite-vs-create-react-app-choosing-the-right-tool-for-your-react-js-project-8824411247cd);
and not a full meta-framework like Next.js — see note below).

In plain terms: Vue and Svelte are both legitimate, well-built frameworks,
but React wins clearly on the two criteria that matter most for this team —
by far the largest base of examples/tutorials for an agent-assisted
beginner to draw on, and now the strongest institutional longevity story of
any option here, having just moved from single-company ownership to
foundation governance backed by multiple major tech companies. That's a
direct answer to "will this still be safe to build on and not orphaned in a
year" — arguably a stronger governance position than it had even under
Meta.

**Vite vs. Next.js — scoped separately, not a coin-flip:** GD Arena is a
logged-in practice tool (accounts, rooms, session history) with no public
content pages that need search-engine visibility — exactly the case current
guidance describes as favoring Vite: "applications behind authentication
where SEO does not matter benefit from Vite" [[4]](https://saurabhnativeblog.medium.com/vite-vs-create-react-app-choosing-the-right-tool-for-your-react-js-project-8824411247cd).
Next.js's main advantages (server-rendering for SEO/fast first paint on
public pages) don't apply here, and it's real added complexity (routing
conventions, server/client component boundaries) for a first-time team to
learn. Plain React + Vite is simpler and a direct fit.

## Consequences
- **Positive:** Largest possible pool of documentation/examples for an
  agent-dependent team. Strongest longevity position of any frontend
  framework right now (foundation-governed, multi-company backed). Vite is
  fast to develop with and simple to reason about for a first build.
- **Risk to track:** React's own pace of change (Server Components, etc.)
  is real — but we're deliberately *not* adopting a meta-framework that
  would expose us to that complexity, so this risk is largely avoided by
  the Vite-not-Next.js scoping above.
- If a future module needs public, SEO-relevant marketing pages (unlikely
  for an accounts-gated practice arena), Next.js or a static site tool can
  be added alongside the Vite app later without touching React itself.

## Revisit if
- A future requirement needs server-rendered public pages (Next.js becomes
  worth the added complexity then, not now), or
- React Foundation governance changes materially, or
- Team composition changes to include someone with strong existing Vue/
  Svelte experience, which would change the beginner-fit calculus.

## Sources
1. [React vs Vue 2026 market share/stability](https://tech-insider.org/react-vs-vue-2026/)
2. [React Foundation launch, Feb 2026](https://www.javascriptdoctor.blog/2026/05/the-react-foundation-is-here-react.html)
3. [State of SolidJS/Svelte 2026](https://listiak.dev/blog/the-state-of-solid-js-in-2026-signals-performance-and-growing-influence)
4. [Vite vs CRA 2026 — CRA unmaintained](https://saurabhnativeblog.medium.com/vite-vs-create-react-app-choosing-the-right-tool-for-your-react-js-project-8824411247cd)
