// Pure prompt-building for per-student GD feedback (W6, PHASE1_PLAN.md §5).
// Kept separate from the network-calling Gemini client so this stays
// testable without hitting the real API -- same split as topicPrompt.js.
//
// Two properties this must hold: (a) enough shared transcript/group context
// for the model to judge "did they let others speak", (b) each call is
// scoped to exactly one target student -- it must never ask for or produce
// another student's feedback, since a per-student call is how "own history
// only" (guardrail #4) stays true at the LLM layer too.
export function buildFeedbackPrompt({ topic, transcriptLines = [], participants = [], targetUserId } = {}) {
  if (!targetUserId) {
    throw new Error('targetUserId is required');
  }
  const target = participants.find((p) => p.userId === targetUserId);
  if (!target) {
    throw new Error('targetUserId must be a participant in this session');
  }

  const nameFor = (userId) => participants.find((p) => p.userId === userId)?.displayName ?? 'Unknown speaker';

  const transcript = transcriptLines.length
    ? transcriptLines.map((line) => `${nameFor(line.userId)}: ${line.text}`).join('\n')
    : '(no speech was transcribed in this session)';

  const parts = [
    `You are an expert group discussion (GD) coach giving feedback to one student, ${target.displayName}, after a live group discussion practice session.`,
  ];
  if (topic) parts.push(`Topic discussed: "${topic}".`);
  parts.push(`Full transcript of the discussion, attributed by speaker:\n${transcript}`);
  parts.push(
    `Write feedback only for ${target.displayName}. Do not write feedback for any other participant, and do not mention their names except as context for ${target.displayName}'s own contribution.`
  );
  parts.push(
    'Use the full transcript to judge whether they spoke clearly, stayed on topic, and let others speak -- but address only their own performance.'
  );
  parts.push(
    'Respond with a single plain paragraph. No numeric scores, no bullet points, no headings. Be constructive and never discouraging.'
  );
  return parts.join('\n\n');
}

// Same extraction shape as topicPrompt.js's parseTopicResponse -- Gemini's
// generateContent response is structured identically regardless of prompt.
export function parseFeedbackResponse(geminiResponseBody) {
  const text = geminiResponseBody?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || !text.trim()) {
    throw new Error('Gemini response did not contain feedback text');
  }
  return text.trim();
}
