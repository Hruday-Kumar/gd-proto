# [DB-SPEC-ID] — [Migration name]

**Status:** Draft  
**Owner:** [name]  
**Migration file:** `supabase/migrations/[NNNN_name].sql`  
**Related feature:** [spec link]  
**Data classification:** [public/internal/student-sensitive/secret]

## Problem

[Why the current schema cannot safely support the required behavior.]

## Goals

- [Schema/data outcome]

## Non Goals

- [No unrelated cleanup or destructive rewrite]

## Requirements

- **R1:** Migration is ordered, reviewable, and safe on the current live schema.
- **R2:** New user data has RLS enabled and least-privilege policies.
- **R3:** Application compatibility is defined before, during, and after apply.

## Design

### Current and target schema

[Tables, columns, constraints, indexes, functions, policies, and data volume.]

### Migration strategy

[Expand/contract steps, backfill batches, locks, transaction boundaries,
idempotency, and application deployment order.]

### RLS and authorization

[Policy matrix for anon, authenticated owner, other user, and service role.]

## Risks

| Risk | Detection | Mitigation |
|---|---|---|
| lock/data loss/policy gap | [query/signal] | [control] |

## Acceptance Criteria

- [ ] Applies once to a representative current schema.
- [ ] Pre/post verification queries pass.
- [ ] RLS owner-isolation tests pass.
- [ ] Old/new application compatibility matches the rollout plan.

## Implementation Tasks

- [ ] Write forward migration.
- [ ] Write verification queries and recovery procedure.
- [ ] Add integration/RLS tests.
- [ ] Record manual Supabase apply step and owner.

## Testing

[Representative snapshot, row counts, constraints, query plan, RLS, concurrent
writes, and application compatibility.]

## Verification

[Exact pre/post SQL, expected results, applied-by/when, and migration checksum.]

## Monitoring

[Error rate, latency, locks, policy denials, row counts, and observation window.]

## Rollout

[Backup/checkpoint, application/migration order, maintenance needs, stop gates.]

## Rollback

[Reversible SQL or forward-recovery plan. Explicitly describe data loss risk;
never promise rollback for an irreversible transformation.]

