// Gemini topic-generation client (W4, ADR-0008). Thin wrapper around the
// REST API -- fetchImpl is injected so this is testable without a live key
// or network call.
//
// Model default updated at build time, 2026-07-26 (per PHASE1_PLAN.md's W4
// note: confirm the current free-tier model rather than hardcoding the
// ADR's pick). ADR-0008 chose gemini-2.5-flash, but a live check
// (ai.google.dev/gemini-api/docs/deprecations) showed it shuts down
// 2026-10-16, with Google's own recommended stable replacement being
// gemini-3.6-flash (GA, launched 2026-07-21, has a free tier). Kept
// overridable via the `model` option / GEMINI_MODEL env var so the next
// vendor lineup change is a config edit, not a code change.
import { buildTopicPrompt, parseTopicResponse } from '../domain/topicPrompt.js';
import { parseFeedbackResponse } from '../domain/feedbackPrompt.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

async function callGemini(prompt, { apiKey, model, fetchImpl }) {
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

export async function generateTopic(
  { category, difficulty } = {},
  { apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, fetchImpl = fetch } = {}
) {
  const prompt = buildTopicPrompt({ category, difficulty });
  const body = await callGemini(prompt, { apiKey, model, fetchImpl });
  return parseTopicResponse(body);
}

// W6: sends an already-built feedback prompt (domain/feedbackPrompt.js's
// buildFeedbackPrompt) to Gemini and returns the parsed paragraph. Takes a
// raw prompt string, not structured filters like generateTopic -- this is
// the exact `generate(prompt)` shape domain/feedbackGeneration.js's
// orchestrator calls per student (see agent/feedbackWorker.js for the
// partial application that wires the two together).
export async function generateFeedback(
  prompt,
  { apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, fetchImpl = fetch } = {}
) {
  const body = await callGemini(prompt, { apiKey, model, fetchImpl });
  return parseFeedbackResponse(body);
}
