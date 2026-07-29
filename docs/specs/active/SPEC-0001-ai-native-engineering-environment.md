# SPEC-0001 — AI-native engineering environment

**Status:** Approved  
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
- Create seven agent definitions with responsibilities, inputs, outputs,
  invocation criteria, and prohibitions.
- Create a professional pull request template and six issue templates.
- Create an ADR template and repository-wide Definition of Done.
- Produce retained/removal skill reports without deleting any skill.

## Design

Root context files provide short entry points; `ENGINEERING.md` owns lifecycle
policy; `docs/` owns durable specifications, architecture, decisions, runbooks,
operations, and pilot evidence; `templates/` owns reusable artifacts;
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

- [ ] Establish handbook, AI contexts, and spec lifecycle.
- [ ] Add templates, checklists, ADR entry point, and GitHub forms.
- [ ] Add runbooks, operations, and pilot documentation.
- [ ] Add focused agents and skills.
- [ ] Complete the existing-skills audit.
- [ ] Validate links, structure, skills, tests, lint, and build.
- [ ] Move this specification to `completed/` with evidence.

## Testing

- Run the six-skill validator.
- Run a repository link/path validation script without changing application code.
- Run `npm test`, `npm run lint`, and `npm run build`.

## Verification

Map every deliverable in the source brief to an existing file and verify required
headings. Review `git diff` to ensure useful tracked documentation was preserved.

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

