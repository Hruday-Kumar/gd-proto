// SPEC-0011 state 8 (test/eval-golden-suite, AC8): a golden fixture suite
// running determinism, metamorphic (participant rename), and
// evidence-integrity tests through the FULL pipeline (domain/
// evaluationPipeline.js), as a regression gate in `npm test` -- not just at
// the unit level (evidenceVerifier.test.js/scoreAggregator.test.js/etc.
// already cover their own stage in isolation).
//
// A genuine determinism limitation, stated honestly rather than
// papered over: every Gemini call in this pipeline is dependency-injected
// (same pattern as every prior SPEC-0011 state, no live key used anywhere in
// this repo's test suite), so this suite cannot measure real model sampling
// noise -- that is only observable against a live Gemini key, still an open
// item under AC7. What it CAN prove, honestly: (1) the pipeline's own
// aggregation/confidence/concurrency machinery introduces no non-determinism
// of its own (e.g. from Promise.all's concurrent criterion-evaluator calls
// completing in a different order each run), and (2) renaming participants
// cannot change a score, which is a real, currently-load-bearing structural
// guarantee (criterionEvaluationPrompt.js/transcriptAnalysisPrompt.js only
// ever expose position-stable anonymous tags like "P1"/"P2" to a criterion
// evaluator, never a real name or id).
import { describe, it, expect } from 'vitest';
import { runEvaluationPipeline } from '../src/domain/evaluationPipeline.js';

function participantsFixture(ids, names) {
  return ids.map((userId, index) => ({ userId, displayName: names[index] }));
}

const ORIGINAL_PARTICIPANTS = participantsFixture(['user-a', 'user-b', 'user-c'], ['Asha', 'Bilal', 'Chen']);
const RENAMED_PARTICIPANTS = participantsFixture(['stu-9', 'stu-4', 'stu-7'], ['Zara', 'Yusuf', 'Priya']);

// Transcript content/order is identical for both fixtures above -- only the
// userId attached to each line changes, per the metamorphic test's point.
function transcriptFor(participants) {
  const [a, b, c] = participants.map((p) => p.userId);
  return [
    { id: 'line-1', userId: a, text: 'Remote work improves productivity because commute time is reclaimed.', startedAtMs: 0, endedAtMs: 3000 },
    { id: 'line-2', userId: b, text: 'I disagree, it isolates people and weakens team culture.', startedAtMs: 3000, endedAtMs: 6000 },
    { id: 'line-3', userId: a, text: 'That is a fair concern, but scheduled syncs can offset it.', startedAtMs: 6000, endedAtMs: 9000 },
    { id: 'line-4', userId: c, text: 'Hmm.', startedAtMs: 9000, endedAtMs: 9500 },
  ];
}

// Evidence items reference transcript lines only by position (utteranceIndexes)
// and exact quote text, never by userId directly -- evidenceVerifier.js
// resolves the owner dynamically from whichever transcript it's given. That
// makes this single ledger valid, unmodified, for both the original and
// renamed participant fixtures -- exactly the property the metamorphic test
// below relies on: nothing about verification should depend on which literal
// userId/displayName strings are attached to a given seat.
const GOLDEN_EVIDENCE_LEDGER = [
  {
    utteranceIndexes: [0],
    relatedUtteranceIndexes: [],
    evidenceType: 'claim',
    exactQuote: 'Remote work improves productivity because commute time is reclaimed.',
    neutralDescription: 'States a claim with a supporting reason.',
    topicSegmentId: null,
    extractionConfidence: 'high',
  },
  {
    utteranceIndexes: [1],
    relatedUtteranceIndexes: [0],
    evidenceType: 'disagreement',
    exactQuote: 'I disagree, it isolates people and weakens team culture.',
    neutralDescription: 'Disagrees with the prior point.',
    topicSegmentId: null,
    extractionConfidence: 'high',
  },
  {
    utteranceIndexes: [2],
    relatedUtteranceIndexes: [1],
    evidenceType: 'rebuttal',
    exactQuote: 'That is a fair concern, but scheduled syncs can offset it.',
    neutralDescription: 'Acknowledges and responds to the disagreement.',
    topicSegmentId: null,
    extractionConfidence: 'high',
  },
  // Deliberately nothing for line-4 ("Hmm.") -- the third seat gets no
  // verifiable evidence at all, same as a genuinely quiet participant would.
];

