// SPEC-0011 state 7 (feat/eval-feedback-decoupled): runEvaluationPipeline
// composes every prior state into the pipeline SPEC-0011's Design section
// describes -- Transcript Analysis (state 2) -> deterministic evidence
// verification (state 2) -> five Criterion Evaluators with bounded
// validation retry (states 3/5) -> deterministic score aggregation
// (state 4) -> confidence (state 6) -> per-participant Feedback Generation
// (this state). Every Gemini call is injected, so this is fully testable
// without a live key -- same DI pattern as domain/feedbackGeneration.js.
import { describe, it, expect } from 'vitest';
import { FEEDBACK_DIMENSION_LABELS } from '../src/domain/feedbackPrompt.js';
import { TRANSCRIPTION_FAILED_MESSAGE } from '../src/domain/feedbackGeneration.js';
import { subdimensionIdsFor } from '../src/domain/evalRubric.js';
import { hashTranscript, PROMPT_BUNDLE_VERSION, runEvaluationPipeline } from '../src/domain/evaluationPipeline.js';

const participants = [
  { userId: 'user-a', displayName: 'Asha' },
  { userId: 'user-b', displayName: 'Bilal' },
];

const transcriptLines = [
  { id: 'line-1', userId: 'user-a', text: 'Remote work improves productivity.', startedAtMs: 0, endedAtMs: 2000 },
  { id: 'line-2', userId: 'user-b', text: 'I disagree, it isolates people.', startedAtMs: 2000, endedAtMs: 4000 },
];

function cleanAnalysisResult() {
  return {
    conversationUnderstanding: { summary: 'Discussed remote work tradeoffs.', topicSegments: [] },
    evidenceLedger: [
      {
        utteranceIndexes: [0],
        relatedUtteranceIndexes: [],
        evidenceType: 'claim',
        exactQuote: 'Remote work improves productivity.',
        neutralDescription: 'States a claim about remote work.',
        topicSegmentId: null,
        extractionConfidence: 'high',
      },
      {
        utteranceIndexes: [1],
        relatedUtteranceIndexes: [0],
        evidenceType: 'disagreement',
        exactQuote: 'I disagree, it isolates people.',
        neutralDescription: 'Disagrees with the prior point.',
        topicSegmentId: null,
        extractionConfidence: 'high',
      },
    ],
  };
}

function fabricatedAnalysisResult() {
  return {
    conversationUnderstanding: { summary: 'Discussed remote work tradeoffs.', topicSegments: [] },
    evidenceLedger: [
      {
        utteranceIndexes: [0],
        relatedUtteranceIndexes: [],
        evidenceType: 'claim',
        exactQuote: 'this quote was never actually said',
        neutralDescription: 'States a claim.',
        topicSegmentId: null,
        extractionConfidence: 'high',
      },
    ],
  };
}

// Every participant fully demonstrated on every subdimension of the given
// dimension, citing the first evidence id offered -- a deterministic
// "clean pass" stand-in for a real Gemini response, same fixture role as
// scoreAggregator.test.js's fullyDemonstrated helper.
function demonstratedResultFor(parseContext) {
  return {
    dimensionLabel: parseContext.dimensionLabel,
    participantEvaluations: Object.entries(parseContext.tagToUserId).map(([, userId]) => ({
      participantUserId: userId,
      subdimensions: parseContext.subdimensionIds.map((subdimensionId) => ({
        subdimensionId,
        level: 'demonstrated',
        evidenceIds: [parseContext.evidenceIds[0]],
        reasoning: 'Grounded in the cited evidence.',
      })),
    })),
  };
}

function cleanCriterionEvaluationFn() {
  return async (_prompt, parseContext) => demonstratedResultFor(parseContext);
}

function cleanEvaluationFeedbackFn() {
  return async (_prompt, { dimensionLabels }) => ({
    summary: 'A constructive summary.',
    dimensionNotes: dimensionLabels.map((label) => ({ label, note: `Note about ${label}.` })),
    strengths: ['Clear opening.'],
    improvements: ['Invite others in more.'],
  });
}

