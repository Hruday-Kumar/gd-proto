// SPEC-0011 state 6 (feat/eval-confidence-score): the Confidence
// Calculator. Pure functions only, no LLM calls -- R6 requires confidence
// to come only from measurable pipeline signals, never asked of the LLM
// directly. Every input here is something an earlier stage already
// produced:
//   - transcript integrity / speaker attribution: evidenceVerifier.js's
//     verified/rejected buckets for the room's evidence ledger (state 2).
//   - evidence sufficiency: how many of a participant's subdimension
//     levels (criterionEvaluationPrompt.js's parsed output, state 3)
//     actually landed on an evidence-backed level rather than
//     not_observed/insufficient_context.
//   - validation success: evaluateCriterionWithValidation's per-dimension
//     {valid, retryCount} outcomes (state 5).
//
// R6 names exactly these four components. The 0019 migration's
// evaluation_confidence.components comment additionally lists
// "execution_quality" as an illustrative example -- that is orchestration
// -level (did the run complete without error, within budget), not a
// pure pipeline-stage signal this module has access to, so it is left to
// state 7's feedbackWorker.js wiring rather than fabricated here; flagged,
// not hidden, same as state 4's equal-weighting decision.
import { FEEDBACK_DIMENSION_LABELS } from './feedbackPrompt.js';
import { DEFAULT_MAX_RETRIES } from './validationLayer.js';

const ATTRIBUTION_REJECTION_REASON = 'utterance indexes span multiple speakers';
const INSUFFICIENT_EVIDENCE_LEVELS = new Set(['not_observed', 'insufficient_context']);

export const CONFIDENCE_COMPONENT_WEIGHT = {
  transcriptIntegrity: 0.25,
  speakerAttribution: 0.25,
  evidenceSufficiency: 0.25,
  validationSuccess: 0.25,
};

// 100 when nothing of that kind was attempted at all -- no evidence to
// fail is not itself evidence of a problem.
function safeRatio(passCount, failCount) {
  const total = passCount + failCount;
  return total === 0 ? 100 : (100 * passCount) / total;
}

// rejected: verifyEvidenceLedger's `rejected` array ({ item, reason }[]),
// room-wide (the evidence ledger is produced once per room, state 2) --
// every participant in the same run starts from the same ledger quality.
// Splits evidenceVerifier.js's rejection reasons into the two components
// below: a crossed-speaker-boundary rejection is an attribution signal,
// everything else (fabricated quote, out-of-range index, malformed item)
// is a general integrity signal.
export function bucketEvidenceRejections(rejected) {
  let attributionRejectedCount = 0;
  let integrityRejectedCount = 0;
  for (const { reason } of rejected) {
    if (reason === ATTRIBUTION_REJECTION_REASON) {
      attributionRejectedCount += 1;
    } else {
      integrityRejectedCount += 1;
    }
  }
  return { attributionRejectedCount, integrityRejectedCount };
}

// General quote/index accuracy of the room's evidence ledger.
export function computeTranscriptIntegrityComponent({ verifiedCount, integrityRejectedCount }) {
  return safeRatio(verifiedCount, integrityRejectedCount);
}

// How often an evidence item's utterances crossed a speaker boundary.
// Attribution itself is derived from transcript_lines.userId, never
// claimed by the model (evidenceVerifier.js), so this measures how often
// the Transcript Analysis stage drew an evidence boundary the verifier
// could not attribute to one speaker -- independent of quote fabrication.
export function computeSpeakerAttributionComponent({ verifiedCount, attributionRejectedCount }) {
  return safeRatio(verifiedCount, attributionRejectedCount);
}

// levels: one participant's subdimension levels across all five
// dimensions (criterionEvaluationPrompt.js's parsed subdimensions,
// flattened) -- the fraction that actually landed on evidence rather than
// not_observed/insufficient_context. Mirrors R9: absence of evidence is
// never scored as a failure, but it does lower confidence, since less of
// the scorecard is evidence-backed.
export function computeEvidenceSufficiencyComponent(levels) {
  if (!levels.length) {
    throw new Error('computeEvidenceSufficiencyComponent: levels must not be empty');
  }
  const sufficientCount = levels.filter((level) => !INSUFFICIENT_EVIDENCE_LEVELS.has(level)).length;
  return (100 * sufficientCount) / levels.length;
}

