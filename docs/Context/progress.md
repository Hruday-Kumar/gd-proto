# Evaluation engine redesign — progress

Tracks execution of `docs/specs/active/SPEC-0011-eval-engine-redesign.md`,
which adapts `PlaceMe AI Evaluation Engine Architecture Plan.docx` (this
folder) to pilot scale per direct user confirmation ("implement it to a
pilot level, enterprise level is not expected"). Updated alongside every
state — not just at the end.

Legend: Not started / In progress / Implemented — pending verification /
Verified / Done.

| # | State (branch) | Status | Last updated | Notes |
|---|---|---|---|---|
| 0 | Spec + branches created | Done | 2026-08-02 | SPEC-0011 drafted; 9 task branches cut from `dev` (`feat/eval-schema-foundation`, `feat/eval-transcript-analysis`, `feat/eval-criterion-scoring`, `feat/eval-score-aggregation`, `feat/eval-validation-layer`, `feat/eval-confidence-score`, `feat/eval-feedback-decoupled`, `test/eval-golden-suite`, `chore/eval-cutover-cleanup`). |
| 1 | `feat/eval-schema-foundation` | Implemented — PR not yet opened | 2026-08-02 | Migration `0019_evaluation_pipeline_tables.sql` adds `evaluation_runs`, `evaluation_evidence`, `evaluation_criterion_results`, `evaluation_validation_issues`, `evaluation_confidence`, all RLS-enabled with zero client policies (service-role only). No application code changed. Committed (`dc8f3c4`) and pushed. Still needs: manual application to the live Supabase project (per `CLAUDE.md`, migrations are never applied automatically) before state 2 can insert real rows. |
| 2 | `feat/eval-transcript-analysis` | Implemented — PR not yet opened | 2026-08-02 | `domain/transcriptAnalysisPrompt.js` (prompt/schema/parser) + `domain/evidenceVerifier.js` (deterministic quote/attribution verification) + `llm/geminiClient.generateTranscriptAnalysis`. Also pinned `temperature` on every eval Gemini call, including the still-live `generateFeedback` (R13, done early — small, safe, directly fixes the reported "random scores"). Branched off state 1's tip (stacked, not off `dev`, since it depends on the schema). Not yet wired into `feedbackWorker.js`/persisted to `evaluation_evidence` — pure, injectable, unit-tested domain functions only. |
| 3 | `feat/eval-criterion-scoring` | Implemented — PR not yet opened | 2026-08-02 | `domain/evalRubric.js` (5 dimensions x 2-3 anchored subdimensions, weights sum to 1.0, `SUBDIMENSION_LEVELS`/`LEVEL_MARK`) + `domain/criterionEvaluationPrompt.js` (one prompt per dimension, evaluates all participants at once from the evidence ledger only, never the raw transcript) + `llm/geminiClient.generateCriterionEvaluation`. Branched off state 2's tip (stacked). Not yet wired into `feedbackWorker.js` -- pure, injectable, unit-tested domain functions only, same as state 2. |
| 4 | `feat/eval-score-aggregation` | Implemented — PR not yet opened | 2026-08-03 | `domain/scoreAggregator.js`: `aggregateDimensionScore` (weighted average of subdimension marks, excluding not_observed/insufficient_context, renormalizing remaining weights, null if all excluded), `aggregateOverallScore` (equal-weighted average across the five dimensions, same null-exclusion rule), `aggregateScorecard` (composes both per participant across all five criterion-evaluator results into `{participantUserId, dimensions: [{label, score}], overallScore}`). Branched off state 3's tip (stacked). |
| 5 | `feat/eval-validation-layer` | Implemented — PR not yet opened | 2026-08-03 | `domain/validationLayer.js`: `validateWeightTotal`/`validateScoreRange` (deterministic, always) + `evaluateCriterionWithValidation` (bounded max-2 same-criterion retry around a flagged/parse-failing criterion evaluator response, returns a flagged issue instead of throwing once exhausted). Branched off state 4's tip (stacked). Also merged into new consolidated `phase-2` branch per user instruction — every state branch is merged into `phase-2` as it lands, kept in sync going forward. |
| 6 | `feat/eval-confidence-score` | Implemented — PR not yet opened | 2026-08-03 | `domain/confidenceCalculator.js`: `computeTranscriptIntegrityComponent`/`computeSpeakerAttributionComponent` (from state 2's `verifyEvidenceLedger` verified/rejected counts, rejection reasons bucketed via `bucketEvidenceRejections`), `computeEvidenceSufficiencyComponent` (per participant, fraction of subdimension levels that are evidence-backed rather than not_observed/insufficient_context), `computeValidationSuccessComponent` (from state 5's `evaluateCriterionWithValidation` valid/retryCount outcomes, reusing its exported `DEFAULT_MAX_RETRIES`), `aggregateConfidence` (equal-weighted average of the four, rounded to an integer), `computeConfidenceForRun` (composes all of the above into one `{participantUserId, confidence, components}` entry per participant, same participant-extraction/dimension-coverage-check pattern as state 4's `aggregateScorecard`). Branched off state 5's tip (stacked). Persistence to `evaluation_confidence` deferred to state 7's `feedbackWorker.js` wiring, same scope pattern as states 2-5. |
| 7 | `feat/eval-feedback-decoupled` | Implemented — human verification pending (guardrail #1) | 2026-08-03 | Full pipeline wired end to end in `agent/feedbackWorker.js`; `feedback` row shape confirmed unchanged by test. New: `domain/evaluationFeedbackPrompt.js`, `domain/evaluationPipeline.js`, `db/evaluationRuns.js`/`evaluationEvidence.js`/`evaluationCriterionResults.js`/`evaluationConfidence.js`, `llm/geminiClient.generateEvaluationFeedback`. 567/567 tests passing. **Not yet done: migration 0019 applied live, a real Gemini-key run, and guardrail #1 human verification** -- see SPEC-0011 AC7 for the full list; none of these are satisfied by automated tests alone, per guardrail #1. |
| 8 | `test/eval-golden-suite` | Not started | — | Fixture transcripts + determinism/metamorphic/evidence tests in `npm test`. |
| 9 | `chore/eval-cutover-cleanup` | Not started | — | Remove old single-shot scoring path, update docs, final human-verification checklist. |

## Session log

- **2026-08-02:** User reported feedback scores read as random/inconsistent
  and demanded a properly designed, unbiased scoring system tied to
  student-performance improvement. Investigated current system (100%
  single-shot LLM scoring, no temperature pin, no rubric anchors, no
  cross-check between overall and dimension scores, no calibration/bias
  testing — see SPEC-0011 Problem section for full detail). User pointed
  to `docs/Context/PlaceMe AI Evaluation Engine Architecture Plan.docx` as
  the reference design. Confirmed with user: adapt the doc's core
  evaluation-quality architecture to this project's actual pilot scale and
  guardrails, not its full enterprise infrastructure (Temporal, worker-pool
  autoscaling, S3, Redis, multi-region) — explicit answer: "pilot level,
  enterprise level is not expected." Drafted SPEC-0011. Created 9 task
  branches off `dev` per user instruction to branch every major task.
  **Git note:** found `feat/be-20-raise-hand-signal` checked out with
  uncommitted work from a concurrent session (per repo convention — several
  older stashes from other sessions already existed in `git stash list`).
  Preserved it via `git stash` (msg: "wip: feat/be-20-raise-hand-signal
  in-progress work (concurrent session) — recover with: `git checkout
  feat/be-20-raise-hand-signal && git stash pop`"), left untouched/unpopped
  in the stash list rather than restored to disk, to avoid it floating
  across branches that share identical committed content with `dev`. Not
  this session's work to resume — flagged here for whoever owns that
  branch.
- **2026-08-02 (state 1 done):** Wrote migration `0019_evaluation_pipeline_tables.sql`
  on `feat/eval-schema-foundation`, matching this repo's existing migration
  style (plain SQL, manual dashboard apply, RLS enabled). Ran
  `npm test --workspace=@placeme/server`: 413/413 tests passed; 4 RLS
  isolation test *files* error at setup (`Node.js detected but native
  WebSocket not found` — needs Node 22+, this sandbox runs Node v20.20.0).
  Confirmed this is pre-existing and unrelated: this state added zero
  JS/test files, only a `.sql` file vitest never loads, so the same 4
  files would fail identically without this change. No schema-only
  migration in this repo's history (0007/0009/0012/0014/0015/0016/0018)
  carries a paired automated test either, since these tables have no
  client policy to test against (RLS enabled, zero policies — nothing for
  a client-side test to exercise until an application stage starts
  writing to them in state 2+). Committed and pushed all 9 branches to
  `origin` (empty for states 2-9 so far, per user request to create
  branches for every major task up front).
- Next: user check-in on whether to open a PR for state 1 now and/or
  continue straight into state 2 (`feat/eval-transcript-analysis`) — per
  guardrail #9 (session discipline: one core unit at a time), this is a
  deliberate pause point, not an interruption.
- **2026-08-02 (unrelated, same session, logged for continuity):** User
  asked to push `feat/be-20-raise-hand-signal`'s stashed work. Checked out
  the branch — the concurrent session had already popped its own stash by
  then (recovery instructions above had been followed). Ran
  `npm test --workspace=@placeme/server` as a sanity check only (413/413
  passed, same pre-existing 4-file Node-version gap as state 1, not
  otherwise evaluated per explicit user instruction — "don't evaluate,
  just push, don't create any PR"). Committed (`bd3e8fd`: BE-20 raise-hand
  signal, `canPublishData: true` + `hand_raised` LiveKit data topic, full
  detail in that commit and `SPEC-0010`) and pushed to `origin`, no PR
  opened. Returned to `feat/eval-schema-foundation` afterward — this
  session's own eval-engine state (see table above) is unaffected and
  still the next thing to pick up.
- **2026-08-02 (state 2 done):** User said "back to feedback" — resumed
  eval-engine work. Fast-forwarded `feat/eval-transcript-analysis` onto
  `feat/eval-schema-foundation`'s tip (stacked branch; state 2's domain
  code doesn't strictly need the migration file, but stacking keeps every
  eval-pipeline branch building on the same lineage, consistent with how
  `pr-review`'s own docs describe stacked feature branches as normal in
  this repo). Wrote `transcriptAnalysisPrompt.js` (prompt asks for neutral
  evidence only, numbers utterances, uses position-stable anonymous tags
  P1/P2/... instead of real display names so a rename can't affect
  scoring), `evidenceVerifier.js` (deterministically rejects fabricated
  quotes and cross-speaker-attributed evidence, derives the true
  participant from `transcript_lines.user_id` rather than trusting the
  model), and added `generateTranscriptAnalysis` + `DEFAULT_EVAL_TEMPERATURE`
  (0.1, pinned on both the new call and the existing `generateFeedback`
  call) to `geminiClient.js`. 33 new tests, all passing;
  `npm test --workspace=@placeme/server`: 446/446 tests passed (same 4
  pre-existing Node-version-gated RLS test files as state 1, confirmed
  unrelated). `npm run lint`: no new warnings/errors (only pre-existing,
  unrelated `@placeme/web` warnings). Committed (`3b946d9`) and pushed.
  Not yet wired into `feedbackWorker.js` or persisted to
  `evaluation_evidence` — that orchestration is a later state.
- **2026-08-02 (state 3 done):** Fast-forwarded `feat/eval-criterion-scoring`
  onto `feat/eval-transcript-analysis`'s tip (stacked, same lineage as
  states 1-2). Wrote `domain/evalRubric.js`: each of the five existing
  feedback dimensions broken into 2-3 observable subdimensions with anchor
  descriptions per level and weights summing to 1.0 (asserted by test, plus
  a load-time self-check that its dimension labels exactly match
  `feedbackPrompt.js`'s `FEEDBACK_DIMENSION_LABELS`); exports the fixed
  `SUBDIMENSION_LEVELS` enum and the `LEVEL_MARK` level-to-percentage table
  as rubric-owned data only -- deliberately does not compute anything with
  it, since AC4's aggregator is a later state and this keeps "the LLM
  output alone never contains a final score" true by construction (there is
  no score field anywhere in this stage's schema). Wrote
  `domain/criterionEvaluationPrompt.js`: one prompt per dimension,
  evaluating all participants together from the evidence ledger only
  (reuses `transcriptAnalysisPrompt.js`'s `assignParticipantTags` rather
  than reimplementing anonymization), assigns each evidence item a
  position-stable id (E1, E2, ...) so the model must cite evidence by id
  instead of restating it; `parseCriterionEvaluationResponse` does
  closed-world validation against that specific call's context -- rejects
  an invented subdimension level, an invented/renamed subdimension id, a
  missing or duplicate participant, a foreign/invented evidence_id, a
  non-absence level with no cited evidence, and a `not_observed`/
  `insufficient_context` level that contradictorily cites evidence anyway.
  Added `generateCriterionEvaluation` to `geminiClient.js` (same
  temperature-pinned, structured-output pattern as the other two
  evaluation-stage calls; takes a `parseContext` since this response's
  validity depends on what that specific call offered, unlike the other
  two's fixed schemas). 40 new tests, all passing;
  `npm test --workspace=@placeme/server`: 486/486 tests passed (same 4
  pre-existing Node-version-gated RLS test files as states 1-2, confirmed
  unrelated -- no JS/test files those 4 suites touch were changed). `npm
  run lint`: no new warnings (only pre-existing, unrelated `@placeme/web`
  warnings). Not yet wired into `feedbackWorker.js` or persisted to
  `evaluation_criterion_results` -- that orchestration is a later state.
- **2026-08-03 (state 4 done):** Fast-forwarded `feat/eval-score-aggregation`
  onto `feat/eval-criterion-scoring`'s tip (stacked, same lineage as states
  1-3). Wrote `domain/scoreAggregator.js`, pure functions only, no LLM calls
  — the only place in the pipeline that computes a score:
  `aggregateDimensionScore` takes one participant's subdimension levels for
  one dimension, looks up each subdimension's weight from `evalRubric.js`
  and mark from `LEVEL_MARK`, excludes `not_observed`/`insufficient_context`
  from the average (renormalizing remaining weights rather than scoring
  absence as 0, consistent with R9), returns `null` if every subdimension is
  excluded; throws on an unknown subdimension id or level rather than
  silently ignoring a malformed input. `aggregateOverallScore` applies the
  same null-exclusion weighted-average logic equal-weighted across the five
  dimensions — SPEC-0011 only fixes subdimension weights *within* a
  dimension, not cross-dimension weights, so equal weighting is this state's
  simplest deterministic choice satisfying R4; flagged to user as a decision
  worth confirming, not hidden. `aggregateScorecard` composes both across
  one `parseCriterionEvaluationResponse`-shaped result per
  `FEEDBACK_DIMENSION_LABELS` dimension, producing
  `{participantUserId, dimensions: [{label, score}], overallScore}` per
  participant — `note` (feedback text) stays out of scope, that's state 7's
  Feedback Generation stage. 13 new tests in `test/scoreAggregator.test.js`,
  covering every level/weight/insufficient-evidence combination plus
  malformed-input cases; combined with `criterionEvaluationPrompt.test.js`'s
  pre-existing "schema has no score field" test, satisfies AC4's "unit test
  proves the LLM output alone never contains a final score." Full suite:
  `npm test --workspace=@placeme/server` 499/499 passing (same 4
  pre-existing Node-version-gated RLS test files as states 1-3, confirmed
  unrelated — this state touched zero files those suites depend on). `npm
  run lint`: no new warnings (same pre-existing `@placeme/web` ones).
  Checked off AC4 and the state-4 task row in SPEC-0011. Not committed yet.
- **2026-08-03 (consolidated `phase-2` branch created, user instruction):**
  User asked for a consolidated `phase-2` branch containing all SPEC-0011
  work, and for every state branch to be merged into it going forward.
  Created `phase-2` off `feat/eval-score-aggregation`'s tip (`11e344a`,
  states 1-4), pushed to origin. Confirmed all 9 state branches were already
  ancestors (`git merge --ff-only` against each: "Already up to date") —
  states 6-9 hadn't started yet, so this was a no-op consolidation, not a
  real merge. Convention from here: finish a state on its own branch as
  before (unchanged process/tests/docs), then fast-forward-merge that
  branch into `phase-2` and push `phase-2` too.
- **2026-08-03 (state 5 done):** Fast-forwarded `feat/eval-validation-layer`
  onto `feat/eval-score-aggregation`'s tip (stacked, same lineage as states
  1-4). Wrote `domain/validationLayer.js`: `validateWeightTotal` (rubric
  weights sum to 1.0, a code-review defect if not -- checked always, before
  any Gemini call, since a retry can never fix a rubric bug) and
  `validateScoreRange` (a score is `null` or a finite number in [0, 100]).
  R5's other two named checks (evidence existence, quote match) are already
  enforced as hard closed-world validation inside state 3's
  `parseCriterionEvaluationResponse` -- this state's new piece is
  `evaluateCriterionWithValidation`, which builds a criterion-evaluator
  prompt once (`buildCriterionEvaluationPrompt`) and retries the *same*
  dimension/evidence/participants up to `maxRetries` (default 2) additional
  times if a response fails that parse validation, returning
  `{valid, result, retryCount}` on eventual success or
  `{valid: false, result: null, retryCount, issue}` once exhausted --- never
  throws on an exhausted retry, so a caller can record the issue and
  continue rather than losing the whole room's evaluation to one bad
  response. `generate` is injected (same `(prompt, parseContext) => parsed`
  contract as `geminiClient.generateCriterionEvaluation`), so this is fully
  testable with no live Gemini key. 11 new tests in
  `test/validationLayer.test.js`. Full suite: `npm test
  --workspace=@placeme/server` 510/510 passing (same 4 pre-existing
  Node-version-gated RLS test files as states 1-4, confirmed unrelated).
  `npm run lint`: no new warnings. Checked off AC5 and the state-5 task row
  in SPEC-0011. Merged into `phase-2` and pushed, per the new convention
  above.
- **2026-08-03 (state 6 done):** Fast-forwarded `feat/eval-confidence-score`
  onto `feat/eval-validation-layer`'s tip (stacked, same lineage as states
  1-5). Wrote `domain/confidenceCalculator.js`, pure functions only, no LLM
  calls, exactly R6's four named components (transcript integrity, speaker
  attribution, evidence sufficiency, validation success): the two
  evidence-ledger components read state 2's `verifyEvidenceLedger`
  verified/rejected output, splitting rejection reasons via
  `bucketEvidenceRejections` into a speaker-boundary-crossing bucket
  (attribution) versus everything else (fabricated quote, out-of-range
  index -- general integrity), both room-wide since the ledger is produced
  once per room; evidence sufficiency is computed per participant, from
  state 3's subdimension levels, as the fraction that landed on an
  evidence-backed level rather than not_observed/insufficient_context
  (R9-consistent: absence isn't scored as failure, but it does lower
  confidence); validation success reads state 5's
  `evaluateCriterionWithValidation` `{valid, retryCount}` outcomes per
  dimension, scoring a clean pass 100, a retried-but-passing criterion
  proportionally lower, and an exhausted/flagged criterion 0 -- exported
  `DEFAULT_MAX_RETRIES` from `validationLayer.js` so this reuses the same
  bound rather than duplicating it. `aggregateConfidence` equal-weights the
  four components (`CONFIDENCE_COMPONENT_WEIGHT`, 0.25 each, same
  equal-weighting rationale as state 4's `aggregateOverallScore` --
  SPEC-0011 doesn't define relative weights across these four, so this is
  the simplest deterministic choice satisfying R6, flagged not hidden) and
  rounds to an integer, matching `evaluation_confidence.confidence`'s
  column type. `computeConfidenceForRun` composes all of it into one
  `{participantUserId, confidence, components}` entry per participant,
  reusing the same participant-extraction and five-dimension-coverage
  check `aggregateScorecard` (state 4) already established. Deliberately
  did not implement the 0019 migration comment's illustrative fifth
  component, "execution_quality" -- that's orchestration-level (pipeline
  completed without error/on time), not a signal available to a pure
  domain function, and R6 itself only names four; left to state 7's
  `feedbackWorker.js` wiring, noted in SPEC-0011 rather than fabricated
  here. 23 new tests in `test/confidenceCalculator.test.js`, covering every
  component's edge cases (nothing attempted, nothing rejected, partial
  rejection, exhausted retry) and `computeConfidenceForRun`'s end-to-end
  composition including its two guard-clause errors. Full suite: `npm test
  --workspace=@placeme/server` 533/533 passing (same 4 pre-existing
  Node-version-gated RLS test files as states 1-5, confirmed unrelated).
  `npm run lint`: no new warnings (same pre-existing `@placeme/web` ones).
  Checked off AC6 and the state-6 task row in SPEC-0011 (noting, as AC1
  did for its own deferred piece, that literal persistence to
  `evaluation_confidence` is state 7's concern, not this state's). Merged
  into `phase-2` and pushed, per the state-5-established convention.
