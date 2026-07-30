# Runbook — Supabase outage

## Impact

Supabase provides authentication and Postgres data. Outage or degradation can
block signup/login, consent lookup, room state, transcripts, feedback, history,
and deletion. RLS/configuration errors can also create a security incident.

## Detect and classify

- Check Supabase status, project health, connection/latency/errors, quota, and
  recent migrations/policy/config changes.
- Separate auth, database, RLS/policy denial, and service-role credential errors.
- Check whether the problem affects all users or a single ownership path.
- Never paste rows, access tokens, service-role values, or transcripts into
  shared evidence.

## Response

1. Stop new sessions if consent cannot be verified, writes cannot be made
   consistently, or ownership isolation is uncertain.
2. If unauthorized cross-user access is possible, treat as SEV-1, disable the
   affected path, preserve evidence, and invoke the Security Engineer.
3. Do not disable RLS, use the service role in the browser, or bypass consent to
   restore availability.
4. For a migration-related problem, use `database-migration.md` and its approved
   recovery plan.
5. Rotate suspected credentials in Supabase and hosting secret stores; do not
   place values in source or incident records.

## Verification

- Auth signup/login/refresh behavior succeeds as expected.
- Consent read/write and protected API paths succeed for the owner.
- Cross-user RLS isolation tests pass for profiles, consent, rooms,
  participants, transcripts, feedback, and history as applicable.
- Data-integrity/row-count queries match expected results.
- A deployed end-to-end journey passes and monitoring stabilizes.

## Record

Failure class, migration/config relation, user impact as counts, privacy
assessment, provider ticket/status, actions, recovery evidence, and follow-ups.

