// Supabase queries for the evaluation_confidence table (SPEC-0011 state 7,
// 0019_evaluation_pipeline_tables.sql). One row per (run, participant) --
// domain/confidenceCalculator.js's computeConfidenceForRun output,
// batch-inserted once per run.
import { getSupabase } from './supabase.js';

export async function insertEvaluationConfidence(runId, confidences, { supabase = getSupabase() } = {}) {
  if (!confidences.length) return;
  const { error } = await supabase.from('evaluation_confidence').insert(
    confidences.map((c) => ({
      run_id: runId,
      participant_user_id: c.participantUserId,
      confidence: c.confidence,
      components: {
        transcript_integrity: c.components.transcriptIntegrity,
        speaker_attribution: c.components.speakerAttribution,
        evidence_sufficiency: c.components.evidenceSufficiency,
        validation_success: c.components.validationSuccess,
      },
    }))
  );
  if (error) throw error;
}
