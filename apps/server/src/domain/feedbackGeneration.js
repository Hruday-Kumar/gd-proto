// SPEC-0011 AC9 (chore/eval-cutover-cleanup, 2026-08-04): the old single-shot
// generateFeedbackForRoom orchestration was removed once AC7's human
// verification passed -- domain/evaluationPipeline.js is now the only
// feedback-generation path. TRANSCRIPTION_FAILED_MESSAGE/
// transcriptionFailedBody/DEFAULT_FEEDBACK_CONCURRENCY remain: they're
// genuinely reused by evaluationPipeline.js/feedbackWorker.js, not dead code.

// Shown instead of ever asking Gemini to judge a session it has no
// evidence for -- an empty transcript means transcription itself failed
// (agent never joined, a network blip, etc.), not that the student stayed
// silent. Gemini given "(no speech was transcribed)" will reasonably (and
// wrongly) tell the student to participate more next time; guardrail #1
// requires feedback to never be discouraging or misleading, so this case
// must short-circuit before the model is ever called.
export const TRANSCRIPTION_FAILED_MESSAGE =
  "We weren't able to capture a transcript for this session due to a technical issue on our end -- this isn't a reflection of your participation. Please try another session, and let us know if this keeps happening.";

// SPEC-0006 (BE-6/BE-7): feedback bodies are now the structured shape
// domain/feedbackPrompt.js's parseFeedbackResponse produces (summary,
// score, dimensions, strengths, improvements), not a bare string. This
// short-circuit stub must match that shape -- `score: null` and empty
// arrays, never a fabricated number, so a caller can't render a 0 as if it
// were a real (and very low) performance score. Guardrail #1 already
// required this path never judge a session it has no evidence for; the
// same reasoning now covers the numeric fields too.
// Exported so other stages (state 7's evaluationPipeline.js) can reuse this
// exact shape/message for their own "we have no usable evidence, and it's
// not the student's fault" short-circuit, instead of duplicating it.
export function transcriptionFailedBody() {
  return { summary: TRANSCRIPTION_FAILED_MESSAGE, score: null, dimensions: [], strengths: [], improvements: [] };
}

// How many Gemini calls may be in flight at once (M11, audit 2026-07-28).
// Every participant's call used to go out in a single Promise.all -- six at
// once for a full room (maxGroupSize, api/rooms.js), against a free tier with
// a per-minute request limit. A rate-limited call falls into the per-student
// error path below, so the student silently receives no feedback at all: the
// one output this product exists to deliver.
//
// Two is a deliberate compromise, not a measured optimum: it smooths a full
// room into three small waves instead of one burst, while keeping total
// generation time well inside the ~2 minute window the lobby polls for
// feedback. Overridable per call, and worth raising once the project is on a
// paid Gemini tier with a known quota.
export const DEFAULT_FEEDBACK_CONCURRENCY = 2;
