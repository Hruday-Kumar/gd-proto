# PlaceMe architecture

## System context

PlaceMe GD Arena is a JavaScript monorepo:

```text
React/Vite browser
  ├─ Supabase Auth + user-scoped data through RLS
  ├─ Express API on Render
  │    ├─ Supabase service operations
  │    ├─ LiveKit room/token operations
  │    └─ Gemini topic and feedback generation
  └─ LiveKit real-time room
       └─ Node worker → AssemblyAI live STT → transcript → feedback
```

## Components and trust boundaries

| Component | Responsibility | Trust boundary |
|---|---|---|
| `apps/web` | authentication UI, consent flow, rooms, live audio, history | untrusted browser; anon Supabase key only |
| `apps/server` API | authenticated orchestration, consent gate, validation, rate limiting | validates tokens and resource ownership |
| Agent worker | room dispatch, live transcription, attribution, feedback | provider credentials; no raw-audio persistence |
| Supabase | auth, Postgres data, RLS | service role is server-only; students see own data |
| LiveKit | room audio and participant permissions | publish/subscribe grants must be least-privilege |
| AssemblyAI | ephemeral live speech-to-text | audio streamed under recorded consent |
| Gemini | topic and feedback generation | prompts minimize personal data and handle outage/limits |
| Render/Vercel | backend/frontend deployment | environment values managed outside source control |

## Architectural invariants

- Consent is recorded before microphone enablement or transcript capture.
- Raw audio is not persisted.
- Transcript and feedback access is user-scoped and enforced by RLS plus API
  authorization.
- Provider failures must not corrupt room state or expose secrets.
- Retries and duplicate events must not create duplicate feedback, participants,
  or inconsistent terminal states.
- The backend remains containerizable and provider boundaries stay explicit.

## Decision history

Accepted technology ADRs remain under `docs/engineering/adr/`. Start new
decisions from `docs/adr/README.md` and `templates/architecture-decision-record.md`.
An ADR is required before changing a selected provider, trust boundary, runtime,
data ownership model, or deployment topology.

## Change expectations

Update this overview when a change adds a component, external data flow, trust
boundary, provider, or new class of stored data. Put detailed operational steps
in `docs/runbooks/`, not here.

