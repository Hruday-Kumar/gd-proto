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

export async function generateFeedbackForRoom({ topic, transcriptLines, participants }, { generate }) {
  if (transcriptLines.length === 0) {
    return participants.map(({ userId }) => ({ userId, status: 'ok', body: TRANSCRIPTION_FAILED_MESSAGE }));
  }
  return Promise.all(
    participants.map(async ({ userId }) => {
      try {
        const prompt = buildFeedbackPrompt({ topic, transcriptLines, participants, targetUserId: userId });
        const body = await generate(prompt);
        return { userId, status: 'ok', body };
      } catch (err) {
        return { userId, status: 'error', error: err.message };
      }
    })
  );
}
