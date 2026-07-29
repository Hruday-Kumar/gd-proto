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

Use the focused repository skills under `.github/skills/placeme-*` when their
workflow applies. Existing generic skills are not project policy.

