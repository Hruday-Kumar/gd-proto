# Runbook — Supabase database migration

## Purpose

Apply a reviewed SQL migration safely to the Supabase Postgres project. PlaceMe
migrations are manual; merging a file does not apply it.

## Preconditions

- Approved database-migration specification and reviewed sequential file under
  `supabase/migrations/`.
- Exact target project/environment independently confirmed.
- Current application release and schema version recorded.
- Pre-migration queries, expected results, post-migration verification, RLS
  tests, application compatibility, and recovery plan approved.
- Backup/checkpoint appropriate to the migration's data-loss risk.
- Named operator and verifier; pilot traffic paused if required.

## Preflight

1. Compare the migration number with the repository and other active PRs.
2. Review locks, table rewrites, backfill volume, transaction boundaries, and
   old/new application compatibility.
3. Confirm every new user-data table has RLS enabled and least-privilege
   policies.
4. Run the migration against a representative non-production schema where
   available.
5. Run and save privacy-safe pre-migration verification results.
6. Confirm stop conditions and whether rollback is truly reversible. Prefer an
   expand/contract or forward-recovery strategy for destructive changes.

## Apply

1. Open the correct Supabase SQL Editor project and re-check its identifier.
2. Paste the exact reviewed migration file without ad hoc edits.
3. Execute once. Record timestamp, operator, file name, and commit SHA.
4. If execution errors, stop. Do not rerun blindly; determine whether the
   transaction rolled back or partially applied.

## Verification

- Run the approved schema, constraint, index, policy, row-count, and data
  integrity queries.
- Run positive owner and negative cross-user RLS tests.
- Run affected server tests and API smoke tests.
- Verify error rate/latency and affected user journey.
- Record observed result against each migration acceptance criterion.

## Recovery

- Before any reversal, inspect actual partial state.
- Use the approved rollback SQL only if it is proven safe and does not destroy
  post-migration writes.
- Otherwise execute the approved forward-recovery migration.
- If access control may be open, stop affected traffic and treat as SEV-1.

## Close

Update the specification/release record with apply evidence, verification,
residual risk, and the schema version. Never include secret values or student
row contents.

