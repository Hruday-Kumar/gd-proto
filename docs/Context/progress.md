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
| 3 | `feat/eval-criterion-scoring` | Not started | — | 5 criterion evaluators (all participants at once per dimension) + `domain/evalRubric.js`. |
| 4 | `feat/eval-score-aggregation` | Not started | — | Deterministic aggregator, pure functions, no LLM arithmetic. |
| 5 | `feat/eval-validation-layer` | Not started | — | Deterministic checks + bounded (max 2) targeted LLM rubric-validation retry. |
| 6 | `feat/eval-confidence-score` | Not started | — | Confidence from measurable components, pure functions. |
| 7 | `feat/eval-feedback-decoupled` | Not started | — | Cutover point: feedback generation reads validated scorecard/evidence; `feedback` row shape unchanged; requires guardrail #1 human verification before merge to `main`. |
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
- Next: state 3 (`feat/eval-criterion-scoring`) — the 5 criterion
  evaluators + `domain/evalRubric.js`, evaluating all participants
  together per dimension from the evidence ledger (not raw transcript).
