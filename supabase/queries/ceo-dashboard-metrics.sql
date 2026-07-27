-- B2 (pilot-readiness audit) / Tier 1 instrumentation from
-- business/ceo-dashboard.md §4. Not a schema migration -- these are
-- read-only reporting queries, paste-and-run in the Supabase SQL Editor
-- (or save as a saved snippet there) as part of the Monday dashboard
-- ritual (ceo-dashboard.md §5). Nothing here writes to the database.
--
-- Verified against the live schema (not run live -- this repo's tooling
-- has no raw-SQL execution path, only the REST/service-role client): every
-- column referenced (rooms.status/ends_at/ended_at/created_at,
-- room_participants.room_id/user_id, transcript_lines.room_id/user_id,
-- feedback.room_id/user_id) exists as of migrations 0001-0007. Run each
-- block separately -- the Supabase SQL Editor only returns the last
-- statement's result if you run the whole file at once.

-- ============================================================
-- North Star: Weekly Active Discussers (WAD)
-- Unique students who completed a full GD this week and actually spoke
-- (presence isn't participation).
-- ============================================================
select count(distinct rp.user_id) as weekly_active_discussers
from room_participants rp
join rooms r on r.id = rp.room_id
where r.status = 'ended'
  and r.ended_at >= date_trunc('week', now())
  and exists (
    select 1 from transcript_lines t
    where t.room_id = r.id and t.user_id = rp.user_id
  );

-- ============================================================
-- Metric 1: Room fill rate (last 7 days)
-- % of rooms created that reached >= 3 participants.
-- Green >= 70%, trigger < 60%.
-- ============================================================
select
  count(*) filter (where p >= 3)::float / nullif(count(*), 0) as fill_rate
from (
  select r.id, count(rp.user_id) as p
  from rooms r
  left join room_participants rp on rp.room_id = r.id
  where r.created_at >= now() - interval '7 days'
  group by r.id
) s;

-- ============================================================
-- Metric 3 (the pivot-trigger metric): Session-2 return within 14 days
-- % of first-time discussers who complete a 2nd session within 14 days of
-- their first. Green >= 40%, trigger < 25% -- see ceo-dashboard.md §2 for
-- what to do if this trips.
-- ============================================================
with firsts as (
  select rp.user_id, min(r.ended_at) as first_session
  from room_participants rp
  join rooms r on r.id = rp.room_id
  where r.status = 'ended'
  group by rp.user_id
)
select
  count(*) filter (where exists (
    select 1 from room_participants rp2
    join rooms r2 on r2.id = rp2.room_id
    where rp2.user_id = f.user_id
      and r2.status = 'ended'
      and r2.ended_at >  f.first_session
      and r2.ended_at <= f.first_session + interval '14 days'
  ))::float / nullif(count(*), 0) as session_2_return
from firsts f
where f.first_session < now() - interval '14 days'; -- only cohorts that had the chance

-- ============================================================
-- Metric 4: Broken-session rate (last 7 days)
-- Ended rooms with no transcript at all, or with a seated participant who
-- never got feedback. Green <= 5%, trigger > 10%.
-- (Extends ceo-dashboard.md's count-only query with a denominator so this
-- is directly the rate the dashboard names, not just a raw count.)
-- ============================================================
select
  count(*) filter (where broken) as broken_count,
  count(*) as total_ended,
  count(*) filter (where broken)::float / nullif(count(*), 0) as broken_rate
from (
  select
    r.id,
    (
      not exists (select 1 from transcript_lines t where t.room_id = r.id)
      or exists (
        select 1 from room_participants rp
        where rp.room_id = r.id
          and not exists (
            select 1 from feedback f where f.room_id = r.id and f.user_id = rp.user_id
          )
      )
    ) as broken
  from rooms r
  where r.status = 'ended'
    and r.ended_at >= now() - interval '7 days'
) s;
