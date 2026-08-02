// SPEC-0011 state 4 (feat/eval-score-aggregation): the deterministic score
// aggregator is the ONLY place a dimension or overall score is computed --
// AC4 requires a unit test proving the LLM output alone never contains a
// final score (criterionEvaluationPrompt.test.js already asserts the schema
// has no score field); this file proves the other half, that this module's
// pure functions correctly turn subdimension levels + evalRubric.js weights
// into scores for every level/weight/insufficient-evidence combination.
import { describe, it, expect } from 'vitest';
import { EVAL_RUBRIC } from '../src/domain/evalRubric.js';
import { FEEDBACK_DIMENSION_LABELS } from '../src/domain/feedbackPrompt.js';
import {
  aggregateDimensionScore,
  aggregateOverallScore,
  aggregateScorecard,
} from '../src/domain/scoreAggregator.js';

// 'Content depth' subdimensions: relevance_to_topic (0.4), depth_of_reasoning
// (0.4), factual_soundness (0.2) -- used throughout as a fixed, known rubric
// to hand-verify weighted-average arithmetic against.
const DIMENSION = 'Content depth';

function subdimensions(levelById) {
  return Object.entries(levelById).map(([subdimensionId, level]) => ({ subdimensionId, level }));
}

describe('aggregateDimensionScore', () => {
  it('computes the full-weight average when every subdimension is demonstrated', () => {
    const score = aggregateDimensionScore({
      dimensionLabel: DIMENSION,
      subdimensions: subdimensions({
        relevance_to_topic: 'demonstrated',
        depth_of_reasoning: 'demonstrated',
        factual_soundness: 'demonstrated',
      }),
    });
    expect(score).toBe(100);
  });

  it('weights subdimensions by evalRubric.js weight, not equally', () => {
    // relevance_to_topic (0.4) + depth_of_reasoning (0.4) demonstrated (100),
    // factual_soundness (0.2) contradicted (20):
    // 0.4*100 + 0.4*100 + 0.2*20 = 84
    const score = aggregateDimensionScore({
      dimensionLabel: DIMENSION,
      subdimensions: subdimensions({
        relevance_to_topic: 'demonstrated',
        depth_of_reasoning: 'demonstrated',
        factual_soundness: 'contradicted',
      }),
    });
    expect(score).toBeCloseTo(84, 5);
  });

  it('handles partially_demonstrated (60) and contradicted (20) marks', () => {
    // 0.4*60 + 0.4*20 + 0.2*100 = 52
    const score = aggregateDimensionScore({
      dimensionLabel: DIMENSION,
      subdimensions: subdimensions({
        relevance_to_topic: 'partially_demonstrated',
        depth_of_reasoning: 'contradicted',
        factual_soundness: 'demonstrated',
      }),
    });
    expect(score).toBeCloseTo(52, 5);
  });

  it('excludes not_observed/insufficient_context from the average and renormalizes remaining weights, never scoring absence as 0', () => {
    // factual_soundness (0.2) excluded; remaining 0.4/0.8 + 0.4/0.8 both demonstrated -> 100
    const score = aggregateDimensionScore({
      dimensionLabel: DIMENSION,
      subdimensions: subdimensions({
        relevance_to_topic: 'demonstrated',
        depth_of_reasoning: 'demonstrated',
        factual_soundness: 'not_observed',
      }),
    });
    expect(score).toBeCloseTo(100, 5);

    // Same shape, but the non-excluded pair is a mix: renormalized weights
    // are 0.4/0.8 = 0.5 each -> 0.5*60 + 0.5*20 = 40
    const mixed = aggregateDimensionScore({
      dimensionLabel: DIMENSION,
      subdimensions: subdimensions({
        relevance_to_topic: 'partially_demonstrated',
        depth_of_reasoning: 'contradicted',
        factual_soundness: 'insufficient_context',
      }),
    });
    expect(mixed).toBeCloseTo(40, 5);
  });

  it('returns null, never 0, when every subdimension is not_observed or insufficient_context', () => {
    const score = aggregateDimensionScore({
      dimensionLabel: DIMENSION,
      subdimensions: subdimensions({
        relevance_to_topic: 'not_observed',
        depth_of_reasoning: 'insufficient_context',
        factual_soundness: 'not_observed',
      }),
    });
    expect(score).toBeNull();
  });

  it('throws on a subdimension id not defined in evalRubric.js for that dimension, rather than silently ignoring it', () => {
    expect(() =>
      aggregateDimensionScore({
        dimensionLabel: DIMENSION,
        subdimensions: subdimensions({ made_up_subdimension: 'demonstrated' }),
      })
    ).toThrow(/unknown subdimension/i);
  });

  it('throws on a level not in LEVEL_MARK, rather than silently treating it as absent', () => {
    expect(() =>
      aggregateDimensionScore({
        dimensionLabel: DIMENSION,
        subdimensions: subdimensions({ relevance_to_topic: 'vibes' }),
      })
    ).toThrow(/unknown level/i);
  });
});

