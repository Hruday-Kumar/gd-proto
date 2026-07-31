# [API-SPEC-ID] — [API change]

**Status:** Draft  
**Owner:** [name]  
**Consumers:** [web/worker/external]  
**Compatibility:** [additive/breaking]  
**Related feature:** [spec link]

## Problem

[Consumer need and deficiency in the current contract.]

## Goals

- [Contract outcome]

## Non Goals

- [Excluded endpoints/clients]

## Requirements

- **R1:** [Method/path/auth/authorization behavior]
- **R2:** [Request/response/error/idempotency behavior]
- **R3:** [Rate limit, consent, privacy, and observability behavior]

## Design

### Contract

```text
[METHOD] /api/[path]
Auth:
Request:
Success:
Errors:
```

### State, concurrency, and compatibility

[Duplicate requests, ordering, versioning, old/new consumer overlap, timeout,
cancellation, retry, and provider behavior.]

## Risks

[Unauthorized access, enumeration, injection, breaking clients, amplification,
partial writes, error leakage.]

## Acceptance Criteria

- [ ] Contract tests cover success and documented errors.
- [ ] Authentication, resource authorization, consent, and rate limits are tested.
- [ ] Compatibility and deprecation plan is evidenced.

## Implementation Tasks

- [ ] Update server contract and boundary validation.
- [ ] Update all consumers and API documentation.
- [ ] Add contract, security, and regression tests.

## Testing

[Unit, API integration, auth negative cases, malformed/large input, concurrency,
provider failure, and consumer tests.]

## Verification

[Request/response evidence with secrets and personal data redacted.]

## Monitoring

[Volume, latency, status classes, rate-limit denials, provider failures, owner.]

## Rollout

[Additive-first/versioned deployment, consumer sequence, deprecation window.]

## Rollback

[Compatibility-safe revert, feature flag/routing action, data implications.]

