# SPEC-0011 — Evaluation engine redesign (deterministic, unbiased scoring)

**Status:** Draft
**Owner:** Claude Code (this session), pending user approval
**Reviewers:** Architect / Reviewer / Security Engineer / Pilot Engineer
**Issue:** direct user report — feedback scores read as "random"/inconsistent
and must never be biased; see `docs/Context/PlaceMe AI Evaluation Engine
Architecture Plan.docx` for the reference architecture this spec adapts.
**Target release:** incremental — one task branch per state below, each
merged into `dev` as it lands and is verified.

## Problem

Today's scoring (`domain/feedbackPrompt.js`, `llm/geminiClient.js`,
`domain/feedbackGeneration.js`) is a single Gemini call per student that
invents an overall 0–100 score, five dimension scores, and all feedback text
in one shot, cold, against the raw transcript. Concretely:

- No `temperature` is set anywhere in the Gemini call, so the same
  transcript can score differently across runs.
- The five rubric dimensions (`Content depth`, `Clarity`, `Confidence`,
  `Listening`, `Fluency`) are named but never defined — no anchors for what
  separates a 40 from a 70 from a 95.
- The overall score and the five dimension scores are generated
  independently in the same call with no code-level check that they're
  consistent with each other.
- There is no evidence trail — a score can't be traced back to a specific
  transcript quote.
- There is no calibration set, no determinism test, no bias/metamorphic
  test (e.g. renaming a student), and no validation of score *quality*,
  only of JSON *shape* (`parseFeedbackResponse`).
- Every student is scored in isolation with no cross-participant
  consistency for the same criterion in the same room.

This is a direct, user-reported quality and fairness problem: "no biased
scores are entertained" and scoring must actually help improve student
performance, which requires it to be trustworthy and explainable.

## Reference architecture and scope adaptation

`docs/Context/PlaceMe AI Evaluation Engine Architecture Plan.docx`
("the architecture doc") describes a full enterprise multi-tenant platform:
Temporal workflow orchestration, a dedicated Model Gateway service,
independently autoscaled worker pools, S3 object storage, Redis, a prompt
and rubric admin registry, multi-region deployment, and tenant quotas.

That is out of scope here per `CLAUDE.md`'s fixed constraints (pilot scale
5–10 rooms now / 20–30 in 3 months, <US$100/month, agent-dependent team,
mainstream-tech-only) and guardrail #2 (no scope creep without explicit
approval). **Confirmed with the user directly: implement this to pilot
level, not enterprise level.**

What this spec adopts from the doc — because it is what actually fixes
biased/random scores, and needs no new infrastructure:

- One immutable transcript, analyzed for evidence exactly once per room
  (not once per student).
- An evidence ledger: neutral, quote-verified observations, separate from
  judgment.
- Per-criterion evaluation across all participants at once (reduces
  per-student halo effects), with anchored subdimension levels instead of
  an invented 0–100 number.
- Deterministic score aggregation in application code — the LLM never does
  arithmetic.
- A validation layer combining deterministic checks and one bounded,
  targeted LLM rubric-validation retry.
- Confidence calculated from measurable components, not invented.
- Feedback generation as a separate stage that can explain but not change
  scores.
- A small, pilot-scale golden/determinism/metamorphic/evidence test suite.

What this spec explicitly does **not** adopt (named per guardrail #2, all
deferred, not built):

- Temporal or any durable workflow engine — orchestration stays a
  synchronous pipeline inside the existing `feedbackWorker.js`, using
  Postgres (`evaluation_runs.status`) for state, matching how
  `roomSweeper.js` already drives feedback generation today.
- A separate Model Gateway service — Gemini calls stay in
  `llm/geminiClient.js`, extended with `temperature` pinning and per-stage
  timeout/retry, not a new service.
- Independent autoscaled worker pools / Kubernetes HPA — pilot concurrency
  (5–10 rooms) is handled by the existing in-process concurrency limiter
  (`DEFAULT_FEEDBACK_CONCURRENCY` pattern), reused for the new fan-out.
- S3/object storage and Redis — stage artifacts (evidence ledger, criterion
  results) are stored as `jsonb` in existing Supabase Postgres, which the
  project already runs and pays for.
- A prompt/rubric admin registry service — prompts and the rubric
  (dimensions, subdimensions, anchors, weights) are versioned as code
  (`domain/evalRubric.js`, a `rubric_version` constant), reviewed via PR
  like any other code, not a runtime-editable registry.
- Multi-region, tenant quotas, vector DB, priority queues — not applicable
  at pilot scale.
