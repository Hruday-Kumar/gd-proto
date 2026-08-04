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
import { parseTranscriptAnalysisResponse, TRANSCRIPT_ANALYSIS_RESPONSE_SCHEMA } from '../domain/transcriptAnalysisPrompt.js';
import {
  parseCriterionEvaluationResponse,
  CRITERION_EVALUATION_RESPONSE_SCHEMA,
} from '../domain/criterionEvaluationPrompt.js';
import {
  parseEvaluationFeedbackResponse,
  EVALUATION_FEEDBACK_RESPONSE_SCHEMA,
} from '../domain/evaluationFeedbackPrompt.js';
import { withRetry } from '../domain/retry.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

// SPEC-0011 R13: the single biggest fix for run-to-run score variance --
// no evaluation-pipeline call ever left `temperature` unset before this,
// so the same transcript could score differently across runs purely from
// default sampling. Pinned low (not 0) since some models degrade into
// repetitive/degenerate structured output at exactly 0; this is "as
// deterministic as practical", not a claim of bit-for-bit reproducibility
// (architecture doc §18: "exact identical scores cannot be guaranteed by
// a probabilistic model... target bounded variance").
export const DEFAULT_EVAL_TEMPERATURE = 0.1;

// 2026-07-30 (pilot-readiness + exception-handling pass): no timeout
// existed anywhere in this file -- a hung request blocked indefinitely,
// tying up an HTTP request or one of the feedback worker's fixed
// concurrency slots forever. 15s is generous for a single-prompt
// generateContent call while still bounding the worst case.
export const DEFAULT_GEMINI_TIMEOUT_MS = 15_000;
export const DEFAULT_GEMINI_RETRY_ATTEMPTS = 3;
export const DEFAULT_GEMINI_RETRY_DELAY_MS = 500;

// A 429/5xx is the class of failure withRetry exists for -- a transient
// blip on Google's side, not a mistake on ours. A 4xx like an
// invalid/expired key is permanent: retrying it three times only delays
// surfacing a real problem.
function isRetryableGeminiError(err) {
  if (err.status === 429) return true;
  if (err.status >= 500 && err.status < 600) return true;
  // A network failure or our own timeout never got a status at all.
  return err.status === undefined;
}

async function callGemini(prompt, { apiKey, model, fetchImpl, timeoutMs, generationConfig }) {
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }
  // N9 (audit comparison, 2026-07-29): the key used to travel in the URL
  // query string -- a classic accidental-disclosure vector (proxy logs,
  // CDN logs, access logs). Google's API accepts the same key via this
  // header instead.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(generationConfig ? { generationConfig } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const err = new Error(`Gemini API error: ${response.status} ${await response.text()}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export async function generateTopic(
  { category, difficulty } = {},
  {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
    retryAttempts = DEFAULT_GEMINI_RETRY_ATTEMPTS,
    retryDelayMs = DEFAULT_GEMINI_RETRY_DELAY_MS,
  } = {}
) {
  const prompt = buildTopicPrompt({ category, difficulty });
  const body = await withRetry(() => callGemini(prompt, { apiKey, model, fetchImpl, timeoutMs }), {
    attempts: retryAttempts,
    delayMs: retryDelayMs,
    shouldRetry: isRetryableGeminiError,
  });
  return parseTopicResponse(body);
}

// SPEC-0011 AC9 (chore/eval-cutover-cleanup, 2026-08-04): the old single-shot
// generateFeedback (W6) was removed once AC7's human verification passed --
// generateEvaluationFeedback below is now the only feedback-generation call.

// SPEC-0011 state 2: sends an already-built Transcript Analysis prompt
// (domain/transcriptAnalysisPrompt.js's buildTranscriptAnalysisPrompt) and
// returns the parsed conversation_understanding + evidence_ledger. Same
// raw `generate(prompt)` shape as generateFeedback, and the same
// structured-output + defensive-parse pairing -- the API schema keeps the
// shape reliable, parseTranscriptAnalysisResponse still validates
// defensively on top of it.
export async function generateTranscriptAnalysis(
  prompt,
  {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
    retryAttempts = DEFAULT_GEMINI_RETRY_ATTEMPTS,
    retryDelayMs = DEFAULT_GEMINI_RETRY_DELAY_MS,
  } = {}
) {
  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: TRANSCRIPT_ANALYSIS_RESPONSE_SCHEMA,
    temperature: DEFAULT_EVAL_TEMPERATURE,
  };
  const body = await withRetry(() => callGemini(prompt, { apiKey, model, fetchImpl, timeoutMs, generationConfig }), {
    attempts: retryAttempts,
    delayMs: retryDelayMs,
    shouldRetry: isRetryableGeminiError,
  });
  return parseTranscriptAnalysisResponse(body);
}

// SPEC-0011 state 3: sends an already-built Criterion Evaluator prompt
// (domain/criterionEvaluationPrompt.js's buildCriterionEvaluationPrompt)
// for one rubric dimension and returns the parsed per-participant
// subdimension levels. Takes `parseContext` (also returned by
// buildCriterionEvaluationPrompt) because -- unlike generateFeedback/
// generateTranscriptAnalysis's fixed, context-free schemas -- validating
// this response requires knowing which participant tags, subdimension ids,
// and evidence ids were actually offered in this specific call (R2/AC3:
// an invented or foreign reference must be rejected, not silently passed
// through).
export async function generateCriterionEvaluation(
  prompt,
  parseContext,
  {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
    retryAttempts = DEFAULT_GEMINI_RETRY_ATTEMPTS,
    retryDelayMs = DEFAULT_GEMINI_RETRY_DELAY_MS,
  } = {}
) {
  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: CRITERION_EVALUATION_RESPONSE_SCHEMA,
    temperature: DEFAULT_EVAL_TEMPERATURE,
  };
  const body = await withRetry(() => callGemini(prompt, { apiKey, model, fetchImpl, timeoutMs, generationConfig }), {
    attempts: retryAttempts,
    delayMs: retryDelayMs,
    shouldRetry: isRetryableGeminiError,
  });
  return parseCriterionEvaluationResponse(body, parseContext);
}

// SPEC-0011 state 7: the Feedback Generation stage's Gemini call -- one per
// participant, sent last, after the scorecard and confidence are already
// final. Same `(prompt, parseContext)` shape as generateCriterionEvaluation
// (parseContext here is just the ordered dimension label list this call's
// prompt offered, for parseEvaluationFeedbackResponse's order check).
export async function generateEvaluationFeedback(
  prompt,
  parseContext,
  {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
    retryAttempts = DEFAULT_GEMINI_RETRY_ATTEMPTS,
    retryDelayMs = DEFAULT_GEMINI_RETRY_DELAY_MS,
  } = {}
) {
  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: EVALUATION_FEEDBACK_RESPONSE_SCHEMA,
    temperature: DEFAULT_EVAL_TEMPERATURE,
  };
  const body = await withRetry(() => callGemini(prompt, { apiKey, model, fetchImpl, timeoutMs, generationConfig }), {
    attempts: retryAttempts,
    delayMs: retryDelayMs,
    shouldRetry: isRetryableGeminiError,
  });
  return parseEvaluationFeedbackResponse(body, parseContext);
}
