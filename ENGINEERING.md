# PlaceMe engineering handbook

This handbook is the repository-wide engineering contract for a production SaaS
application preparing for a controlled pilot. It applies to humans, Claude Code,
Codex, GitHub, and VS Code workflows.

## Authority and source of truth

When instructions conflict, use this order:

1. `.claude/rules/guardrails.md`
2. an approved feature specification and accepted ADRs
3. this handbook
4. service runbooks and local component documentation

Product constraints live in `CLAUDE.md`. Existing architecture decisions remain
in `docs/engineering/adr/`; `docs/adr/` is the entry point for new ADRs and links
to that history.

## Specification-driven development

No significant feature may be implemented without an approved specification.
Significant means any user-visible behavior, API or schema change, authentication
or authorization change, provider integration, data-retention change,
architecture decision, operational behavior, or rollout risk.

Tiny spelling, comment, and obviously behavior-neutral documentation corrections
may skip a specification. When uncertain, write the specification.

Specifications move through:

`Draft → In Review → Approved → Implementing → Verified → Completed`

- Draft and approved work lives in `docs/specs/active/`.
- Verified, shipped work moves to `docs/specs/completed/`.
- Rejected, superseded, or abandoned work moves to `docs/specs/archived/` with
  the reason retained.
- A specification ID and path must appear in its issue, branch or commit context,
  pull request, implementation summary, and verification record.
- If implementation changes intended behavior, update and re-approve the
  specification before merging the behavior.

## Development lifecycle

| Stage | Required output | Exit gate |
|---|---|---|
| Idea / Issue | problem, user impact, owner, priority | triaged and in MVP scope |
| Specification | goals, non-goals, requirements, risks, acceptance criteria, rollout, rollback | explicit approval recorded |
| Design Review | architecture, data flow, APIs, concurrency, security, provider failure behavior | relevant ADRs accepted or referenced |
| Implementation | small, traceable code changes and implementation summary | approved scope implemented |
| Unit Tests | deterministic domain and failure-path tests | fresh tests pass |
| Integration Tests | API, database/RLS, provider boundary, and component integration evidence | affected integrations pass |
| Security Review | auth, authorization, RLS, consent, secrets, retention, abuse, dependency review | no unresolved blocker/high finding |
| Verification | requirement-to-evidence matrix, regression checks, manual tests | all acceptance criteria evidenced |
| Pilot Validation | real-device journey, monitoring, support, limits, rollout, rollback | Pilot Engineer sign-off |
| Merge | reviewed PR targeting the correct branch | Definition of Done met |

Skipping a gate requires a written exception in the specification with owner,
reason, risk, expiry, and follow-up issue. Security, consent, retention, and
required human verification gates cannot be waived silently.

## Coding standards

- Use Node.js 22+, ECMAScript modules, and the established JavaScript/JSX style.
- Keep domain decisions in small, deterministic modules under
  `apps/server/src/domain/`; keep transport, database, and provider code at
  boundaries.
- Validate untrusted input at API, database, WebSocket, and provider boundaries.
- Authenticate first and authorize every resource action. Client visibility is
  not authorization.
- Keep Supabase service-role credentials server-only. Browser code uses the anon
  key and must remain protected by RLS.
- Make writes idempotent where retries or duplicate events are possible. Define
  ordering, ownership, timeout, cancellation, and cleanup for concurrent work.
- Use structured, actionable errors and logs without secrets, tokens,
  transcripts, or unnecessary personal data.
- Prefer existing dependencies and mainstream maintained tools. A new dependency
  needs rationale, security review, licensing check, and glossary update in
  `docs/engineering/LESSONS.md`.
- Do not persist raw audio. Explicit recorded consent must precede microphone
  enablement and capture.
- Keep changes narrowly scoped. Do not mix behavior, refactoring, migration, and
  unrelated cleanup unless the specification explains why.

## Testing requirements

PlaceMe uses pragmatic Red → Green → Refactor. Core domain behavior and bug fixes
require a test that fails for the intended reason before implementation.
Peripheral work still requires tests before it is considered done.

Minimum commands:

```sh
npm test
npm run lint
npm run build
```

Apply the following according to risk:

- Unit tests for domain rules, state transitions, validation, timeouts, retries,
  and error paths.
- API integration tests for authentication, authorization, consent gates, rate
  limits, and response contracts.
- Live RLS isolation tests for new or changed tables and policies.
- Migration verification on a representative database with pre/post queries.
- Browser/manual tests for affected user journeys and accessibility basics.
- Multi-person, real-device testing for rooms, audio, transcription,
  attribution, and feedback. Automated checks alone never close this gate.
