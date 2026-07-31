# Release checklist — [release]

**Release/SHA:** [value]  
**Specifications:** [links]  
**Release Manager/date:** [name/date]  
**Environment:** [value]

## Scope and quality

- [ ] Included specifications are approved and verified.
- [ ] Diff and dependency changes are reviewed.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass freshly.
- [ ] Regression, security, performance, and manual checks are complete.
- [ ] Required real-person room/audio evidence is complete.

## Data and configuration

- [ ] Migrations are ordered with apply, verification, and recovery steps.
- [ ] Environment-variable names/config are confirmed without exposing values.
- [ ] RLS, consent, retention, and account deletion remain correct.
- [ ] Provider quotas/status/billing caps support rollout.

## Operations

- [ ] Monitoring, alerts, support, and incident ownership confirmed.
- [ ] Smoke tests and stabilization window defined.
- [ ] Rollout phases and stop conditions approved.
- [ ] Rollback/forward recovery is executable and owner assigned.

## Execution record

| Time | Action | Evidence/result | Owner |
|---|---|---|---|
| [time] | [deploy/smoke/observe] | [safe link/result] | [name] |

## Decision

**Release / Hold / Roll back:** [decision]  
**Post-release status and residual risk:** [summary]

