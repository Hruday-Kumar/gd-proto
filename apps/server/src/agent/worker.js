// LiveKit agent worker — runs in the SAME process as the Express API (see
// PHASE1_PLAN.md §3a: Render's free tier only affords one always-on
// service's worth of instance-hours). Registered at boot from src/index.js.
//
// This is a placeholder. The real per-track-subscribe + AssemblyAI pipeline
// (proven in the P2 smoke test, spike/src/transcriber-assemblyai.js) is
// W5's job — wiring it here means minting real room tokens (W2/W3) and
// persisting attributed lines (data model in PHASE1_PLAN.md §4), neither of
// which exists yet.
export function startAgentWorker() {
  console.log('[agent] worker registered (stub — real dispatch logic lands in W5)');
}
