// SPEC-0011 state 2 core unit: the deterministic evidence verifier is what
// actually stops a fabricated quote or a wrong-speaker attribution from
// ever reaching the score aggregator. Every case here is deliberately
// adversarial -- it exists to catch what an LLM might get wrong, not to
// re-test the happy path already covered elsewhere.
import { describe, it, expect } from 'vitest';
import { verifyEvidenceLedger } from '../src/domain/evidenceVerifier.js';

const transcriptLines = [
  { id: 'line-0', userId: 'user-a', text: 'I think remote work improves productivity.', startedAtMs: 0, endedAtMs: 2000 },
  { id: 'line-1', userId: 'user-b', text: 'I disagree, collaboration suffers.', startedAtMs: 2100, endedAtMs: 4000 },
  { id: 'line-2', userId: 'user-a', text: 'That is fair, but tools have improved.', startedAtMs: 4100, endedAtMs: 6000 },
  { id: 'line-3', userId: 'user-c', text: 'Both sides have merit depending on the role.', startedAtMs: 6100, endedAtMs: 8000 },
];

function validEvidence(overrides = {}) {
  return {
    utteranceIndexes: [0],
    relatedUtteranceIndexes: [],
    evidenceType: 'claim',
    exactQuote: 'remote work improves productivity',
    neutralDescription: 'States a position on remote work.',
    topicSegmentId: 'TS1',
    extractionConfidence: 'high',
    ...overrides,
  };
}

describe('verifyEvidenceLedger', () => {
  it('verifies a well-formed evidence item and derives its participant from the transcript, not the model', () => {
    const { verified, rejected } = verifyEvidenceLedger(transcriptLines, [validEvidence()]);
    expect(rejected).toEqual([]);
    expect(verified).toHaveLength(1);
    expect(verified[0].participantUserId).toBe('user-a');
    expect(verified[0].utteranceIds).toEqual(['line-0']);
    expect(verified[0].sequenceStart).toBe(0);
    expect(verified[0].sequenceEnd).toBe(0);
    expect(verified[0].timestampStartMs).toBe(0);
    expect(verified[0].timestampEndMs).toBe(2000);
  });

  it('rejects a fabricated quote that does not appear in the referenced utterance', () => {
    const { verified, rejected } = verifyEvidenceLedger(
      transcriptLines,
      [validEvidence({ exactQuote: 'something nobody actually said' })]
    );
    expect(verified).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/exact_quote/i);
  });

  it('rejects an evidence item with no utterance indexes', () => {
    const { rejected } = verifyEvidenceLedger(transcriptLines, [validEvidence({ utteranceIndexes: [] })]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/no utterance indexes/i);
  });

  it('rejects an out-of-range utterance index rather than crashing', () => {
    const { rejected } = verifyEvidenceLedger(transcriptLines, [validEvidence({ utteranceIndexes: [99] })]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/out of range/i);
  });

  it('rejects evidence whose utterance indexes span more than one speaker', () => {
    // index 0 is user-a, index 1 is user-b -- this must never be treated
    // as "one participant's" evidence.
    const { rejected } = verifyEvidenceLedger(
      transcriptLines,
      [validEvidence({ utteranceIndexes: [0, 1], exactQuote: 'remote work improves productivity' })]
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/multiple speakers/i);
  });

  it('derives related_participants from related_utterance_indexes ownership, excluding the main speaker', () => {
    const { verified } = verifyEvidenceLedger(
      transcriptLines,
      [
        validEvidence({
          utteranceIndexes: [2],
          exactQuote: 'tools have improved',
          relatedUtteranceIndexes: [1],
          evidenceType: 'counterargument',
        }),
      ]
    );
    expect(verified[0].participantUserId).toBe('user-a');
    expect(verified[0].relatedParticipants).toEqual(['user-b']);
  });

  it('rejects an out-of-range related utterance index', () => {
    const { rejected } = verifyEvidenceLedger(
      transcriptLines,
      [validEvidence({ relatedUtteranceIndexes: [42] })]
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/related utterance index out of range/i);
  });

  it('matches quotes with normalized whitespace/case rather than requiring byte-identical text', () => {
    const { verified, rejected } = verifyEvidenceLedger(
      transcriptLines,
      [validEvidence({ exactQuote: '  REMOTE work   IMPROVES productivity ' })]
    );
    expect(rejected).toEqual([]);
    expect(verified).toHaveLength(1);
  });

  it("isolates one bad item from an otherwise-valid ledger -- one fabrication doesn't lose everything", () => {
    const { verified, rejected } = verifyEvidenceLedger(transcriptLines, [
      validEvidence(),
      validEvidence({ utteranceIndexes: [1], exactQuote: 'fabricated nonsense' }),
    ]);
    expect(verified).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});
