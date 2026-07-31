# PlaceMe — GD Arena

On-demand practice arena for engineering students preparing for campus
placements. This repo currently builds **one** module: the **GD (Group
Discussion) Arena — Multiplayer mode** — real students in a live audio
room with a topic and timer, per-speaker transcription and attribution,
and individual written feedback.

New here? Read [`CLAUDE.md`](CLAUDE.md) first — it's the single source of
truth for scope, fixed constraints, and how this project is run day to
day (including for AI coding agents, which this project relies on
heavily — see [`docs/engineering/TEAM.md`](docs/engineering/TEAM.md)).

## Repo layout

```
apps/server/   Express API + the LiveKit transcription agent worker
apps/web/      React (Vite) frontend
supabase/      Postgres schema migrations (run manually, see below)
docs/engineering/  Architecture, ADRs, branching workflow, current state
```

## Getting started

This project requires **Node 22+** (`engine-strict` is on — a fresh clone
on Node 20 fails at `npm install` rather than breaking later at runtime).
An `.nvmrc` pins the version:

```
nvm use          # or: nvm install 22 && nvm use
npm install      # from the repo root — this is an npm workspaces monorepo
```

Per workspace:

```
npm test --workspace=@placeme/server    # Vitest
npm run lint --workspace=@placeme/web   # oxlint
npm run build --workspace=@placeme/web  # Vite build
```

You'll need a `.env` in `apps/server` (copy `.env.example`) with Supabase,
LiveKit, AssemblyAI, and Gemini credentials — see
[`docs/engineering/DEPLOYMENT.md`](docs/engineering/DEPLOYMENT.md) for
where each one comes from. Database schema changes live in
`supabase/migrations/` as plain SQL — **nothing applies them
automatically**; paste each new one into the Supabase SQL Editor yourself.

## Where to look next

- [`docs/engineering/PROGRESS.md`](docs/engineering/PROGRESS.md) — current
  state, what's done, what's next. Read this first each session.
- [`docs/engineering/PLAN.md`](docs/engineering/PLAN.md) — the shared
  task checklist.
- [`docs/engineering/BRANCHING.md`](docs/engineering/BRANCHING.md) — the
  git workflow (branch per task, PR into `dev`, squash merge).
- [`.claude/rules/guardrails.md`](.claude/rules/guardrails.md) — the
  non-negotiable rules (consent before mic, data retention, no scope
  creep, human verification for room/audio features).
