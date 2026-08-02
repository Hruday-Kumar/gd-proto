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
| 1 | `feat/eval-schema-foundation` | In progress | 2026-08-02 | Additive migration for `evaluation_runs`, `evaluation_evidence`, `evaluation_criterion_results`, `evaluation_validation_issues`, `evaluation_confidence`. No behavior change. |
| 2 | `feat/eval-transcript-analysis` | Not started | — | Transcript Analysis Service (1 Gemini call/room) + deterministic evidence verifier. |
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
- Next: implement state 1 (schema migration) on `feat/eval-schema-foundation`,
  verify, update this file, then stop for check-in before continuing to
  state 2 (per guardrail #9 — one core unit at a time, not all 9 states in
  one unreviewed pass).