describe('hashTranscript', () => {
  it('is deterministic for the same transcript', () => {
    expect(hashTranscript(transcriptLines)).toBe(hashTranscript(transcriptLines));
  });

  it('differs when the transcript content differs', () => {
    const other = [{ ...transcriptLines[0], text: 'different text' }, transcriptLines[1]];
    expect(hashTranscript(transcriptLines)).not.toBe(hashTranscript(other));
  });
});

describe('PROMPT_BUNDLE_VERSION', () => {
  it('is a non-empty version string', () => {
    expect(typeof PROMPT_BUNDLE_VERSION).toBe('string');
    expect(PROMPT_BUNDLE_VERSION.length).toBeGreaterThan(0);
  });
});

describe('runEvaluationPipeline', () => {
  it('short-circuits to the transcription-failed message for every participant when the transcript is empty, without calling any Gemini stage', async () => {
    const generateTranscriptAnalysisFn = async () => {
      throw new Error('must not be called');
    };
    const outcome = await runEvaluationPipeline(
      { topic: 'Remote work', transcriptLines: [], participants },
      { generateTranscriptAnalysisFn, generateCriterionEvaluationFn: cleanCriterionEvaluationFn(), generateEvaluationFeedbackFn: cleanEvaluationFeedbackFn() }
    );
    expect(outcome.status).toBe('no_transcript');
    expect(outcome.results).toEqual(
      participants.map(({ userId }) => ({
        userId,
        status: 'ok',
        body: { summary: TRANSCRIPTION_FAILED_MESSAGE, score: null, dimensions: [], strengths: [], improvements: [] },
      }))
    );
  });

  it('falls back to the same technical-issue message for every participant when no evidence survives verification, without calling criterion evaluation or feedback generation', async () => {
    const criterionCalls = [];
    const outcome = await runEvaluationPipeline(
      { topic: 'Remote work', transcriptLines, participants },
      {
        generateTranscriptAnalysisFn: async () => fabricatedAnalysisResult(),
        generateCriterionEvaluationFn: async (...args) => {
          criterionCalls.push(args);
          throw new Error('must not be called');
        },
        generateEvaluationFeedbackFn: async () => {
          throw new Error('must not be called');
        },
      }
    );
    expect(outcome.status).toBe('insufficient_evidence');
    expect(criterionCalls).toHaveLength(0);
    expect(outcome.results.every((r) => r.body.summary === TRANSCRIPTION_FAILED_MESSAGE)).toBe(true);
    expect(outcome.evidenceVerification.verified).toHaveLength(0);
    expect(outcome.evidenceVerification.rejected).toHaveLength(1);
  });

  it('produces a full scorecard + confidence + feedback per participant end to end when every stage is clean', async () => {
    const outcome = await runEvaluationPipeline(
      { topic: 'Remote work', transcriptLines, participants },
      {
        generateTranscriptAnalysisFn: async () => cleanAnalysisResult(),
        generateCriterionEvaluationFn: cleanCriterionEvaluationFn(),
        generateEvaluationFeedbackFn: cleanEvaluationFeedbackFn(),
      }
    );

    expect(outcome.status).toBe('ok');
    expect(outcome.results).toHaveLength(2);
    expect(outcome.criterionResults).toHaveLength(FEEDBACK_DIMENSION_LABELS.length);
    expect(outcome.validationResults).toEqual(
      FEEDBACK_DIMENSION_LABELS.map((dimensionLabel) => ({ dimensionLabel, valid: true, retryCount: 0 }))
    );

    const ashaResult = outcome.results.find((r) => r.userId === 'user-a');
    expect(ashaResult.status).toBe('ok');
    expect(ashaResult.body.score).toBe(100);
    expect(ashaResult.body.dimensions).toEqual(
      FEEDBACK_DIMENSION_LABELS.map((label) => ({ label, score: 100, note: `Note about ${label}.` }))
    );
    expect(ashaResult.body.summary).toBe('A constructive summary.');
    expect(ashaResult.confidence.confidence).toBe(100);
    expect(ashaResult.confidence.components).toEqual({
      transcriptIntegrity: 100,
      speakerAttribution: 100,
      evidenceSufficiency: 100,
      validationSuccess: 100,
    });
  });

  it('never crashes one participant\'s feedback-generation failure into another\'s -- same per-student isolation as feedbackGeneration.js', async () => {
    const outcome = await runEvaluationPipeline(
      { topic: 'Remote work', transcriptLines, participants },
      {
        generateTranscriptAnalysisFn: async () => cleanAnalysisResult(),
        generateCriterionEvaluationFn: cleanCriterionEvaluationFn(),
        generateEvaluationFeedbackFn: async (prompt, ctx) => {
          if (prompt.includes('Bilal')) throw new Error('quota exceeded');
          return cleanEvaluationFeedbackFn()(prompt, ctx);
        },
      }
    );

    const asha = outcome.results.find((r) => r.userId === 'user-a');
    const bilal = outcome.results.find((r) => r.userId === 'user-b');
    expect(asha.status).toBe('ok');
    expect(bilal.status).toBe('error');
    expect(bilal.error).toMatch(/quota exceeded/);
  });

  // Regression: the five criterion-evaluator calls used to run in a
  // sequential for-loop, stacking all five dimensions' latency onto every
  // room -- a real risk against the ~2 minute lobby-poll budget
  // feedbackGeneration.js's own comment already documents. They are
  // independent (same evidence, no shared state), so they must overlap.
  it('runs the five criterion-evaluator calls concurrently, not one after another', async () => {
    let concurrentCalls = 0;
    let maxConcurrentCalls = 0;
    const generateCriterionEvaluationFn = async (_prompt, parseContext) => {
      concurrentCalls += 1;
      maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
      await new Promise((resolve) => setTimeout(resolve, 5));
      concurrentCalls -= 1;
      return demonstratedResultFor(parseContext);
    };

    await runEvaluationPipeline(
      { topic: 'Remote work', transcriptLines, participants },
      {
        generateTranscriptAnalysisFn: async () => cleanAnalysisResult(),
        generateCriterionEvaluationFn,
        generateEvaluationFeedbackFn: cleanEvaluationFeedbackFn(),
      }
    );

    expect(maxConcurrentCalls).toBeGreaterThan(1);
  });

  it('never fabricates a score for a dimension whose criterion evaluator exhausts its validation retries -- falls back to insufficient_context, not a numeric guess', async () => {
    const outcome = await runEvaluationPipeline(
      { topic: 'Remote work', transcriptLines, participants },
      {
        generateTranscriptAnalysisFn: async () => cleanAnalysisResult(),
        generateCriterionEvaluationFn: async (_prompt, parseContext) => {
          if (parseContext.dimensionLabel === 'Fluency') {
            throw new Error('malformed response');
          }
          return demonstratedResultFor(parseContext);
        },
        generateEvaluationFeedbackFn: cleanEvaluationFeedbackFn(),
        maxValidationRetries: 1,
      }
    );

    const fluencyValidation = outcome.validationResults.find((v) => v.dimensionLabel === 'Fluency');
    expect(fluencyValidation).toEqual({ dimensionLabel: 'Fluency', valid: false, retryCount: 1 });

    const fluencyResult = outcome.criterionResults.find((r) => r.dimensionLabel === 'Fluency');
    for (const evaluation of fluencyResult.participantEvaluations) {
      for (const subdimensionId of subdimensionIdsFor('Fluency')) {
        const sub = evaluation.subdimensions.find((s) => s.subdimensionId === subdimensionId);
        expect(sub.level).toBe('insufficient_context');
      }
    }

    const ashaResult = outcome.results.find((r) => r.userId === 'user-a');
    const fluencyScore = ashaResult.body.dimensions.find((d) => d.label === 'Fluency');
    expect(fluencyScore.score).toBeNull();
    // Overall score excludes the null Fluency dimension and renormalizes
    // across the other four (all 100), per R9 -- never scored as 0.
    expect(ashaResult.body.score).toBe(100);
    // Confidence's validationSuccess component reflects the one exhausted
    // dimension out of five: (4 * 100 + 1 * 0) / 5 = 80.
    expect(ashaResult.confidence.components.validationSuccess).toBe(80);
  });
});
