# ADR-0004: Database / storage

**Status:** Accepted
**Date:** 2026-07-25
**Category:** Database/storage (see `METHOD.md` for rubric, updated
2026-07-25 to weight "genuinely free forever" over "cheap" — see below)

## Context
What actually needs a database: student profiles, room/session metadata,
per-speaker transcripts, and written feedback — all kept until account
deletion (fixed retention constraint). **Not** audio: guardrail #4 requires
raw audio deleted immediately after transcription, so there's no long-term
audio storage decision here at all, only a small amount of structured text.

This data is naturally **relational** — a student has many sessions, a
session has many transcript lines from multiple students, feedback ties to
one student + one session. That shape fits a SQL database more directly
than a document store, before even weighing vendors.

**Budget reality (per direct user guidance, 2026-07-25):** there's no money
to spend out of pocket. The plan is to build on free tiers/open source,
demo it, and use that to attract funding before any real spend starts. So
this ADR — and `METHOD.md`'s rubric going forward — weights "free forever,
no credit card" much more heavily than "cheap at low volume."

ADR-0003 already picked **Supabase** for Auth, and Supabase bundles a
Postgres database in the same free project. That's a real thumb on the
scale (one fewer vendor account, already-proven free tier, already
integrated) — but the comparison below still checks it against alternatives
on its own merits, not just by default.

## Options considered

| Option | Free tier — genuinely forever, no card? | Fit for our data shape | Beginner/mainstream fit | Extra vendor overhead |
|---|---|---|---|---|
| **Supabase Postgres** ✅ chosen | ✅ 500MB database + 1GB file storage, no credit card, permanent [[1]](https://www.itpathsolutions.com/supabase-free-tier-limits) | ✅ Relational (Postgres) — direct fit | ✅ Postgres is about as mainstream/well-documented as databases get; same platform as our already-chosen Auth | ✅ **None** — same project as Auth, zero new accounts |
| Neon (serverless Postgres) | ✅ 0.5GB storage, 100 compute-hours/mo, no card [[2]](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/) | ✅ Relational — direct fit | ✅ Mainstream, Apache-2.0 open-source core, but now owned by Databricks (May 2025 acquisition) — worth a light watch, not a disqualifier [[2]](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/) | ❌ A second vendor account separate from Auth; scale-to-zero compute could add cold-start latency to a live room's writes, which Supabase's always-on-while-active free instance avoids |
| MongoDB Atlas (M0) | ✅ 512MB, genuinely free forever, no card [[3]](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) | ❌ Document/NoSQL — our data (users → sessions → transcript lines → feedback) is relational; would mean modeling joins ourselves, more schema-design risk for a first-time team | ⚠️ Mainstream, but a worse conceptual fit here | ❌ Second vendor account |
| PlanetScale | ⚠️ **Sources conflict** — some say the free Hobby tier was removed in 2024 and never replaced, others say a free tier exists again as of mid-2026 [[4]](https://propicked.com/hosting/planetscale/pricing) | ✅ Relational (MySQL/Vitess) | ✅ Mainstream | ❌ Second vendor account; genuine free-tier status too uncertain to build a zero-budget plan on |
| Turso (libSQL/SQLite) | ✅ 5GB storage, 500M row-reads/mo, no card, open source [[5]](https://www.freetiers.com/directory/turso) | ✅ Relational (SQL) — workable | ⚠️ Less mainstream for a Node/React beginner team than Postgres; smaller community/example base | ❌ Second vendor account, for no clear gain over Supabase's already-sufficient free tier |
| Render (managed Postgres) | ❌ Free Postgres **expires after 30 days** [[6]](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026) | — | — | **Disqualified** — actively incompatible with our "keep transcript+feedback until account deletion" retention rule; a expiring DB can't be the system of record |
| Railway | ❌ No free managed database at all — one-time trial credit only, then paid [[7]](https://blog.railway.com/p/best-postgresql-hosting-2026) | — | — | **Disqualified** — fails the zero-out-of-pocket bar outright |
| Self-hosted Postgres (free VM) | Technically $0 | ✅ Relational | ❌ **Disqualified** — backups, security patching, and uptime become our problem; same "don't self-manage the hard/unfamiliar parts" reasoning already applied to self-hosted WebRTC/STT (`TEAM.md`) | — |

## Decision
**Supabase Postgres** — the same Supabase project already chosen for Auth
in ADR-0003, using its bundled Postgres database for everything structured
(profiles, rooms, sessions, transcripts, feedback).

Reasoning in plain terms: our data is naturally relational, so a SQL
database beats a document database here regardless of vendor. Among SQL
options with a real, permanent, no-credit-card free tier, Supabase and Neon
are the strongest — and Supabase wins because it's *already* the vendor we
picked for Auth, so this decision adds zero new accounts, zero new
integrations, and zero new things to learn. Render and Railway are
disqualified outright under the tightened zero-out-of-pocket bar (expiring
or nonexistent free databases); MongoDB is a worse conceptual fit for
relational data; PlanetScale's free-tier status is too unclear right now to
plan around.

**Rough capacity sanity check:** a 15-minute, 5-person GD session produces
roughly 20–30KB of transcript text plus ~3KB of feedback per student
(~35–50KB per session all-in). Supabase's 500MB free tier holds on the
order of **10,000+ sessions'** worth of that before hitting the limit — well
past what a single-campus pilot will produce before there's a reason to
revisit pricing (see Revisit-if below).

## Consequences
- **Positive:** No new vendor, no new account, no new cost. Postgres is the
  most mainstream, best-documented relational database available, which
  matters for an agent-assisted beginner team. Structured relational schema
  fits our actual data shape (foreign keys between students, sessions, and
  transcript lines) far better than a document store would.
- **Risk to track:** Supabase's free project pauses after 7 days with no
  database activity — irrelevant once real students are using it
  regularly, but worth remembering during quiet early-development stretches
  (don't be surprised if a demo needs an unpause click after a break).
  500MB is generous for this data shape but not infinite — see Revisit-if.
- No audio storage decision needed here — raw audio is deleted immediately
  after transcription per guardrail #4, so it never reaches this database.

## Revisit if
- Free-tier database usage approaches the 500MB ceiling (per the estimate
  above, likely only after the pilot is already succeeding — at which point
  the $25/mo Pro tier is a reasonable, budget-fitting next step, consistent
  with the "prove it, then fund it" plan), or
- Supabase's free-tier terms change materially, or
- A future module needs a data shape Postgres handles poorly (unlikely for
  this product).

## Sources
1. [Supabase free tier limits 2026](https://www.itpathsolutions.com/supabase-free-tier-limits)
2. [Neon pricing/ownership 2026](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/)
3. [MongoDB Atlas M0 free tier](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
4. [PlanetScale pricing 2026 (conflicting reports)](https://propicked.com/hosting/planetscale/pricing)
5. [Turso free tier 2026](https://www.freetiers.com/directory/turso)
6. [Render free-tier Postgres expiry](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
7. [Railway free tier / Postgres hosting 2026](https://blog.railway.com/p/best-postgresql-hosting-2026)
