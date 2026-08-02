// SPEC-0011 state 7 (feat/eval-feedback-decoupled) cutover: this used to
// wire domain/feedbackGeneration.js's single-shot generateFeedbackForRoom
// to a bare `generateFn`. It now wires domain/evaluationPipeline.js's
// multi-stage pipeline (three distinct injected Gemini calls) and persists
// that pipeline's own artifacts (evaluation_runs/evaluation_evidence/
// evaluation_criterion_results/evaluation_confidence) alongside the same
// `feedback` row shape as before (R8) -- all dependencies injected, no
// live DB or Gemini key needed, same DI-everything convention every prior
// SPEC-0011 state already established.
import { describe, it, expect, vi } from 'vitest';
import { generateAndPersistFeedbackForRoom } from '../src/agent/feedbackWorker.js';
import { TRANSCRIPTION_FAILED_MESSAGE } from '../src/domain/feedbackGeneration.js';
import { FEEDBACK_DIMENSION_LABELS } from '../src/domain/feedbackPrompt.js';

const roomParticipants = [
  { user_id: 'user-a', livekit_identity: 'user-a', joined_at: '2026-07-29T09:00:00.000Z' },
  { user_id: 'user-b', livekit_identity: 'user-b', joined_at: '2026-07-29T09:00:01.000Z' },
];

