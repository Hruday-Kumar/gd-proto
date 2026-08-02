// SPEC-0011 state 4 (feat/eval-score-aggregation): the Deterministic Score
// Aggregator. Pure functions only, no LLM calls -- this is the ONLY place in
// the pipeline that turns subdimension levels + evalRubric.js weights into a
// dimension or overall score (AC4: "the LLM output alone never contains a
// final score"; criterionEvaluationPrompt.js's schema has no score field for
// it to invent one into, this module supplies the missing arithmetic).
//
// R9 / evalRubric.js's LEVEL_MARK contract: not_observed/insufficient_context
// are excluded from the weighted average, never scored as 0 -- both here
// (subdimension -> dimension) and in aggregateOverallScore (dimension ->
// overall), so missing evidence never silently drags a score down.
import { LEVEL_MARK, getRubricForDimension } from './evalRubric.js';
import { FEEDBACK_DIMENSION_LABELS } from './feedbackPrompt.js';

function weightedAverage(items) {
  const scored = items.filter((item) => item.mark !== null);
  if (!scored.length) {
    return null;
  }
  const totalWeight = scored.reduce((sum, item) => sum + item.weight, 0);
  const weightedSum = scored.reduce((sum, item) => sum + item.weight * item.mark, 0);
  return weightedSum / totalWeight;
}

// subdimensions: [{ subdimensionId, level }], one entry per subdimension a
// criterion evaluator returned for a single participant on a single
// dimension (criterionEvaluationPrompt.js's parsed participantEvaluations
// entry) -- score, not note/evidence, is this function's only concern.
export function aggregateDimensionScore({ dimensionLabel, subdimensions }) {
  const rubric = getRubricForDimension(dimensionLabel);
  const weightById = new Map(rubric.subdimensions.map((s) => [s.id, s.weight]));

  const items = subdimensions.map(({ subdimensionId, level }) => {
    if (!weightById.has(subdimensionId)) {
      throw new Error(`aggregateDimensionScore: unknown subdimension "${subdimensionId}" for dimension "${dimensionLabel}"`);
    }
    if (!Object.prototype.hasOwnProperty.call(LEVEL_MARK, level)) {
      throw new Error(`aggregateDimensionScore: unknown level "${level}"`);
    }
    return { weight: weightById.get(subdimensionId), mark: LEVEL_MARK[level] };
  });

  return weightedAverage(items);
}

// dimensionScores: [{ label, score }], one entry per FEEDBACK_DIMENSION_LABELS
// dimension for a single participant. Equal-weighted across dimensions --
// SPEC-0011 only defines subdimension weights within a dimension, not
// cross-dimension weights, so this is the simplest deterministic function
// satisfying R4 (a code review / spec-amendment decision, not an invented
// requirement, since R4 requires *some* fixed function to exist).
export function aggregateOverallScore(dimensionScores) {
  const items = dimensionScores.map(({ score }) => ({ weight: 1, mark: score }));
  return weightedAverage(items);
}

// criterionResults: one parseCriterionEvaluationResponse-shaped object per
// FEEDBACK_DIMENSION_LABELS dimension -- { dimensionLabel, participantEvaluations:
// [{ participantUserId, subdimensions }] }. Returns one scorecard entry per
// participant: { participantUserId, dimensions: [{ label, score }], overallScore }.
// `note` (feedback text) is not this stage's concern -- that is state 7's
// Feedback Generation stage, reading this scorecard plus evidence.
export function aggregateScorecard(criterionResults) {
  const resultByLabel = new Map(criterionResults.map((r) => [r.dimensionLabel, r]));
  const resultLabels = new Set(resultByLabel.keys());
  const expectedLabels = new Set(FEEDBACK_DIMENSION_LABELS);
  if (resultLabels.size !== expectedLabels.size || ![...expectedLabels].every((l) => resultLabels.has(l))) {
    throw new Error('aggregateScorecard: criterionResults must cover exactly the five fixed FEEDBACK_DIMENSION_LABELS dimensions, no more, no fewer');
  }

  const participantIds = [
    ...new Set(criterionResults.flatMap((r) => r.participantEvaluations.map((p) => p.participantUserId))),
  ];

  return participantIds.map((participantUserId) => {
    const dimensions = FEEDBACK_DIMENSION_LABELS.map((dimensionLabel) => {
      const result = resultByLabel.get(dimensionLabel);
      const evaluation = result.participantEvaluations.find((p) => p.participantUserId === participantUserId);
      if (!evaluation) {
        throw new Error(`aggregateScorecard: participant "${participantUserId}" is missing from dimension "${dimensionLabel}"`);
      }
      return { label: dimensionLabel, score: aggregateDimensionScore({ dimensionLabel, subdimensions: evaluation.subdimensions }) };
    });

    return { participantUserId, dimensions, overallScore: aggregateOverallScore(dimensions) };
  });
}
