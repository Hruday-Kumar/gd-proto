// Small, pure retry helper. Built for the transcription agent's LiveKit
// connect (agent/roomAgent.js), which had zero retry -- a single transient
// network blip permanently killed transcription for the whole room with no
// recovery attempt. Kept generic/injectable (delayMs, onRetry) rather than
// hardcoded to that one call site, since it's a plain "retry a flaky async
// call a bounded number of times" concern.
// shouldRetry (2026-07-30): defaults to retrying every failure, unchanged
// from the original behavior -- but not every flaky-async-call failure is
// worth retrying (a permanent 4xx like a bad API key isn't a network blip,
// and retrying it three times only delays surfacing a real problem).
// Lets a caller opt a specific error out without duplicating this loop.
export async function withRetry(fn, { attempts = 3, delayMs = 500, onRetry, shouldRetry = () => true } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (!shouldRetry(err)) throw err;
      onRetry?.(err, attempt);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}
