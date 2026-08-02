// Supabase queries for the evaluation_evidence table (SPEC-0011 state 7,
// 0019_evaluation_pipeline_tables.sql). One row per verified evidence item
// -- domain/evidenceVerifier.js's `verified` output, batch-inserted once
// per run, same batch-don't-loop convention as db/roomParticipants.js's
// listParticipantsForRooms.
import { getSupabase } from './supabase.js';

export async function insertEvaluationEvidence(runId, verifiedEvidence, { supabase = getSupabase() } = {}) {
  if (!verifiedEvidence.length) return;
  const { error } = await supabase.from('evaluation_evidence').insert(
    verifiedEvidence.map((item) => ({
      run_id: runId,
      participant_user_id: item.participantUserId,
      utterance_ids: item.utteranceIds,
      sequence_start: item.sequenceStart,
      sequence_end: item.sequenceEnd,
      timestamp_start_ms: item.timestampStartMs,
      timestamp_end_ms: item.timestampEndMs,
      evidence_type: item.evidenceType,
      exact_quote: item.exactQuote,
      neutral_description: item.neutralDescription,
      related_participants: item.relatedParticipants,
      topic_segment_id: item.topicSegmentId,
      extraction_confidence: item.extractionConfidence,
    }))
  );
  if (error) throw error;
}
