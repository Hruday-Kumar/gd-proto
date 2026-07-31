# SPEC-0001 — AI-native engineering environment

**Status:** Completed  
**Owner:** Engineering  
**Approvers:** Repository owner  
**Issue:** User-provided repository transformation brief  
**Target:** Documentation and workflow only; no runtime release

## Problem

PlaceMe has useful product, engineering, and deployment notes, but lacks one
complete specification-driven operating system shared by Claude Code, Codex,
GitHub, and VS Code. The repository also contains 280 generic skills with no
project-focused selection policy.

## Goals

- Establish a specification-first lifecycle from issue through merge.
- Add durable AI context, agent roles, focused skills, templates, checklists,
  runbooks, GitHub workflows, and a Definition of Done.
- Encode PlaceMe-specific security, provider, pilot, deployment, and privacy
  constraints.
- Audit existing skills without deleting them.
- Preserve and link useful existing documentation.

## Non Goals

- Change application behavior or production infrastructure.
- Delete, install, or execute unrelated generic skills.
- Replace historical ADRs, progress reports, or deployment records.
- Redesign the accepted application architecture.

## Requirements

- Create the requested `.github`, `docs`, and `templates` structure.
- Create `ENGINEERING.md`, `CLAUDE.md`, and `CODEX.md`.
- Create nine specification/decision templates and seven verification templates.
- Create ten operational runbooks.
- Create and validate six focused PlaceMe skills.
- Make the six skills automatically discoverable and implicitly invocable in
  Codex, Claude Code, and GitHub Copilot/VS Code from repository-local paths.
- Create seven agent definitions with responsibilities, inputs, outputs,
  invocation criteria, and prohibitions.
- Create a professional pull request template and six issue templates.
- Create an ADR template and repository-wide Definition of Done.
- Produce retained/removal skill reports without deleting any skill.

## Design

Root context files provide short entry points; `ENGINEERING.md` owns lifecycle
policy; `docs/` owns durable specifications, architecture, decisions, runbooks,
operations, and pilot evidence; `docs/templates/` owns reusable artifacts;
`.github/agents` and `.github/skills/placeme-*` own focused AI workflows.
Existing documents remain in place and are indexed from the new structure.

## Risks

- Duplicate guidance can drift. Mitigation: declare authority order and link
  canonical documents instead of copying operational detail.
- Generic skills can continue auto-triggering. Mitigation: report a minimal
  retained set and state that generic skills are not repository policy.
- Templates can become paperwork without evidence. Mitigation: require links,
  owners, commands, and explicit gate outcomes.

## Acceptance Criteria

- Every requested directory and artifact exists and contains actionable PlaceMe
  guidance.
- All six PlaceMe skills pass the skill validator.
- Template and documentation links resolve.
- No existing generic skill is deleted.
- Application tests, lint, and build remain green.

## Implementation Tasks

- [x] Establish handbook, AI contexts, and spec lifecycle.
- [x] Add templates, checklists, ADR entry point, and GitHub forms.
- [x] Add runbooks, operations, and pilot documentation.
- [x] Add focused agents and skills.
- [x] Add automatic cross-host skill discovery and trigger routing.
- [x] Complete the existing-skills audit.
- [x] Validate links, structure, skills, tests, lint, and build.
- [x] Move this specification to `completed/` with evidence.

## Testing

- Six-skill validator: passed at canonical `.github/skills`, Codex
  `.agents/skills`, and Claude `.claude/skills` discovery paths.
- Repository link/path validation: 61 new/updated Markdown files passed.
- Node 22 tests with live Supabase variables intentionally blanked: 311 passed,
  8 live-RLS tests skipped by their designed no-credentials path.
- Node 22 lint: zero errors; one pre-existing React Fast Refresh warning.
- Node 22 production build: passed.

## Verification

Map every deliverable in the source brief to an existing file and verify required
headings. Review `git diff` to ensure useful tracked documentation was preserved.

Completed:

- all nine specification/decision templates contain the required lifecycle
  headings;
- all issue, agent, instruction, and OpenAI metadata YAML parses successfully;
- the skills audit contains exactly 252 removal recommendations and no deletion;
- all automatic-discovery links resolve to the six validated canonical skills;
- local Markdown links resolve; application test/lint/build gates pass as
  recorded above.

## Monitoring

No runtime monitoring changes. Review workflow adoption after the first three
significant pull requests: each should link a spec, contain verification
evidence, and close rollout/rollback gates.

## Rollout

Merge the documentation and workflow artifacts in one reviewable PR. Introduce
the workflow on the next new feature; do not retroactively rewrite historical
work.

## Rollback

Revert the workflow PR. Preserve any specifications or incident records created
after adoption by moving them to an archive before reverting structure.
