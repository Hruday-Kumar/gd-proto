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
