// Shared feedback-contract constants (labels + list-length bound), kept here
// since domain/evaluationPipeline.js's new pipeline still imports both --
// see the SPEC-0011 AC9 note below for what moved out of this file.

// Fixed order/labels the model must score against, matching exactly what
// place-me-UI/src/lib/demo.ts's feedbackScores mock (and the real
// ScoreBar rows it renders) already expect -- the frontend never has to
// handle an unknown label because this list is exhaustive.
export const FEEDBACK_DIMENSION_LABELS = ['Content depth', 'Clarity', 'Confidence', 'Listening', 'Fluency'];

// Exported so other stages (state 7's evaluation feedback generation) can
// reuse the same list-length bound instead of duplicating the number.
export const MAX_LIST_ITEMS = 6;

// SPEC-0011 AC9 (chore/eval-cutover-cleanup, 2026-08-04): FEEDBACK_RESPONSE_SCHEMA/
// buildFeedbackPrompt/parseFeedbackResponse (the old single-shot scoring
// prompt/schema/parser) were removed once AC7's human verification passed --
// domain/evaluationPipeline.js is the only feedback-generation path now.
// FEEDBACK_DIMENSION_LABELS/MAX_LIST_ITEMS above remain: the new pipeline
// still imports both.
