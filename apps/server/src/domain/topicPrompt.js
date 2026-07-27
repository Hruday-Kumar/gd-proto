// Pure prompt-building and response-parsing for Gemini topic generation
// (W4, ADR-0008). Kept separate from the network-calling client
// (src/llm/geminiClient.js) so this stays testable without hitting the
// real API.
export function buildTopicPrompt({ category, difficulty } = {}) {
  const parts = [
    'Generate a single group discussion (GD) topic suitable for engineering students preparing for campus placements.',
  ];
  if (category) parts.push(`Category: ${category}.`);
  if (difficulty) parts.push(`Difficulty: ${difficulty}.`);
  parts.push('Respond with only the topic text, one sentence, no numbering, no quotes, no explanation.');
  return parts.join(' ');
}

export function parseTopicResponse(geminiResponseBody) {
  const text = geminiResponseBody?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || !text.trim()) {
    throw new Error('Gemini response did not contain topic text');
  }
  return text.trim();
}
