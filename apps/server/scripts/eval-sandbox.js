// SPEC-0011 AC7 support: rigorous, LIVE-Gemini testing of the new
// evaluation pipeline (domain/evaluationPipeline.js) BEFORE it is ever
// pointed at a real student's room. Runs a small set of synthetic
// scenarios (scripts/eval-sandbox-fixtures.js) through the real
// llm/geminiClient.js functions -- no injected stub -- and checks two
// things a stub-based test can never actually prove: (1) bias -- does the
// live model's score for a seat change when only that seat's identity
// changes, content held fixed; (2) evidence integrity -- does every score
// a live model actually returns still trace to a real, quoted transcript
// utterance.
//
// Writes results ONLY to the self-contained public.eval_sandbox_runs table
// (supabase/migrations/0020_evaluation_sandbox.sql) -- this script must
// NEVER read or write `rooms`, `transcript_lines`, `feedback`, or any of
// migration 0019's `evaluation_*` tables. There is nothing real to
// accidentally touch here: every userId/transcript line in this run is
// synthetic, defined in eval-sandbox-fixtures.js.
//
// Usage:
//   node scripts/eval-sandbox.js                 # run + persist + report
//   node scripts/eval-sandbox.js --no-db          # run + report only,
//                                                  # e.g. before migration
//                                                  # 0020 has been applied
import 'dotenv/config';
import { getSupabase } from '../src/db/supabase.js';
import { runEvaluationPipeline, PROMPT_BUNDLE_VERSION } from '../src/domain/evaluationPipeline.js';
import { RUBRIC_VERSION } from '../src/domain/evalRubric.js';
import {
  generateTranscriptAnalysis,
  generateCriterionEvaluation,
  generateEvaluationFeedback,
} from '../src/llm/geminiClient.js';
// Same free-tier quota-spreading defaults as the real production path
// (agent/feedbackWorker.js) -- reused directly rather than re-picked here,
// so this sandbox round exercises the exact same per-stage model split
// that will actually run against a real room later.
import {
  DEFAULT_TRANSCRIPT_ANALYSIS_MODEL,
  DEFAULT_CRITERION_EVALUATION_MODEL,
  DEFAULT_FEEDBACK_MODEL,
} from '../src/agent/feedbackWorker.js';
import { buildSandboxScenarios } from './eval-sandbox-fixtures.js';

const SANDBOX_TABLE = 'eval_sandbox_runs';
const BIAS_FLAG_THRESHOLD = 2; // matches SPEC-0011's own "<=2 marks/100" bounded-variance target

// Same resolution order as feedbackWorker.js's defaults: a stage-specific
// override, then the shared GEMINI_MODEL, then the free-tier-quota-spread
// default.
const transcriptAnalysisModel = process.env.GEMINI_MODEL_TRANSCRIPT_ANALYSIS || process.env.GEMINI_MODEL || DEFAULT_TRANSCRIPT_ANALYSIS_MODEL;
const criterionEvaluationModel = process.env.GEMINI_MODEL_CRITERION_EVALUATION || process.env.GEMINI_MODEL || DEFAULT_CRITERION_EVALUATION_MODEL;
const feedbackModel = process.env.GEMINI_MODEL_FEEDBACK || process.env.GEMINI_MODEL || DEFAULT_FEEDBACK_MODEL;
const modelSummary = `transcript:${transcriptAnalysisModel},criterion:${criterionEvaluationModel},feedback:${feedbackModel}`;

const noDb = process.argv.includes('--no-db');
const batchLabel = `${new Date().toISOString().slice(0, 19).replace('T', ' ')}-sandbox-round`;

function evidenceForParticipant(userId, verifiedEvidence) {
  return verifiedEvidence.filter(
    (item) => item.participantUserId === userId || item.relatedParticipants.includes(userId)
  );
}

async function runScenario(scenario) {
  const { scenarioLabel, variantLabel, topic, participants, transcriptLines } = scenario;
  console.log(`\n=== ${scenarioLabel} / ${variantLabel} (${participants.map((p) => p.displayName).join(', ')}) ===`);

  const outcome = await runEvaluationPipeline(
    { topic, transcriptLines, participants },
    {
      generateTranscriptAnalysisFn: (prompt) => generateTranscriptAnalysis(prompt, { model: transcriptAnalysisModel }),
      generateCriterionEvaluationFn: (prompt, parseContext) => generateCriterionEvaluation(prompt, parseContext, { model: criterionEvaluationModel }),
      generateEvaluationFeedbackFn: (prompt, parseContext) => generateEvaluationFeedback(prompt, parseContext, { model: feedbackModel }),
    }
  );

  if (outcome.status !== 'ok') {
    console.log(`  [!] pipeline returned status "${outcome.status}" -- no scorecard produced for this variant.`);
    return participants.map((p, seatIndex) => ({
      scenarioLabel,
      variantLabel,
      participant_seat: seatIndex + 1,
      participant_display_name: p.displayName,
      rubric_version: RUBRIC_VERSION,
      prompt_bundle_version: PROMPT_BUNDLE_VERSION,
      model: modelSummary,
      overall_score: null,
      dimensions: [],
      confidence: null,
      confidence_components: {},
      evidence: [],
      notes: `pipeline status: ${outcome.status}`,
    }));
  }

  return participants.map((participant, seatIndex) => {
    const result = outcome.results.find((r) => r.userId === participant.userId);
    const evidence = evidenceForParticipant(participant.userId, outcome.evidenceVerification.verified).map((e) => ({
      evidenceType: e.evidenceType,
      exactQuote: e.exactQuote,
      neutralDescription: e.neutralDescription,
    }));

    console.log(
      `  seat ${seatIndex + 1} (${participant.displayName}): ${result.status === 'ok' ? `score ${result.body.score}` : `ERROR: ${result.error}`}`
    );

    return {
      scenarioLabel,
      variantLabel,
      participant_seat: seatIndex + 1,
      participant_display_name: participant.displayName,
      rubric_version: RUBRIC_VERSION,
      prompt_bundle_version: PROMPT_BUNDLE_VERSION,
      model: modelSummary,
      overall_score: result.status === 'ok' ? result.body.score : null,
      dimensions: result.status === 'ok' ? result.body.dimensions : [],
      confidence: result.status === 'ok' ? result.confidence?.confidence ?? null : null,
      confidence_components: result.status === 'ok' ? result.confidence?.components ?? {} : {},
      evidence,
      notes: result.status === 'ok' ? null : result.error,
    };
  });
}

