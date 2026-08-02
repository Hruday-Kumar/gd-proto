// SPEC-0011 state 3 core unit: prompt assembly + response parsing for the
// Criterion Evaluator stage. Mirrors transcriptAnalysisPrompt.test.js's
// structure -- same DI-free pure-function testing style, same repo.
import { describe, it, expect } from 'vitest';
import {
  assignEvidenceIds,
  buildCriterionEvaluationPrompt,
  parseCriterionEvaluationResponse,
  CRITERION_EVALUATION_RESPONSE_SCHEMA,
} from '../src/domain/criterionEvaluationPrompt.js';

const participants = [
  { userId: 'user-a', displayName: 'Asha' },
  { userId: 'user-b', displayName: 'Bilal' },
];

const evidence = [
  {
    participantUserId: 'user-a',
    evidenceType: 'claim',
    exactQuote: 'remote work improves productivity',
    neutralDescription: 'States a position on remote work.',
  },
  {
    participantUserId: 'user-b',
    evidenceType: 'counterargument',
    exactQuote: 'collaboration suffers',
    neutralDescription: 'Raises a counterpoint about collaboration.',
  },
];

describe('assignEvidenceIds', () => {
  it('assigns stable ids by array position', () => {
    const withIds = assignEvidenceIds(evidence);
    expect(withIds[0].evidenceId).toBe('E1');
    expect(withIds[1].evidenceId).toBe('E2');
  });

  it('does not mutate the original items', () => {
    const withIds = assignEvidenceIds(evidence);
    expect(evidence[0].evidenceId).toBeUndefined();
    expect(withIds[0].exactQuote).toBe(evidence[0].exactQuote);
  });
});

describe('buildCriterionEvaluationPrompt', () => {
  it('throws when evidence is empty', () => {
    expect(() => buildCriterionEvaluationPrompt({ dimensionLabel: 'Clarity', evidence: [], participants })).toThrow(
      /evidence/i
    );
  });

  it('throws when participants is empty', () => {
    expect(() =>
      buildCriterionEvaluationPrompt({ dimensionLabel: 'Clarity', evidence, participants: [] })
    ).toThrow(/participants/i);
  });

  it('never includes a real display name -- only anonymous tags', () => {
    const { prompt } = buildCriterionEvaluationPrompt({ dimensionLabel: 'Content depth', evidence, participants });
    for (const p of participants) {
      expect(prompt).not.toContain(p.displayName);
    }
    expect(prompt).toContain('P1');
    expect(prompt).toContain('P2');
  });

  it('includes the rubric anchors for the requested dimension only', () => {
    const { prompt } = buildCriterionEvaluationPrompt({ dimensionLabel: 'Content depth', evidence, participants });
    expect(prompt).toContain('relevance_to_topic');
    expect(prompt).toContain('depth_of_reasoning');
    expect(prompt).toContain('factual_soundness');
    // Clarity's subdimensions must not leak into a Content depth call.
    expect(prompt).not.toContain('word_choice');
  });

  it('lists the fixed subdimension levels the model must choose from', () => {
    const { prompt } = buildCriterionEvaluationPrompt({ dimensionLabel: 'Clarity', evidence, participants });
    for (const level of ['demonstrated', 'partially_demonstrated', 'not_observed', 'contradicted', 'insufficient_context']) {
      expect(prompt).toContain(level);
    }
  });

  it('forbids the model from outputting a numeric score', () => {
    const { prompt } = buildCriterionEvaluationPrompt({ dimensionLabel: 'Clarity', evidence, participants });
    expect(prompt).toMatch(/do not output any numeric score/i);
  });

  it('assigns each evidence item a stable id and requires citing only those ids', () => {
    const { prompt, parseContext } = buildCriterionEvaluationPrompt({ dimensionLabel: 'Clarity', evidence, participants });
    expect(prompt).toContain('E1');
    expect(prompt).toContain('E2');
    expect(parseContext.evidenceIds).toEqual(['E1', 'E2']);
  });

  it('returns a parseContext mapping tags back to userIds and listing the expected subdimensions', () => {
    const { parseContext } = buildCriterionEvaluationPrompt({ dimensionLabel: 'Fluency', evidence, participants });
    expect(parseContext.dimensionLabel).toBe('Fluency');
    expect(parseContext.tagToUserId).toEqual({ P1: 'user-a', P2: 'user-b' });
    expect(parseContext.subdimensionIds).toEqual(['flow', 'vocabulary_range', 'pacing']);
  });
});

describe('CRITERION_EVALUATION_RESPONSE_SCHEMA', () => {
  it('requires participant_evaluations and has no numeric score field', () => {
    expect(CRITERION_EVALUATION_RESPONSE_SCHEMA.required).toEqual(['participant_evaluations']);
    expect(JSON.stringify(CRITERION_EVALUATION_RESPONSE_SCHEMA)).not.toMatch(/score/i);
  });
});

