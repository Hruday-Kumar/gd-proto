// SPEC-0011 state 2 (feat/eval-transcript-analysis): deterministic
// verification of the LLM-produced evidence ledger against the real,
// stored transcript -- "a deterministic verifier must check... this
// prevents fabricated quotations without asking another LLM to reread the
// transcript" (architecture doc §5). Nothing here calls an LLM; every
// check is plain code, which is the whole point -- an evidence item that
// fails one of these checks is a bug or a hallucination, not something
// worth a second opinion from another model call.
//
// Also where participant attribution is *derived*, not merely checked:
// domain/transcriptAnalysisPrompt.js never asks the model which
// participant an evidence item belongs to, so there is no attribution
// claim to get wrong -- the owner is read directly from
// transcriptLines[i].userId for the referenced utterance(s).
//
// transcriptLines: ordered array of { id, userId, text, startedAtMs, endedAtMs },
// matching db/transcriptLines.js's row shape (camelCased).
// evidenceItems: parseTranscriptAnalysisResponse(...).evidenceLedger.

function isInRange(index, transcriptLines) {
  return Number.isInteger(index) && index >= 0 && index < transcriptLines.length;
}

function normalizeForMatch(text) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Finds why an evidence item must be rejected, or null if it's clean.
// Checked in order so the first, most fundamental problem is reported.
function findRejectionReason(transcriptLines, item) {
  if (!item.utteranceIndexes?.length) {
    return 'no utterance indexes';
  }
  if (!item.utteranceIndexes.every((index) => isInRange(index, transcriptLines))) {
    return 'utterance index out of range';
  }

  const owners = new Set(item.utteranceIndexes.map((index) => transcriptLines[index].userId));
  if (owners.size > 1) {
    return 'utterance indexes span multiple speakers';
  }

  if (item.relatedUtteranceIndexes?.length && !item.relatedUtteranceIndexes.every((index) => isInRange(index, transcriptLines))) {
    return 'related utterance index out of range';
  }

  const sourceText = normalizeForMatch(item.utteranceIndexes.map((index) => transcriptLines[index].text).join(' '));
  if (!sourceText.includes(normalizeForMatch(item.exactQuote))) {
    return 'exact_quote not found in the referenced utterance text';
  }

  return null;
}

function buildVerifiedEvidence(transcriptLines, item) {
  const ownerUserId = transcriptLines[item.utteranceIndexes[0]].userId;
  const referencedLines = item.utteranceIndexes.map((index) => transcriptLines[index]);
  const relatedParticipants = [
    ...new Set((item.relatedUtteranceIndexes ?? []).map((index) => transcriptLines[index].userId)),
  ].filter((userId) => userId !== ownerUserId);

  return {
    participantUserId: ownerUserId,
    utteranceIds: referencedLines.map((line) => line.id),
    sequenceStart: Math.min(...item.utteranceIndexes),
    sequenceEnd: Math.max(...item.utteranceIndexes),
    timestampStartMs: Math.min(...referencedLines.map((line) => line.startedAtMs)),
    timestampEndMs: Math.max(...referencedLines.map((line) => line.endedAtMs)),
    evidenceType: item.evidenceType,
    exactQuote: item.exactQuote,
    neutralDescription: item.neutralDescription,
    relatedParticipants,
    topicSegmentId: item.topicSegmentId,
    extractionConfidence: item.extractionConfidence,
  };
}

// Never throws: one bad evidence item must not lose every other valid
// item in the same ledger, same isolation principle domain/
// feedbackGeneration.js already applies per-student. Callers decide what
// to do with `rejected` (log, feed into evaluation_validation_issues in a
// later state, etc.) -- this function only classifies.
export function verifyEvidenceLedger(transcriptLines, evidenceItems) {
  const verified = [];
  const rejected = [];

  for (const item of evidenceItems) {
    const reason = findRejectionReason(transcriptLines, item);
    if (reason) {
      rejected.push({ item, reason });
    } else {
      verified.push(buildVerifiedEvidence(transcriptLines, item));
    }
  }

  return { verified, rejected };
}
