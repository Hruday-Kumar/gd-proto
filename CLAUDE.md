# PlaceMe — Claude Code context

Claude Code is PlaceMe's primary specification, architecture, implementation,
documentation, and refactoring agent. `ENGINEERING.md` defines the shared
lifecycle; `.claude/rules/guardrails.md` contains rules that must never be
silently bypassed.

## Product boundary

PlaceMe is an on-demand practice arena for engineering students preparing for
campus placements. v1 contains one module: **GD Arena — Multiplayer**. Real
students join a live audio room with a topic and timer, receive per-speaker
transcription/attribution, and receive individual written feedback.

In scope:

- student authentication, identity, and basic profile;
- explicit recorded consent;
- generated or custom topics;
- random matching and shareable room code/link;
- live real-person audio through LiveKit;
- AssemblyAI live transcription with speaker attribution;
- Gemini-generated individual feedback;
- per-student session history and account deletion.

Deferred unless the user explicitly expands scope: AI voice practice, JAM,
aptitude/technical tests, roleplay interviews, drive simulator, payments,
notifications, mobile apps, and unrelated product modules.

## Fixed constraints

- Team: agent-dependent builders who are new to much of the stack; prefer
  mainstream, documented, maintainable technology.
- Pilot scale: roughly 5–10 concurrent rooms initially and 20–30 after three
  months.
- Budget: less than roughly US$100/month for infrastructure and tooling.
- Privacy: never persist raw audio; retain transcript and feedback until account
  deletion; students can access only their own history.
- Compliance: India DPDP and explicit recorded consent before any microphone is
  enabled.
- Deployment: containerized backend on Render, Vite/React frontend on Vercel,
  Supabase/Postgres, LiveKit, AssemblyAI, and Gemini.
- Method: pragmatic TDD—core logic tests first, all affected behavior tested
  before done.
- Git: branch per task, PR to `dev`, and `dev` → `main` by release PR.

Do not re-litigate these constraints without an explicit request and an ADR.

## Responsibilities

- Translate an idea or issue into a specification before significant work.
- Design within accepted architecture and record material decisions as ADRs.
- Implement approved behavior with small, maintainable changes.
- Add and update unit, integration, regression, RLS, and manual tests.
- Update specifications, architecture, runbooks, and user/operator
  documentation.
- Refactor only when behavior is protected by tests and the scope remains clear.
- Produce an implementation summary for every significant change.

## Mandatory rules

- Never implement undocumented behavior.
- Never bypass authentication, authorization, RLS, consent, retention, rate
  limits, or other security controls.
- Always update affected tests.
- Always update the specification when intended behavior or scope changes.
- Always generate an implementation summary with files, decisions, tests,
  verification, risks, rollout, and rollback.
- Never expose secret values from `.env` files or provider configuration.
- Never mark room/audio/transcription/attribution/feedback work complete without
  the real-human evidence required by the guardrails.

## Start-of-work protocol

1. Read `.claude/rules/guardrails.md`.
2. Read `docs/engineering/PROGRESS.md` and `docs/engineering/PLAN.md`.
3. Read the issue and approved specification in `docs/specs/active/`.
4. Read applicable ADRs under `docs/engineering/adr/` and `docs/adr/`.
5. Confirm acceptance criteria, non-goals, risks, rollout, and rollback.
6. If a significant change lacks an approved specification, draft one before
   implementation.

## Implementation protocol

Follow:

`Issue → Specification → Architecture Review → Implementation → Unit Tests → Integration Tests → Security Review → Verification → Pilot Validation → Merge`

Use `$placeme-feature` for implementation. Before merge, route verification to
the corresponding `$placeme-review`, `$placeme-security`, `$placeme-pilot`, and
`$placeme-release` workflows.

### TDD — mandatory for behavior changes

1. **RED:** write the next focused test and run it. Confirm it fails for the
   intended missing behavior, not a test defect.
2. **GREEN:** implement only enough behavior to pass.
3. **REFACTOR:** improve clarity without changing behavior, then rerun tests.
4. Do not delete or weaken a valid test to obtain a pass.
5. Bug fixes require a regression test.

Commits should remain reviewable and preserve the test/implementation trail when
the workflow permits it.

## Commands

```sh
npm test
npm run lint
npm run build
```

Focused commands:

```sh
npm test --workspace=@placeme/server
npm run lint --workspace=@placeme/web
npm run build --workspace=@placeme/web
```

Database migrations are applied manually to Supabase; they are never considered
deployed merely because the SQL file merged.

## Required implementation summary

Include:

- issue and specification path;
- behavior delivered and explicit non-goals;
- architecture/ADR decisions;
- files and data/API contracts changed;
- tests written and commands run;
- security, privacy, concurrency, and regression review;
- manual/human verification still required;
- monitoring, rollout, rollback, and residual risks.

## Durable project context

- Handbook: `ENGINEERING.md`
- Codex verification contract: `CODEX.md`
- Non-negotiable guardrails: `.claude/rules/guardrails.md`
- Current status: `docs/engineering/PROGRESS.md`
- Shared plan: `docs/engineering/PLAN.md`
- Team context: `docs/engineering/TEAM.md`
- Branching: `docs/engineering/BRANCHING.md`
- Deployment: `docs/engineering/DEPLOYMENT.md`
- Architecture: `docs/architecture/README.md`
- ADR index: `docs/adr/README.md`
- Runbooks: `docs/runbooks/README.md`
