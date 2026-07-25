# PlaceMe — Agent Context

**One-liner:** PlaceMe is an on-demand practice arena for engineering students preparing for campus placements. v1 builds **one** module only: the **GD (Group Discussion) Arena — Multiplayer mode** — real students in a live audio room with a topic + timer, per-speaker transcription/attribution, and individual written feedback.

## MVP boundary (v1)
**IN scope:** student accounts (auth, identity, basic profile) · GD Arena Multiplayer ONLY · LLM-generated topics + custom topic entry · random matching AND shareable room code/link · live audio room (real participants only, no AI voices) · per-speaker transcription + attribution · individual written feedback per student · per-student session history.

**OUT of scope for v1 (Deferred, not silently skipped):** GD Arena AI Voice Practice mode · JAM · Aptitude/Technical tests · 1-on-1 Roleplay Interviews · Drive Simulator · payments · notifications/SMS/push · analytics · advanced observability.

Only research/ADR the categories the in-scope list touches: **Auth, Database/storage, Real-time room/WebRTC, Live speech-to-text, Backend framework, Frontend framework, Hosting/deployment, LLM provider.**

## Fixed constraints (decided — do not re-litigate)
- **Team:** agent-dependent builder(s), new to the whole stack → prefer mainstream, heavily-documented, managed-where-possible tech. See @docs/engineering/TEAM.md.
- **Scale (MVP):** tiny pilot — ~5–10 concurrent rooms at launch, ~20–30 at 3 months.
- **Budget:** shoestring, <~$100/mo infra + tooling.
- **Retention:** delete raw audio immediately after successful transcription; keep transcript + feedback until account deletion; student sees only their own history.
- **Compliance:** India DPDP + explicit **recorded consent before any mic is enabled**.
- **Timeline:** ~2–4 weeks to real students in a live room.
- **Deployment:** cloud-agnostic, containerized (Docker/OCI), no hard vendor lock-in.
- **Methodology:** TDD, pragmatic mode (core logic tests-first; peripheral tests before "done").
- **Codebase:** fully greenfield.

## Build commands
_None yet — no stack chosen. Populate once Phase 0 selects a stack._

## Rules & state
- Non-negotiable guardrails: @.claude/rules/guardrails.md
- Team context: @docs/engineering/TEAM.md
- **Current state / what's next / blockers:** @docs/engineering/PROGRESS.md — read this first each session.

## TDD Rules — MANDATORY

This project follows strict Red → Green → Refactor. Test framework: Vitest/Jest.
Run tests with: `npm test` (or `npx vitest run` / `npx jest`)

1. Never write implementation code without a failing test first.
2. Before writing any test, announce: "🔴 RED: writing failing test for [feature]"
3. After writing a test, run it and confirm it fails for the RIGHT reason
   (missing implementation, not a typo or syntax error). Report the failure output.
4. Before writing implementation, announce: "🟢 GREEN: implementing minimum code to pass"
5. Write only enough code to pass the current failing test(s). Do not add
   functionality nobody asked for yet.
6. Do NOT edit or delete a test to make it pass. If a test seems wrong,
   stop and say so — do not silently change its assertions.
7. After tests pass, announce: "🔵 REFACTOR: cleaning up" and refactor only
   if needed. Re-run tests after refactoring to confirm they're still green.
8. Commit after each RED phase (failing test) and each GREEN phase (passing
   implementation) as separate commits. This gives a reviewable diff trail.

Self-check before writing any code file: "Does a failing test already exist
for this behavior?" If no, stop and write the test first.