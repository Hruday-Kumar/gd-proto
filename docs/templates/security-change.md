# [SEC-SPEC-ID] — [Security change]

**Status:** Draft  
**Owner:** [name]  
**Security reviewer:** [name]  
**Tracking:** [private advisory or non-sensitive issue]  
**Disclosure:** [private/internal/public-safe]

## Problem

[Threat, affected asset, attacker capability, current control gap, and severity.
Do not place exploit secrets or sensitive personal data in a public document.]

## Goals

- [Security property to establish]

## Non Goals

- [Threats or systems not addressed]

## Requirements

- **R1 Authentication:** [identity guarantee]
- **R2 Authorization/RLS:** [resource access guarantee]
- **R3 Consent/retention:** [privacy guarantee]
- **R4 Secrets/API:** [credential and boundary guarantee]
- **R5 Auditability:** [safe signal/evidence]

## Design

### Assets and trust boundaries

[Data, actors, entry points, providers, and privilege boundaries.]

### Threat model and controls

| Threat | Prevent/detect/respond control | Residual risk |
|---|---|---|
| [threat] | [control] | [risk] |

## Risks

[Compatibility, lockout, bypass, fail-open behavior, migration, and rollout risk.]

## Acceptance Criteria

- [ ] The defined unauthorized action is denied.
- [ ] Authorized behavior still works.
- [ ] Logs/alerts contain no secrets or unnecessary personal data.

## Implementation Tasks

- [ ] Add negative and positive security tests.
- [ ] Implement control.
- [ ] Search for variants and alternate entry points.
- [ ] Update runbook and rotation/recovery guidance.

## Testing

[Auth/authz, RLS isolation, input abuse, rate limits, fail-closed provider/config,
and regression cases.]

## Verification

[Independent reviewer, commands/scans, evidence location, and accepted risks.]

## Monitoring

[Security signal, threshold, access, retention, alert owner, response runbook.]

## Rollout

[Coordinated credential/config/code order, staged enablement, communications.]

## Rollback

[Safe rollback that does not restore the vulnerability; prefer forward recovery
when reverting would re-open exposure.]

