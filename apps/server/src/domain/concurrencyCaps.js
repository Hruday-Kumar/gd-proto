// Phase 1 pilot concurrency caps (ACTION_PLAN.md, 2026-08-04). CLAUDE.md's
// fixed pilot-scale constraint is "roughly 5-10 concurrent rooms
// initially" -- the audit's original "1 active room" number would have
// contradicted that, so the room cap here is set to the constraint's own
// floor instead (user decision, 2026-08-04).
export const MAX_CONCURRENT_LIVE_ROOMS = 5;

// Scaled to the room cap above times the existing per-room participant
// ceiling (domain/roomCapacity.js's MAX_ROOM_PARTICIPANTS), not the
// audit's flat "10" -- a flat 10 would have blocked most of even one
// full room, let alone five (user decision, 2026-08-04).
export const MAX_CONCURRENT_TRANSCRIPTION_STREAMS = 60;

// Distinct from DEFAULT_FEEDBACK_CONCURRENCY (feedbackGeneration.js) --
// that caps how many participants *within one room* get their feedback
// generated in parallel; this caps how many *rooms* run feedback
// generation at once, system-wide. Set to 1 per ACTION_PLAN.md to protect
// the shared Gemini free-tier quota (see the eval pipeline's per-stage
// model split, PR #87/#88).
export const MAX_CONCURRENT_FEEDBACK_ROOMS = 1;