function cleanAnalysisResult(evidenceLedger = GOLDEN_EVIDENCE_LEDGER) {
  return async () => ({
    conversationUnderstanding: { summary: 'Discussed remote-work tradeoffs.', topicSegments: [] },
    evidenceLedger,
  });
}

// Identity-blind by construction: branches only on the anonymous,
// position-stable tag ("P1"/"P2"/"P3") a criterion-evaluator call actually
// sees, never on the real userId/displayName behind it -- mirroring exactly
// what domain/criterionEvaluationPrompt.js hands a real Gemini call. P1 is
// fully demonstrated, P2 is demonstrated except its last subdimension, P3
// (the quiet seat, no evidence) is insufficient_context throughout -- a
// deliberately uneven fixture so the metamorphic test below is a genuine
// same-seat check, not one three equal outcomes would pass trivially.
function tagBasedCriterionEvaluationFn() {
  return async (_prompt, parseContext) => {
    const { dimensionLabel, tagToUserId, subdimensionIds, evidenceIds } = parseContext;
    const participantEvaluations = Object.entries(tagToUserId).map(([tag, participantUserId]) => {
      if (tag === 'P3') {
        return {
          participantUserId,
          subdimensions: subdimensionIds.map((subdimensionId) => ({
            subdimensionId,
            level: 'insufficient_context',
            evidenceIds: [],
            reasoning: 'No evidence available for this participant.',
          })),
        };
      }
      const evidenceId = evidenceIds[tag === 'P1' ? 0 : Math.min(1, evidenceIds.length - 1)];
      return {
        participantUserId,
        subdimensions: subdimensionIds.map((subdimensionId, index) => ({
          subdimensionId,
          level: tag === 'P2' && index === subdimensionIds.length - 1 ? 'partially_demonstrated' : 'demonstrated',
          evidenceIds: [evidenceId],
          reasoning: 'Grounded in the cited evidence.',
        })),
      };
    });
    return { dimensionLabel, participantEvaluations };
  };
}

function cleanEvaluationFeedbackFn() {
  return async (_prompt, { dimensionLabels }) => ({
    summary: 'A constructive summary.',
    dimensionNotes: dimensionLabels.map((label) => ({ label, note: `Note about ${label}.` })),
    strengths: ['Clear opening.'],
    improvements: ['Invite others in more.'],
  });
}

function runGolden({ participants, evidenceLedger, generateCriterionEvaluationFn }) {
  return runEvaluationPipeline(
    { topic: 'Remote work', transcriptLines: transcriptFor(participants), participants },
    {
      generateTranscriptAnalysisFn: cleanAnalysisResult(evidenceLedger),
      generateCriterionEvaluationFn: generateCriterionEvaluationFn ?? tagBasedCriterionEvaluationFn(),
      generateEvaluationFeedbackFn: cleanEvaluationFeedbackFn(),
    }
  );
}

describe('golden fixture: participant rename must not change scores (metamorphic)', () => {
  it('assigns identical per-seat scores and confidence whether participants use their original identity or an entirely renamed one', async () => {
    const originalOutcome = await runGolden({ participants: ORIGINAL_PARTICIPANTS });
    const renamedOutcome = await runGolden({ participants: RENAMED_PARTICIPANTS });

    expect(originalOutcome.status).toBe('ok');
    expect(renamedOutcome.status).toBe('ok');

    ORIGINAL_PARTICIPANTS.forEach((originalParticipant, seatIndex) => {
      const renamedParticipant = RENAMED_PARTICIPANTS[seatIndex];
      const originalResult = originalOutcome.results.find((r) => r.userId === originalParticipant.userId);
      const renamedResult = renamedOutcome.results.find((r) => r.userId === renamedParticipant.userId);

      expect(renamedResult.body.score).toBe(originalResult.body.score);
      expect(renamedResult.body.dimensions.map((d) => d.score)).toEqual(originalResult.body.dimensions.map((d) => d.score));
      expect(renamedResult.confidence.confidence).toBe(originalResult.confidence.confidence);
      expect(renamedResult.confidence.components).toEqual(originalResult.confidence.components);
    });

    // Sanity check on the fixture itself: the three seats score differently
    // from each other, so the per-seat equality above is a genuine
    // same-seat-same-score check, not something three identical outcomes
    // would satisfy either way.
    const originalScores = originalOutcome.results.map((r) => r.body.score);
    expect(new Set(originalScores).size).toBeGreaterThan(1);
  });
});

