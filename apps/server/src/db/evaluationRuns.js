// Supabase queries for the evaluation_runs table (SPEC-0011 state 7,
// 0019_evaluation_pipeline_tables.sql). Same injectable-client pattern as
// db/feedback.js. One row per evaluation attempt for a room -- created
// 'running' when agent/feedbackWorker.js starts the pipeline, updated to
// 'completed' or 'failed' once it finishes, so a stalled run is visible
// without needing to infer it from an absent feedback row.
import { getSupabase } from './supabase.js';

export async function insertEvaluationRun(
  { roomId, transcriptHash, rubricVersion, promptBundleVersion, model, startedAt },
  { supabase = getSupabase() } = {}
) {
  const { data, error } = await supabase
    .from('evaluation_runs')
    .insert({
      room_id: roomId,
      status: 'running',
      transcript_hash: transcriptHash,
      rubric_version: rubricVersion,
      prompt_bundle_version: promptBundleVersion,
      model,
      started_at: startedAt,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function completeEvaluationRun(runId, { completedAt }, { supabase = getSupabase() } = {}) {
  const { error } = await supabase
    .from('evaluation_runs')
    .update({ status: 'completed', completed_at: completedAt })
    .eq('id', runId);
  if (error) throw error;
}

export async function failEvaluationRun(runId, { error: errorMessage, completedAt }, { supabase = getSupabase() } = {}) {
  const { error } = await supabase
    .from('evaluation_runs')
    .update({ status: 'failed', error: errorMessage, completed_at: completedAt })
    .eq('id', runId);
  if (error) throw error;
}
