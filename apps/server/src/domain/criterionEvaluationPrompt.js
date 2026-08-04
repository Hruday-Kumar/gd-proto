// SPEC-0011 state 3 (feat/eval-criterion-scoring): the Criterion Evaluator
// stage. One call per rubric dimension (Content depth / Clarity /
// Confidence / Listening / Fluency), evaluating ALL participants together
// from the same evidence -- never the raw transcript (R3) -- against the
// anchored subdimension levels in domain/evalRubric.js.
//
// Three properties this must hold, all direct SPEC-0011 requirements:
// (a) No numeric score anywhere in this module's prompt or parsed output --
//     only the fixed SUBDIMENSION_LEVELS enum. That is what makes AC4's
//     "the LLM never outputs a final score directly" true by construction:
//     there is no score field for it to invent one into.
// (b) Every non-absence level must cite at least one evidence_id, and only
//     evidence_ids that were actually offered to the model in this call --
//     an invented or foreign evidence_id is rejected the same way
//     evidenceVerifier.js rejects a fabricated quote (R2).
// (c) Participants are referred to only by the same position-stable
//     anonymous tag scheme as domain/transcriptAnalysisPrompt.js (P1, P2,
//     ...) -- reused directly, not reimplemented, so a rename still cannot
//     affect a criterion score (metamorphic goal).
import { assignParticipantTags } from './transcriptAnalysisPrompt.js';
import { getRubricForDimension, subdimensionIdsFor, SUBDIMENSION_LEVELS } from './evalRubric.js';

export const CRITERION_EVALUATION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    participant_evaluations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          participant_tag: { type: 'STRING' },
          subdimensions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                subdimension_id: { type: 'STRING' },
                level: { type: 'STRING' },
                evidence_ids: { type: 'ARRAY', items: { type: 'STRING' } },
                reasoning: { type: 'STRING' },
              },
              required: ['subdimension_id', 'level', 'reasoning'],
            },
          },
        },
        required: ['participant_tag', 'subdimensions'],
      },
    },
  },
  required: ['participant_evaluations'],
};

// Evidence items here are domain/evidenceVerifier.js's `verified` output:
// { participantUserId, exactQuote, neutralDescription, evidenceType,
//   relatedParticipants, ... }. Assigns a position-stable id (E1, E2, ...)
// scoped to this criterion-evaluation call -- same "anonymous, stable,
// never the model's own invention" pattern as assignParticipantTags,
// applied to evidence instead of participants.
export function assignEvidenceIds(evidenceItems = []) {
  return evidenceItems.map((item, index) => ({ ...item, evidenceId: `E${index + 1}` }));
}

export function buildCriterionEvaluationPrompt({ dimensionLabel, evidence = [], participants = [] } = {}) {
  if (!evidence.length) {
    throw new Error('evidence must not be empty');
  }
  if (!participants.length) {
    throw new Error('participants must not be empty');
  }

  const rubric = getRubricForDimension(dimensionLabel);
  const tagByUserId = assignParticipantTags(participants);
  const tagFor = (userId) => tagByUserId.get(userId) ?? 'Unknown speaker';
  const evidenceWithIds = assignEvidenceIds(evidence);

  const subdimensionLines = rubric.subdimensions.map((s) => {
    const anchorLines = Object.entries(s.anchors)
      .map(([level, text]) => `    - ${level}: ${text}`)
      .join('\n');
    return `- ${s.id} ("${s.label}"):\n${anchorLines}`;
  });

  const evidenceLines = evidenceWithIds.map(
    (item) =>
      `${item.evidenceId} [${tagFor(item.participantUserId)}, ${item.evidenceType}]: ${item.neutralDescription} (quote: "${item.exactQuote}")`
  );

  const participantTags = participants.map((p) => tagFor(p.userId));

  const parts = [
    `You are scoring one rubric dimension, "${dimensionLabel}", for a group discussion (GD) practice session, for ALL participants together in this single response.`,
    'You do not have the raw transcript. You have only a neutral evidence ledger already extracted from it -- base every judgment strictly on this evidence, never on assumptions beyond it.',
    `Participants, referred to only by anonymous tag: ${participantTags.join(', ')}.`,
    `Neutral evidence ledger (each item has a stable id you must cite by, never invent a new id):\n${evidenceLines.join('\n')}`,
    `For "${dimensionLabel}", evaluate each of these subdimensions, using ONLY the anchor descriptions below to decide the level -- do not invent your own criteria:\n${subdimensionLines.join('\n')}`,
    `For each subdimension, choose exactly one level from this fixed set: ${SUBDIMENSION_LEVELS.join(', ')}.`,
    [
      'Use "not_observed" when the evidence simply does not cover this subdimension for that participant, and "insufficient_context" when the evidence is too ambiguous to judge --',
      'neither is a negative judgment, and must never be treated like "contradicted". Never guess a level beyond what the evidence actually supports.',
    ].join(' '),
    [
      'When you choose "demonstrated", "partially_demonstrated", or "contradicted", cite at least one evidence_id from the ledger above that supports it.',
      'Never cite an evidence_id that is not in the ledger above. When you choose "not_observed" or "insufficient_context", leave evidence_ids empty.',
    ].join(' '),
    `Respond with a participant_evaluations array covering every participant tag exactly once (${participantTags.join(', ')}), each with exactly these subdimensions: ${subdimensionIdsFor(dimensionLabel).join(', ')}. Do not add, omit, or rename any subdimension.`,
    'For each subdimension, include a one-clause reasoning grounded in the cited evidence.',
    'Do not output any numeric score anywhere in your response -- only the level, evidence_ids, and reasoning per subdimension.',
  ];

  return {
    prompt: parts.join('\n\n'),
    parseContext: {
      dimensionLabel,
      tagToUserId: Object.fromEntries(participants.map((p) => [tagFor(p.userId), p.userId])),
      evidenceIds: evidenceWithIds.map((item) => item.evidenceId),
      subdimensionIds: subdimensionIdsFor(dimensionLabel),
    },
  };
}

