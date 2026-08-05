# PROJECT.md — PlaceMe / gd-proto

The durable "what is this and how is it put together" reference. For
**current state** (what's live, what's blocked, what's next), see
[`docs/engineering/STATUS.md`](docs/engineering/STATUS.md) instead — that
file changes weekly; this one shouldn't need to.

## What PlaceMe is

A digital practice arena for students preparing for campus placements —
rehearsal for group discussions, JAM sessions, aptitude tests, and
interviews before the real thing. Full product vision, target users, and
the intended build sequence across all five product pieces (GD Arena,
JAM, Aptitude/Technical Tests, 1-on-1 Roleplay, the Drive Simulator):
[`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md).

**What's actually built so far:** GD Arena, multiplayer mode only — real
students in a live room with LiveKit audio, AssemblyAI transcription
attributed per speaker, and individually generated feedback afterward.
Everything else in the product vision (AI Voice Practice mode, JAM,
Aptitude/Technical, Roleplay Interviews, the Drive Simulator) is
unbuilt.

## Repository roles

This is one of three repos that make up the product:

| Repo | Role | Where it deploys |
|---|---|---|
| **`gd-proto`** (this repo) | Backend: Express API, Supabase (Postgres + Auth + RLS), the LiveKit/AssemblyAI/Gemini transcription-and-feedback pipeline. Also currently hosts `apps/web`, the original frontend. | `apps/server` → Render (`gdarena.placeme.study`, tracks `main`). `apps/web` → Vercel (`gd-proto-web.vercel.app`). |
| **`placeme-UI`** | Canonical frontend (TanStack Start), the one actively being developed — supersedes `apps/web`. | Vite + TanStack Start, hosting-neutral (Cloudflare/Vercel both validated). |
| **`gd-frontend`** | A stale mirror of `placeme-UI` on a different GitHub remote, one merge behind. Deliberately left alone — decision recorded in `ACTION_PLAN.md`'s decision log; revisit merge/retire only once cross-repo contract work is stable. | Not deployed from. |

`waitlist` (a separate, non-git-repo Vercel project) serves the
pre-launch landing page at the `placeme.study` custom domain — this is
intentional, not a misconfiguration; the app itself lives at the
`*.onrender.com`/`*.vercel.app`/hosting-neutral URLs above until public
launch.

## Architecture, in one page

- **Auth & data**: Supabase (Postgres, Auth, Row-Level Security). Every
  student-facing table has RLS; mutating writes go through the server's
  service-role key, never a direct client insert (guardrail: RLS alone
  is not the whole story — see `.claude/rules/guardrails.md`).
- **Rooms**: created by code (shareable) or by random matchmaking.
  Lifecycle is `waiting` → `live` → `ended`, driven by
  `agent/roomSweeper.js`'s periodic sweep, not by any client poll.
- **Audio & transcription**: LiveKit for the room's live audio; a
  server-managed "transcriber" participant joins each room and pipes
  audio to AssemblyAI, attributing each line to the speaking student's
  `user_id`.
- **Feedback**: on room end, `agent/feedbackWorker.js` runs
  `domain/evaluationPipeline.js` — a deterministic multi-stage pipeline
  (transcript analysis → evidence verification → per-criterion
  evaluation → validation → score aggregation → confidence → feedback
  prose), not a single ungrounded LLM call. See
  `docs/specs/active/SPEC-0011-eval-engine-redesign.md` for why and how.
  The pipeline's internal artifacts (evidence, per-criterion results,
  confidence) persist to `evaluation_*` tables for audit/monitoring but
  are **not** exposed through the API — the `feedback` table/route
  contract is deliberately unchanged (SPEC-0011 R8); see
  `docs/api/openapi.yaml`.
- **Contract**: `docs/api/openapi.yaml` is the source of truth for the
  REST API `placeme-UI` (and `apps/web`) consume. `placeme-UI` generates
  its TS client from a vendored, pinned copy — see that repo's
  `openapi/` directory and `scripts/sync-contract.mjs`.

## Commands

From repo root (Node pinned via `.nvmrc`, currently `22.23.1`):

```
npm ci                                          # install (workspaces: apps/*)
npm test --workspace=@placeme/server            # server test suite (vitest)
npx oxlint apps/server/src apps/server/test     # server lint
npm run openapi:lint --workspace=@placeme/server  # validate docs/api/openapi.yaml
npm test --workspace=@placeme/web               # web frontend tests
npm run build --workspace=@placeme/web          # web frontend build
docker build -t placeme-server .                # production image (apps/server only)
```

Migrations (`supabase/migrations/*.sql`) are **never applied
automatically** — paste each new one into the Supabase SQL Editor
yourself; see `docs/engineering/STATUS.md` for what's currently applied.

## Authoritative document map

| Need | Read |
|---|---|
| What's true right now (branch, deploy, migrations, blockers, next action) | [`docs/engineering/STATUS.md`](docs/engineering/STATUS.md) |
| The live, cross-repo work tracker | `ACTION_PLAN.md` *(shared across `gd-proto`/`placeme-UI`/`gd-frontend`; lives alongside a local checkout of all three, not tracked in any of their git histories — not a link from here for that reason)* |
| Product vision, users, build sequence | [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md) |
| Non-negotiable rules (consent, RLS, human-verification gates) | [`.claude/rules/guardrails.md`](.claude/rules/guardrails.md) |
| Agent operating rules (this is what an AI assistant should read first) | [`CLAUDE.md`](CLAUDE.md) |
| REST API contract | [`docs/api/openapi.yaml`](docs/api/openapi.yaml) |
| Deployment / env vars / secrets checklist | [`docs/engineering/DEPLOYMENT.md`](docs/engineering/DEPLOYMENT.md) |
| Git workflow (branch/PR conventions) | [`docs/engineering/BRANCHING.md`](docs/engineering/BRANCHING.md) |
| Architecture decision records | [`docs/adr/README.md`](docs/adr/README.md) |
| Active/approved feature specs | [`docs/specs/active/`](docs/specs/active/) |
| Historical narrative log (audit remediation, session-by-session record through 2026-08-04) | [`docs/engineering/archive/PROGRESS.md`](docs/engineering/archive/PROGRESS.md), [`docs/engineering/archive/PLAN.md`](docs/engineering/archive/PLAN.md) |

## Why PROJECT.md + STATUS.md exist

Before 2026-08-05, "what's true right now" was scattered across
`PRODUCT_CONTEXT.md` (product-only, no engineering state),
`docs/engineering/PLAN.md` (a two-person task checklist — every row
eventually marked done, format not built for a single fast-moving
tracker), and `docs/engineering/PROGRESS.md` (a 3,500+ line narrative
log — invaluable as history, unusable as a "what do I need to know
right now" doc). `ACTION_PLAN.md` (see the document map above) had already
superseded `PLAN.md`/`PROGRESS.md` as the live cross-repo tracker in
practice; this just makes that official and gives each remaining
concern exactly one home: durable reference here, current state in
`STATUS.md`, live task tracking in `ACTION_PLAN.md`. `PLAN.md` and
`PROGRESS.md` are archived, not deleted — see
`docs/engineering/archive/`.