function geminiBodyWith(jsonObject) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(jsonObject) }] } }] };
}

function baseParseContext() {
  return {
    dimensionLabel: 'Clarity',
    tagToUserId: { P1: 'user-a', P2: 'user-b' },
    evidenceIds: ['E1', 'E2'],
    subdimensionIds: ['structure', 'word_choice', 'conciseness'],
  };
}

function validSubdimension(overrides = {}) {
  return {
    subdimension_id: 'structure',
    level: 'demonstrated',
    evidence_ids: ['E1'],
    reasoning: 'Organized their point clearly before moving on.',
    ...overrides,
  };
}

function validParticipantEvaluations() {
  const subdimensionIds = ['structure', 'word_choice', 'conciseness'];
  return ['P1', 'P2'].map((tag) => ({
    participant_tag: tag,
    subdimensions: subdimensionIds.map((id) => validSubdimension({ subdimension_id: id })),
  }));
}

describe('parseCriterionEvaluationResponse', () => {
  it('extracts and validates a well-formed response, mapping tags back to userIds', () => {
    const parsed = parseCriterionEvaluationResponse(
      geminiBodyWith({ participant_evaluations: validParticipantEvaluations() }),
      baseParseContext()
    );
    expect(parsed.dimensionLabel).toBe('Clarity');
    expect(parsed.participantEvaluations).toHaveLength(2);
    expect(parsed.participantEvaluations[0].participantUserId).toBe('user-a');
    expect(parsed.participantEvaluations[0].subdimensions).toHaveLength(3);
  });

  it('allows not_observed/insufficient_context with empty evidence_ids', () => {
    const evaluations = validParticipantEvaluations();
    evaluations[0].subdimensions[1] = { subdimension_id: 'word_choice', level: 'not_observed', evidence_ids: [], reasoning: 'No evidence of word choice quality.' };
    const parsed = parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext());
    expect(parsed.participantEvaluations[0].subdimensions[1].level).toBe('not_observed');
  });

  it('throws when there is no candidate text', () => {
    expect(() => parseCriterionEvaluationResponse({ candidates: [] }, baseParseContext())).toThrow(/criterion evaluation/i);
  });

  it('throws when the candidate text is not valid JSON', () => {
    const body = { candidates: [{ content: { parts: [{ text: 'not json' }] } }] };
    expect(() => parseCriterionEvaluationResponse(body, baseParseContext())).toThrow(/json/i);
  });

  it('throws when an invented/invalid level is used', () => {
    const evaluations = validParticipantEvaluations();
    evaluations[0].subdimensions[0].level = 'excellent';
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /invalid level/i
    );
  });

  it('throws when an invented subdimension_id is used', () => {
    const evaluations = validParticipantEvaluations();
    evaluations[0].subdimensions[0].subdimension_id = 'charisma';
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /unexpected subdimension_id/i
    );
  });

  it('throws when a required subdimension is missing for a participant', () => {
    const evaluations = validParticipantEvaluations();
    evaluations[0].subdimensions = evaluations[0].subdimensions.slice(0, 2);
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /missing one or more required subdimensions/i
    );
  });

  it('throws when a participant is missing from the response', () => {
    const evaluations = validParticipantEvaluations().slice(0, 1);
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /missing one or more required participants/i
    );
  });

  it('throws when an unexpected participant_tag is present', () => {
    const evaluations = validParticipantEvaluations();
    evaluations[0].participant_tag = 'P99';
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /unexpected participant_tag/i
    );
  });

  it('throws when a cited evidence_id is not in the offered evidence ledger', () => {
    const evaluations = validParticipantEvaluations();
    evaluations[0].subdimensions[0].evidence_ids = ['E99'];
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /evidence_id not in the evidence ledger/i
    );
  });

  it('throws when a non-absence level cites no evidence', () => {
    const evaluations = validParticipantEvaluations();
    evaluations[0].subdimensions[0].evidence_ids = [];
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /cites no evidence/i
    );
  });

  it('throws when not_observed cites evidence anyway (contradictory)', () => {
    const evaluations = validParticipantEvaluations();
    evaluations[0].subdimensions[0].level = 'not_observed';
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /contradictory/i
    );
  });

  it('throws when reasoning is missing', () => {
    const evaluations = validParticipantEvaluations();
    evaluations[0].subdimensions[0].reasoning = '';
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /missing reasoning/i
    );
  });

  it('throws when a duplicate participant_tag is present', () => {
    const evaluations = validParticipantEvaluations();
    evaluations.push({ ...evaluations[0] });
    expect(() => parseCriterionEvaluationResponse(geminiBodyWith({ participant_evaluations: evaluations }), baseParseContext())).toThrow(
      /duplicate participant_tag/i
    );
  });
});