describe('aggregateOverallScore', () => {
  it('averages all five dimension scores equally when every dimension has a score', () => {
    const overall = aggregateOverallScore([
      { label: 'Content depth', score: 80 },
      { label: 'Clarity', score: 70 },
      { label: 'Confidence', score: 60 },
      { label: 'Listening', score: 90 },
      { label: 'Fluency', score: 100 },
    ]);
    expect(overall).toBeCloseTo(80, 5);
  });

  it('excludes a null dimension score from the average and renormalizes, never scoring it as 0', () => {
    const overall = aggregateOverallScore([
      { label: 'Content depth', score: 90 },
      { label: 'Clarity', score: 70 },
      { label: 'Confidence', score: null },
      { label: 'Listening', score: null },
      { label: 'Fluency', score: 80 },
    ]);
    expect(overall).toBeCloseTo(80, 5);
  });

  it('returns null when every dimension score is null', () => {
    const overall = aggregateOverallScore([
      { label: 'Content depth', score: null },
      { label: 'Clarity', score: null },
      { label: 'Confidence', score: null },
      { label: 'Listening', score: null },
      { label: 'Fluency', score: null },
    ]);
    expect(overall).toBeNull();
  });
});

// Fixture matching the real shape of five parseCriterionEvaluationResponse
// outputs (one per FEEDBACK_DIMENSION_LABELS entry, criterionEvaluationPrompt.js)
// for two participants, to prove aggregateScorecard composes the two pure
// functions above per participant, across all five dimensions, correctly.
function fullyDemonstrated(dimensionLabel, participantUserId) {
  return {
    participantUserId,
    subdimensions: EVAL_RUBRIC[dimensionLabel].subdimensions.map((s) => ({
      subdimensionId: s.id,
      level: 'demonstrated',
    })),
  };
}

describe('aggregateScorecard', () => {
  it('produces a dimensions array (label + score) and overallScore per participant, from one criterion result per dimension', () => {
    const criterionResults = FEEDBACK_DIMENSION_LABELS.map((dimensionLabel) => ({
      dimensionLabel,
      participantEvaluations: [
        fullyDemonstrated(dimensionLabel, 'user-1'),
        fullyDemonstrated(dimensionLabel, 'user-2'),
      ],
    }));

    const scorecard = aggregateScorecard(criterionResults);

    expect(scorecard).toHaveLength(2);
    const user1 = scorecard.find((p) => p.participantUserId === 'user-1');
    expect(user1.dimensions).toEqual(FEEDBACK_DIMENSION_LABELS.map((label) => ({ label, score: 100 })));
    expect(user1.overallScore).toBe(100);
  });

  it('throws if a participant is missing from one of the per-dimension criterion results', () => {
    const criterionResults = FEEDBACK_DIMENSION_LABELS.map((dimensionLabel, index) => ({
      dimensionLabel,
      participantEvaluations:
        index === 0
          ? [fullyDemonstrated(dimensionLabel, 'user-1')]
          : [fullyDemonstrated(dimensionLabel, 'user-1'), fullyDemonstrated(dimensionLabel, 'user-2')],
    }));

    expect(() => aggregateScorecard(criterionResults)).toThrow(/missing/i);
  });

  it('throws if criterionResults does not cover exactly the five fixed dimensions', () => {
    const criterionResults = FEEDBACK_DIMENSION_LABELS.slice(0, 4).map((dimensionLabel) => ({
      dimensionLabel,
      participantEvaluations: [fullyDemonstrated(dimensionLabel, 'user-1')],
    }));

    expect(() => aggregateScorecard(criterionResults)).toThrow(/dimension/i);
  });
});
