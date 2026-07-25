# How we write Phase 0b ADRs

One ADR per tech category (Auth, DB/storage, real-time room/WebRTC, live STT,
backend framework, frontend framework, hosting/deployment, LLM provider). Each
ADR is self-contained — a future session (or teammate) should be able to read
just that file and understand the decision without replaying this one.

## Rubric — every option is checked against the fixed constraints in
`CLAUDE.md` and `.claude/rules/guardrails.md`, specifically:

1. **Hard requirement(s) for this category** — a capability the product
   literally cannot ship without (e.g. for real-time/WebRTC: server-side
   access to each participant's audio as a separate stream, since that's what
   makes per-speaker attribution structural instead of guessed).
2. **Managed over self-managed for hard/unfamiliar parts** (TEAM.md) — does
   this option hide the hardest engineering problem, or push it onto a team
   that's new to the domain?
3. **Mainstream + well-documented** (guardrail #7) — large community,
   abundant examples/tutorials, actively maintained (not sunsetting).
4. **Cost at pilot scale — effectively $0 out-of-pocket, not just "under
   $100/mo."** The <~$100/mo figure in CLAUDE.md is a ceiling, not a
   spending target: there is no budget to spend from personal funds. The
   plan is to bootstrap entirely on genuinely-free tiers/open-source tools,
   build something demoable, and use that to attract funding before any
   real spend kicks in. So: weight "free forever, no credit card required"
   far above "cheap at low volume," and call out explicitly which options
   require eventually adding a card or committing to a paid plan even if
   the sticker price is low — those are a real blocker here, not a nitpick.
   A one-time expiring trial credit (e.g. Deepgram's $200 credit in the
   spike) is fine for a prototype but should not be the basis for a
   production decision. Check this against ~5–10 concurrent rooms now,
   ~20–30 rooms at 3 months.
5. **No hard vendor lock-in, cloud-agnostic, containerized** (fixed
   constraint) — bonus for an open-source core / self-host escape hatch;
   penalty for closed proprietary-only platforms.
6. **Fits the ~2–4 week timeline** — evidence from the Phase 0a spike counts
   here if this category was spiked.
7. **Longevity / production stability** (added 2026-07-25, per direct user
   guidance) — is this option proven in real production apps, not just
   demos/prototypes, and unlikely to be abandoned or force a breaking
   rewrite on us later? Foundational tech choices (frameworks, databases,
   room/STT providers) are expensive to change once the product is built on
   them, so it's fair to weigh this now even though we otherwise avoid
   designing for hypothetical future requirements — that guardrail is about
   product *scope* creep, not about picking unstable foundations. Prefer
   boring-and-proven over new-and-trendy when two options are otherwise
   close.

We use a plain ✅/⚠️/❌ comparison table, not weighted scoring — the team is
new to all of this and a heavier framework would obscure the reasoning rather
than clarify it. Every ✅/⚠️/❌ must be traceable to a cited source (guardrail
#6): training-data recall is not an acceptable basis for current pricing,
versions, or product status.

## ADR file format
- **Status** (Proposed / Accepted / Superseded)
- **Context** — what we're deciding and why, tied back to the constraints
- **Options considered** — comparison table with citations
- **Decision** — the pick, in plain language
- **Consequences** — what this buys us and what risk/cost we're accepting
- **Revisit if** — the condition that would make us reopen this decision
