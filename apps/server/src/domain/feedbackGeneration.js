// Feedback generation orchestration (W6 core unit, PHASE1_PLAN.md §5).
// Builds one scoped prompt per participant (domain/feedbackPrompt.js) and
// calls the injected `generate` function for each. Each student's call is
// isolated -- one student's Gemini error must never lose the shared
// transcript or block any other student's feedback, and never leaks into
// another student's result. `generate` is injected so this is testable
// without a live Gemini key or network call.
import { buildFeedbackPrompt } from './feedbackPrompt.js';

// Shown instead of ever asking Gemini to judge a session it has no
// evidence for -- an empty transcript means transcription itself failed
// (agent never joined, a network blip, etc.), not that the student stayed
// silent. Gemini given "(no speech was transcribed)" will reasonably (and
// wrongly) tell the student to participate more next time; guardrail #1
// requires feedback to never be discouraging or misleading, so this case
// must short-circuit before the model is ever called.
export const TRANSCRIPTION_FAILED_MESSAGE =
  "We weren't able to capture a transcript for this session due to a technical issue on our end -- this isn't a reflection of your participation. Please try another session, and let us know if this keeps happening.";

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

export async function generateFeedbackForRoom(
  { topic, transcriptLines, participants },
  { generate, concurrency = DEFAULT_FEEDBACK_CONCURRENCY }
) {
  if (transcriptLines.length === 0) {
    return participants.map(({ userId }) => ({ userId, status: 'ok', body: TRANSCRIPTION_FAILED_MESSAGE }));
  }

  // Never throws: one student's failure becomes that student's result, so it
  // can't lose the shared transcript, abort the pool, or leak into anyone
  // else's feedback -- the same isolation the old Promise.all had, preserved
  // now that the calls are batched.
  async function generateForParticipant({ userId }) {
    try {
      const prompt = buildFeedbackPrompt({ topic, transcriptLines, participants, targetUserId: userId });
      const body = await generate(prompt);
      return { userId, status: 'ok', body };
    } catch (err) {
      return { userId, status: 'error', error: err.message };
    }
  }

  // Fixed-size worker pool over a shared cursor. Results are written back by
  // index, so the returned order matches `participants` regardless of which
  // calls finish first -- batching stays invisible to callers.
  const results = Array.from({ length: participants.length });
  let nextIndex = 0;

  async function worker() {
    for (let index = nextIndex++; index < participants.length; index = nextIndex++) {
      results[index] = await generateForParticipant(participants[index]);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, participants.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}
