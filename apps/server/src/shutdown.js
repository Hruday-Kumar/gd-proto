// Graceful shutdown (H2, audit 2026-07-28). Render sends SIGTERM on every
// deploy and before a free-tier sleep; without a handler the process just
// dies, dropping each live room's LiveKit and AssemblyAI sockets with no
// disconnect and no chance for the last speaker's turn to flush.
//
// Built as a factory rather than registering process.on() itself so the
// behaviour is testable: index.js does the wiring, this does the work.
export function createGracefulShutdown({ server, stopAllTranscriptions, exit = (code) => process.exit(code), forceExitMs = 10_000 }) {
  let shuttingDown = false;

  return async function shutdown(signal) {
    // Render follows up with a second signal if the process lingers. Running
    // the teardown twice would double-disconnect rooms mid-flush.
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received — shutting down`);

    // The graceful path has to be bounded: a LiveKit disconnect that never
    // resolves must not hold the process open until the platform SIGKILLs it.
    const forced = setTimeout(() => {
      console.error(`[server] shutdown did not finish within ${forceExitMs}ms — forcing exit`);
      exit(1);
    }, forceExitMs);
    forced.unref?.();

    // Stop accepting new connections immediately; in-flight requests finish
    // while the agents disconnect below.
    const closed = new Promise((resolve) => server.close(resolve));

    try {
      const stopped = await stopAllTranscriptions();
      console.log(`[server] stopped ${stopped} active transcription(s)`);
    } catch (err) {
      // A failed disconnect must not strand the process — the platform will
      // SIGKILL it anyway, and an un-closed server is strictly worse.
      console.error(`[server] error stopping transcriptions during shutdown: ${err.message}`);
    }

    await closed;
    clearTimeout(forced);
    exit(0);
  };
}
