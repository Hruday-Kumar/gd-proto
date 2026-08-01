-- BE-14 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0008): signup
-- profile fields, college and graduating year. /signup's "College" and
-- "Graduating year" fields were entirely uncontrolled and never
-- submitted -- profiles had nowhere to put them, and the signup trigger
-- never read them.
--
-- Both nullable -- signup doesn't mark either field required today, and
-- there's no equivalent fallback the way display_name falls back to
-- email. No backfill for existing rows; both are simply NULL for anyone
-- who already signed up.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table public.profiles
  add column if not exists college text,
  add column if not exists graduation_year int;

-- Same auto-create-on-signup trigger as 0001_profiles.sql, extended to
-- also read the two new optional metadata keys. nullif(..., '')::int
-- rather than a bare ::int cast -- an empty-string metadata value (as
-- opposed to an absent key, which is already NULL) would otherwise throw
-- a cast error and fail the whole signup, the most safety-critical path a
-- trigger bug here could break.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, college, graduation_year)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    new.raw_user_meta_data ->> 'college',
    nullif(new.raw_user_meta_data ->> 'graduation_year', '')::int
  );
  return new;
end;
$$;

-- Trigger itself is unchanged (still on_auth_user_created, still fires
-- after insert on auth.users) -- only the function body it points to was
-- replaced above, so no drop/recreate of the trigger is needed here.
