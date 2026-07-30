// Process-level exception safety net (2026-07-30 pilot-readiness +
// exception-handling pass). Node's default behavior on an unhandled
// promise rejection is to crash the whole process -- and this codebase
// dispatches several fire-and-forget background calls per live room
// (agent/roomAgent.js), each meant to isolate its own failures. Reaching
// either handler here means one of those isolation boundaries was missed
// somewhere; the response still shouldn't be "take every other live room
// down with it." Built as a factory, same shape as shutdown.js, so the
// handlers are directly testable without registering process.on() in a
// test run.
export function createProcessSafetyNet({ logger = console, shutdown, exit = (code) => process.exit(code) } = {}) {
  function logError(kind, err) {
    const isError = err instanceof Error;
    logger.error(
      JSON.stringify({
        level: 'error',
        kind,
        message: isError ? err.message : String(err),
        stack: isError ? err.stack : undefined,
        at: new Date().toISOString(),
      })
    );
  }

  return {
    // A rejected promise with no .catch() anywhere in its chain. Logged,
    // not crashed: Node's default here would take down every other live
    // room over one room's failure, which is strictly worse than logging
    // a bug to go fix at the source.
    onUnhandledRejection(reason) {
      logError('unhandledRejection', reason);
    },

    // A synchronous throw that escaped every try/catch on the stack --
    // unlike a rejected promise, this can leave in-memory state (the
    // activeRooms map, Express's own internals) genuinely unknown, so
    // continuing to serve traffic isn't safe. Reuse the existing graceful
    // shutdown (never duplicate it) so any live rooms still get a clean
    // disconnect before the platform restarts the process.
    async onUncaughtException(err) {
      logError('uncaughtException', err);
      if (shutdown) {
        await shutdown('uncaughtException');
      } else {
        exit(1);
      }
    },
  };
}
