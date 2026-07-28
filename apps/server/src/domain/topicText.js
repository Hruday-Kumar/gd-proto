// H5 (audit 2026-07-28): bounds a custom topic's length. A genuine GD
// topic is one sentence; this is generous enough for that while bounding
// how much room a hostile submission has to work with before it reaches
// the Gemini feedback prompt (domain/feedbackPrompt.js embeds it verbatim
// for every participant in the room).
export const MAX_CUSTOM_TOPIC_LENGTH = 200;

export function isValidCustomTopicText(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed.length <= MAX_CUSTOM_TOPIC_LENGTH;
}
