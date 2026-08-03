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
| More Gemini calls per room (≈1 + 5 + N vs today's N) raises latency/cost | Medium/Medium | Measured post-state-7 (2026-08-03), see note below: ≈$0.10/room modeled vs ≈$0.055/room old, ~1.9x. Criterion evaluators parallelized (state 7 fix) to bound latency; cost is the residual risk at real volume. | This session |
| New pipeline stalls mid-way (partial `evaluation_runs` row) | Low/Medium | `status` state machine + existing `roomSweeper`/retry-tracking pattern (`rooms.feedback_attempts`) reused, not reinvented | This session |
| Rubric subdimension design is itself subjective | Medium/Medium | Anchors documented explicitly in code + spec, reviewed like any PR; golden set catches drift | This session + reviewer |
| Scope creep back toward the full enterprise doc | Low/High | This spec's Non Goals list is explicit; guardrail #2 applies to every state | This session |
| Existing frontend/API breaks | Low/High | `feedback` table/route contract is explicitly unchanged (R8); state 7 verified against existing `place-me-UI` before merge | This session |

### Gemini cost estimate (2026-08-03, post-state-7)

Pricing verified live against `ai.google.dev/gemini-api/docs/pricing` (not
training-data recall, per guardrail #6's spirit): `gemini-3.6-flash` is
**$1.50 / million input tokens, $7.50 / million output tokens** (cached
input $0.15/M). Free-tier RPM/RPD limits are account/region-specific and
not published as a fixed number by Google itself (shown only in each
project's AI Studio console) -- moot in practice anyway, since even the
*old* pipeline's call volume would strain a free tier's low RPM the moment
two rooms end in the same minute (a routine event at 5-10 concurrent
rooms), so a paid tier is assumed regardless of this pipeline.

Modeled (not measured -- no real transcript or live key used yet) for one
ended room at `DEFAULT_MAX_ROOM_PARTICIPANTS` (6) and a ~18-minute
discussion (~3,000-token raw transcript):

| | Calls/room | Input tok | Output tok | Cost/room |
|---|---|---|---|---|
| Old (single-shot) | 6 | ~23,400 | ~2,700 | ~$0.055 |
| New (this pipeline) | 1 + 5 + 6 = 12 | ~22,900 | ~9,200 | ~$0.103 |

**≈1.9x the old per-room Gemini cost** -- close to the spec's own original
"≈1+5+N vs N" estimate, now with real pricing behind it. At monthly volume:
100 rooms/mo ≈ $10.33, 500 rooms/mo ≈ $51.67, 1,000 rooms/mo ≈ $103.35 --
i.e. Gemini spend alone approaches the full <$100/month infrastructure
ceiling (CLAUDE.md) somewhere between 500 and 1,000 rooms/month, *before*
Render/Supabase/LiveKit/AssemblyAI hosting costs are added on top of it.
Not counted here: validation retries (state 5, up to 2 extra criterion
-evaluator calls when a dimension is flagged) or Gemini's own 429/5xx retry
(`geminiClient.js`, up to 3 attempts) -- both add cost only in the
already-uncommon case of a malformed or transiently-failed response, so
the table above is a typical-case estimate, not a worst case.

**This is a token-count model, not a measurement** -- replace it with real
numbers (Gemini responses include token-usage metadata) the first time this
runs against a live key, per the still-open AC7 human-verification gate
below.

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
- [x] **AC3 (state 3):** Criterion evaluators produce anchored subdimension
      levels with evidence IDs for all participants in one call per
      dimension; unsupported/invented levels are rejected by schema
      validation. (`domain/evalRubric.js` + `domain/criterionEvaluationPrompt.js`
      + `llm/geminiClient.generateCriterionEvaluation`, commit pending;
      40 new tests, including adversarial invented-level, invented-
      subdimension, foreign-evidence-id, and missing-participant cases.)
- [x] **AC4 (state 4):** Dimension and overall scores are produced only by
      deterministic code from subdimension levels/weights; a unit test
      proves the LLM output alone (without the aggregator) never contains
      a final score. (`domain/scoreAggregator.js`, commit pending; 13 new
      tests covering every level/weight/insufficient-evidence combination;
      `criterionEvaluationPrompt.test.js`'s existing "has no numeric score
      field" test covers the LLM-output half.)
- [x] **AC5 (state 5):** Deterministic validation checks (evidence
      existence, quote match, score range, weight totals) run on every
      evaluation; a flagged criterion is retried at most twice, targeted
      only at that criterion. (`domain/validationLayer.js`, commit pending;
      evidence existence/quote-match closed-world checks already enforced
      by state 3's `parseCriterionEvaluationResponse` -- this state adds
      `validateWeightTotal`/`validateScoreRange` plus
      `evaluateCriterionWithValidation`'s bounded same-criterion retry
      around a flagged (parse-failing) response; 11 new tests.)
- [x] **AC6 (state 6):** Confidence and its component breakdown are stored
      per participant per run, computed only from measurable inputs.
      (`domain/confidenceCalculator.js`, commit pending; 23 new tests
      covering every component's edge cases (nothing attempted, nothing
      rejected, partial rejection, exhausted retry) plus
      `computeConfidenceForRun`'s end-to-end composition. "Stored" is
      literal persistence to `evaluation_confidence` -- deferred to state 7
      alongside the rest of the pipeline's `feedbackWorker.js` wiring, same
      pattern as states 2-5's pure/injectable-only scope.)
- [ ] **AC7 (state 7):** Feedback text is generated from the validated
      scorecard/evidence only; `feedback` table rows and both existing API
      routes are byte-for-byte compatible in shape with today; real-human
      verification (guardrail #1) confirms feedback still reads as useful
      and non-discouraging.
      **Code/tests done, guardrail #1 human verification NOT done --
      deliberately left unchecked per guardrail #1 ("never mark
      room/audio/transcription/attribution/feedback done on automated
      tests alone"), unlike AC1-AC6 which had no such requirement in their
      own text.** `domain/evaluationFeedbackPrompt.js` (Feedback Generation
      stage: schema has no score field, same by-construction technique as
      criterionEvaluationPrompt.js) + `llm/geminiClient.generateEvaluationFeedback`
      + `domain/evaluationPipeline.js` (composes states 2/3/4/5/6/7 into the
      full per-room pipeline, commit pending) + four new `db/evaluation*.js`
      modules + `agent/feedbackWorker.js` rewired to call the new pipeline
      and persist `evaluation_runs`/`evaluation_evidence`/
      `evaluation_criterion_results`/`evaluation_confidence` alongside the
      unchanged `feedback` row. 57 new tests (evaluationFeedbackPrompt,
      evaluationPipeline, geminiClient, feedbackWorker combined); full
      suite 567/567 passing. `feedback` row shape confirmed unchanged by
      test (`{summary, score, dimensions: [{label, score, note}], strengths,
      improvements}` -- identical fields, values now deterministically
      computed instead of invented). Old path
      (`domain/feedbackGeneration.js`/`feedbackPrompt.js`/
      `geminiClient.generateFeedback`) deliberately left intact and
      untouched, no longer called from `feedbackWorker.js` -- Rollback
      section's "single-file revert" contract. **Post-review fixes
      (2026-08-03, same day, before any of this was merged further):**
      the five criterion-evaluator calls ran sequentially in the first cut
      (a real latency risk against the ~2 minute lobby-poll budget) --
      parallelized via `Promise.all`, with a regression test proving
      concurrency; the Feedback Generation prompt's evidence section
      claimed all evidence was the target's "own contributions" when it
      can include evidence merely connecting them to another participant
      -- reworded to be accurate. Gemini cost modeled against live-verified
      pricing (see Risks section above): ≈$0.10/room, ~1.9x the old
      pipeline. **Still required before this can be considered done or
      merged to `main`:** (1) migration 0019
      applied to the live Supabase project (AC1's own still-pending item --
      this is the first state that actually writes to those tables); (2) a
      real room run through the full pipeline against a live Gemini key;
      (3) guardrail #1 real-human verification that feedback still reads as
      useful, attributed correctly, and non-discouraging.
- [x] **AC8 (state 8):** A golden fixture suite runs determinism,
      metamorphic (participant rename), and evidence-integrity tests in
      `npm test`. (`apps/server/test/evaluationGoldenSuite.test.js`, commit
      pending; 4 new tests, run through the full `runEvaluationPipeline`
      composition, not just a single stage in isolation.) **Determinism**:
      the same fixture transcript run three times concurrently (with
      randomized per-call latency jitter on the five criterion-evaluator
      calls, so completion order differs run to run) produces
      byte-identical scores/dimensions/confidence every time -- proves the
      pipeline's own aggregation/concurrency machinery introduces no
      non-determinism of its own. **Metamorphic**: the same fixture,
      re-run with every participant's userId/displayName replaced end to
      end, produces identical per-seat scores and confidence when matched
      by seat position -- verified as a real, non-vacuous check by a
      temporary mutation test (making `assignParticipantTags` sort by
      display name instead of position broke this test immediately, then
      reverted). **Evidence integrity**: a ledger mixing genuine evidence
      with a fabricated quote and a cross-speaker-attribution item is
      verified end to end -- both bad items are rejected with the correct
      reason, every criterion-evaluator call only ever sees the surviving
      verified evidence ids, and the room still scores from what remains;
      a fully-fabricated ledger falls back to the same
      transcription-failed message as an empty transcript, never a
      fabricated score. **Named limitation, stated in the test file's own
      header comment**: every Gemini call in this suite is
      dependency-injected (no live key, same as every prior state), so
      this cannot measure real model sampling noise -- only a live-key run
      (already an open AC7 item) can. `npm test --workspace=@placeme/server`:
      582/582 passing (one unrelated single-run flake in
      `roomsApi.test.js`'s "409s when room is not in a startable state",
      confirmed gone on two clean re-runs, same pre-existing timing
      sensitivity already noted in state 7's own review entry).
      `npx oxlint apps/server/src apps/server/test`: same 2 pre-existing,
      unrelated warnings, no new ones.
- [ ] **AC9 (state 9):** Old single-shot per-student scoring path
      (`feedbackPrompt.js`'s scoring instructions) is retired; docs/specs
      updated; no dead code remains.
      **Deliberately still unchecked and blocked, not silently
      incomplete** — this AC's own Rollback section makes its deletion
      step conditional on AC7's human verification already having
      passed, and that verification has not happened yet (see the AC7
      Human Verification Checklist below). Confirmed directly with the
      user (2026-08-03): hold the actual deletion until that checklist is
      complete, rather than delete now or silently skip this AC. Verified
      there is no OTHER dead code to remove in the meantime — every
      remaining reference to `feedbackGeneration.js`/`feedbackPrompt.js`
      from non-test code is either (a) `feedbackWorker.js`'s own comments
      documenting the still-intact rollback path, (b) its two genuinely
      still-used imports (`transcriptionFailedBody`,
      `DEFAULT_FEEDBACK_CONCURRENCY`, reused by
      `domain/evaluationPipeline.js` rather than duplicated), or (c)
      `FEEDBACK_DIMENSION_LABELS`/`MAX_LIST_ITEMS` — shared constants the
      new pipeline intentionally imports from `feedbackPrompt.js` rather
      than forking a second copy. `generateFeedbackForRoom`/
      `geminiClient.generateFeedback` themselves are confirmed called from
      nowhere in the active path (grepped `apps/server/src`), exactly as
      state 7 already documented — nothing further to clean up until the
      files themselves are deleted.

## AC7 Human Verification Checklist

Concrete, actionable steps to close AC7's still-open guardrail #1 gate —
until all three are done and recorded here, AC7 stays unchecked and AC9's
deletion step stays blocked per its own Rollback section. None of these are
satisfiable by an agent alone; each needs a real human with access to the
live Supabase project and a live Gemini key.

1. **Apply migration `0019_evaluation_pipeline_tables.sql`** to the live
   Supabase project (manual SQL Editor step, same process as every other
   migration in this repo) and confirm the five new tables
   (`evaluation_runs`, `evaluation_evidence`, `evaluation_criterion_results`,
   `evaluation_validation_issues`, `evaluation_confidence`) exist with the
   expected columns.
2. **Run one real room end-to-end** through the new pipeline against a
   live Gemini key (not an injected stub) — a real or realistic multi
   -participant GD session, through to `feedback` rows actually being
   persisted for every participant. Confirm `evaluation_runs.status`
   reaches `completed` (not `failed`) and capture the real Gemini
   token-usage numbers to replace this spec's modeled cost estimate
   (Risks section) with a measured one.
3. **A real human reads the actual generated feedback** for every
   participant in that room, including whichever participant scored
   lowest, and confirms directly:
   - scores are correctly attributed to the right person (no cross
     -participant mixups);
   - a low score still reads as specific and actionable, never harsh or
     discouraging (guardrail #1's own standard);
   - the summary/strengths/improvements text is coherent and genuinely
     useful, not just schema-valid.

Record the outcome of all three directly in this section (date, verifier,
what was observed) once done, then check AC7 and proceed with AC9's
deletion in a follow-up commit on `chore/eval-cutover-cleanup`.

**Status: not yet started** for the live-key/live-Supabase items above.
The sandbox groundwork below (self-contained test table + a live-Gemini
bias/evidence test harness) is done and gave real, though partial,
signal — see the next section.

## Sandbox Testing and Free-Tier Constraint (2026-08-03)

**Constraint, stated directly by the user:** no runway at this point —
every provider must stay on its free tier, no paid billing enabled. This
is tighter than CLAUDE.md's already-frozen `<$100/month` ceiling; that
figure assumed some willingness to pay, the real current constraint is
closer to $0. Multi-vendor LLM splitting (e.g. routing some stages
through a different provider such as OpenRouter) was considered and
explicitly rejected: it doesn't fix the actual constraint (other
providers' free tiers are typically just as capped, sometimes tighter),
adds a real architecture/scope change against CLAUDE.md's fixed
Gemini-only provider list (guardrail #2, would need its own ADR), and
doesn't reduce hallucination risk beyond what this pipeline's existing
schema-constrained-decoding + code-side verification design already
provides model-agnostically (evidence is checked against the real
transcript, no LLM output is ever trusted blindly, regardless of vendor).

**A self-contained sandbox environment** was built instead, so rigorous
bias/evidence testing could proceed against a live Gemini key without
ever touching real student data or the production `evaluation_*`/
`feedback`/`transcript_lines`/`rooms` tables:
- `supabase/migrations/0020_evaluation_sandbox.sql` — a new
  `eval_sandbox_runs` table with NO foreign key to any production table
  (every row is synthetic test data by construction, not a real room/
  student). Same RLS-enabled-zero-policy posture as every other
  pipeline-internal table.
- `apps/server/scripts/eval-sandbox.js` + `eval-sandbox-fixtures.js` — 2
  synthetic 3-participant GD scenarios × 2 identity variants each (same
  seats, same content, only names/genders swapped between variants,
  including names participants use to address each other mid-sentence —
  a real transcript-content leak vector the fully-injected
  `evaluationGoldenSuite.test.js` unit suite can never probe, since it
  never calls a real model). Reports a bias comparison (flags any seat
  whose score shifts more than the spec's own 2-point bounded-variance
  target across identity variants) and prints every evidence quote for
  direct human review.

**A real, live-quota finding surfaced immediately**: the project's
Gemini key is on Google's free tier, capped at **20 requests/day per
(project, model)** — confirmed directly from a real `429` response's own
`quotaId` (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`), not
assumed. A single room's own pipeline run costs 1+5+N calls (9 for a
3-person room); with every stage defaulting to one model, that one
20/day bucket capped real usage at roughly **2 rooms/day, total**, for
every stage combined — nowhere near this spec's own pilot-scale target
(5–10 concurrent rooms) even before counting dev/test usage.

**Fix, live-verified rather than assumed:** Google's quota is scoped per
exact model string, not pooled across a project's models (confirmed via
both the `429` response's own naming and empirical test calls against
this project's real key — `gemini-2.5-flash`/`gemini-2.5-flash-lite` are
both `404` "no longer available to new users," but `gemini-3.6-flash`,
`gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, and
`gemini-3-flash-preview` are all live and callable on this key).
`agent/feedbackWorker.js` now defaults each of the pipeline's three
stages to its own distinct model instead of one shared model —
`DEFAULT_TRANSCRIPT_ANALYSIS_MODEL` (`gemini-3.5-flash-lite`),
`DEFAULT_CRITERION_EVALUATION_MODEL` (`gemini-3.6-flash`, unchanged —
the actual scoring engine keeps today's flagship, since that stage's
judgment quality matters most), `DEFAULT_FEEDBACK_MODEL`
(`gemini-3.1-flash-lite`) — each independently overridable via
`GEMINI_MODEL_TRANSCRIPT_ANALYSIS`/`GEMINI_MODEL_CRITERION_EVALUATION`/
`GEMINI_MODEL_FEEDBACK`, falling back to the existing shared
`GEMINI_MODEL` env var, then to these defaults. `evaluation_runs.model`
and `feedback.model` now record all three as one composite string
(`transcript:…,criterion:…,feedback:…`) rather than a single value,
since no single model name is a complete answer to "what generated this
row" anymore. This is still a mitigation, not a full fix — the true
per-room ceiling is now bound by whichever stage's own (calls-per-room /
20-per-day) ratio is tightest (Criterion Evaluation's 5 calls/room, ≈4
rooms/day on its own bucket) rather than the old combined bottleneck
(≈2 rooms/day) — a real, meaningful, zero-cost improvement, but pilot
scale (5–10 *concurrent* rooms) still genuinely needs a paid tier, which
remains blocked on runway, not on anything this session could fix.

## Implementation Tasks (state = branch, in order)

- [x] `feat/eval-schema-foundation` — migrations for the 5 new tables.
- [x] `feat/eval-transcript-analysis` — Transcript Analysis service +
      deterministic evidence verifier.
- [x] `feat/eval-criterion-scoring` — 5 criterion evaluators + rubric
      module (`domain/evalRubric.js`).
- [x] `feat/eval-score-aggregation` — deterministic aggregator (pure
      functions, fully unit-testable without any LLM).
- [x] `feat/eval-validation-layer` — deterministic validators + bounded
      targeted LLM retry.
- [x] `feat/eval-confidence-score` — confidence calculator (pure
      functions).
- [x] `feat/eval-feedback-decoupled` — rewire `feedbackWorker.js` to the
      new pipeline; retire the old single-shot prompt; verify contract
      unchanged. ("Retire" = no longer called from the active path, not
      deleted -- Rollback section reserves deletion for state 9.) Human
      verification (AC7) still pending before merge to `main`.
- [x] `test/eval-golden-suite` — fixture transcripts + determinism /
      metamorphic / evidence tests.
- [ ] `chore/eval-cutover-cleanup` — remove dead code, update docs, human
      verification checklist, mark this spec done.
      **Partially done (2026-08-03): the human-verification checklist
      (see the new AC7 Human Verification Checklist section above) and
      docs are done; confirmed no dead code exists outside the
      deliberately-still-present old path. Dead-code removal (deleting
      `feedbackGeneration.js`/`feedbackPrompt.js`'s scoring
      instructions/`geminiClient.generateFeedback`) and marking this spec
      done are both deliberately deferred, per direct user instruction, to
      a follow-up commit on this same branch once the checklist above is
      actually completed by a human.**

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
