-- C1 (engineering audit, 2026-07-28): account deletion fails for any
-- student who has created a room.
--
-- `rooms.created_by` was declared in 0003 as:
--     created_by uuid not null references auth.users (id)
-- with no ON DELETE clause, so it defaults to NO ACTION. Deleting the
-- auth.users row (which is exactly what scripts/delete-account.js does,
-- and the only thing that triggers the cascades every other table relies
-- on) therefore aborts with a foreign-key violation for any student who
-- ever created a room -- which is most of them, since "Start a room" is
-- HomePage's primary call to action.
--
-- Three places in the repo already documented the intended behaviour and
-- were never reconciled with the schema:
--   - scripts/delete-account.js (header comment + its runtime output)
--   - docs/engineering/ACCOUNT_DELETION.md
--   - apps/server/test/historyRlsIsolation.test.js (which hit the real FK
--     violation in W7 and worked around it locally by deleting fixture
--     rooms first)
--
-- This migration makes the schema match that documented intent. Dropping
-- NOT NULL is required, not incidental: SET NULL cannot apply to a NOT
-- NULL column, so the constraint would still fail. It is also semantically
-- right -- a room whose creator exercised their right to erasure genuinely
-- has no creator, while the other participants keep their own history and
-- transcripts (guardrail #4: erase the leaver, don't collaterally erase
-- their groupmates).
--
-- Compare 0003's `topics.created_by`, which was already declared
-- correctly with `on delete set null` -- this brings rooms in line with it.
--
-- No application code changes with this. api/rooms.js gates the start
-- route on `room.created_by !== req.userId`; a NULL creator correctly
-- fails that comparison for every caller, so an orphaned room simply can
-- no longer be started by anyone. Covered by tests in
-- apps/server/test/roomsApi.test.js.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table public.rooms alter column created_by drop not null;

alter table public.rooms drop constraint if exists rooms_created_by_fkey;

alter table public.rooms
  add constraint rooms_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- Fail loudly rather than silently leaving the bug in place.
--
-- The DROP above targets the default Postgres name for an inline column
-- REFERENCES constraint (`<table>_<column>_fkey`). If this database ever
-- had that constraint under a different name, `drop constraint if exists`
-- would quietly do nothing and the ADD would leave TWO foreign keys on
-- created_by -- the old NO ACTION one still blocking deletes, with the
-- migration appearing to have succeeded. That is the same class of silent
-- failure this migration exists to fix, so check for it explicitly.
--
-- confdeltype: 'a' = NO ACTION, 'r' = RESTRICT, 'c' = CASCADE,
--              'n' = SET NULL, 'd' = SET DEFAULT.
do $$
declare
  offending_count int;
begin
  select count(*) into offending_count
  from pg_constraint con
  where con.conrelid = 'public.rooms'::regclass
    and con.contype = 'f'
    and con.conkey = array[
      (select attnum from pg_attribute
        where attrelid = 'public.rooms'::regclass
          and attname = 'created_by'
          and not attisdropped)
    ]
    and con.confdeltype <> 'n';

  if offending_count > 0 then
    raise exception
      'rooms.created_by still has % foreign key(s) without ON DELETE SET NULL -- account deletion would still fail. Inspect with: select conname, confdeltype from pg_constraint where conrelid = ''public.rooms''::regclass and contype = ''f'';',
      offending_count;
  end if;
end $$;
