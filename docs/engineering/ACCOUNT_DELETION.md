# Account deletion (DPDP right to erasure)

**Status:** manual process, pilot-acceptable. No self-serve delete button
exists yet — see guardrail #4 and India DPDP's right-to-erasure requirement
in `CLAUDE.md`. `PILOT_READINESS.md`'s B6 flags this as fine for a 10–30
student pilot; a self-serve UI can wait for contract #1.

## The process

1. A student emails the pilot's contact address asking their account be
   deleted.
2. A founder runs the dry run first, to see exactly what will be removed:
   ```
   cd apps/server
   npm run delete-account -- student@example.com
   ```
3. If the account and counts look right, confirm the deletion:
   ```
   npm run delete-account -- student@example.com --confirm
   ```
4. Reply to the student confirming it's done.

**Target turnaround: within 7 days of the request**, per the consent copy's
existing promise ("kept until you delete your account").

## What actually gets deleted

`scripts/delete-account.js` deletes the student's `auth.users` row via
Supabase's admin API. Every table that identifies them is wired with
`on delete cascade` back to `auth.users` (see the migrations in
`supabase/migrations/`), so this one call cascades to:

- their `profiles` row
- their `consents` records
- their `room_participants` rows (their seat in any room)
- their `transcript_lines` (what they personally said)
- their `feedback` (feedback generated for them)
- their `matchmaking_queue` row, if queued

**Rooms they created are kept**, with `created_by` set to `NULL`
(`on delete set null`) — so if they created a room other students are
still in, those students don't lose their own history or transcript just
because one member of their group asked to be deleted.

> **Requires migration `0008_rooms_created_by_on_delete_set_null.sql`.**
> This is only true once that migration has been run against the project.
> Before it, `rooms.created_by` was `NOT NULL` with no `ON DELETE` clause
> (i.e. `NO ACTION`), so `deleteUser()` aborted with a foreign-key
> violation for **any student who had ever created a room** — the majority,
> since "Start a room" is the app's primary call to action. That was
> finding **C1** of the 2026-07-28 engineering audit. If a deletion fails
> with a `rooms_created_by_fkey` violation, 0008 has not been run yet.

## Why a script instead of raw SQL against `auth.users`

Supabase manages the `auth` schema itself; deleting directly from
`auth.users` with SQL isn't the supported path. `scripts/delete-account.js`
uses `supabase.auth.admin.deleteUser()`, the same API Supabase's own
dashboard uses, which is what actually triggers the cascades above.

## Finding the account

There's no `getUserByEmail` in the installed `@supabase/supabase-js`
version, so the script paginates `auth.admin.listUsers()` looking for an
exact (case-insensitive) email match — see
`apps/server/src/domain/accountDeletion.js`'s `findUserByEmail`, unit
tested in `test/accountDeletion.test.js`. Fine at pilot scale (tens of
users); would need a real index/query if the user base grew into the
thousands.
