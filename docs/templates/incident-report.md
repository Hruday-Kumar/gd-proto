# [INC-ID] — [Incident title]

**Status:** Investigating  
**Severity:** [SEV-1/2/3]  
**Commander:** [name]  
**Started:** [UTC/IST timestamp]  
**Resolved:** [timestamp or ongoing]  
**Affected release/providers:** [identifiers]

## Problem

[Concise observed impact. Do not include secrets, raw audio, full transcripts, or
unnecessary student identifiers.]

## Goals

- Protect students and data.
- Restore a safe service or stop affected flows.
- Preserve evidence and communicate accurately.

## Non Goals

- Root-cause speculation during initial response.
- Unrelated refactoring.

## Requirements

- **R1:** Assign incident roles and severity.
- **R2:** Record a timestamped, factual timeline and decisions.
- **R3:** Mitigate without bypassing consent, authorization, RLS, or retention.

## Design

### Detection and impact

[Signal, affected users/functions, geography/cohort, data/privacy assessment.]

### Timeline

| Time | Fact/action/decision | Owner | Evidence |
|---|---|---|---|
| [time] | [entry] | [name] | [safe link] |

### Current hypothesis

[Clearly label hypothesis; separate it from verified facts.]

## Risks

[Ongoing safety/privacy/data/integrity/availability risks and containment.]

## Acceptance Criteria

- [ ] Impact is contained.
- [ ] Core service is safely restored or explicitly disabled.
- [ ] Student/privacy impact is assessed.
- [ ] Follow-up and post-mortem owners are assigned.

## Implementation Tasks

- [ ] Contain and mitigate.
- [ ] Verify restoration.
- [ ] Communicate status.
- [ ] Open corrective-action issues and post-mortem.

## Testing

[Focused reproduction and smoke tests used during mitigation.]

## Verification

[Health, end-to-end, logs/metrics, data integrity, and owner confirming recovery.]

## Monitoring

[Heightened observation signals, frequency, duration, and owner.]

## Rollout

[How mitigation/recovery is introduced and who authorizes it.]

## Rollback

[How to undo a failed mitigation without returning to an unsafe state.]

