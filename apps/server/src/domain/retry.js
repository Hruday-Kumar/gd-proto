// Small, pure retry helper. Built for the transcription agent's LiveKit
// connect (agent/roomAgent.js), which had zero retry -- a single transient
// network blip permanently killed transcription for the whole room with no
// recovery attempt. Kept generic/injectable (delayMs, onRetry) rather than
// hardcoded to that one call site, since it's a plain "retry a flaky async
// call a bounded number of times" concern.
export async function withRetry(fn, { attempts = 3, delayMs = 500, onRetry } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      onRetry?.(err, attempt);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}
