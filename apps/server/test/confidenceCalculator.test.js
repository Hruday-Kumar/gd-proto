// SPEC-0011 state 6 (feat/eval-confidence-score): the Confidence Calculator
// is pure functions only, no LLM calls -- R6/AC6 require confidence to come
// only from measurable pipeline signals (evidenceVerifier.js's state-2
// verified/rejected ledger, criterionEvaluationPrompt.js's state-3
// subdimension levels, validationLayer.js's state-5 retry outcomes), never
// asked of the LLM directly.
import { describe, it, expect } from 'vitest';
import { EVAL_RUBRIC } from '../src/domain/evalRubric.js';
import { FEEDBACK_DIMENSION_LABELS } from '../src/domain/feedbackPrompt.js';
import {
  CONFIDENCE_COMPONENT_WEIGHT,
  bucketEvidenceRejections,
  computeTranscriptIntegrityComponent,
  computeSpeakerAttributionComponent,
  computeEvidenceSufficiencyComponent,
  computeValidationSuccessComponent,
  aggregateConfidence,
  computeConfidenceForRun,
} from '../src/domain/confidenceCalculator.js';

describe('bucketEvidenceRejections', () => {
  it('buckets the multi-speaker rejection reason as attribution, everything else as integrity', () => {
    const rejected = [
      { item: {}, reason: 'utterance indexes span multiple speakers' },
      { item: {}, reason: 'exact_quote not found in the referenced utterance text' },
      { item: {}, reason: 'utterance index out of range' },
      { item: {}, reason: 'utterance indexes span multiple speakers' },
    ];
    expect(bucketEvidenceRejections(rejected)).toEqual({
      attributionRejectedCount: 2,
      integrityRejectedCount: 2,
    });
  });

  it('returns zero counts for an empty rejection list', () => {
    expect(bucketEvidenceRejections([])).toEqual({ attributionRejectedCount: 0, integrityRejectedCount: 0 });
  });
});

describe('computeTranscriptIntegrityComponent', () => {
  it('is 100 when nothing was rejected', () => {
    expect(computeTranscriptIntegrityComponent({ verifiedCount: 10, integrityRejectedCount: 0 })).toBe(100);
  });

  it('is 100 when nothing was attempted at all (no evidence to fail is not evidence of a problem)', () => {
    expect(computeTranscriptIntegrityComponent({ verifiedCount: 0, integrityRejectedCount: 0 })).toBe(100);
  });

  it('scales down proportionally to the integrity rejection rate', () => {
    expect(computeTranscriptIntegrityComponent({ verifiedCount: 3, integrityRejectedCount: 1 })).toBe(75);
  });
});

describe('computeSpeakerAttributionComponent', () => {
  it('is 100 when nothing was rejected for crossing a speaker boundary', () => {
    expect(computeSpeakerAttributionComponent({ verifiedCount: 8, attributionRejectedCount: 0 })).toBe(100);
  });

  it('scales down proportionally to the attribution rejection rate, independent of integrity rejections', () => {
    expect(computeSpeakerAttributionComponent({ verifiedCount: 8, attributionRejectedCount: 2 })).toBe(80);
  });
});

describe('computeEvidenceSufficiencyComponent', () => {
  it('is 100 when every level is evidence-backed', () => {
    const levels = ['demonstrated', 'partially_demonstrated', 'contradicted'];
    expect(computeEvidenceSufficiencyComponent(levels)).toBe(100);
  });

  it('excludes not_observed/insufficient_context from the "sufficient" count', () => {
    const levels = ['demonstrated', 'not_observed', 'insufficient_context', 'contradicted'];
    expect(computeEvidenceSufficiencyComponent(levels)).toBe(50);
  });

  it('is 0 when every level is not_observed or insufficient_context', () => {
    expect(computeEvidenceSufficiencyComponent(['not_observed', 'insufficient_context'])).toBe(0);
  });

  it('throws on an empty levels array rather than dividing by zero silently', () => {
    expect(() => computeEvidenceSufficiencyComponent([])).toThrow(/empty/i);
  });
});

describe('computeValidationSuccessComponent', () => {
  it('scores a clean pass (retryCount 0) as 100', () => {
    expect(computeValidationSuccessComponent([{ valid: true, retryCount: 0 }])).toBe(100);
  });

  it('scores a passing-but-retried criterion lower than a clean one, proportional to retries used of maxRetries', () => {
    // maxRetries defaults to validationLayer.js's DEFAULT_MAX_RETRIES (2):
    // retryCount 1 of 2 -> 100 * (2 - 1 + 1) / 3 = 66.67
    expect(computeValidationSuccessComponent([{ valid: true, retryCount: 1 }])).toBeCloseTo(66.6667, 3);
  });

  it('scores an exhausted/flagged criterion (valid: false) as 0 regardless of retryCount', () => {
    expect(computeValidationSuccessComponent([{ valid: false, retryCount: 2 }])).toBe(0);
  });

  it('averages across multiple dimensions equally', () => {
    const results = [
      { valid: true, retryCount: 0 },
      { valid: false, retryCount: 2 },
    ];
    expect(computeValidationSuccessComponent(results)).toBe(50);
  });

  it('throws on an empty results array rather than dividing by zero silently', () => {
    expect(() => computeValidationSuccessComponent([])).toThrow(/empty/i);
  });
});

