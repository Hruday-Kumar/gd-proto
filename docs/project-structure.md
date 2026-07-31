# Project structure

This document records how the repository is organized and why, following a
repo-wide hygiene pass (`chore/repo-organization`, 2026-07-31). It does not
describe application behavior — see `ENGINEERING.md`, `docs/architecture/`,
and `docs/adr/` for that.

## Top-level layout

```
apps/
  web/            Vite + React 19 SPA (plain .jsx/.js, no TypeScript)
  server/         Express API + LiveKit/AssemblyAI/Gemini integration
docs/
  adr/            Pointer to where new ADRs are filed (see below)
  architecture/    System overview
  business/       Product/business strategy docs (board updates, GTM, revenue model)
  engineering/    Engineering handbook material, PROGRESS/PLAN logs, ADR history
  operations/     Operational runbooks and incident process
  pilot/          Pilot-readiness evidence (dated audit/recalibration reports)
  runbooks/       Step-by-step operational procedures
  specs/          active/ (in-flight), completed/ (shipped) specifications
  templates/      Reusable templates (ADR, spec, checklist, incident report, ...)
supabase/         SQL migrations (numbered, sequential) and reporting queries
spike/            Phase 0a de-risk-spike evidence (see "Why spike/ stays put")
```

Root-level files are limited to what's genuinely root-appropriate: agent/
handbook entry points (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `ENGINEERING.md`),
the design-system input trio (`DESIGN.md`, `PRODUCT.md`, `.impeccable/` —
load-bearing for `apps/web/test/design-system/*`, see below), the product
context doc (`PRODUCT_CONTEXT.md`), `README.md`, and standard build/deploy/
tooling config (`package.json`, `Dockerfile`, `.dockerignore`, `render.yaml`,
`spec-kit.yaml`, `.npmrc`, `.nvmrc`, `.gitignore`, `.github/`, `.vercel/`,
`.claude/`, `.agents/`).

## What changed in the 2026-07-31 hygiene pass

| Old path | New path | Why |
|---|---|---|
| `business/*.md`, `business/board-updates/` | `docs/business/` | Product/business strategy docs, not code — didn't belong at repo root. |
| `templates/*.md` (18 files) | `docs/templates/` | Reusable reference templates, not root-worthy. |
| `PILOT_READINESS_AUDIT_2026-07-30.md`, `PILOT_READINESS_RECALIBRATION_2026-07-30.md` | `docs/pilot/` | Dated snapshot reports; `docs/pilot/README.md` already existed as the intended home. |
| `Readme.md` | `README.md` | Casing consistency — every other doc in the repo uses `README.md`. |
| `PlaceMe_Product_Context_v2.md` | `PRODUCT_CONTEXT.md` | Matches the ALL-CAPS root convention (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `DESIGN.md`, `ENGINEERING.md`); version history belongs to git, not a `_v2` filename suffix. |
| `apps/server/src/api/*.js` (flat, 10 files) | `apps/server/src/api/routes/` + `apps/server/src/api/middleware/` | Separated route handlers (`health`, `me`, `consent`, `topics`, `rooms`, `history`) from middleware (`authMiddleware`, `errorHandler`, `rateLimit`, `consentGate`), matching `.claude/rules/external/coding-style.md`'s "organize by responsibility." |

All moves used `git mv` to preserve history. Every markdown link, code
comment, and import path that pointed at an old location was updated; dated
audit/log documents (`docs/engineering/AUDIT.md`, `AUDIT_COMPARISON_2026-07-29.md`,
`PROGRESS.md`, the resolved-items table in `PLAN.md`, `docs/engineering/PILOT_READINESS.md`)
were deliberately left referencing the old filenames, since they're
point-in-time historical records, not live navigation.

## Why `spike/` stays put

`spike/` holds Phase 0a de-risk-spike evidence (see guardrail #5, "Spike
before the real-time ADR"). It's a self-contained top-level prototype with
its own `.env`/`node_modules` (both untracked/gitignored — confirmed no
secret exposure), not misplaced root clutter, so it wasn't moved. Its
`media/*.wav` fixtures are duplicated in
`apps/server/scripts/regression/media/` — noted, not deduplicated, since
removing a spike's original evidence goes beyond "organize."

## Why `PRODUCT.md`/`DESIGN.md`/`.impeccable/` stay at root

These three are a load-bearing input trio for the "impeccable" design-system
tooling. Critically, `apps/web/test/design-system/productDoc.test.js` and
`designDoc.test.js` read `PRODUCT.md`/`DESIGN.md` directly via
`readRepoFile()` (see `apps/web/test/design-system/helpers.js`) — moving them
would break that test suite for no organizational benefit, so they were left
at root alongside `.impeccable/`.

## Archive policy

This repository uses **git history as its archive**, not a dedicated
`archive/` directory. Nothing is ever deleted in a reorganization pass;
anything superseded or renamed is moved via `git mv` and remains fully
recoverable via `git log --follow`.

## Naming conventions actually in use

- Root docs: `ALL_CAPS.md` for handbook/agent-entry-point files.
- `docs/**`: `README.md` per directory as an index/pointer; otherwise
  `kebab-case.md` for most content, `UPPER_SNAKE_CASE.md` for dated audit/
  progress-style reports (an existing convention, not changed here).
- `apps/web/src`: `PascalCase.jsx` for components/pages, `camelCase.js` for
  hooks/libs, colocated `*.test.jsx` next to the source they test.
- `apps/server/src`: `camelCase.js` throughout; flat `test/` directory
  (Vitest, no colocation).
- ADRs: `NNNN-short-slug.md`, four-digit sequence, filed in
  `docs/engineering/adr/` (the accepted-decision history); `docs/adr/README.md`
  is the pointer explaining where *new* ADRs get filed — this split is
  intentional, documented in that README, and wasn't changed.
