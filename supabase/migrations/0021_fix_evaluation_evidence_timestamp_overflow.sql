-- SPEC-0011 bugfix (live-run finding, 2026-08-04): 0019 declared
-- evaluation_evidence.timestamp_start_ms/timestamp_end_ms as `integer`, but
-- domain/evidenceVerifier.js populates them from real epoch-millisecond
-- values (transcript_lines.startedAtMs/endedAtMs). Postgres `integer` (int4)
-- maxes out at 2,147,483,647 -- any real epoch-ms timestamp has exceeded
-- that since 1970-01-25, so every evaluation_evidence insert has failed
-- since these tables were created (confirmed live: "value ... out of range
-- for type integer" on a real room run). `bigint` comfortably holds
-- epoch-ms until the year 292 million CE.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
alter table public.evaluation_evidence
  alter column timestamp_start_ms type bigint,
  alter column timestamp_end_ms type bigint;
