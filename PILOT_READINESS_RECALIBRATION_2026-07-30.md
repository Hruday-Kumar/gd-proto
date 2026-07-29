# Pilot Readiness Recalibration and Fix Tracker

Date: 2026-07-30  
Scope: The 16 findings from `PILOT_READINESS_AUDIT_2026-07-30.md`, reassessed only for a supervised, single-college engineering pilot with approximately 20–50 concurrent students.

## Revised recommendation

**GO WITH CONDITIONS**

The original **NO GO** was over-calibrated for a production-scale launch. Five findings remain absolute pilot blockers, seven are strongly recommended but survivable through manual intervention, and four are safe to defer.

Estimated readiness after completing only Category A: **7.5/10**.

## Status legend

| Status | Meaning |
|---|---|
| `TODO` | Work has not started |
| `IN PROGRESS` | An engineer is actively addressing it |
| `READY FOR VERIFY` | Implementation is complete but pilot-specific verification remains |
| `DONE` | Implemented and verified |
| `DEFERRED` | Intentionally postponed until after pilot feedback |

## Category A — Must Fix Before Pilot

| Priority | Finding | Repository evidence | Likelihood at 20–50 students | Actual pilot impact | Recover in 5–10 minutes? | Blocks pilot? | Proportional pilot fix | Status |
|---:|---|---|---|---|---|---|---|---|
| 2 | **F-05 — AssemblyAI failure can silently lose transcription and grow memory** | [`assemblyai.js`](apps/server/src/agent/assemblyai.js#L34) buffers pre-open audio without a limit; [`transcriber.js`](apps/server/src/agent/transcriber.js#L17) logs errors but continues feeding audio. [`LESSONS.md`](docs/engineering/LESSONS.md#L114) records the development-tier limit of five new connections per minute and an observed silent failure. | **Likely** unless starts are explicitly staggered | One or many rooms can lose transcript and feedback; accumulated audio may exhaust the only process and cause a complete outage | **NO** for speech already missed. The process can be restarted, but the transcript cannot be reconstructed | **YES** — transcription is a core pilot function and the failure can also crash the application | Add a short connection-open deadline, a bounded pre-open audio buffer, explicit open/closed state, close-code/error handling, and stop accepting audio after terminal failure. Full circuit breakers and a durable reconnect system are not required for this pilot | `TODO` |
| 3 | **F-16 — Email addresses become participant display names** | [`SignupPage.jsx`](apps/web/src/pages/SignupPage.jsx#L19) supplies no display-name metadata; [`0001_profiles.sql`](supabase/migrations/0001_profiles.sql#L27) falls back to email; [`rooms.js`](apps/server/src/api/rooms.js#L89) exposes the resulting name in room tokens and participant APIs | **Very Likely** for every new pilot account | Personal emails are disclosed to room peers and included in Gemini prompts | **NO** after disclosure | **YES** — this is a predictable privacy and data-minimization failure | Collect a bounded display name at signup or assign a pseudonymous fallback. Update existing pilot profiles before they enter rooms. Do not use email as a participant-facing fallback | `TODO` |
| 4 | **F-06 — Caption publication can crash the Node process** | [`roomAgent.js`](apps/server/src/agent/roomAgent.js#L108) calls `publishData()` without awaiting or catching it. [`package-lock.json`](package-lock.json#L271) locks `@livekit/rtc-node` 0.13.31 | **Unlikely**, but realistic during disconnect or shutdown | Complete backend outage and transcription gaps across all active rooms | **YES** for service recovery through restart and live-room reattachment; **NO** for transcript lost during the gap | **YES** — it is a known uncaught rejection in the only server process | Catch the `publishData()` promise and log the room-scoped failure without failing transcript persistence. Add a regression test that forces rejection and proves it is contained | `TODO` |
| 5 | **F-04 — Consent versions can be forged** | [`0002_consents.sql`](supabase/migrations/0002_consents.sql#L24) lets authenticated clients insert arbitrary consent versions; [`consent.js`](apps/server/src/domain/consent.js#L18) accepts a stored version greater than or equal to the current version | **Unlikely**, because it requires deliberate API manipulation | Consent-integrity and privacy violation; normally no availability impact | **NO** for consent already falsely recorded | **YES** — the pilot cannot rely on consent records that clients can manufacture for future versions | Drop the authenticated consent insert policy, keep the server as the only writer, and require the stored version to equal the current version exactly. Add denial and future-version regression tests | `TODO` |
| 6 | **F-03 — Direct room insertion bypasses API controls** | [`0003_topics_rooms_matching.sql`](supabase/migrations/0003_topics_rooms_matching.sql#L48) permits authenticated direct room inserts; the legitimate web path uses the controlled API in [`roomsApi.js`](apps/web/src/rooms/roomsApi.js#L25) | **Possible**, principally through deliberate abuse by a technically capable student | Database pollution; deliberate bulk abuse could cause a partial or complete backend outage | **YES** operationally: drop the policy, remove forged rooms, and restart if saturated | **YES** — it is a live authorization and abuse-control bypass capable of disrupting the pilot | Drop the authenticated room insert policy and keep room writes server-only. Add a live RLS regression test proving direct insertion is denied. Distributed abuse infrastructure is not required | `TODO` |

## Category B — Strongly Recommended Before Pilot

| Priority | Finding | Repository evidence | Likelihood at 20–50 students | Actual pilot impact | Recover in 5–10 minutes? | Blocks pilot? | Proportional pilot action | Status |
|---:|---|---|---|---|---|---|---|---|
| 1 | **F-09 — No provider-wide concurrency control** | Each audio track opens an AssemblyAI connection in [`transcriber.js`](apps/server/src/agent/transcriber.js#L13); feedback concurrency is only per room in [`feedbackGeneration.js`](apps/server/src/domain/feedbackGeneration.js#L32). [`LESSONS.md`](docs/engineering/LESSONS.md#L114) documents five new STT connections per minute on the development tier | **Very Likely** during an ordinary simultaneous 20–50-student start; preventable through explicit staggering or a provider-tier change | Many rooms may lack transcription; feedback may be delayed | **NO** for audio already missed. Future starts can be protected by pausing admission and staggering them | **NO** — manual admission control is acceptable for this supervised pilot | Verify the actual AssemblyAI tier. If the five-per-minute limit remains, use code-based groups of no more than five and admit no more than five new microphones per minute. A durable global work queue can wait | `TODO` |
| 7 | **F-08 — Stale queue rows and owner-only waiting rooms** | [`MatchPage.jsx`](apps/web/src/pages/MatchPage.jsx#L37) relies on best-effort browser cleanup and a 90-second client timeout; [`rooms.js`](apps/server/src/api/rooms.js#L236) allows only the creator to start | **Likely** under laptop sleep, browser closure, or network loss | One match or waiting room becomes stuck; students are delayed | **YES** — purge stale queue rows and create a replacement code room | **NO** — manual cleanup and code-room fallback are acceptable | Prepare a targeted stale-queue cleanup query/runbook and keep code-room links ready. Server leases, heartbeats, creator handoff, and waiting-room sweeps can follow after pilot feedback | `TODO` |
| 8 | **F-07 — Room and matchmaking workflows are not transactional** | [`rooms.js`](apps/server/src/api/rooms.js#L198) removes match members before Gemini, topic, room, and seat creation completes. [`DEPLOYMENT.md`](docs/engineering/DEPLOYMENT.md#L65) records a real Gemini credential failure demonstrating the failure class | **Possible** | One match group can be delayed or removed from the queue; orphan or partially seated rooms are possible | **YES** — requeue affected students or move them to a code-based room | **NO** — the failure is confined to a group and staff can recreate the room | Add a manual requeue/recreate runbook. If making a small code fix, compensate failed matches by safely restoring unseated users. Full transactional RPCs, durable sagas, and outboxes can wait | `TODO` |
| 9 | **F-10 — No network deadlines or single-flight scheduling** | [`geminiClient.js`](apps/server/src/llm/geminiClient.js#L18) and [`roomsApi.js`](apps/web/src/rooms/roomsApi.js#L5) have no abort deadlines; [`roomSweeper.js`](apps/server/src/agent/roomSweeper.js#L188) can overlap interval work | **Possible** | Delayed lobby or feedback updates; partial outage during sustained dependency latency | **Usually yes** — pause admission and restart after the dependency recovers | **NO** — the small supervised load makes manual containment viable | Add the highest-value short deadlines and in-flight guards if time permits. Otherwise monitor dependency latency and pause new rooms when requests begin accumulating | `TODO` |
| 10 | **F-01 — Free, single-instance runtime** | [`render.yaml`](render.yaml#L13) declares one free service; [`index.js`](apps/server/src/index.js#L112) co-locates API and worker responsibilities. [`DEPLOYMENT.md`](docs/engineering/DEPLOYMENT.md#L52) records a successful idle test and deployed two-person sessions | **Unlikely** during a short, pre-warmed pilot; capacity remains unmeasured | A process stop causes a complete backend outage and transcription gaps | **YES** — wake or restart the service and allow boot recovery to reattach live rooms | **NO** — one instance is proportionate to this pilot | Pre-warm the service and avoid deploying during active rooms. Upgrade to the documented always-on Render tier if it is a quick dashboard change. Do not split services or add horizontal scaling yet | `TODO` |
| 11 | **F-13 — Transcript and name prompt injection** | [`feedbackPrompt.js`](apps/server/src/domain/feedbackPrompt.js#L19) frames topic text as untrusted but interpolates transcript text and display names without equivalent framing | **Possible** in an engineering-student cohort | Misleading feedback for one student or room; no server compromise or secret/tool access | **PARTIAL** — staff can invalidate or manually regenerate feedback, but there is no clean sanitized replay | **NO** — the blast radius is feedback quality | Delimit all user-controlled prompt data and use neutral speaker identifiers. Strict structured output and a large adversarial corpus can wait | `TODO` |
| 12 | **F-15 — Six-hour LiveKit credentials** | [`token.js`](apps/server/src/livekit/token.js#L6) sets no explicit TTL; [`rooms.js`](apps/server/src/api/rooms.js#L81) checks room state only when issuing the token | **Unlikely**; principally deliberate stale-token reuse | Off-session access to a former room and possible provider cost; normally no outage | **NO** through the application itself; provider-side room closure or key rotation would be needed | **NO** — access remains limited to an already-authorized participant’s room | Set a short token TTL based on waiting or remaining room time. Full revocation infrastructure can wait | `TODO` |

## Category C — Safe to Defer

| Priority | Finding | Why it can wait for this pilot | Repository evidence | Blocks pilot? | Post-pilot direction | Status |
|---:|---|---|---|---|---|---|
| 13 | **F-02 — Distributed transcription ownership and room start** | Only the rare same-room double-start race applies. Database leases, fencing, outboxes, and multi-replica ownership solve a deployment model this pilot does not use | [`rooms.js`](apps/server/src/api/rooms.js#L236), [`roomAgent.js`](apps/server/src/agent/roomAgent.js#L71) | **NO** — restart recovery is adequate for a supervised single process | Before adding replicas, implement an atomic `waiting -> live` claim, durable ownership, fencing, and idempotent transcript keys | `DEFERRED` |
| 14 | **F-11 — Health and monitoring can remain green** | The health blind spot has no direct user impact, and engineers will actively observe rooms, logs, captions, transcript activity, and provider dashboards | [`health.js`](apps/server/src/api/health.js#L5), [`agentWorkerStatus.js`](apps/server/src/domain/agentWorkerStatus.js#L61) | **NO** — manual monitoring is explicitly acceptable | Add dependency-aware readiness, per-track STT state, persisted incident status, metrics, and alerts before a wider or unattended rollout | `DEFERRED` |
| 15 | **F-12 — Schema and critical behavior are not continuously proven** | The repository records migrations 0001–0013 as applied, multiple live RLS verifications, and successful deployed end-to-end rooms. The missing continuous pipeline matters more when deployments become frequent or unattended | [`PLAN.md`](docs/engineering/PLAN.md#L112), [`DEPLOYMENT.md`](docs/engineering/DEPLOYMENT.md#L60), [`ci.yml`](.github/workflows/ci.yml#L57) | **NO** — a manual full-dress check is sufficient for this controlled pilot | Add managed migrations, mandatory RLS execution, staging, browser E2E, provider-failure tests, and measured load gates before wider rollout | `DEFERRED` |
| 16 | **F-14 — Exhausted feedback rows can starve older retries** | The failure needs 100 newer ineligible rooms to occupy the bounded query, which is not credible during this limited pilot | [`rooms.js`](apps/server/src/db/rooms.js#L121), [`roomSweep.js`](apps/server/src/domain/roomSweep.js#L61) | **NO** — occurrence is **Extremely Unlikely** at pilot volume | Move eligibility predicates into SQL and add durable claiming/dead-letter handling when feedback volume grows | `DEFERRED` |

## Pilot operating conditions

These are manual controls, not additional findings:

| Condition | Required action | Related findings | Status |
|---:|---|---|---|
| 1 | Complete and verify all five Category A fixes before admitting students | F-03, F-04, F-05, F-06, F-16 | `TODO` |
| 2 | Verify the AssemblyAI account tier. If limited to five new connections per minute, organize groups and room starts around that limit | F-05, F-09 | `TODO` |
| 3 | Immediately before admission, warm the backend and complete one real room through captions, transcript, feedback, and history | F-01, F-05, F-11, F-12 | `TODO` |
| 4 | Do not deploy or restart intentionally while rooms are active | F-01, F-02, F-06 | `TODO` |
| 5 | Watch Render logs, process memory, captions, transcript activity, STT errors, stale queue entries, and feedback completion throughout the pilot | F-05, F-08, F-09, F-10, F-11 | `TODO` |
| 6 | Pause new admissions if captions disappear, STT connections are rejected, memory rises continuously, or the backend restarts | F-01, F-05, F-09, F-10 | `TODO` |
| 7 | Keep code-room links and a targeted stale-queue cleanup procedure ready as the matchmaking fallback | F-07, F-08 | `TODO` |

## Assumptions intentionally removed from the pilot gate

The following earlier assumptions should not delay this pilot:

| Earlier assumption | Findings it influenced | Pilot decision |
|---|---|---|
| Multiple server replicas | F-01, F-02 | Keep one instance; defer distributed ownership and fencing |
| Horizontal scaling and internet-scale traffic | F-01, F-09, F-12 | Use a measured admission cap and manual start staggering |
| Multi-region infrastructure | F-01 | Not required |
| Zero-downtime deployments | F-01, F-02, F-06 | Avoid deployments during active rooms; retain only the known crash fix |
| Unattended operations | F-08, F-10, F-11 | Use live engineering coverage and manual intervention |
| Enterprise observability | F-11, F-12 | Use logs, provider dashboards, and room spot-checks |
| Fortune-500 transaction guarantees | F-07 | Use requeue and code-room recovery for the pilot |
| Large historical feedback backlogs | F-14 | Defer until real volume makes the 100-row condition plausible |

## Pilot decision checklist

- [ ] F-03 completed and verified
- [ ] F-04 completed and verified
- [ ] F-05 completed and verified
- [ ] F-06 completed and verified
- [ ] F-16 completed and verified
- [ ] Provider tier and connection-start allowance verified
- [ ] Pilot room-start schedule respects the provider allowance
- [ ] Existing pilot accounts use non-email display names
- [ ] Pre-pilot real-room smoke test passed
- [ ] Monitoring owner named for the full pilot window
- [ ] Stale-queue cleanup and code-room fallback ready
- [ ] No deployment planned during active pilot rooms

When every item above is checked, the repository’s revised recommendation is **GO WITH CONDITIONS**.