- Rewriting the frontend or changing the external API contract — `feedback`
  keeps its existing shape (`score`, `dimensions: [{label, score, note}]`,
  `strengths`, `improvements`, `summary`) so `place-me-UI`'s already-built
  `ScoreRing`/`ScoreBar`/`FeedbackList` (BE-6/BE-7/BE-8/BE-9/BE-19) and
  `apps/web` keep working unmodified.

## Goals

- Re-running the same transcript through evaluation produces scores within
  a small, bounded variance (target: ≤ 2 marks / 100 per dimension),
  instead of fully independent re-generation.
- Every dimension score is traceable to specific evidence (transcript
  quotes), and every quote is verified to actually exist in the transcript.
- The overall score is a deterministic function of the five dimension
  scores — never independently invented by the LLM.
- Renaming participants or reordering unrelated formatting does not change
  a student's score (metamorphic invariant).
- A student's score no longer depends on which other students happen to be
  in the same room being scored in the same isolated call — one criterion
  is evaluated across the whole room together, from the same evidence.
  base, in one pass.
- Feedback text is generated from validated scores + evidence, and cannot
  alter those scores.
- The external API/DB contract for `feedback` is unchanged.

## Non Goals

- Any of the enterprise infrastructure listed above (Temporal, Model
  Gateway service, autoscaled worker pools, S3, Redis, vector DB,
  multi-region, tenant quotas, admin registry UI).
- Audio/video evidence, cross-session coaching, recruiter calibration,
  real-time evaluation — architecture doc's Phase 4, explicitly deferred.
- Changing the five rubric dimension labels or the frontend UI.
- A hosted eval platform (e.g. OpenAI Evals) — a small code-first fixture
  suite is used instead (also consistent with the doc's own note that
  OpenAI's Evals platform is being sunset).

## Requirements

### Functional

- **R1:** A `Transcript Analysis` stage runs once per room, producing a
  neutral evidence ledger (no scores, no judgments) from the raw
  transcript. No other stage receives the raw transcript.
- **R2:** Every evidence item references real transcript utterances; a
  deterministic verifier confirms quoted text and participant attribution
  match the stored transcript before evidence is used for scoring.
- **R3:** Each of the five rubric dimensions is evaluated once per room
  across all participants together, using only the evidence ledger (not
  the raw transcript), against explicit anchored subdimension levels
  (`demonstrated` / `partially_demonstrated` / `not_observed` /
  `contradicted` / `insufficient_context`).
- **R4:** Dimension and overall scores are computed by deterministic
  application code from subdimension levels and fixed weights — the LLM
  never outputs a final numeric score directly.
- **R5:** A validation layer deterministically checks evidence existence,
  quote matching, score range, and weight totals, plus one bounded
  (max 2 retries) targeted LLM rubric-validation pass per criterion.
- **R6:** Confidence is computed from measurable components (transcript
  integrity, speaker attribution quality, evidence sufficiency, validation
  success) and stored with its breakdown — never asked of the LLM directly.
- **R7:** Feedback text generation receives the validated scorecard and
  evidence (not the raw transcript) and cannot modify any score.
- **R8:** `feedback` table rows and the `GET /api/rooms/:id/feedback/mine`
  / `GET /api/history/mine` responses are unchanged in shape.
- **R9:** Missing evidence (`insufficient_context`/`not_observed`) is never
  treated as, or scored like, negative evidence.

### Security, privacy, and operations

- **R10:** Raw transcript access stays restricted to the Transcript
  Analysis stage only — no wider than today's access pattern (guardrail
  #4, retention/minimization already covers the transcript itself).
- **R11:** All new tables carry the same RLS posture as `feedback` today —
  server/service-role writes only, `select own` (or no client access at
  all) for students; stage-internal tables (evidence, criterion results)
  are not directly student-readable.
- **R12:** Guardrail #1 still applies: no scoring/feedback change is marked
  done on automated tests alone — real-human verification of attribution
  and non-discouraging tone is required before merge to `main`.
- **R13:** Every Gemini call in the pipeline pins `temperature` (low, fixed
  value) and is traced (stage, prompt version, rubric version, model,
  token counts, latency) via structured `console.log`/existing logging —
  no new observability infrastructure.

## Design

### Pipeline (per room, triggered the same way feedback is today — by
`roomSweeper.js` on room end, executed inside `feedbackWorker.js`)

```
transcript (frozen, from transcript_lines)
        |
        v
[1 Gemini call]  Transcript Analysis
        conversation_understanding + evidence_ledger
        (neutral only — no scores, no coaching language)
        |
        v
Deterministic Evidence Verifier
        quote match, participant attribution, utterance order
        |
        v
[5 Gemini calls, one per dimension, all participants at once]
Criterion Evaluators (Content depth / Clarity / Confidence / Listening / Fluency)
        subdimension levels + evidence_ids + reasoning, per participant
        |
        v
Validation Layer
        deterministic checks (always)
        + targeted LLM rubric-validation retry (only on flagged issues, max 2)
        |
        v
Deterministic Score Aggregator (pure code)
        subdimension levels + weights -> dimension score -> overall score
        |
        v
Confidence Calculator (pure code)
        |
        v
[N Gemini calls, one per participant, existing concurrency limiter]
Feedback Generation (scorecard + evidence -> strengths/improvements/summary)
        |
        v
feedback table (unchanged shape) -> existing API -> existing frontend
```