- Regression tests for every bug fix and for high-risk adjacent behavior.

Tests must be fresh, reproducible, and recorded in the pull request. Do not
weaken assertions or delete tests merely to obtain a pass.

## Review process

1. The author self-reviews the diff against the specification and Definition of
   Done.
2. The Architect reviews new architecture or material design decisions.
3. The Reviewer checks specification compliance, regressions, tests, and
   maintainability.
4. The Security Engineer reviews any auth, RLS, consent, data, provider, API,
   dependency, or operational-security impact.
5. The Pilot Engineer reviews user and operational readiness for pilot-facing
   changes.
6. The Release Manager verifies migrations, smoke tests, monitoring, rollout,
   and rollback before promotion.

Authors must resolve findings with code/evidence or record an accepted risk with
an accountable owner and deadline. AI review supports but does not replace the
human owner for security exceptions, production changes, or pilot sign-off.

## Documentation requirements

Each significant change updates, as applicable:

- the approved specification and task status;
- architecture overview and ADRs;
- API, schema, environment-variable, and provider contracts;
- operator runbooks and monitoring;
- user/support documentation;
- `docs/engineering/STATUS.md` and `LESSONS.md`;
- a concise implementation summary and verification record.

Documentation describes actual behavior. Never ship undocumented behavior or
leave a specification claiming behavior the implementation no longer has.

## Security requirements

- Enforce least privilege across API authorization, LiveKit permissions,
  Supabase RLS, CI, and provider credentials.
- Require explicit, recorded consent before microphone or transcript capture.
- Preserve the retention contract: raw audio is streamed, not stored; transcript
  and feedback remain until account deletion.
- Threat-model trust boundaries and abuse cases for every exposed endpoint or
  provider callback.
- Store secrets only in approved local or hosted secret stores; commit example
  names, never values. Rotate suspected exposures and record the incident.
- Review rate limits, CORS, headers, error leakage, dependency risk, and audit
  logging.
- Treat migrations and RLS changes as security changes. Test owner isolation and
  service-role boundaries.
- Follow `docs/templates/security-checklist.md` and use `$placeme-security`.

## Pilot readiness workflow

A pilot-facing change needs:

1. acceptance criteria verified in a deployed or representative environment;
2. the required real-person room/audio journey where applicable;
3. provider quotas, rate limits, billing caps, degradation, and outage behavior
   checked for Gemini, AssemblyAI, LiveKit, Supabase, Render, and Vercel;
4. dashboards/health checks, alert ownership, and support channel confirmed;
5. privacy, consent, account deletion, and student-data access rechecked;
6. rollout cohort, success metrics, stop conditions, and rollback rehearsed;
7. a named operator and Pilot Engineer sign-off.

Evidence belongs in `docs/pilot/` or the specification. Use
`docs/templates/pilot-checklist.md` and `$placeme-pilot`.

## Release workflow

1. Freeze the intended commit and confirm the PR targets `dev`; production
   releases promote `dev` to `main` by PR.
2. Confirm every included specification is approved and verified.
3. Run fresh tests, lint, build, security, regression, and smoke checks.
4. Verify environment variables and provider configuration by name only.
5. Review migrations in sequence; record apply, verification, and recovery steps.
6. Confirm monitoring, operator ownership, rollout phases, and stop conditions.
7. Deploy the approved artifact, execute smoke tests, and observe the defined
   stabilization window.
8. Roll back or execute the approved forward-recovery plan if a stop condition
   triggers.
9. Record release evidence and move shipped specifications to `completed/`.

Use `docs/templates/release-checklist.md`, the runbooks in `docs/runbooks/`, and
`$placeme-release`.

## Definition of Done

A feature is complete only when the repository-wide checklist in
[`docs/operations/definition-of-done.md`](docs/operations/definition-of-done.md)
is satisfied:

- [ ] specification approved;
- [ ] design review complete;
- [ ] implementation complete and traceable to the specification;
- [ ] unit and integration tests passing;
- [ ] regression review complete;
- [ ] security reviewed;
- [ ] documentation updated;
- [ ] verification and acceptance criteria complete;
- [ ] monitoring updated and alert owner identified;
- [ ] rollout and rollback documented;
- [ ] pilot impact reviewed;
- [ ] required human validation complete;
- [ ] implementation summary recorded in the pull request.

Unmet items remain explicit blockers or documented, approved follow-ups. “Tests
pass” alone is never the Definition of Done.