function printBiasReport(rows) {
  console.log('\n\n──────── BIAS REPORT (same seat, same content, different identity) ────────');
  const byScenarioSeat = new Map();
  for (const row of rows) {
    const key = `${row.scenarioLabel}::${row.participant_seat}`;
    if (!byScenarioSeat.has(key)) byScenarioSeat.set(key, []);
    byScenarioSeat.get(key).push(row);
  }

  let anyFlagged = false;
  for (const [key, variantRows] of byScenarioSeat) {
    if (variantRows.length < 2) continue;
    const [scenarioLabel, seat] = key.split('::');
    const scores = variantRows.map((r) => r.overall_score).filter((s) => s !== null);
    if (scores.length < 2) {
      console.log(`${scenarioLabel} seat ${seat}: skipped (missing score in at least one variant)`);
      continue;
    }
    const spread = Math.max(...scores) - Math.min(...scores);
    const flagged = spread > BIAS_FLAG_THRESHOLD;
    if (flagged) anyFlagged = true;
    console.log(
      `${flagged ? 'FLAG' : 'ok  '}  ${scenarioLabel} seat ${seat}: ${variantRows
        .map((r) => `${r.variantLabel}=${r.overall_score}`)
        .join(', ')} (spread ${spread.toFixed(1)}, threshold ${BIAS_FLAG_THRESHOLD})`
    );
  }

  if (!anyFlagged) {
    console.log('\nNo seat exceeded the bounded-variance threshold across identity variants.');
  } else {
    console.log('\nAt least one seat exceeded the threshold -- inspect the rows above and their evidence before trusting this rubric/prompt version against a real student.');
  }
}

function printEvidenceSpotCheck(rows) {
  console.log('\n\n──────── EVIDENCE SPOT CHECK (read these yourself) ────────');
  for (const row of rows) {
    console.log(`\n${row.scenarioLabel}/${row.variantLabel} seat ${row.participant_seat} (${row.participant_display_name}), score ${row.overall_score}:`);
    if (!row.evidence.length) {
      console.log('  (no evidence attributed to this participant)');
      continue;
    }
    for (const e of row.evidence) {
      console.log(`  [${e.evidenceType}] "${e.exactQuote}" -- ${e.neutralDescription}`);
    }
  }
}

async function persist(rows) {
  const supabase = getSupabase();
  const payload = rows.map((r) => ({ batch_label: batchLabel, ...r }));
  const { error } = await supabase.from(SANDBOX_TABLE).insert(payload);
  if (error) {
    console.log(`\n[!] Could not persist to ${SANDBOX_TABLE}: ${error.message}`);
    console.log('    If the table does not exist yet, apply supabase/migrations/0020_evaluation_sandbox.sql');
    console.log('    in the Supabase SQL Editor, then re-run this script (without --no-db) to persist results.');
    return false;
  }
  console.log(`\nPersisted ${payload.length} row(s) to ${SANDBOX_TABLE} under batch_label "${batchLabel}".`);
  return true;
}

async function main() {
  const scenarios = buildSandboxScenarios();
  console.log(`Running ${scenarios.length} scenario/variant combinations against live Gemini (batch "${batchLabel}")...`);

  const allRows = [];
  for (const [index, scenario] of scenarios.entries()) {
    // A short gap between scenarios -- back-to-back scenarios each firing
    // 1+5+3=9 concurrent-ish Gemini calls in quick succession hit a
    // transient rate-limit-shaped timeout in practice; this is test-harness
    // pacing only, not something the real per-room pipeline needs (a real
    // room's own pipeline run is naturally spaced out by room lifecycle).
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 3000));
    const rows = await runScenario(scenario);
    allRows.push(...rows);
  }

  printBiasReport(allRows);
  printEvidenceSpotCheck(allRows);

  if (!noDb) {
    await persist(allRows);
  } else {
    console.log('\n--no-db passed: results printed above only, nothing persisted.');
  }
}

main().catch((err) => {
  console.error('\n[!] eval-sandbox run failed:', err);
  process.exit(1);
});
