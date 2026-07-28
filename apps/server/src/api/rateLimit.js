import rateLimit from 'express-rate-limit';

// H4 (audit 2026-07-28): rate limiter for the two Gemini-backed routes
// (topic generation, random matching). Keyed on req.userId, set by
// requireAuth which always runs before this middleware in every mount
// point -- never IP, so students sharing a campus network can't
// collaterally rate-limit each other, and a spoofed/rotating IP can't
// dodge the cap.
export const DEFAULT_LLM_RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_LLM_RATE_LIMIT_MAX = 5;

export function createLlmRateLimiter({
  windowMs = DEFAULT_LLM_RATE_LIMIT_WINDOW_MS,
  max = DEFAULT_LLM_RATE_LIMIT_MAX,
} = {}) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.userId,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests -- please wait a moment before trying again.' },
  });
}
