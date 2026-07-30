// Pure in-process tracker for the transcription agent's dispatch health
// (W8). agent/roomAgent.js calls this every time it starts or stops
// transcribing a room; api/health.js exposes it read-only at
// GET /health/agent so a dead/failing dispatch is visible on a health
// endpoint instead of only in server logs (ADR-0007 Consequences: a
// disconnected worker fails silently -- the room works, nobody gets
// transcribed).
export function createAgentWorkerStatus() {
  let activeRooms = 0;
  let dispatchSuccesses = 0;
  let dispatchFailures = 0;
  let lastFailure = null; // { roomId, message, at }
  // L5 (audit 2026-07-28): used to be discarded, so a success -- unlike a
  // failure -- couldn't be correlated to which room it was for.
  let lastSuccess = null; // { roomId, at }
  // Sequence numbers, not timestamps, decide "most recent" -- two calls in
  // the same millisecond must still order correctly.
  let lastFailureSeq = -1;
  let lastSuccessSeq = -1;
  let seq = 0;

  // N1 (audit comparison, 2026-07-29): feedback generation's own dispatch
  // health, tracked in parallel to the transcription counters above but
  // kept separate -- feedback has no "active" concept (it's a one-shot
  // generation, not a held-open connection), and its failure/health
  // recording only fires once retries are actually exhausted (see
  // agent/roomSweeper.js), not on every transient attempt -- a room that
  // fails once and succeeds on retry a minute later shouldn't page anyone.
  let feedbackSuccesses = 0;
  let feedbackFailures = 0;
  let lastFeedbackFailure = null; // { roomId, message, at }
  let lastFeedbackSuccess = null; // { roomId, at }
  let lastFeedbackFailureSeq = -1;
  let lastFeedbackSuccessSeq = -1;

  return {
    recordDispatchSuccess(roomId) {
      activeRooms += 1;
      dispatchSuccesses += 1;
      lastSuccess = { roomId, at: new Date().toISOString() };
      lastSuccessSeq = seq++;
    },
    recordDispatchFailure(roomId, error) {
      dispatchFailures += 1;
      lastFailure = { roomId, message: error.message, at: new Date().toISOString() };
      lastFailureSeq = seq++;
    },
    recordRoomStopped() {
      activeRooms = Math.max(0, activeRooms - 1);
    },
    recordFeedbackSuccess(roomId) {
      feedbackSuccesses += 1;
      lastFeedbackSuccess = { roomId, at: new Date().toISOString() };
      lastFeedbackSuccessSeq = seq++;
    },
    recordFeedbackFailure(roomId, error) {
      feedbackFailures += 1;
      lastFeedbackFailure = { roomId, message: error.message, at: new Date().toISOString() };
      lastFeedbackFailureSeq = seq++;
    },
    getStatus() {
      // "Healthy" means the most recent dispatch outcome was a success --
      // an old failure that's since been followed by a working dispatch
      // shouldn't keep paging anyone.
      const healthy = lastFailureSeq === -1 || lastSuccessSeq > lastFailureSeq;
      const feedbackHealthy = lastFeedbackFailureSeq === -1 || lastFeedbackSuccessSeq > lastFeedbackFailureSeq;
      return {
        activeRooms,
        dispatchSuccesses,
        dispatchFailures,
        lastFailure,
        lastSuccess,
        healthy,
        feedbackSuccesses,
        feedbackFailures,
        lastFeedbackFailure,
        lastFeedbackSuccess,
        feedbackHealthy,
      };
    },
  };
}
