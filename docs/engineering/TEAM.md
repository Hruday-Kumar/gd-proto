# Team Context

## Composition
- Small team, nominally 2–6 developers (fixed project constraint).
- **Actual working reality (confirmed by user, 2026-07-24):** the builder(s) are **not experienced** in any of the core technologies — frontend (React), backend (Node/APIs), WebRTC / real-time audio, or TDD / automated testing. The user can learn and execute, but **relies heavily on AI coding agents** to build.

## How this must affect agent behavior
1. **Tech selection:** strongly favor mainstream, widely-adopted technologies with large communities, abundant examples, and excellent documentation — the things both a newcomer and an agent lean on. Reject niche, cutting-edge, or "clever" choices even when technically elegant, unless they're clearly the safest managed option.
2. **Managed over self-managed for hard parts:** the real-time audio (WebRTC) and live speech-to-text layers are the highest-risk, least-familiar areas. Prefer managed services that hide that complexity, budget permitting (<~$100/mo).
3. **Explain more:** PRs and decisions touching unfamiliar tech need plain-language explanation of what the code does and why — assume the reviewer is learning it via the agent.
4. **TDD support:** the team is new to test-first work. Keep the pragmatic-TDD workflow concrete and low-friction; show, in each feature, exactly which unit is core (tests-first) vs peripheral (tests before "done").
5. **Maintainability first:** optimize for code the team can still operate and modify without the original agent context — reliability and clarity over sophistication.

## Not yet known
- Exact headcount actually active on the build.
- Whether any team member has adjacent experience (e.g. general programming, DevOps) beyond the four areas asked about.

Update this file if team composition or experience changes.
