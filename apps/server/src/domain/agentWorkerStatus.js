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
  // Sequence numbers, not timestamps, decide "most recent" -- two calls in
  // the same millisecond must still order correctly.
  let lastFailureSeq = -1;
  let lastSuccessSeq = -1;
  let seq = 0;

  return {
    recordDispatchSuccess(roomId) {
      activeRooms += 1;
      dispatchSuccesses += 1;
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
    getStatus() {
      // "Healthy" means the most recent dispatch outcome was a success --
      // an old failure that's since been followed by a working dispatch
      // shouldn't keep paging anyone.
      const healthy = lastFailureSeq === -1 || lastSuccessSeq > lastFailureSeq;
      return { activeRooms, dispatchSuccesses, dispatchFailures, lastFailure, healthy };
    },
  };
}
