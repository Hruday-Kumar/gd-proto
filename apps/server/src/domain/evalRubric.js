// SPEC-0011 state 3 (feat/eval-criterion-scoring): the rubric definition
// for the redesigned evaluation pipeline. Versioned as code, reviewed like
// any other PR -- explicitly NOT a runtime-editable registry (SPEC-0011's
// "what this spec does not adopt" list).
//
// Each of the five existing feedback dimensions (domain/feedbackPrompt.js's
// FEEDBACK_DIMENSION_LABELS, unchanged -- the frontend contract stays fixed)
// is broken into 2-3 observable subdimensions with anchor descriptions per
// level, replacing an invented 0-100 number with something a criterion
// evaluator can actually ground in evidence. Weights sum to 1.0 within each
// dimension (asserted by test/evalRubric.test.js, not at runtime, since a
// bad weight is a code review defect, not a live-traffic failure mode).
//
// LEVEL_MARK is the deterministic level -> percentage mapping described in
// SPEC-0011's Design section. It is exported here (rubric-owned data) but
// NOT applied here -- state 4's aggregator (feat/eval-score-aggregation) is
// the only place weights + marks are actually combined into a dimension or
// overall score. Keeping that math out of this file is what makes AC4's
// "the LLM output alone never contains a final score" trivially true: this
// module only ever describes the rubric, never computes with it.
import { FEEDBACK_DIMENSION_LABELS } from './feedbackPrompt.js';

// R3/R4: the only levels a criterion evaluator may ever assign. No numeric
// score is ever a valid level -- that is what schema validation in
// criterionEvaluationPrompt.js rejects an invented level for.
export const SUBDIMENSION_LEVELS = [
  'demonstrated',
  'partially_demonstrated',
  'not_observed',
  'contradicted',
  'insufficient_context',
];

// R9: missing evidence is never scored like negative evidence -- both
// "absence" levels map to null (excluded from the weighted average by
// state 4's aggregator), never to 0.
export const LEVEL_MARK = {
  demonstrated: 100,
  partially_demonstrated: 60,
  contradicted: 20,
  not_observed: null,
  insufficient_context: null,
};