- **2026-08-03 (state 7 implemented, human verification still pending):**
  Fast-forwarded `feat/eval-feedback-decoupled` onto `feat/eval-confidence-score`'s
  tip (stacked, same lineage as states 1-6). This is the cutover state:
  built the missing R7 piece (Feedback Generation stage --
  `domain/evaluationFeedbackPrompt.js`: response schema has no score field
  anywhere, same by-construction technique `criterionEvaluationPrompt.js`
  uses for AC4, plus the prompt explicitly tells the model its scores are
  already final and not to be restated differently; `llm/geminiClient.generateEvaluationFeedback`,
  same DI pattern as the other four stage calls), then wrote
  `domain/evaluationPipeline.js` to compose every prior state into the full
  per-room pipeline SPEC-0011's Design section describes: Transcript
  Analysis -> `verifyEvidenceLedger` -> five Criterion Evaluators each
  through `evaluateCriterionWithValidation`'s bounded retry -> a criterion
  that still fails after retries falls back to `insufficient_context` on
  every subdimension (never a fabricated level, R9 applied to a validation
  failure, not just a genuine evidence gap) -> `aggregateScorecard` ->
  `computeConfidenceForRun` -> per-participant Feedback Generation, with a
  small worker pool (same shape as `feedbackGeneration.js`'s own) so one
  participant's Feedback Generation failure can never lose another's.
  An empty transcript or a fully-rejected evidence ledger (every extracted
  item fabricated/malformed) both short-circuit to the exact same
  `TRANSCRIPTION_FAILED_MESSAGE` stub `feedbackGeneration.js` already used
  (exported `transcriptionFailedBody` for reuse instead of duplicating it)
  -- honest per R9/guardrail #1, never judging a session with no usable
  evidence. Added `RUBRIC_VERSION` (`evalRubric.js`) and
  `PROMPT_BUNDLE_VERSION` (`evaluationPipeline.js`) code-versioned
  constants, and a pure `hashTranscript` (sha256 of ordered
  id/user/text), all three recorded on `evaluation_runs` for lineage.
  Added four thin `db/evaluation*.js` insert wrappers (no dedicated unit
  tests, matching this repo's existing convention -- no `db/*.test.js`
  file exists for any table); `evaluation_criterion_results.weight_applied`
  is left `null` since a criterion's weight is actually distributed across
  its subdimensions, not a single per-criterion number -- flagged in that
  file's own comment rather than fabricating a value, same spirit as state
  4's equal-weighting note. Rewired `agent/feedbackWorker.js`'s
  `generateAndPersistFeedbackForRoom` to call the new pipeline and persist
  its artifacts alongside the unchanged `feedback` row (R8) -- confirmed
  byte-for-byte by test. Old path
  (`feedbackGeneration.js`/`feedbackPrompt.js`/`geminiClient.generateFeedback`)
  deliberately untouched and no longer called, per the Rollback section's
  "single-file revert" contract; full deletion stays state 9's job.
  **Caught and fixed one real robustness gap before calling this done:**
  the initial version opened the `evaluation_runs` row outside any
  try/catch, so migration 0019 not yet being applied to the live Supabase
  project (AC1's own still-pending note) would throw on literally every
  room, permanently exhausting `roomSweeper.js`'s
  `FEEDBACK_RETRY_MAX_ATTEMPTS` before a single student ever got feedback
  -- a regression the old pipeline never had. Fixed: opening the run is now
  its own try/catch, failure just means `runId` stays `null` (skip
  persisting artifacts, log it), feedback generation proceeds unaffected;
  added a regression test for exactly this. 57 new tests across
  `evaluationFeedbackPrompt.test.js`, `evaluationPipeline.test.js`,
  `geminiClient.test.js`'s new `generateEvaluationFeedback` block, and a
  fully rewritten `feedbackWorker.test.js` (12 cases, including the new
  evaluation-run persistence/failure paths). Full suite: `npm test
  --workspace=@placeme/server` 567/567 passing (same 4 pre-existing
  Node-version-gated RLS test files as states 1-6, confirmed unrelated).
  `npm run lint`: no new warnings. Checked off the state-7 task row in
  SPEC-0011, but **deliberately left AC7 itself unchecked** -- unlike
  AC1-AC6, AC7's own text requires guardrail #1 real-human verification,
  which automated tests cannot satisfy; also still pending: applying
  migration 0019 to the live Supabase project, and a real run against a
  live Gemini key (this session used only injected fakes, same as every
  prior state, but state 7 is the first one where that gap actually
  matters -- states 1-6 never touched the DB or a real model at all).
  Merged into `phase-2` and pushed, per the state-5-established
  convention -- `phase-2` is a working-integration branch, not `main`;
  guardrail #12/CLAUDE.md's `main` merge is separately gated on AC7.
- **2026-08-03 (same day, self-review before continuing further):** User
  asked directly whether states 1-7 actually work well -- honest answer
  given: code health is good (tests, structure, TDD discipline) but real
  -world validation is zero, and two concrete issues were found on
  re-reading state 7's own code rather than just trusting green tests.
  Fixed both, still on `feat/eval-feedback-decoupled` before its prior
  merge into `phase-2` was built further on: (1) the five criterion
  -evaluator calls ran sequentially (a real latency risk against the ~2
  minute lobby-poll budget `feedbackGeneration.js` already documents) --
  parallelized via `Promise.all` in `evaluationPipeline.js`'s
  `runCriterionEvaluators`, added a regression test asserting
  `maxConcurrentCalls > 1`; (2) the Feedback Generation prompt
  (`evaluationFeedbackPrompt.js`) claimed all evidence shown was the
  target's "own contributions," but `evidenceFor()` also includes evidence
  merely connecting them to another participant (needed for
  Listening/turn-taking notes) -- reworded to be accurate rather than
  misleading the model about whose words it's looking at. Also did the
  Gemini cost measurement the spec's own Risks table asked for "before
  merging state 7" and this session had missed: verified
  `gemini-3.6-flash` pricing live against `ai.google.dev/gemini-api/docs/pricing`
  ($1.50/M input, $7.50/M output -- not recalled from training data),
  modeled token counts for a 6-participant ~18-minute room, got ≈$0.10/room
  for the new pipeline vs ≈$0.055/room for the old one (~1.9x, in line with
  the spec's original qualitative estimate) -- at pilot volume this
  approaches the full <$100/month infra ceiling somewhere between 500 and
  1,000 rooms/month, before other hosting costs. Recorded both the fixes
  and the cost model in SPEC-0011 (Risks section + AC7's own note). Full
  suite re-run after the fixes: 568/568 passing (one single-run flake seen
  once during this pass, gone on three clean re-runs of the touched files
  -- attributed to a pre-existing real-timer retry-delay test under system
  load, not these changes). `npm run lint`: no new warnings. Committed on
  `feat/eval-feedback-decoupled`, fast-forwarded into `phase-2`, pushed
  both. AC7's status is unchanged by this entry -- still unchecked,
  human verification/live migration/live-key run are still the open items,
  this was a code-quality pass on top of the same unverified state.
- Next: state 8 (`test/eval-golden-suite`) — fixture transcripts +
  determinism/metamorphic (participant rename)/evidence-integrity tests in
  `npm test`. Note this does not itself satisfy AC7's human-verification
  gate; that remains open in parallel and must be resolved (migration
  applied, live-key run, real-human check) before any `dev` -> `main`
  release PR that includes state 7.

- **2026-08-03 (state 8, `test/eval-golden-suite`) — done.** New
  `apps/server/test/evaluationGoldenSuite.test.js`, run through the full
  `runEvaluationPipeline` composition (not a single stage in isolation --
  every other state's own test file already covers its stage alone). One
  shared 3-participant/4-line fixture transcript + a position-tag-based
  criterion-evaluator stub (branches only on the anonymous "P1"/"P2"/"P3"
  tag a real Gemini call would see, never on the real userId/displayName
  behind it, so it's a faithful stand-in for the real
  `criterionEvaluationPrompt.js` contract, not a toy).

  **Determinism**: the same fixture run three times concurrently, with
  randomized per-call latency jitter on the five criterion-evaluator calls
  (so completion order differs each run), still produces byte-identical
  scores/dimensions/confidence -- proves the pipeline's own
  aggregation/concurrency machinery (the `Promise.all` fan-out state 7's
  own review pass added) introduces no non-determinism of its own.
  **Named limitation, stated honestly in the file's own header comment,
  not glossed over**: every Gemini call here is dependency-injected (no
  live key, same as every prior state) -- this suite cannot measure real
  model sampling noise, only a live-key run can (already an open AC7
  item), so "determinism" here is scoped to what's actually testable
  without one.

  **Metamorphic**: the same fixture, re-run with every participant's
  userId/displayName replaced end to end (different ids, different
  names, same seat order), produces identical per-seat scores and
  confidence when matched by seat position, not name. **Verified as a
  real, non-vacuous check, not assumed**: temporarily mutated
  `transcriptAnalysisPrompt.js`'s `assignParticipantTags` to sort by
  display name instead of array position before assigning tags, re-ran
  the suite, watched the metamorphic test fail immediately
  (`expected null to be 100`), then reverted the mutation and confirmed
  green again -- the same "prove it, don't assume it" discipline this
  session's earlier work already applies to RLS/migration changes,
  applied here to a test-quality claim instead.

  **Evidence integrity**: a ledger mixing two genuine items with a
  fabricated quote and a cross-speaker-attribution item is verified
  end-to-end -- both bad items rejected with the exact right reason,
  every criterion-evaluator call captured and confirmed to only ever see
  the two surviving verified evidence ids, and the room still scores from
  what remains (a partially-bad ledger degrades to less evidence, not to
  a lost room). A second case confirms a fully-fabricated ledger falls
  back to the same transcription-failed message every participant gets
  for an empty transcript, per R9 -- never a fabricated score from zero
  surviving evidence.

  **Tests**: 4 new, all passing. Full suite fresh under Node 22
  (`npm test --workspace=@placeme/server`): **582/582 passing** (one
  unrelated single-run flake in `roomsApi.test.js`'s "409s when room is
  not in a startable state" -- a timeout, confirmed gone on two clean
  re-runs of that file alone, same pre-existing timing sensitivity
  state 7's own review entry already noted, not caused by this change).
  `npx oxlint apps/server/src apps/server/test`: same 2 pre-existing,
  unrelated warnings, no new ones.

  **Branch note**: `test/eval-golden-suite` (and `chore/eval-cutover-cleanup`,
  next) already existed as placeholder branches from early in this spec,
  stale at `bbe1f45` (pre-dating all of `phase-2`'s eval work, no unique
  commits of their own) -- fast-forwarded to current `phase-2` rather than
  recreated, since `bbe1f45` is an ancestor of `phase-2` and a clean
  fast-forward needed no force-push or history rewrite.

  **Residual/open:** none new -- this state adds regression coverage only,
  no behavior change, so guardrail #1's human-verification gate is
  unaffected and remains open from state 7 exactly as before. Next: state 9
  (`chore/eval-cutover-cleanup`).

- **2026-08-03 (state 9, `chore/eval-cutover-cleanup`) — partial, by
  direct user decision.** Per direct user instruction, asked to complete
  both remaining SPEC-0011 states in this session; hit a real gate on
  state 9's own scope before writing any code: AC9 (retiring the old
  single-shot scoring path) means actually *deleting*
  `feedbackGeneration.js`/`feedbackPrompt.js`'s scoring instructions/
  `geminiClient.generateFeedback`, and the spec's own Rollback section
  makes that deletion conditional on AC7's human verification already
  having passed -- which it hasn't (migration `0019` not yet confirmed
  live, no run against a live Gemini key, no real human has read real
  generated feedback yet). Flagged this conflict directly rather than
  guessing; **user chose: hold the actual deletion, do the rest of state 9
  now.**

  **Done this session:** a new, concrete "AC7 Human Verification
  Checklist" section in `SPEC-0011-eval-engine-redesign.md` -- three
  specific, human-only steps (apply migration `0019` live; run one real
  room through the pipeline against a live Gemini key; a real human reads
  every participant's actual generated feedback for correct attribution
  and non-discouraging tone) that must all be completed and recorded
  there before AC7 can be checked and AC9's deletion can proceed. Also
  confirmed by grep that no OTHER dead code exists outside the
  deliberately-kept old path -- every remaining non-test reference to
  `feedbackGeneration.js`/`feedbackPrompt.js` is either `feedbackWorker.js`'s
  own rollback-path documentation, its two genuinely-reused exports
  (`transcriptionFailedBody`, `DEFAULT_FEEDBACK_CONCURRENCY`), or shared
  constants (`FEEDBACK_DIMENSION_LABELS`, `MAX_LIST_ITEMS`) the new
  pipeline intentionally imports rather than duplicating --
  `generateFeedbackForRoom`/`geminiClient.generateFeedback` themselves are
  confirmed called from nowhere in the active path, same as state 7
  already established.

  **Explicitly NOT done, on purpose:** the old path is not deleted, AC9
  and its own task-list checkbox stay unchecked, and this spec is not
  marked done -- all three are the remaining scope of this same
  `chore/eval-cutover-cleanup` branch, picked back up once a human
  actually completes the new checklist above.

  **No production code or tests changed this entry** -- docs only
  (`SPEC-0011-eval-engine-redesign.md` + this file). Full suite not
  re-run for this reason (nothing it could regress).

  **Residual/open:**
  - The AC7 Human Verification Checklist itself is the single remaining
    blocker for closing out SPEC-0011 entirely -- needs a human with live
    Supabase + Gemini access, not something a future agent session can
    complete alone.
  - Once that checklist is done: come back to `chore/eval-cutover-cleanup`,
    delete the old path, check AC7/AC9, update this spec's own `Status`
    header from Draft, and move it from `docs/specs/active/` to
    `docs/specs/completed/` per `ENGINEERING.md`'s specification
    lifecycle.

- **2026-08-03 (`feat/eval-free-tier-support`) — sandbox harness built,
  live-quota wall hit and mitigated, per direct user instruction.** User
  stated directly: no runway right now, every provider must stay on its
  free tier, no paid billing -- saved as a project memory
  (`project_gd-proto-no-runway-free-tier-only`) since it's tighter than
  CLAUDE.md's own `<$100/month` ceiling and should shape future provider
  -related recommendations project-wide, not just this session's.

  **Built:** `supabase/migrations/0020_evaluation_sandbox.sql`
  (self-contained `eval_sandbox_runs` table, no FK to any production
  table -- pending the user's manual apply, same as every migration in
  this repo) + `apps/server/scripts/eval-sandbox.js`/
  `eval-sandbox-fixtures.js` (2 synthetic scenarios x 2 identity variants,
  live-Gemini bias/evidence test harness, writes only to the sandbox
  table). User's own first proposal (split pipeline stages across
  different LLM *providers*, e.g. OpenRouter) was pushed back on directly
  before building anything: doesn't fix the real constraint (other
  providers' free tiers are typically just as capped), is a real
  provider/architecture change against CLAUDE.md's fixed Gemini-only list
  (guardrail #2), and doesn't reduce hallucination risk beyond what this
  pipeline's existing schema-constrained + code-verified design already
  gives model-agnostically.

  **Real finding, live-verified not assumed:** first sandbox run hit a
  hard wall -- this project's Gemini key is capped at **20 requests/day
  per (project, model)** (confirmed from a real `429`'s own `quotaId`:
  `GenerateRequestsPerDayPerProjectPerModel-FreeTier`). At 1+5+N calls per
  room with every stage sharing one model, that is roughly **2 rooms/day,
  total** -- nowhere near pilot scale, and the actual reason two
  consecutive sandbox rounds failed mid-run. First live test round (before
  hitting the cap) still produced real signal from the `attendance-policy`
  scenario: the two strong, well-evidenced seats scored identically
  (100/100) across both identity variants; the one weak/quiet, 2-line
  seat moved 2.7 points (82.7 vs 80) between variants -- over the spec's
  own 2-point bounded-variance target, but in the direction opposite
  typical bias concerns (female-coded name scored higher), read as
  ordinary sampling noise on thin evidence, not a bias pattern.

  **Fix, also live-verified**: Google scopes free-tier quota per exact
  model string, confirmed both from the `429`'s own quotaId naming and by
  directly testing candidate models against this real key --
  `gemini-2.5-flash`/`gemini-2.5-flash-lite` are both dead (`404`, "no
  longer available to new users," despite third-party aggregator sites
  quoting rate limits for them that no longer apply here) but
  `gemini-3.6-flash`/`gemini-3.5-flash`/`gemini-3.5-flash-lite`/
  `gemini-3.1-flash-lite`/`gemini-3-flash-preview` are all live and
  callable. `agent/feedbackWorker.js` now defaults each pipeline stage to
  its own distinct model (`DEFAULT_TRANSCRIPT_ANALYSIS_MODEL`/
  `DEFAULT_CRITERION_EVALUATION_MODEL`/`DEFAULT_FEEDBACK_MODEL`, each
  independently overridable via its own `GEMINI_MODEL_*` env var, falling
  back to the existing shared `GEMINI_MODEL`) instead of one shared
  model -- still one vendor (Gemini), no ADR needed. The actual scoring
  engine (5 Criterion Evaluator calls) keeps today's flagship
  (`gemini-3.6-flash`) unchanged, since that stage's judgment quality
  matters most; Transcript Analysis (extraction, independently
  re-verified against the real transcript regardless of model quality)
  and Feedback Generation (prose only, R7: structurally cannot alter a
  score) each moved to their own separate, lighter model instead.
  `evaluation_runs.model`/`feedback.model` now record all three as one
  composite string rather than a single value. `eval-sandbox.js` reuses
  these exact same production defaults, so the sandbox round exercises
  the real split, not a separately-invented one.

  **Tests**: RED confirmed first -- 4 new tests in
  `feedbackWorker.test.js` (default per-stage model selection, a
  stage-specific env-var override, the shared `GEMINI_MODEL` fallback,
  and the composite `evaluation_runs.model` string), deliberately
  omitting the file's usual `generate*Fn` overrides so the real default
  closures run against a newly-mocked `llm/geminiClient.js`. Caught and
  fixed a real bug on the first run: a stray leftover reference to the
  old single `model` variable in the `insertFeedbackFn` call (removed
  when the three stage models were introduced) threw `model is not
  defined` and silently failed every pre-existing test in the file (8
  failures) until fixed -- full suite fresh under Node 22: **586/586
  passing**. `npx oxlint apps/server/src apps/server/test`: same 2
  pre-existing, unrelated warnings, no new ones.

  **Residual/open:**
  - This is a mitigation, not a fix -- the new per-room ceiling is bound
    by whichever stage's own (calls-per-room / 20-per-day) ratio is
    tightest (Criterion Evaluation's 5 calls/room, ≈4 rooms/day), a real
    improvement over the old combined ≈2 rooms/day but still short of
    pilot scale (5-10 *concurrent* rooms) -- that gap needs a paid tier,
    blocked on runway, not on anything fixable in code.
  - Migration `0020` not yet applied to the live Supabase project --
    sandbox rounds so far used `--no-db` (console report only); nothing
    persisted yet.
  - Second sandbox scenario (`remote-work`) has not yet completed a full
    round under the new model split -- next step is re-running
    `eval-sandbox.js` now that the free-tier wall has real headroom
    again.
  - Does not touch or resolve the AC7 Human Verification Checklist's own
    three live-key/live-Supabase items above -- this work only makes
    rigorous *pre*-verification testing possible within a $0 budget.
