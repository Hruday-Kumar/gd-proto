// SPEC-0011 state 5 (feat/eval-validation-layer): R5/AC5's deterministic
// checks (weight totals, score range) plus the bounded (max 2) targeted
// LLM retry for a criterion evaluator call whose response fails
// criterionEvaluationPrompt.js's parseCriterionEvaluationResponse
// validation. Mirrors criterionEvaluationPrompt.test.js's fixture style.
import { describe, it, expect, vi } from 'vitest';
import {
  validateWeightTotal,
  validateScoreRange,
  evaluateCriterionWithValidation,
} from '../src/domain/validationLayer.js';
import { parseCriterionEvaluationResponse } from '../src/domain/criterionEvaluationPrompt.js';

describe('validateWeightTotal', () => {
  it('is valid for every real rubric dimension (weights sum to 1.0)', () => {
    for (const label of ['Content depth', 'Clarity', 'Confidence', 'Listening', 'Fluency']) {
      expect(validateWeightTotal(label)).toEqual({ valid: true, total: expect.closeTo(1, 5) });
    }
  });
});

describe('validateScoreRange', () => {
  it('accepts null as valid (absence of evidence, not an out-of-range score)', () => {
    expect(validateScoreRange(null)).toEqual({ valid: true });
  });

  it('accepts any number from 0 to 100 inclusive', () => {
    expect(validateScoreRange(0).valid).toBe(true);
    expect(validateScoreRange(52.5).valid).toBe(true);
    expect(validateScoreRange(100).valid).toBe(true);
  });

  it('rejects a number outside 0-100', () => {
    expect(validateScoreRange(-1).valid).toBe(false);
    expect(validateScoreRange(101).valid).toBe(false);
  });

  it('rejects a non-number, non-null value', () => {
    expect(validateScoreRange('80').valid).toBe(false);
    expect(validateScoreRange(undefined).valid).toBe(false);
    expect(validateScoreRange(NaN).valid).toBe(false);
  });
});

const participants = [
  { userId: 'user-a', displayName: 'Asha' },
  { userId: 'user-b', displayName: 'Bilal' },
];

const evidence = [
  {
    participantUserId: 'user-a',
    evidenceType: 'claim',
    exactQuote: 'remote work improves productivity',
    neutralDescription: 'States a position on remote work.',
  },
  {
    participantUserId: 'user-b',
    evidenceType: 'counterargument',
    exactQuote: 'collaboration suffers',
    neutralDescription: 'Raises a counterpoint about collaboration.',
  },
];

function geminiBodyWith(jsonObject) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(jsonObject) }] } }] };
}

function validSubdimension(overrides = {}) {
  return {
    subdimension_id: 'structure',
    level: 'demonstrated',
    evidence_ids: ['E1'],
    reasoning: 'Organized their point clearly before moving on.',
    ...overrides,
  };
}

function validParticipantEvaluations() {
  const subdimensionIds = ['structure', 'word_choice', 'conciseness'];
  return ['P1', 'P2'].map((tag) => ({
    participant_tag: tag,
    subdimensions: subdimensionIds.map((id) => validSubdimension({ subdimension_id: id })),
  }));
}

// Simulates geminiClient.generateCriterionEvaluation's contract: takes
// (prompt, parseContext), returns the already-parsed result, throws on an
// invalid response -- so this module's retry loop can be tested with no
// live Gemini key, same DI pattern the rest of SPEC-0011 uses.
function generateReturning(jsonObject) {
  return async (prompt, parseContext) => parseCriterionEvaluationResponse(geminiBodyWith(jsonObject), parseContext);
}

describe('evaluateCriterionWithValidation', () => {
  it('throws immediately on a bad rubric weight total, without ever calling generate (a rubric bug, not something a retry fixes)', async () => {
    const generate = vi.fn();
    await expect(
      evaluateCriterionWithValidation({ dimensionLabel: 'Not A Real Dimension', evidence, participants, generate })
    ).rejects.toThrow(/no rubric defined/i);
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns valid:true with retryCount 0 when the first response is valid', async () => {
    const generate = generateReturning({ participant_evaluations: validParticipantEvaluations() });
    const outcome = await evaluateCriterionWithValidation({ dimensionLabel: 'Clarity', evidence, participants, generate });
    expect(outcome.valid).toBe(true);
    expect(outcome.retryCount).toBe(0);
    expect(outcome.result.dimensionLabel).toBe('Clarity');
    expect(outcome.result.participantEvaluations).toHaveLength(2);
  });

  it('retries a flagged (invalid) response and succeeds once a later attempt is valid', async () => {
    const badEvaluations = validParticipantEvaluations();
    badEvaluations[0].subdimensions[0].level = 'excellent'; // invented level -> parse throws
    const generate = vi
      .fn()
      .mockImplementationOnce(async (prompt, parseContext) =>
        parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: badEvaluations }), parseContext)
      )
      .mockImplementationOnce(async (prompt, parseContext) =>
        parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: validParticipantEvaluations() }), parseContext)
      );

    const outcome = await evaluateCriterionWithValidation({ dimensionLabel: 'Clarity', evidence, participants, generate });
    expect(outcome.valid).toBe(true);
    expect(outcome.retryCount).toBe(1);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('gives up after exactly maxRetries (default 2) retries and returns a flagged issue instead of throwing', async () => {
    const badEvaluations = validParticipantEvaluations();
    badEvaluations[0].subdimensions[0].level = 'excellent';
    const generate = vi.fn(generateReturning({ participant_evaluations: badEvaluations }));

    const outcome = await evaluateCriterionWithValidation({ dimensionLabel: 'Clarity', evidence, participants, generate });

    expect(outcome.valid).toBe(false);
    expect(outcome.result).toBeNull();
    expect(outcome.retryCount).toBe(2);
    expect(generate).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(outcome.issue.dimensionLabel).toBe('Clarity');
    expect(outcome.issue.detail).toMatch(/invalid level/i);
  });

  it('honors a custom maxRetries', async () => {
    const badEvaluations = validParticipantEvaluations();
    badEvaluations[0].subdimensions[0].level = 'excellent';
    const generate = vi.fn(generateReturning({ participant_evaluations: badEvaluations }));

    const outcome = await evaluateCriterionWithValidation({
      dimensionLabel: 'Clarity',
      evidence,
      participants,
      generate,
      maxRetries: 0,
    });

    expect(outcome.valid).toBe(false);
    expect(outcome.retryCount).toBe(0);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('builds the prompt/parseContext once and passes the same one to every retry attempt (same criterion, not a broader re-ask)', async () => {
    const generate = vi.fn(generateReturning({ participant_evaluations: validParticipantEvaluations() }));
    await evaluateCriterionWithValidation({ dimensionLabel: 'Clarity', evidence, participants, generate });
    expect(generate).toHaveBeenCalledTimes(1);
    const [prompt, parseContext] = generate.mock.calls[0];
    expect(typeof prompt).toBe('string');
    expect(parseContext.dimensionLabel).toBe('Clarity');
  });
});
