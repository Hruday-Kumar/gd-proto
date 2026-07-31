# PlaceMe agent instructions

This repository is specification-driven. Read these files before making a
significant change:

1. [`CLAUDE.md`](CLAUDE.md) for product scope, fixed constraints, and the
   implementation protocol.
2. [`CODEX.md`](CODEX.md) for verification and review responsibilities.
3. [`ENGINEERING.md`](ENGINEERING.md) for lifecycle gates and the Definition of
   Done.
4. [`.claude/rules/guardrails.md`](.claude/rules/guardrails.md) for
   non-negotiable consent, retention, human-verification, and scope rules.
5. The approved specification under `docs/specs/active/` for the work at hand.

Do not implement significant behavior without an approved specification. Keep
the issue, specification, implementation, tests, verification evidence, rollout,
and rollback traceable through the specification path and pull request.

Automatically select the focused repository skill whose description matches the
request:

| Request intent | Skill |
|---|---|
| build, implement, fix, or refactor approved behavior | `$placeme-feature` |
| review a diff/PR or verify spec/regression/concurrency | `$placeme-review` |
| audit auth, authorization, RLS, consent, secrets, API, or privacy | `$placeme-security` |
| assess real-student or operational pilot readiness | `$placeme-pilot` |
| prepare/verify release, deployment, migration, smoke, or rollback | `$placeme-release` |
| respond to outage, incident, degradation, or root-cause analysis | `$placeme-incident` |

For a compound request, apply the relevant skills in lifecycle order. Skill
selection does not authorize deployment, migration, destructive changes, or
external communication. Existing generic skills are optional tools, not project
policy.
