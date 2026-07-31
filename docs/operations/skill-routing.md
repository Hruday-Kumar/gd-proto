# Automatic skill routing

The six PlaceMe skills have one canonical implementation under
`.github/skills/placeme-*`.

| Host | Repository discovery path | Behavior |
|---|---|---|
| GitHub Copilot / VS Code agent mode | `.github/skills/placeme-*` | matches the skill `description` to the user request |
| Codex CLI / IDE / app | `.agents/skills/placeme-*` | repository-local links to the canonical skills; implicit policy enabled |
| Claude Code | `.claude/skills/placeme-*` | repository-local links to the canonical skills; model invocation enabled by default |

## Routing

| Intent/trigger examples | Primary skill | Next gates when applicable |
|---|---|---|
| “build”, “implement”, “fix”, “refactor” | `placeme-feature` | review → security → pilot → release |
| “review this PR/diff”, “check regressions/concurrency/spec” | `placeme-review` | security/pilot/release by risk |
| “security audit”, “RLS/auth/consent/secrets/API privacy” | `placeme-security` | review/release |
| “are we pilot ready?”, provider limits, monitoring | `placeme-pilot` | release |
| “release/deploy/migrate/smoke/rollback” | `placeme-release` | incident if a stop condition fires |
| outage, incident, degradation, recovery, root cause | `placeme-incident` | security/post-mortem/release as needed |

Description matching is intentionally semantic rather than keyword-only. For a
compound request, invoke matching skills in lifecycle order. The always-loaded
`AGENTS.md`, `CLAUDE.md`, and Copilot instructions reinforce this router.

## Safety boundary

Automatic skill invocation loads instructions; it does not broaden authority.
Release and incident skills may inspect and prepare plans automatically, but
must not deploy, merge, migrate, delete data, rotate credentials, or send
external communications without the authorization required by the repository
and tool environment.

## Smoke test

After cloning or changing the top-level discovery directories, restart the host
if the skills do not appear immediately. Verify with representative prompts:

1. “Implement the approved room-capacity spec.” → `placeme-feature`
2. “Review this PR for regressions and spec compliance.” → `placeme-review`
3. “Audit this migration’s RLS and consent impact.” → `placeme-security`
4. “Are we ready for Friday’s 20-student pilot?” → `placeme-pilot`
5. “Prepare the next release and migration checklist.” → `placeme-release`
6. “Gemini feedback is failing in the pilot—coordinate the incident.” →
   `placeme-incident`

Use explicit `$placeme-*` (Codex), `/placeme-*` (Claude/Copilot), or the host's
skill picker when deterministic manual selection is desired.

