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

// N3 (audit comparison, 2026-07-29): POST /api/rooms (create) and POST
// /api/rooms/join had no rate limiting at all -- a leaked room code plus
// an unthrottled join endpoint meant a single account could hammer it
// with no cost. Separate from createLlmRateLimiter above since neither
// route is Gemini-backed itself -- sharing one counter would incorrectly
// couple unrelated traffic. Same per-user keying discipline.
export const DEFAULT_ROOM_ACTION_RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_ROOM_ACTION_RATE_LIMIT_MAX = 10;

export function createRoomActionRateLimiter({
  windowMs = DEFAULT_ROOM_ACTION_RATE_LIMIT_WINDOW_MS,
  max = DEFAULT_ROOM_ACTION_RATE_LIMIT_MAX,
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