// results: this run's per-dimension { valid, retryCount } outcomes from
// validationLayer.js's evaluateCriterionWithValidation. A dimension that
// validated cleanly (retryCount 0) scores 100; each retry needed lowers
// that dimension's contribution; an exhausted/flagged dimension
// (valid: false) scores 0. Averaged equally across dimensions, room-wide
// (like the two evidence-ledger components above -- validation runs once
// per dimension for the whole room, not once per participant).
export function computeValidationSuccessComponent(results, maxRetries = DEFAULT_MAX_RETRIES) {
  if (!results.length) {
    throw new Error('computeValidationSuccessComponent: results must not be empty');
  }
  const scores = results.map(({ valid, retryCount }) =>
    valid ? (100 * (maxRetries - retryCount + 1)) / (maxRetries + 1) : 0
  );
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

// Weighted average of the four components per CONFIDENCE_COMPONENT_WEIGHT,
// rounded to the nearest integer since evaluation_confidence.confidence is
// an integer column.
export function aggregateConfidence(components) {
  const weightedSum = Object.entries(CONFIDENCE_COMPONENT_WEIGHT).reduce(
    (sum, [key, weight]) => sum + weight * components[key],
    0
  );
  return Math.round(weightedSum);
}

// evidenceVerification: state 2's verifyEvidenceLedger output for this
// run ({ verified, rejected }). criterionResults: same shape
// scoreAggregator.js's aggregateScorecard takes -- one
// parseCriterionEvaluationResponse-shaped object per
// FEEDBACK_DIMENSION_LABELS dimension. validationResults: this run's
// per-dimension evaluateCriterionWithValidation outcomes
// ({ dimensionLabel, valid, retryCount }). Returns one entry per
// participant: { participantUserId, confidence, components }, ready for a
// later state to persist to evaluation_confidence -- this function itself
// is pure and does no I/O.
export function computeConfidenceForRun({ evidenceVerification, criterionResults, validationResults }) {
  const resultByLabel = new Map(criterionResults.map((r) => [r.dimensionLabel, r]));
  const resultLabels = new Set(resultByLabel.keys());
  const expectedLabels = new Set(FEEDBACK_DIMENSION_LABELS);
  if (resultLabels.size !== expectedLabels.size || ![...expectedLabels].every((l) => resultLabels.has(l))) {
    throw new Error(
      'computeConfidenceForRun: criterionResults must cover exactly the five fixed FEEDBACK_DIMENSION_LABELS dimensions, no more, no fewer'
    );
  }

  const { attributionRejectedCount, integrityRejectedCount } = bucketEvidenceRejections(evidenceVerification.rejected);
  const verifiedCount = evidenceVerification.verified.length;
  const transcriptIntegrity = computeTranscriptIntegrityComponent({ verifiedCount, integrityRejectedCount });
  const speakerAttribution = computeSpeakerAttributionComponent({ verifiedCount, attributionRejectedCount });
  const validationSuccess = computeValidationSuccessComponent(validationResults);

  const participantIds = [
    ...new Set(criterionResults.flatMap((r) => r.participantEvaluations.map((p) => p.participantUserId))),
  ];

  return participantIds.map((participantUserId) => {
    const levels = FEEDBACK_DIMENSION_LABELS.flatMap((dimensionLabel) => {
      const result = resultByLabel.get(dimensionLabel);
      const evaluation = result.participantEvaluations.find((p) => p.participantUserId === participantUserId);
      if (!evaluation) {
        throw new Error(`computeConfidenceForRun: participant "${participantUserId}" is missing from dimension "${dimensionLabel}"`);
      }
      return evaluation.subdimensions.map((s) => s.level);
    });

    const components = {
      transcriptIntegrity,
      speakerAttribution,
      evidenceSufficiency: computeEvidenceSufficiencyComponent(levels),
      validationSuccess,
    };

    return { participantUserId, confidence: aggregateConfidence(components), components };
  });
}
