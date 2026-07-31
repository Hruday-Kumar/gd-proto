# Repository-wide Definition of Done

Use this checklist for every production code change. A pull request may mark an
item not applicable only when it explains why and the reviewer agrees.

## Product and design

- [ ] The approved specification identifies the problem, goals, non-goals,
      requirements, risks, acceptance criteria, rollout, and rollback.
- [ ] The implementation and any architecture decision are traceable to that
      specification.
- [ ] Product behavior, accessibility, failure states, and operational impact
      were reviewed.

## Implementation and quality

- [ ] The change is narrowly scoped and follows repository conventions.
- [ ] Unit and integration tests cover success, failure, authorization, and
      important boundary cases.
- [ ] Required tests, lint, type checks, and builds pass on the reviewed commit.
- [ ] Regression risks, concurrency behavior, and backward compatibility were
      assessed.
- [ ] Generated files, temporary artifacts, dead code, and debug logging are
      absent.

## Security and privacy

- [ ] Authentication, authorization, RLS, consent, secrets, sensitive logs, and
      data retention were reviewed where applicable.
- [ ] No credential or production data is committed or copied into evidence.
- [ ] Dependency and abuse risks are addressed or recorded as approved
      follow-up work.

## Verification and operations

- [ ] Acceptance criteria were verified and evidence is linked in the pull
      request.
- [ ] Documentation, API contracts, migration notes, and runbooks are current.
- [ ] Monitoring signals, alert ownership, and pilot impact are documented.
- [ ] Rollout, smoke checks, stop conditions, and a tested rollback or
      forward-recovery path are ready.
- [ ] Required human validation is complete.

## Closure

- [ ] Review, security, pilot, and release gates required by risk are complete.
- [ ] The pull request contains an implementation summary and any known
      limitations.
- [ ] No unresolved blocker is hidden as a follow-up.
- [ ] The specification is moved to `docs/specs/completed/` only after the
      production outcome is verified.

Passing tests alone does not make a change done. Unmet items are blockers unless
the responsible reviewer explicitly approves a documented follow-up.
