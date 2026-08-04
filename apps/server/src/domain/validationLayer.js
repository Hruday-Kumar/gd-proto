// SPEC-0011 state 5 (feat/eval-validation-layer): R5/AC5's Validation Layer.
// Two deterministic checks (weight totals, score range) plus the bounded
// (max 2) targeted LLM rubric-validation retry that sits between the
// Criterion Evaluators (state 3) and the Score Aggregator (state 4).
//
// A malformed/invented-field response from a criterion evaluator call
// already fails hard inside criterionEvaluationPrompt.js's
// parseCriterionEvaluationResponse (closed-world validation) -- until this
// state, that failure had no recovery path: one bad Gemini response for one
// dimension would kill the whole room's evaluation. evaluateCriterionWithValidation
// gives it a bounded, targeted (same dimension, same evidence, no broader
// re-ask) retry instead, and only reports a flagged issue -- never throws --
// once retries are exhausted, so a caller can decide how to handle a
// genuinely stuck criterion (e.g. record it and continue with the rest of
// the room, a later state's/feedbackWorker.js's concern).
import { getRubricForDimension } from './evalRubric.js';
import { buildCriterionEvaluationPrompt } from './criterionEvaluationPrompt.js';

// Exported so other stages (state 6's confidence calculator) can score a
// retry count against the same bound this module actually enforces,
// instead of duplicating the number.
export const DEFAULT_MAX_RETRIES = 2;

// A rubric weight not summing to 1.0 is a code-review defect in
// evalRubric.js, not something retrying the LLM could ever fix -- checked
// deterministically, always, before any Gemini call is made.
export function validateWeightTotal(dimensionLabel) {
  const { subdimensions } = getRubricForDimension(dimensionLabel);
  const total = subdimensions.reduce((sum, s) => sum + s.weight, 0);
  return { valid: Math.abs(total - 1) < 1e-6, total };
}

// A dimension/overall score (scoreAggregator.js) must be null (absence,
// R9) or a number in [0, 100] -- never anything else. Kept here, not in
// scoreAggregator.js, since "is this score in range" is a validation-layer
// concern the aggregator's own weighted-average math already guarantees by
// construction; this check exists for the SPEC-0011 R5 contract and for
// defense-in-depth if that math or the rubric's marks ever change.
export function validateScoreRange(score) {
  if (score === null) {
    return { valid: true };
  }
  return { valid: typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100 };
}

// generate: (prompt, parseContext) => Promise<parsed result>, matching
// llm/geminiClient.generateCriterionEvaluation's contract (prompt built once
// by buildCriterionEvaluationPrompt, reused unchanged across every retry --
// "targeted" means re-asking the same criterion, not a broader re-prompt).
// Injected so this is testable with no live Gemini key, same DI pattern as
// every other SPEC-0011 stage.
export async function evaluateCriterionWithValidation({
  dimensionLabel,
  evidence,
  participants,
  generate,
  maxRetries = DEFAULT_MAX_RETRIES,
}) {
  const weightCheck = validateWeightTotal(dimensionLabel);
  if (!weightCheck.valid) {
    throw new Error(
      `evaluateCriterionWithValidation: dimension "${dimensionLabel}" rubric weights sum to ${weightCheck.total}, not 1.0 -- this is a rubric code defect, not something a retry can fix`
    );
  }

  const { prompt, parseContext } = buildCriterionEvaluationPrompt({ dimensionLabel, evidence, participants });

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await generate(prompt, parseContext);
      return { valid: true, result, retryCount: attempt };
    } catch (err) {
      lastError = err;
    }
  }

  return {
    valid: false,
    result: null,
    retryCount: maxRetries,
    issue: { dimensionLabel, detail: lastError.message },
  };
}
