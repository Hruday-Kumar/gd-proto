// Phase 1 pilot concurrency cap (ACTION_PLAN.md, 2026-08-04): a minimal
// worker-pool runner -- at most `limit` of `tasks` run at once, the rest
// wait their turn. Each task is a zero-arg thunk returning a promise that
// is expected to handle its own errors (matches how agent/roomSweeper.js's
// attemptFeedback calls are already wrapped in a .catch before being
// queued) -- this runner does not itself catch or rethrow.
export async function runWithConcurrencyLimit(tasks, limit) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const task = tasks[nextIndex++];
      await task();
    }
  }
  const workerCount = Math.max(1, Math.min(limit, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
}
