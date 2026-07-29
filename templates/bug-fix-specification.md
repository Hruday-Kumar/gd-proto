# [BUG-SPEC-ID] — [Bug title]

**Status:** Draft  
**Owner:** [name]  
**Incident/issue:** [link]  
**Severity:** [blocker/high/medium/low]  
**First affected release:** [release or unknown]

## Problem

[Expected behavior, observed behavior, affected users, frequency, and evidence.
Do not include secrets or unnecessary personal data.]

## Goals

- Reproduce and fix the root cause.
- Prevent recurrence with a regression test.

## Non Goals

- [Adjacent cleanup or redesign explicitly excluded]

## Requirements

- **R1:** [Correct behavior]
- **R2:** Existing security, consent, retention, and API contracts remain intact.

## Design

### Reproduction and root cause

[Minimal reproduction, causal chain, affected versions, and why current tests
missed it.]

### Fix

[Smallest safe change, concurrency/failure behavior, and alternatives rejected.]

## Risks

| Risk | Mitigation |
|---|---|
| Regression in [area] | [test/review] |

## Acceptance Criteria

- [ ] The original reproduction fails before and passes after the fix.
- [ ] A regression test covers the root cause.
- [ ] Affected adjacent flows remain green.

## Implementation Tasks

- [ ] Add failing regression test.
- [ ] Implement the minimum fix.
- [ ] Review variants of the same bug pattern.
- [ ] Update docs/runbook if operator-visible.

## Testing

[Unit, integration, RLS, manual, and provider tests with exact cases.]

## Verification

[Commands, environment, before/after evidence, and reviewer.]

## Monitoring

[How recurrence will be detected; metric/log/error signature and owner.]

## Rollout

[Priority, deployment sequence, observation window, and communication.]

## Rollback

[Revert/forward-fix decision, data impact, trigger, and smoke test.]