export const EVAL_RUBRIC = {
  'Content depth': {
    subdimensions: [
      {
        id: 'relevance_to_topic',
        label: 'Relevance to topic',
        weight: 0.4,
        anchors: {
          demonstrated: 'Contributions clearly and consistently address the stated discussion topic.',
          partially_demonstrated: 'Contributions are mostly on-topic, with some tangents or drift.',
          contradicted: 'Contributions repeatedly ignore or contradict the stated topic.',
        },
      },
      {
        id: 'depth_of_reasoning',
        label: 'Depth of support/reasoning',
        weight: 0.4,
        anchors: {
          demonstrated: 'Claims are backed with reasons, examples, or evidence.',
          partially_demonstrated: 'Some claims are backed with reasons; others are asserted without support.',
          contradicted: 'Reasoning is self-contradictory or does not follow from the claim it supports.',
        },
      },
      {
        id: 'factual_soundness',
        label: 'Factual soundness',
        weight: 0.2,
        anchors: {
          demonstrated: 'Factual claims made are accurate or plausible.',
          partially_demonstrated: 'A mix of accurate and questionable factual claims.',
          contradicted: 'Confidently asserts a factual claim that is clearly false or self-contradicted elsewhere in the session.',
        },
      },
    ],
  },
  Clarity: {
    subdimensions: [
      {
        id: 'structure',
        label: 'Structure',
        weight: 0.4,
        anchors: {
          demonstrated: 'Points are organized and easy to follow from one to the next.',
          partially_demonstrated: 'Some organization is present, but occasionally hard to follow.',
          contradicted: 'Contributions are rambling or incoherent, actively confusing to follow.',
        },
      },
      {
        id: 'word_choice',
        label: 'Word choice',
        weight: 0.3,
        anchors: {
          demonstrated: 'Language is precise and accessible.',
          partially_demonstrated: 'Mostly clear language, with occasional vague or ambiguous phrasing.',
          contradicted: 'Language is so vague or garbled the point cannot be recovered.',
        },
      },
      {
        id: 'conciseness',
        label: 'Conciseness',
        weight: 0.3,
        anchors: {
          demonstrated: 'Makes points without unnecessary repetition.',
          partially_demonstrated: 'Some redundancy or rambling before reaching the point.',
          contradicted: 'Excessively repetitive, to the point of obscuring the point being made.',
        },
      },
    ],
  },
  Confidence: {
    subdimensions: [
      {
        id: 'assertiveness',
        label: 'Assertiveness',
        weight: 0.4,
        anchors: {
          demonstrated: 'States positions directly and owns them.',
          partially_demonstrated: 'States positions but hedges heavily.',
          contradicted: 'Repeatedly abandons or reverses a stated position with no new reasoning offered.',
        },
      },
      {
        id: 'initiative',
        label: 'Initiative',
        weight: 0.3,
        anchors: {
          demonstrated: 'Proactively introduces points or redirects the discussion.',
          partially_demonstrated: 'Occasionally proactive, mostly reactive to others.',
          contradicted: 'Never initiates; only responds reluctantly when directly addressed.',
        },
      },
      {
        id: 'composure_under_challenge',
        label: 'Composure under challenge',
        weight: 0.3,
        anchors: {
          demonstrated: 'Responds to disagreement or counterarguments steadily and substantively.',
          partially_demonstrated: 'Responds to challenge, but somewhat defensively or unevenly.',
          contradicted: 'Abandons a position immediately when challenged, with no substantive response, or reacts dismissively.',
        },
      },
    ],
  },
  Listening: {
    subdimensions: [
      {
        id: 'acknowledgment',
        label: 'Acknowledgment',
        weight: 0.4,
        anchors: {
          demonstrated: "Explicitly references or builds on other participants' points.",
          partially_demonstrated: 'Occasionally acknowledges other participants; often speaks as if in isolation.',
          contradicted: "Talks over or repeats own points regardless of what others just said.",
        },
      },
      {
        id: 'responsiveness',
        label: 'Responsiveness',
        weight: 0.3,
        anchors: {
          demonstrated: 'Directly responds to questions or challenges raised by others.',
          partially_demonstrated: 'Responds to some questions or challenges, partially or after delay.',
          contradicted: 'Never responds to a direct question or challenge raised to them.',
        },
      },
      {
        id: 'turn_taking',
        label: 'Turn-taking',
        weight: 0.3,
        anchors: {
          demonstrated: 'Allows others to speak; does not dominate or interrupt.',
          partially_demonstrated: 'Occasionally interrupts or dominates the floor.',
          contradicted: 'Repeatedly interrupts or dominates the floor, preventing others from contributing.',
        },
      },
    ],
  },
  Fluency: {
    subdimensions: [
      {
        id: 'flow',
        label: 'Flow',
        weight: 0.4,
        anchors: {
          demonstrated: 'Speech is smooth, with few false starts or filler words.',
          partially_demonstrated: 'Some hesitations or filler words, but not disruptive.',
          contradicted: 'Severe stammering or false starts that impede communication.',
        },
      },
      {
        id: 'vocabulary_range',
        label: 'Vocabulary range',
        weight: 0.3,
        anchors: {
          demonstrated: 'Varied, appropriate vocabulary for the topic.',
          partially_demonstrated: 'Adequate but repetitive vocabulary.',
          contradicted: 'Vocabulary is so limited or misused that it impedes understanding.',
        },
      },
      {
        id: 'pacing',
        label: 'Pacing',
        weight: 0.3,
        anchors: {
          demonstrated: 'Pacing supports understanding -- neither rushed nor dragging.',
          partially_demonstrated: 'Pacing is occasionally too fast or too slow.',
          contradicted: 'Pacing consistently makes the contribution hard to follow.',
        },
      },
    ],
  },
};

export function getRubricForDimension(dimensionLabel) {
  const rubric = EVAL_RUBRIC[dimensionLabel];
  if (!rubric) {
    throw new Error(`No rubric defined for dimension "${dimensionLabel}"`);
  }
  return rubric;
}

export function subdimensionIdsFor(dimensionLabel) {
  return getRubricForDimension(dimensionLabel).subdimensions.map((s) => s.id);
}

// Sanity check every dimension label from the frontend-facing contract has
// a rubric entry, and vice versa -- run at module load (cheap, pure) rather
// than only in a test, so a future dimension-label change can't silently
// leave the rubric out of sync.
const rubricLabels = Object.keys(EVAL_RUBRIC);
if (rubricLabels.length !== FEEDBACK_DIMENSION_LABELS.length || !FEEDBACK_DIMENSION_LABELS.every((l) => rubricLabels.includes(l))) {
  throw new Error('EVAL_RUBRIC dimension labels must exactly match FEEDBACK_DIMENSION_LABELS');
}
