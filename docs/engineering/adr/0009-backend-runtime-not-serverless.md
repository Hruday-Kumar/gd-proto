# ADR-0009: The backend runs as a long-lived container, not on a serverless function runtime

**Status:** Accepted
**Date:** 2026-07-28
**Category:** Hosting/deployment — narrows ADR-0007 rather than replacing it
**Supersedes:** nothing. **Amends:** ADR-0007 (hosting/deployment).

## Context

ADR-0007 chose **Render (Docker)** for the backend and **Cloudflare Pages**
for the frontend. Between 2026-07-27 and 2026-07-28 the deployment story
forked in the repository without any decision being recorded:

- `03ba38b` ("Fix Vercel serverless invocation crash — add default export
  handler", merged to `main` via PR #2) added a serverless-style default
  export to `apps/server/src/index.js`, written against a live
  `FUNCTION_INVOCATION_FAILED`.
- `292fa8a` and `22871fd`, either side of it, fixed the **Render** Docker
  path (Alpine→Debian for `@livekit/rtc-ffi-bindings`, then installing
  `ca-certificates` for `@livekit/rtc-node`'s native Rust engine).

So two incompatible backend targets were being maintained within 24 hours,
neither recorded in an ADR — flagged as **C2/M12** in the 2026-07-28
engineering audit (`docs/engineering/AUDIT.md`). Vercel appears nowhere in
ADR-0007, `DEPLOYMENT.md`, `PHASE1_PLAN.md` or `PROGRESS.md` as a backend
target; ADR-0007 mentions it only as a *rejected frontend* alternative.

**Confirmed with the user, 2026-07-28: Render (Docker) serves the backend.
The Vercel backend attempt was abandoned.** The handler was therefore dead
code — under Render, `index.js` takes the
`import.meta.url === pathToFileURL(process.argv[1]).href` branch, calls
`app.listen()` and `startAgentWorker()`, and the default export is never
invoked.

This ADR exists so the *reason* survives, and so nobody re-adds that handler
on the reasonable assumption that it was load-bearing.

## Decision

**The PlaceMe backend targets a long-lived container process only.** No
serverless/function-runtime entry point is supported or maintained. The
serverless default export has been removed from `apps/server/src/index.js`.

## Why this application specifically cannot run on a function runtime

This is not a general objection to serverless. It's four concrete properties
of *this* codebase (all verified against the source, not assumed):

1. **Work is dispatched fire-and-forget after the HTTP response.** Both
   `startTranscriptionForRoom` (`api/rooms.js`, in `POST /:id/start`) and
   `generateAndPersistFeedbackForRoom` (in `GET /:id/status`) are launched
   with `.catch(...)` and deliberately *not* awaited, so the response isn't
   delayed by LiveKit/Gemini network time. A function runtime may freeze or
   reclaim the instance once the response is sent, so that work is not
   guaranteed to run at all.

2. **The agent keeps in-process state.** `agent/roomAgent.js` holds
   `activeRooms` (a module-level `Map`) and the shared `agentStatus`
   tracker. Across instances, `stopTranscriptionForRoom` could never find
   the room it needs to disconnect.

3. **The stop timer outlives any function invocation.** The agent
   disconnects itself via `setTimeout(durationSeconds * 1000 +
   STOP_GRACE_MS)` — ten minutes for a typical session, far beyond a
   function's maximum duration.

4. **`@livekit/rtc-node` is a native FFI binding.** Its packaging
   constraints are precisely why the Dockerfile moved musl→glibc and why
   `ca-certificates` had to be installed for the Rust engine's system TLS
   store. Both remedies are Dockerfile lines with no equivalent on a managed
   function runtime.

**The failure would also have been invisible.** The HTTP surface keeps
working: auth succeeds, rooms are created and joined, `/health` returns
`ok`, and students can still hold a real discussion because **browsers
connect to LiveKit directly**, independently of the server-side agent. Only
transcription and feedback silently vanish. Worse, `/health/agent` reads a
fresh in-memory tracker, and `domain/agentWorkerStatus.js` reports
`healthy: true` when no dispatch has been recorded — so a cold instance
always looks healthy, and the keep-alive workflow's `.healthy == true`
assertion could never fire. The alarm built to catch this failure would have
been structurally incapable of catching it.

This is the same silent-failure signature as audit findings **H2** and the
open **B4** risk: the system reports success while the product does nothing.

## Consequences

- `render.yaml`, the root `Dockerfile` and `DEPLOYMENT.md` remain the single
  described path for the backend. ADR-0007's Render sleep mitigation and its
  stated residual risk are unchanged.
- **Vercel remains a legitimate choice for the *frontend*.** ADR-0007 chose
  Cloudflare Pages; if Vercel is used instead, that is a small, defensible
  change — but it needs its own ADR amendment and exactly one committed SPA
  config. The working tree currently holds configs for *both* hosts
  (`apps/web/vercel.json` and `apps/web/public/_redirects`), both untracked;
  reconciling that is audit finding **M12**, not resolved here.
- **If the backend must ever move to a function runtime**, the transcription
  agent has to be split into a separate always-on worker service first. Note
  the cost consequence recorded in `PHASE1_PLAN.md §3a`: Render's free tier
  allows 750 instance-hours/month and one always-on service already consumes
  ~720, so a second always-on service does not fit the zero-out-of-pocket
  constraint.
- Nothing imported the removed default export (`createApp` is the named
  export the tests use), so removal is behaviour-preserving on Render.