describe('golden fixture: determinism across repeated runs', () => {
  it('produces identical scores, dimensions, and confidence across repeated runs of the same transcript, even when the five criterion-evaluator calls complete in a different order each time', async () => {
    const jitteredCriterionEvaluationFn = () => {
      const base = tagBasedCriterionEvaluationFn();
      return async (prompt, parseContext) => {
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 8)));
        return base(prompt, parseContext);
      };
    };

    const run = () =>
      runGolden({ participants: ORIGINAL_PARTICIPANTS, generateCriterionEvaluationFn: jitteredCriterionEvaluationFn() });

    const [first, second, third] = await Promise.all([run(), run(), run()]);

    const summarize = (outcome) =>
      outcome.results
        .map((r) => ({ userId: r.userId, score: r.body.score, dimensions: r.body.dimensions.map((d) => d.score), confidence: r.confidence.confidence }))
        .sort((a, b) => a.userId.localeCompare(b.userId));

    expect(summarize(second)).toEqual(summarize(first));
    expect(summarize(third)).toEqual(summarize(first));
  });
});

describe('golden fixture: evidence integrity end-to-end', () => {
  const MIXED_EVIDENCE_LEDGER = [
    GOLDEN_EVIDENCE_LEDGER[0],
    GOLDEN_EVIDENCE_LEDGER[1],
    {
      utteranceIndexes: [2],
      relatedUtteranceIndexes: [],
      evidenceType: 'claim',
      exactQuote: 'this exact sentence was never actually spoken by anyone',
      neutralDescription: 'A fabricated claim not present in the transcript.',
      topicSegmentId: null,
      extractionConfidence: 'high',
    },
    {
      utteranceIndexes: [0, 1],
      relatedUtteranceIndexes: [],
      evidenceType: 'claim',
      exactQuote: 'Remote work improves productivity because commute time is reclaimed.',
      neutralDescription: 'Wrongly attributed as spanning two different speakers.',
      topicSegmentId: null,
      extractionConfidence: 'medium',
    },
  ];

  it('rejects a fabricated quote and a cross-speaker attribution item, and still scores the room from only the genuine evidence that survives verification', async () => {
    const capturedEvidenceIdsPerCall = [];
    const outcome = await runGolden({
      participants: ORIGINAL_PARTICIPANTS,
      evidenceLedger: MIXED_EVIDENCE_LEDGER,
      generateCriterionEvaluationFn: async (prompt, parseContext) => {
        capturedEvidenceIdsPerCall.push(parseContext.evidenceIds);
        return tagBasedCriterionEvaluationFn()(prompt, parseContext);
      },
    });

    expect(outcome.status).toBe('ok');
    expect(outcome.evidenceVerification.verified).toHaveLength(2);
    expect(outcome.evidenceVerification.rejected).toHaveLength(2);
    expect(outcome.evidenceVerification.rejected.map((r) => r.reason).sort()).toEqual(
      ['exact_quote not found in the referenced utterance text', 'utterance indexes span multiple speakers'].sort()
    );

    // Every criterion-evaluation call was only ever offered the two
    // surviving, verified evidence ids -- the fabricated and cross-speaker
    // items never reach a scoring stage in any form, for any dimension.
    expect(capturedEvidenceIdsPerCall.length).toBeGreaterThan(0);
    expect(capturedEvidenceIdsPerCall.every((ids) => ids.length === 2)).toBe(true);

    // A partially-bad ledger degrades to less evidence, not to a lost room:
    // every participant still gets a real result body.
    expect(outcome.results).toHaveLength(ORIGINAL_PARTICIPANTS.length);
    expect(outcome.results.every((r) => r.status === 'ok' && typeof r.body.summary === 'string')).toBe(true);
  });

  it('falls back to the transcription-failed message for every participant when the entire ledger is fabricated, never fabricating a score from zero surviving evidence', async () => {
    const outcome = await runGolden({
      participants: ORIGINAL_PARTICIPANTS,
      evidenceLedger: [MIXED_EVIDENCE_LEDGER[2]],
      generateCriterionEvaluationFn: async () => {
        throw new Error('must not be called: no evidence survived verification');
      },
    });

    expect(outcome.status).toBe('insufficient_evidence');
    expect(outcome.evidenceVerification.verified).toHaveLength(0);
    expect(outcome.results.every((r) => r.body.score === null)).toBe(true);
  });
});
