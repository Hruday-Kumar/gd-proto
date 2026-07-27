// LiveKit agent worker boot log — runs in the SAME process as the Express
// API (PHASE1_PLAN.md §3a: Render's free tier only affords one always-on
// service's worth of instance-hours).
//
// There's no persistent worker pool to register here: rather than LiveKit's
// job-dispatch Agents framework, W5 reuses the simpler in-process pattern
// the Phase 0a/P2 spike already validated with real humans and bots --
// roomAgent.js's startTranscriptionForRoom() is called directly by the
// rooms API right when a room goes live (POST /api/rooms/:id/start), joins
// that one room as a hidden participant, and disconnects itself once the
// room's own duration elapses.
export function startAgentWorker() {
  console.log('[agent] ready — transcription is dispatched per-room from POST /api/rooms/:id/start (see agent/roomAgent.js)');
}
