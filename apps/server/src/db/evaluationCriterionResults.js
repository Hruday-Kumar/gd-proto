// Supabase queries for the evaluation_criterion_results table (SPEC-0011
// state 7, 0019_evaluation_pipeline_tables.sql). One row per
// (run, participant, criterion) -- built from the pipeline's
// criterionResults (domain/criterionEvaluationPrompt.js-shaped, one entry
// per dimension) plus scoreAggregator.js's own per-dimension score, so the
// persisted score always matches exactly what was actually used to build
// the participant's overall score.
//
// `weight_applied` (0019's schema) doesn't have a single well-defined value
// per row: a criterion's weight is distributed across its 2-3
// subdimensions (evalRubric.js), not applied once at the criterion level.
// Left null rather than fabricating a number that would misrepresent the
// rubric -- flagged here, not hidden, same as scoreAggregator.js's own
// equal-weighting note.
import { getSupabase } from './supabase.js';
import { aggregateDimensionScore } from '../domain/scoreAggregator.js';

export async function insertEvaluationCriterionResults(runId, criterionResults, { supabase = getSupabase() } = {}) {
  const rows = criterionResults.flatMap(({ dimensionLabel, participantEvaluations }) =>
    participantEvaluations.map((evaluation) => ({
      run_id: runId,
      participant_user_id: evaluation.participantUserId,
      criterion_label: dimensionLabel,
      subdimensions: evaluation.subdimensions.map((s) => ({
        subdimension_id: s.subdimensionId,
        level: s.level,
        evidence_ids: s.evidenceIds,
        reasoning: s.reasoning,
      })),
      score: aggregateDimensionScore({ dimensionLabel, subdimensions: evaluation.subdimensions }),
      weight_applied: null,
    }))
  );
  if (!rows.length) return;
  const { error } = await supabase.from('evaluation_criterion_results').insert(rows);
  if (error) throw error;
}
