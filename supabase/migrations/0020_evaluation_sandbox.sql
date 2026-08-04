-- SPEC-0011 AC7 human-verification support: a deliberately self-contained
-- sandbox table for rigorously testing the new evaluation pipeline
-- (domain/evaluationPipeline.js) against a LIVE Gemini key, before any
-- real student's room is ever scored by it.
--
-- Unlike every other table this spec added (0019's evaluation_runs/
-- evaluation_evidence/etc.), this one has NO foreign key to `rooms`,
-- `auth.users`, or `transcript_lines` -- on purpose. Every row here comes
-- from a synthetic, hand-written test scenario (see
-- apps/server/scripts/eval-sandbox.js), never a real student or a real
-- session, so there is nothing here to link back to production data, and
-- no way for this table to ever be confused with or accidentally joined
-- against a real one. `participant_display_name` is a synthetic test name
-- (e.g. "Asha"/"Zara"), never a real student's.
--
-- Same RLS posture as every other pipeline-internal table in this spec:
-- enabled, zero policies -- only the server's service-role key can read or
-- write it. Run this in the Supabase dashboard: SQL Editor -> New query ->
-- paste -> Run.
create table if not exists public.eval_sandbox_runs (
  id uuid primary key default gen_random_uuid(),
  -- Groups every row from one rigorous test round together, e.g.
  -- '2026-08-03-bias-round-1' -- lets a later round be compared against
  -- an earlier one without deleting anything.
  batch_label text not null,
  -- Which synthetic fixture scenario this row came from, e.g.
  -- 'remote-work-3p'.
  scenario_label text not null,
  -- Which identity variant of that same scenario, e.g. 'baseline' or
  -- 'renamed-variant-1' -- the bias check compares scores across variants
  -- of the same scenario_label, matched by participant_seat.
  variant_label text not null,
  -- 1-based seat position within the scenario, stable across variants --
  -- what a bias comparison actually matches on, since variants
  -- deliberately change the name/id, not the seat.
  participant_seat integer not null check (participant_seat >= 1),
  participant_display_name text not null,
  rubric_version text not null,
  prompt_bundle_version text not null,
  model text,
  overall_score numeric check (overall_score is null or (overall_score between 0 and 100)),
  dimensions jsonb not null default '[]',
  confidence integer check (confidence is null or (confidence between 0 and 100)),
  confidence_components jsonb not null default '{}',
  -- This participant's verified evidence (quotes + neutral descriptions),
  -- stored for manual eyeball review -- the whole point of this table is
  -- to let a human confirm every score is actually evidence-grounded, not
  -- just schema-valid.
  evidence jsonb not null default '[]',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists eval_sandbox_runs_batch_idx
  on public.eval_sandbox_runs (batch_label);
create index if not exists eval_sandbox_runs_scenario_idx
  on public.eval_sandbox_runs (batch_label, scenario_label, participant_seat);

alter table public.eval_sandbox_runs enable row level security;
-- No policies created, on purpose -- RLS enabled with zero policies means
-- every role except service-role (which bypasses RLS) gets zero rows for
-- every operation, matching every other pipeline-internal table in this
-- spec (0019's own tables).
