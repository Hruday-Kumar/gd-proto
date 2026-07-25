-- W3 (Consent, guardrail #3): a recorded, versioned consent event per
-- student. Versioned so that a future change to the disclosure copy (e.g.
-- a new data use) requires a *new* consent record, not a silent edit to an
-- old one -- canEnableMic() only accepts the current version as valid.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_version integer not null,
  granted_at timestamptz not null default now()
);

create index if not exists consents_user_id_granted_at_idx
  on public.consents (user_id, granted_at desc);

alter table public.consents enable row level security;

-- "a student can access only their own history" (guardrail #4).
create policy "consents_select_own"
  on public.consents for select
  using (auth.uid() = user_id);

-- Students record their own consent; no update/delete policy -- a consent
-- event is an immutable record, never edited or retracted in place.
create policy "consents_insert_own"
  on public.consents for insert
  with check (auth.uid() = user_id);