### Rubric (versioned as code, not a runtime registry)

`domain/evalRubric.js` (new, state 1) defines, per existing dimension
label, 2–3 observable subdimensions with anchor descriptions and a weight
summing to 1.0 within the dimension. Example (finalized during state 3):

```
Reasoning-adjacent example from the architecture doc, adapted to
"Content depth":
Content depth
├── Relevance to topic         (weight 0.4)
├── Depth of support/reasoning (weight 0.4)
└── Factual soundness          (weight 0.2)
```

Subdimension level -> mark mapping (deterministic, pure code):
`demonstrated` = 100%, `partially_demonstrated` = 60%, `contradicted` = 20%,
`not_observed` / `insufficient_context` = excluded from the weighted
average (not scored as 0) and reduces that dimension's confidence
component instead. If every subdimension for a criterion is
`insufficient_context`, that dimension's score is `null` (never a
fabricated number) and confidence reflects it.

### Data model (Postgres/Supabase, additive migrations only)

New tables, all server/service-role-written, none directly client-writable
(same posture as `feedback`):

- `evaluation_runs` — id, room_id, transcript_hash, status, rubric_version,
  prompt_bundle_version, model, started_at, completed_at, error.
- `evaluation_evidence` — id, run_id, participant user_id, utterance_ids,
  sequence_start/end, evidence_type, exact_quote, neutral_description,
  related_participants, extraction_confidence.
- `evaluation_criterion_results` — id, run_id, user_id, criterion_label,
  subdimensions (jsonb), score, weight_applied.
- `evaluation_validation_issues` — id, run_id, criterion_label, user_id,
  issue_type, detail, resolved, retry_count.
- `evaluation_confidence` — id, run_id, user_id, confidence, components
  (jsonb).

`feedback` (existing table) is populated as the final step from these,
keeping its current columns unchanged. Full column definitions land with
the state-1 migration.

### Determinism and bias controls

- `temperature` pinned low (near 0) on every evaluation-stage Gemini call —
  the single biggest fix for run-to-run score variance.
- Per-criterion evaluation scores all participants together from the same
  evidence in one call, removing the isolated-per-student inconsistency.
- Deterministic aggregation removes the independent overall-vs-dimension
  drift that exists today.
- Golden fixture suite (state 8) adds determinism tests (repeated runs,
  bounded variance) and metamorphic tests (renaming participants must not
  change scores) as regression gates in `npm test`.

## Risks

