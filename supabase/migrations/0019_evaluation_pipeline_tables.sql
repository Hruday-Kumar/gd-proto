-- SPEC-0011 state 1 (feat/eval-schema-foundation): additive schema
-- foundation for the redesigned evaluation pipeline. This migration only
-- creates tables; no application code reads or writes them yet, and the
-- existing `feedback` table (still the only thing the API/frontend read)
-- is untouched. See docs/specs/active/SPEC-0011-eval-engine-redesign.md.
--
-- Every table here is an internal pipeline artifact, never read directly
-- by a student's own client (unlike `feedback`, which has a
-- "select own" policy) -- RLS is enabled with zero policies, so only the
-- server's service-role key (which bypasses RLS entirely) can read or
-- write. This mirrors how `feedback` itself is written (service role
-- only) but goes one step further: there is no student-facing read path
-- to these tables at all, by design (evidence/criterion-level detail is
-- an implementation artifact, not something shown to students).
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- One row per evaluation attempt for a room. Multiple rows can exist for
-- the same room over time (a retried or re-run evaluation creates a new
-- row rather than mutating a prior one), preserving execution lineage.
create table if not exists public.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  transcript_hash text,
  rubric_version text not null,
  prompt_bundle_version text not null,
  model text,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists evaluation_runs_room_id_idx
  on public.evaluation_runs (room_id);

alter table public.evaluation_runs enable row level security;

-- The neutral evidence ledger: quote-verified observations only, no
-- scores or judgments (SPEC-0011 R1/R2). `utterance_ids` references
-- `public.transcript_lines.id` -- the deterministic verifier (state 2)
-- checks every id here actually exists and the quoted text matches.
create table if not exists public.evaluation_evidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.evaluation_runs (id) on delete cascade,
  participant_user_id uuid not null references auth.users (id) on delete cascade,
  utterance_ids uuid[] not null default '{}',
  sequence_start integer,
  sequence_end integer,
  timestamp_start_ms integer,
  timestamp_end_ms integer,
  evidence_type text not null check (
    evidence_type in (
      'claim', 'supporting_reason', 'example', 'factual_reference', 'question', 'clarification',
      'agreement', 'disagreement', 'counterargument', 'builds_on', 'corrects', 'summarizes',
      'redirects', 'introduces_topic', 'invites_participation', 'repetition', 'contradiction',
      'off_topic', 'unclear'
    )
  ),
  exact_quote text not null,
  neutral_description text not null,
  related_participants uuid[] not null default '{}',
  topic_segment_id text,
  extraction_confidence text check (extraction_confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now()
);

create index if not exists evaluation_evidence_run_id_idx
  on public.evaluation_evidence (run_id);
create index if not exists evaluation_evidence_participant_idx
  on public.evaluation_evidence (run_id, participant_user_id);

alter table public.evaluation_evidence enable row level security;

-- One row per (run, participant, criterion). `subdimensions` holds the
-- anchored-level breakdown (SPEC-0011 R3); `score` is filled in only by
-- the deterministic aggregator (state 4), never by an LLM directly.
create table if not exists public.evaluation_criterion_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.evaluation_runs (id) on delete cascade,
  participant_user_id uuid not null references auth.users (id) on delete cascade,
  criterion_label text not null check (
    criterion_label in ('Content depth', 'Clarity', 'Confidence', 'Listening', 'Fluency')
  ),
  subdimensions jsonb not null default '[]',
  score integer check (score is null or (score between 0 and 100)),
  weight_applied numeric,
  created_at timestamptz not null default now(),
  unique (run_id, participant_user_id, criterion_label)
);

create index if not exists evaluation_criterion_results_run_id_idx
  on public.evaluation_criterion_results (run_id);

alter table public.evaluation_criterion_results enable row level security;

-- Deterministic + targeted-LLM validation findings (SPEC-0011 R5).
-- `retry_count` is capped at 2 in code and here, matching the spec's
-- bounded-retry rule -- a stuck validation issue must surface for review,
-- never loop indefinitely.
create table if not exists public.evaluation_validation_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.evaluation_runs (id) on delete cascade,
  criterion_label text,
  participant_user_id uuid references auth.users (id) on delete cascade,
  issue_type text not null,
  detail text,
  resolved boolean not null default false,
  retry_count integer not null default 0 check (retry_count >= 0 and retry_count <= 2),
  created_at timestamptz not null default now()
);

create index if not exists evaluation_validation_issues_run_id_idx
  on public.evaluation_validation_issues (run_id);

alter table public.evaluation_validation_issues enable row level security;

-- Confidence is calculated by code from measurable components (SPEC-0011
-- R6), never asked of an LLM as a bare number. `components` stores the
-- named breakdown (transcript_integrity, speaker_attribution,
-- evidence_sufficiency, validation_success, execution_quality) so a low
-- confidence score is always explainable.
create table if not exists public.evaluation_confidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.evaluation_runs (id) on delete cascade,
  participant_user_id uuid not null references auth.users (id) on delete cascade,
  confidence integer not null check (confidence between 0 and 100),
  components jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (run_id, participant_user_id)
);

create index if not exists evaluation_confidence_run_id_idx
  on public.evaluation_confidence (run_id);

alter table public.evaluation_confidence enable row level security;

-- No policies are created for any table above, on purpose: RLS enabled
-- with zero policies means every role except service-role (which bypasses
-- RLS) gets zero rows, for every operation. Only the server ever reads or
-- writes these tables.
