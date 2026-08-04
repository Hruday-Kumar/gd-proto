// SPEC-0011 state 3 core unit: the rubric is the anchor set every
// criterion evaluator prompt is built from and every evaluator response is
// validated against -- a silent gap here (a missing dimension, a weight
// typo) would quietly corrupt every downstream score, so it gets its own
// direct test rather than relying only on criterionEvaluationPrompt tests.
import { describe, it, expect } from 'vitest';
import { FEEDBACK_DIMENSION_LABELS } from '../src/domain/feedbackPrompt.js';
import {
  EVAL_RUBRIC,
  SUBDIMENSION_LEVELS,
  LEVEL_MARK,
  getRubricForDimension,
  subdimensionIdsFor,
} from '../src/domain/evalRubric.js';

describe('EVAL_RUBRIC', () => {
  it('defines exactly the five fixed feedback dimensions, no more, no fewer', () => {
    expect(Object.keys(EVAL_RUBRIC).sort()).toEqual([...FEEDBACK_DIMENSION_LABELS].sort());
  });

  it('gives every dimension 2-3 subdimensions whose weights sum to 1.0', () => {
    for (const label of FEEDBACK_DIMENSION_LABELS) {
      const { subdimensions } = EVAL_RUBRIC[label];
      expect(subdimensions.length).toBeGreaterThanOrEqual(2);
      expect(subdimensions.length).toBeLessThanOrEqual(3);
      const total = subdimensions.reduce((sum, s) => sum + s.weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    }
  });

  it('gives every subdimension a unique id within its dimension and anchors for demonstrated/partially_demonstrated/contradicted', () => {
    for (const label of FEEDBACK_DIMENSION_LABELS) {
      const { subdimensions } = EVAL_RUBRIC[label];
      const ids = subdimensions.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of subdimensions) {
        expect(typeof s.label).toBe('string');
        expect(s.label.trim()).not.toBe('');
        for (const level of ['demonstrated', 'partially_demonstrated', 'contradicted']) {
          expect(typeof s.anchors[level]).toBe('string');
          expect(s.anchors[level].trim()).not.toBe('');
        }
      }
    }
  });

  it('has no duplicate subdimension ids across different dimensions', () => {
    const allIds = FEEDBACK_DIMENSION_LABELS.flatMap((label) => subdimensionIdsFor(label));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe('SUBDIMENSION_LEVELS / LEVEL_MARK', () => {
  it('defines exactly the five fixed levels from SPEC-0011', () => {
    expect(SUBDIMENSION_LEVELS).toEqual([
      'demonstrated',
      'partially_demonstrated',
      'not_observed',
      'contradicted',
      'insufficient_context',
    ]);
  });

  it('maps every level to a mark, with both absence levels excluded (null), never 0', () => {
    for (const level of SUBDIMENSION_LEVELS) {
      expect(Object.prototype.hasOwnProperty.call(LEVEL_MARK, level)).toBe(true);
    }
    expect(LEVEL_MARK.demonstrated).toBe(100);
    expect(LEVEL_MARK.partially_demonstrated).toBe(60);
    expect(LEVEL_MARK.contradicted).toBe(20);
    expect(LEVEL_MARK.not_observed).toBeNull();
    expect(LEVEL_MARK.insufficient_context).toBeNull();
  });
});

describe('getRubricForDimension / subdimensionIdsFor', () => {
  it('returns the rubric for a known dimension', () => {
    expect(getRubricForDimension('Clarity').subdimensions.length).toBeGreaterThan(0);
  });

  it('throws for an unknown dimension rather than returning undefined', () => {
    expect(() => getRubricForDimension('Vibes')).toThrow(/no rubric defined/i);
  });

  it('returns the subdimension ids in rubric order', () => {
    expect(subdimensionIdsFor('Fluency')).toEqual(['flow', 'vocabulary_range', 'pacing']);
  });
});