function fail(message) {
  throw new Error(`Gemini criterion evaluation response ${message}`);
}

function isNonBlankString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const ABSENCE_LEVELS = new Set(['not_observed', 'insufficient_context']);

// Shape + closed-world validation: every participant tag and every
// subdimension id must be exactly the set this call was told to evaluate
// (no invented/omitted entries), every level must be one of the fixed
// SUBDIMENSION_LEVELS, and every cited evidence_id must be one this call
// actually offered -- an evaluator cannot smuggle in a numeric score, a
// made-up subdimension, or a fabricated evidence reference and have it
// silently accepted. AC3's "unsupported/invented levels are rejected by
// schema validation" is enforced here, deterministically, with no LLM
// re-check needed.
export function parseCriterionEvaluationResponse(geminiResponseBody, parseContext) {
  const { tagToUserId, evidenceIds, subdimensionIds } = parseContext;
  const expectedTags = Object.keys(tagToUserId);
  const validEvidenceIds = new Set(evidenceIds);
  const expectedSubdimensionIds = new Set(subdimensionIds);

  const text = geminiResponseBody?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || !text.trim()) {
    fail('did not contain any content');
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fail('was not valid JSON');
  }

  if (!Array.isArray(json.participant_evaluations)) {
    fail('is missing participant_evaluations');
  }

  const seenTags = new Set();
  const participantEvaluations = json.participant_evaluations.map((entry) => {
    const tag = entry?.participant_tag;
    if (!expectedTags.includes(tag)) {
      fail(`has an unexpected participant_tag "${tag}"`);
    }
    if (seenTags.has(tag)) {
      fail(`has a duplicate participant_tag "${tag}"`);
    }
    seenTags.add(tag);

    if (!Array.isArray(entry.subdimensions)) {
      fail(`for participant_tag "${tag}" is missing subdimensions`);
    }

    const seenSubdimensionIds = new Set();
    const subdimensions = entry.subdimensions.map((sub) => {
      const subdimensionId = sub?.subdimension_id;
      if (!expectedSubdimensionIds.has(subdimensionId)) {
        fail(`for participant_tag "${tag}" has an unexpected subdimension_id "${subdimensionId}"`);
      }
      if (seenSubdimensionIds.has(subdimensionId)) {
        fail(`for participant_tag "${tag}" has a duplicate subdimension_id "${subdimensionId}"`);
      }
      seenSubdimensionIds.add(subdimensionId);

      if (!SUBDIMENSION_LEVELS.includes(sub.level)) {
        fail(`for participant_tag "${tag}", subdimension "${subdimensionId}" has an invalid level "${sub.level}"`);
      }

      const evidenceIdsForSub = sub.evidence_ids ?? [];
      if (!Array.isArray(evidenceIdsForSub)) {
        fail(`for participant_tag "${tag}", subdimension "${subdimensionId}" has invalid evidence_ids`);
      }
      if (!evidenceIdsForSub.every((id) => validEvidenceIds.has(id))) {
        fail(`for participant_tag "${tag}", subdimension "${subdimensionId}" cites an evidence_id not in the evidence ledger`);
      }
      if (ABSENCE_LEVELS.has(sub.level) && evidenceIdsForSub.length > 0) {
        fail(`for participant_tag "${tag}", subdimension "${subdimensionId}" has level "${sub.level}" but cites evidence, which is contradictory`);
      }
      if (!ABSENCE_LEVELS.has(sub.level) && evidenceIdsForSub.length === 0) {
        fail(`for participant_tag "${tag}", subdimension "${subdimensionId}" has level "${sub.level}" but cites no evidence`);
      }
      if (!isNonBlankString(sub.reasoning)) {
        fail(`for participant_tag "${tag}", subdimension "${subdimensionId}" is missing reasoning`);
      }

      return {
        subdimensionId,
        level: sub.level,
        evidenceIds: evidenceIdsForSub,
        reasoning: sub.reasoning.trim(),
      };
    });

    if (subdimensions.length !== expectedSubdimensionIds.size) {
      fail(`for participant_tag "${tag}" is missing one or more required subdimensions`);
    }

    return { participantUserId: tagToUserId[tag], subdimensions };
  });

  if (seenTags.size !== expectedTags.length) {
    fail('is missing one or more required participants');
  }

  return { dimensionLabel: parseContext.dimensionLabel, participantEvaluations };
}