const transcriptRows = [
  {
    id: 'line-1',
    user_id: 'user-a',
    text: 'Remote work improves productivity.',
    started_at_ms: 0,
    ended_at_ms: 2000,
  },
  {
    id: 'line-2',
    user_id: 'user-b',
    text: 'I disagree, it isolates people.',
    started_at_ms: 2000,
    ended_at_ms: 4000,
  },
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

function cleanDeps(overrides = {}) {
  return {
    getRoomByIdFn: vi.fn().mockResolvedValue({ id: 'room-1', topic_id: 'topic-1' }),
    getTopicByIdFn: vi.fn().mockResolvedValue({ id: 'topic-1', text: 'Remote work' }),
    listParticipantsFn: vi.fn().mockResolvedValue(roomParticipants),
    listProfilesFn: vi.fn().mockResolvedValue([
      { id: 'user-a', display_name: 'Asha' },
      { id: 'user-b', display_name: 'Bilal' },
    ]),
    listTranscriptLinesForRoomFn: vi.fn().mockResolvedValue(transcriptRows),
    listFeedbackUserIdsForRoomFn: vi.fn().mockResolvedValue([]),
    insertFeedbackFn: vi.fn().mockResolvedValue(undefined),
    insertEvaluationRunFn: vi.fn().mockResolvedValue('run-1'),
    completeEvaluationRunFn: vi.fn().mockResolvedValue(undefined),
    failEvaluationRunFn: vi.fn().mockResolvedValue(undefined),
    insertEvaluationEvidenceFn: vi.fn().mockResolvedValue(undefined),
    insertEvaluationCriterionResultsFn: vi.fn().mockResolvedValue(undefined),
    insertEvaluationConfidenceFn: vi.fn().mockResolvedValue(undefined),
    generateTranscriptAnalysisFn: vi.fn().mockResolvedValue(cleanAnalysisResult()),
    generateCriterionEvaluationFn: vi.fn().mockImplementation(async (_prompt, parseContext) => demonstratedResultFor(parseContext)),
    generateEvaluationFeedbackFn: vi.fn().mockImplementation(async (_prompt, { dimensionLabels }) => ({
      summary: 'Great job staying on topic.',
      dimensionNotes: dimensionLabels.map((label) => ({ label, note: 'Specific note.' })),
      strengths: ['Clear opening.'],
      improvements: ['Invite others in more.'],
    })),
    ...overrides,
  };
}

describe('generateAndPersistFeedbackForRoom', () => {
  it('persists feedback for every participant and reports complete: true', async () => {
    const deps = cleanDeps();
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);
    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ complete: true });
  });

  it('persists the summary as body plus the deterministic score/dimensions (with generated notes)/strengths/improvements fields', async () => {
    const deps = cleanDeps();
    await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertFeedbackFn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-a',
        body: 'Great job staying on topic.',
        score: 100,
        strengths: ['Clear opening.'],
        improvements: ['Invite others in more.'],
        dimensions: FEEDBACK_DIMENSION_LABELS.map((label) => ({ label, score: 100, note: 'Specific note.' })),
      })
    );
  });

  it('skips participants who already have persisted feedback, and only evaluates the pending one', async () => {
    const deps = cleanDeps({ listFeedbackUserIdsForRoomFn: vi.fn().mockResolvedValue(['user-a']) });
    await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(1);
    expect(deps.insertFeedbackFn).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-b' }));
  });

  it('returns complete: true without calling Gemini or reading the transcript when everyone already has feedback', async () => {
    const deps = cleanDeps({ listFeedbackUserIdsForRoomFn: vi.fn().mockResolvedValue(['user-a', 'user-b']) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.listTranscriptLinesForRoomFn).not.toHaveBeenCalled();
    expect(deps.generateTranscriptAnalysisFn).not.toHaveBeenCalled();
    expect(result).toEqual({ complete: true });
  });

  // The real production incident (PROGRESS.md, 2026-07-29 B7): a dead
  // Gemini service account 401'd every call -- now the very first stage
  // (Transcript Analysis) fails, which fails the whole room's evaluation
  // run rather than any single student's.
  it('reports complete: false and marks the evaluation run failed when the pipeline itself throws', async () => {
    const deps = cleanDeps({ generateTranscriptAnalysisFn: vi.fn().mockRejectedValue(new Error('401 service account disabled')) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertFeedbackFn).not.toHaveBeenCalled();
    expect(deps.failEvaluationRunFn).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ error: expect.stringMatching(/401/) })
    );
    expect(deps.completeEvaluationRunFn).not.toHaveBeenCalled();
    expect(result).toEqual({ complete: false });
  });

  it('reports complete: false when only some participants succeed, without losing the other\'s feedback', async () => {
    const deps = cleanDeps({
      generateEvaluationFeedbackFn: vi.fn().mockImplementation(async (prompt, ctx) => {
        if (prompt.includes('Bilal')) return Promise.reject(new Error('quota exceeded'));
        return {
          summary: 'Great job staying on topic.',
          dimensionNotes: ctx.dimensionLabels.map((label) => ({ label, note: 'Specific note.' })),
          strengths: ['Clear opening.'],
          improvements: ['Invite others in more.'],
        };
      }),
    });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(1);
    expect(deps.insertFeedbackFn).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-a' }));
    expect(result).toEqual({ complete: false });
  });

  it('reports complete: false when generation succeeds but persisting the feedback row fails', async () => {
    const deps = cleanDeps({ insertFeedbackFn: vi.fn().mockRejectedValue(new Error('unique constraint violation')) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);
    expect(result).toEqual({ complete: false });
  });

  it('still returns complete: true for the honest technical-issue message when the transcript is empty, and never opens an evaluation run', async () => {
    const deps = cleanDeps({ listTranscriptLinesForRoomFn: vi.fn().mockResolvedValue([]) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.generateTranscriptAnalysisFn).not.toHaveBeenCalled();
    expect(deps.insertEvaluationRunFn).not.toHaveBeenCalled();
    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(2);
    expect(deps.insertFeedbackFn).toHaveBeenCalledWith(
      expect.objectContaining({ body: TRANSCRIPTION_FAILED_MESSAGE, score: null, dimensions: [] })
    );
    expect(result).toEqual({ complete: true });
  });

  it('opens an evaluation run before the pipeline starts and completes it once every stage succeeds, persisting evidence/criterion-results/confidence', async () => {
    const deps = cleanDeps();
    await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertEvaluationRunFn).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'room-1', rubricVersion: expect.any(String), promptBundleVersion: expect.any(String), model: expect.any(String) })
    );
    expect(deps.insertEvaluationEvidenceFn).toHaveBeenCalledWith('run-1', expect.arrayContaining([expect.objectContaining({ participantUserId: 'user-a' })]));
    expect(deps.insertEvaluationCriterionResultsFn).toHaveBeenCalledWith(
      'run-1',
      expect.arrayContaining([expect.objectContaining({ dimensionLabel: expect.any(String) })])
    );
    expect(deps.insertEvaluationConfidenceFn).toHaveBeenCalledWith(
      'run-1',
      expect.arrayContaining([expect.objectContaining({ participantUserId: 'user-a', confidence: expect.any(Number) })])
    );
    expect(deps.completeEvaluationRunFn).toHaveBeenCalledWith('run-1', expect.objectContaining({ completedAt: expect.any(String) }));
    expect(deps.failEvaluationRunFn).not.toHaveBeenCalled();
  });

  it('marks the evaluation run failed (not completed) when no evidence survives verification, but still inserts the honest fallback feedback for every pending participant', async () => {
    const fabricatedAnalysis = {
      conversationUnderstanding: { summary: 'Discussed remote work tradeoffs.', topicSegments: [] },
      evidenceLedger: [
        {
          utteranceIndexes: [0],
          relatedUtteranceIndexes: [],
          evidenceType: 'claim',
          exactQuote: 'this was never actually said',
          neutralDescription: 'States a claim.',
          topicSegmentId: null,
          extractionConfidence: 'high',
        },
      ],
    };
    const deps = cleanDeps({ generateTranscriptAnalysisFn: vi.fn().mockResolvedValue(fabricatedAnalysis) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.generateCriterionEvaluationFn).not.toHaveBeenCalled();
    expect(deps.failEvaluationRunFn).toHaveBeenCalledWith('run-1', expect.objectContaining({ error: 'insufficient_evidence' }));
    expect(deps.completeEvaluationRunFn).not.toHaveBeenCalled();
    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(2);
    expect(deps.insertFeedbackFn).toHaveBeenCalledWith(expect.objectContaining({ body: TRANSCRIPTION_FAILED_MESSAGE }));
    expect(result).toEqual({ complete: true });
  });

  // Regression: migration 0019 not yet applied to the live Supabase
  // project (AC1's own still-pending note) would make every single room's
  // insertEvaluationRunFn call throw (table doesn't exist) -- this must
  // never cost a student their feedback, and must never burn through
  // roomSweeper.js's retry budget on an unrelated infrastructure gap.
  it('still generates and persists feedback normally when opening the evaluation run itself fails', async () => {
    const deps = cleanDeps({ insertEvaluationRunFn: vi.fn().mockRejectedValue(new Error('relation "evaluation_runs" does not exist')) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(2);
    expect(deps.insertEvaluationEvidenceFn).not.toHaveBeenCalled();
    expect(deps.completeEvaluationRunFn).not.toHaveBeenCalled();
    expect(deps.failEvaluationRunFn).not.toHaveBeenCalled();
    expect(result).toEqual({ complete: true });
  });

  it('still persists every participant\'s feedback row even when persisting the pipeline\'s own artifact tables fails', async () => {
    const deps = cleanDeps({ insertEvaluationEvidenceFn: vi.fn().mockRejectedValue(new Error('connection reset')) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(2);
    expect(deps.failEvaluationRunFn).toHaveBeenCalledWith('run-1', expect.objectContaining({ error: expect.stringMatching(/connection reset/) }));
    expect(result).toEqual({ complete: true });
  });
});