describe('aggregateConfidence', () => {
  it('weights all four named components equally, summing to 1.0', () => {
    const total = Object.values(CONFIDENCE_COMPONENT_WEIGHT).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('averages the four components per CONFIDENCE_COMPONENT_WEIGHT, rounded to the nearest integer', () => {
    const confidence = aggregateConfidence({
      transcriptIntegrity: 100,
      speakerAttribution: 90,
      evidenceSufficiency: 80,
      validationSuccess: 70,
    });
    // (100 + 90 + 80 + 70) / 4 = 85
    expect(confidence).toBe(85);
  });

  it('is 100 when every component is 100', () => {
    expect(
      aggregateConfidence({
        transcriptIntegrity: 100,
        speakerAttribution: 100,
        evidenceSufficiency: 100,
        validationSuccess: 100,
      })
    ).toBe(100);
  });
});

// Fixture matching the real shapes state 2 (verifyEvidenceLedger), state 3
// (criterionEvaluationPrompt.js's parsed participantEvaluations), and
// state 5 (evaluateCriterionWithValidation) actually produce, to prove
// computeConfidenceForRun composes all three into a per-participant
// confidence + component breakdown.
function fullyDemonstrated(dimensionLabel, participantUserId) {
  return {
    participantUserId,
    subdimensions: EVAL_RUBRIC[dimensionLabel].subdimensions.map((s) => ({
      subdimensionId: s.id,
      level: 'demonstrated',
    })),
  };
}

function cleanValidationResults() {
  return FEEDBACK_DIMENSION_LABELS.map((dimensionLabel) => ({ dimensionLabel, valid: true, retryCount: 0 }));
}

describe('computeConfidenceForRun', () => {
  it('returns one entry per participant with confidence 100 when the pipeline is clean end to end', () => {
    const criterionResults = FEEDBACK_DIMENSION_LABELS.map((dimensionLabel) => ({
      dimensionLabel,
      participantEvaluations: [
        fullyDemonstrated(dimensionLabel, 'user-1'),
        fullyDemonstrated(dimensionLabel, 'user-2'),
      ],
    }));

    const result = computeConfidenceForRun({
      evidenceVerification: { verified: [{}, {}, {}], rejected: [] },
      criterionResults,
      validationResults: cleanValidationResults(),
    });

    expect(result).toHaveLength(2);
    const user1 = result.find((r) => r.participantUserId === 'user-1');
    expect(user1.confidence).toBe(100);
    expect(user1.components).toEqual({
      transcriptIntegrity: 100,
      speakerAttribution: 100,
      evidenceSufficiency: 100,
      validationSuccess: 100,
    });
  });

  it('applies the same room-wide evidence/validation components to every participant, but per-participant evidence sufficiency', () => {
    const criterionResults = FEEDBACK_DIMENSION_LABELS.map((dimensionLabel) => ({
      dimensionLabel,
      participantEvaluations: [
        fullyDemonstrated(dimensionLabel, 'user-1'),
        {
          participantUserId: 'user-2',
          subdimensions: EVAL_RUBRIC[dimensionLabel].subdimensions.map((s) => ({
            subdimensionId: s.id,
            level: 'not_observed',
          })),
        },
      ],
    }));

    const result = computeConfidenceForRun({
      evidenceVerification: { verified: [{}, {}], rejected: [] },
      criterionResults,
      validationResults: cleanValidationResults(),
    });

    const user1 = result.find((r) => r.participantUserId === 'user-1');
    const user2 = result.find((r) => r.participantUserId === 'user-2');
    expect(user1.components.evidenceSufficiency).toBe(100);
    expect(user2.components.evidenceSufficiency).toBe(0);
    expect(user1.components.transcriptIntegrity).toBe(user2.components.transcriptIntegrity);
    expect(user1.confidence).toBeGreaterThan(user2.confidence);
  });

  it('throws if criterionResults does not cover exactly the five fixed dimensions', () => {
    const criterionResults = FEEDBACK_DIMENSION_LABELS.slice(0, 4).map((dimensionLabel) => ({
      dimensionLabel,
      participantEvaluations: [fullyDemonstrated(dimensionLabel, 'user-1')],
    }));

    expect(() =>
      computeConfidenceForRun({
        evidenceVerification: { verified: [], rejected: [] },
        criterionResults,
        validationResults: cleanValidationResults(),
      })
    ).toThrow(/dimension/i);
  });

  it('throws if a participant is missing from one of the per-dimension criterion results', () => {
    const criterionResults = FEEDBACK_DIMENSION_LABELS.map((dimensionLabel, index) => ({
      dimensionLabel,
      participantEvaluations:
        index === 0
          ? [fullyDemonstrated(dimensionLabel, 'user-1')]
          : [fullyDemonstrated(dimensionLabel, 'user-1'), fullyDemonstrated(dimensionLabel, 'user-2')],
    }));

    expect(() =>
      computeConfidenceForRun({
        evidenceVerification: { verified: [], rejected: [] },
        criterionResults,
        validationResults: cleanValidationResults(),
      })
    ).toThrow(/missing/i);
  });
});
