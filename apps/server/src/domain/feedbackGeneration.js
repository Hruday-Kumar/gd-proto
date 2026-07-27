// Feedback generation orchestration (W6 core unit, PHASE1_PLAN.md §5).
// Builds one scoped prompt per participant (domain/feedbackPrompt.js) and
// calls the injected `generate` function for each. Each student's call is
// isolated -- one student's Gemini error must never lose the shared
// transcript or block any other student's feedback, and never leaks into
// another student's result. `generate` is injected so this is testable
// without a live Gemini key or network call.
import { buildFeedbackPrompt } from './feedbackPrompt.js';

export async function generateFeedbackForRoom({ topic, transcriptLines, participants }, { generate }) {
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