| Risk | Likelihood/impact | Mitigation | Owner |
|---|---|---|---|
| More Gemini calls per room (≈1 + 5 + N vs today's N) raises latency/cost | Medium/Medium | Gemini Flash is cheap; reuse existing concurrency limiter; measure against the <$100/mo budget before merging state 7 | This session |
| New pipeline stalls mid-way (partial `evaluation_runs` row) | Low/Medium | `status` state machine + existing `roomSweeper`/retry-tracking pattern (`rooms.feedback_attempts`) reused, not reinvented | This session |
| Rubric subdimension design is itself subjective | Medium/Medium | Anchors documented explicitly in code + spec, reviewed like any PR; golden set catches drift | This session + reviewer |
| Scope creep back toward the full enterprise doc | Low/High | This spec's Non Goals list is explicit; guardrail #2 applies to every state | This session |
| Existing frontend/API breaks | Low/High | `feedback` table/route contract is explicitly unchanged (R8); state 7 verified against existing `place-me-UI` before merge | This session |

## Acceptance Criteria

- [x] **AC1 (state 1):** New tables exist via a reviewed migration; no
      existing behavior changes; `npm test` still passes unmodified.
      (`0019_evaluation_pipeline_tables.sql`, commit `dc8f3c4`. Still
      pending: manual application to the live Supabase project.)
- [x] **AC2 (state 2):** Transcript Analysis stage produces a verified
      evidence ledger for a fixture transcript; fabricated-quote and
      wrong-attribution cases are rejected by the deterministic verifier.
      (`domain/transcriptAnalysisPrompt.js` + `domain/evidenceVerifier.js`,
      commit `3b946d9`; 33 tests, including adversarial fabricated-quote
      and cross-speaker-attribution cases.)
- [ ] **AC3 (state 3):** Criterion evaluators produce anchored subdimension
      levels with evidence IDs for all participants in one call per
      dimension; unsupported/invented levels are rejected by schema
      validation.
- [ ] **AC4 (state 4):** Dimension and overall scores are produced only by
      deterministic code from subdimension levels/weights; a unit test
      proves the LLM output alone (without the aggregator) never contains
      a final score.
- [ ] **AC5 (state 5):** Deterministic validation checks (evidence
      existence, quote match, score range, weight totals) run on every
      evaluation; a flagged criterion is retried at most twice, targeted
      only at that criterion.
- [ ] **AC6 (state 6):** Confidence and its component breakdown are stored
      per participant per run, computed only from measurable inputs.
- [ ] **AC7 (state 7):** Feedback text is generated from the validated
      scorecard/evidence only; `feedback` table rows and both existing API
      routes are byte-for-byte compatible in shape with today; real-human
      verification (guardrail #1) confirms feedback still reads as useful
      and non-discouraging.
- [ ] **AC8 (state 8):** A golden fixture suite runs determinism,
      metamorphic (participant rename), and evidence-integrity tests in
      `npm test`.
- [ ] **AC9 (state 9):** Old single-shot per-student scoring path
      (`feedbackPrompt.js`'s scoring instructions) is retired; docs/specs
      updated; no dead code remains.

## Implementation Tasks (state = branch, in order)

- [x] `feat/eval-schema-foundation` — migrations for the 5 new tables.
- [x] `feat/eval-transcript-analysis` — Transcript Analysis service +
      deterministic evidence verifier.
- [ ] `feat/eval-criterion-scoring` — 5 criterion evaluators + rubric
      module (`domain/evalRubric.js`).
- [ ] `feat/eval-score-aggregation` — deterministic aggregator (pure
      functions, fully unit-testable without any LLM).
- [ ] `feat/eval-validation-layer` — deterministic validators + bounded
      targeted LLM retry.
- [ ] `feat/eval-confidence-score` — confidence calculator (pure
      functions).
- [ ] `feat/eval-feedback-decoupled` — rewire `feedbackWorker.js` to the
      new pipeline; retire the old single-shot prompt; verify contract
      unchanged.
- [ ] `test/eval-golden-suite` — fixture transcripts + determinism /
      metamorphic / evidence tests.
- [ ] `chore/eval-cutover-cleanup` — remove dead code, update docs, human
      verification checklist, mark this spec done.

Each branch: rebased onto latest `dev` before starting, PR'd individually,
`pr-review` skill run before merge, per `BRANCHING.md`. Progress tracked in
`docs/Context/progress.md`, updated alongside every state.

## Testing

- Unit: rubric anchor mapping, deterministic aggregator (all
  level/weight/insufficient-evidence combinations), evidence verifier
  (quote match / mismatch / fabricated ID), validation checks, confidence
  formula — all runnable with no live Gemini key (matches this repo's
  existing pattern of injecting `generate`).
- Integration: full pipeline against fixture transcripts with a stubbed
  Gemini client, asserting final `feedback` row shape matches today's.
- Regression: existing `feedbackGeneration`/`feedbackPrompt`/`geminiClient`
  tests continue to pass until state 7 explicitly retires the old path
  (with replacement coverage first).
- Manual/real-device: guardrail #1 human verification before state 7/9
  merge to `main`.

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| AC1–AC9 | Per-state `npm test` run + PR review + (AC7/AC9) human verification | Pending |

## Monitoring

Per-stage structured log line (room/run id, stage, model, temperature,
token counts, latency, validation result, retry count) via existing
`console.log`/error patterns — no new observability stack. Watch: invalid
LLM-output rate, validation-retry rate, `evaluation_runs.status = 'failed'`
rate, feedback generation latency (must stay inside the ~2 minute lobby
poll window per `feedbackGeneration.js`'s existing comment).

## Rollout

State-by-state merges to `dev`. The new pipeline is only cut over to be the
system of record for `feedback` in state 7 (`feat/eval-feedback-decoupled`)
— until then it runs in shadow (writes to the new tables only) with the
existing single-shot path still producing `feedback` rows, so nothing
user-facing changes before state 7's explicit human verification.

## Rollback

Any state before 7: revert the branch's migration/code, no user-facing
impact (shadow mode). State 7 (cutover): keep the old
`feedbackPrompt.js`/`geminiClient.generateFeedback` path intact and
revertable via a single flag/import swap in `feedbackWorker.js` until state
9 explicitly deletes it — state 9 is the only irreversible step, gated on
AC7's human verification having already passed.

## Approvals

- Specification: pending user approval (this document)
- Architecture: pending
- Security: pending (`$placeme-security` before state 7/9 merge)
- Pilot: pending (`$placeme-pilot` before state 7/9 merge to `main`)
