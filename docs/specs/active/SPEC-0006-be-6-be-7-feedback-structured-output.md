# SPEC-0006 — Structured feedback output (BE-6 numeric score + BE-7 per-dimension rubric)

**Status:** Draft
**Owner:** Claude Code (this session), pending user approval
**Reviewers:** Architect / Reviewer / Security Engineer / Pilot Engineer
**Issue:** `place-me-UI/docs/BACKEND_REQUIREMENTS.md` BE-6, BE-7 (also feeds BE-8/BE-9/BE-19, which stay out of scope — see Non Goals)
**Target release:** next `dev` merge after BE-4 (`feat/be-4-room-level`) lands

## Problem

Gemini feedback generation (`domain/feedbackPrompt.js`) explicitly instructs
the model to reply with "a single plain paragraph. No numeric scores, no
bullet points, no headings," and `feedback` (the table, `db/feedback.js`)
has only a `body text` column. `place-me-UI` — the in-progress redesigned
frontend, still real for auth/rooms/matching/transcript but not yet for this
— already ships a full feedback layout (`ScoreRing`, a 5-dimension
`ScoreBar` rubric, "What worked"/"Fix next time" `FeedbackList`s) built
against hardcoded mock data in `src/lib/demo.ts`, with an explicit code
comment at `ended.$roomId.tsx:209-216` marking it fixture data "kept exactly
as designed until the backend returns structured feedback." `gd-proto`'s
own shipping frontend (`apps/web`) has no such UI today — it renders
`feedback` as one `<p>`.

No concrete bad-output complaint is driving this; it's a proactive
structural change requested directly by the user, scoped by their own
instruction: check what the frontend already expects, and shape the JSON
response around that.

## Goals

- Gemini returns structured JSON per student: an overall 0–100 score, a
  fixed 5-dimension rubric (label/score/note), 2–3 strengths, 2–3
  improvement items, and a short prose summary (replacing today's whole
  paragraph as the summary field).
- `feedback` table persists all of the above.
- `GET /api/rooms/:id/feedback/mine` and `GET /api/history/mine` return the
  new fields, additively — the existing `feedback: string|null` key is
  unchanged in meaning (still the prose summary), so any caller reading only
  `.feedback` keeps working with zero changes.
- `place-me-UI`'s existing feedback UI (`ended.$roomId.tsx` /
  `app.ended.tsx`) is wired to the real fields, and its three mock imports
  (`feedbackScores`, `feedbackStrengths`, `feedbackImprovements`) are
  removed from that call site.
- Guardrail #1 ("never discouraging") is preserved explicitly for every new
  numeric/critical field, not just the old prose paragraph.

## Non Goals

- BE-8 (score trend), BE-9 (aggregate stats), BE-19 (re-labeling "analyzed"
  sessions) — all explicitly deferred in `BACKEND_REQUIREMENTS.md` as
  depending on this change, not part of it.
- BE-10/BE-17 (talk-time share) and BE-11 (transcript line tagging) — the
  `ended.$roomId.tsx` mock card's talk-time/filler-word/citation badges and
  the transcript's per-line "Strong point"/"Interruption" tags stay mock;
  unrelated data sources (needs per-speaker duration tracking and
  line-level tagging, neither of which this change touches).
- Rewriting `apps/web` (gd-proto's shipping frontend) to render the new
  score/rubric/strengths/improvements UI. It keeps working unmodified
  (same `feedback` string), but won't visually show the new data. Flagged
  as an open scope question below, not decided here.
- Changing the "vs your last session" delta badge or the "suggested next
  topic" card in `ended.$roomId.tsx` — separate mock, unrelated to this
  change (no score history exists yet; that's BE-8).
- Renaming the `body` column or the `feedback` API key. `body` keeps
  storing the prose summary under its existing name; no breaking rename.

## Open scope question for the user

`place-me-UI` currently has substantial **uncommitted** working-tree changes
(staged deletions of the old mock `ended.tsx`/`lobby.tsx`/`session.tsx`
routes, plus unstaged edits across `api.ts`, `auth-context.tsx`, and most
routes — an in-progress "wire real API" pass, not something this task
should barrel through blind). Before touching `ended.$roomId.tsx` or
`lib/api.ts` there: **should this session commit/stash that existing work
first, or is it safe to layer this change directly on top of the working
tree as-is?**

Also, `gd-proto` is currently on branch `feat/be-4-room-level` (3 commits
ahead of `dev`, BE-4's room-creation half, not yet PR'd) — per
`BRANCHING.md` this feedback work needs its **own** branch off `dev`, not
to be added onto BE-4's branch. Confirming that's fine before branching.

## Requirements

### Functional

- **R1:** `buildFeedbackPrompt` requests Gemini's structured-output mode
  (`generationConfig.responseMimeType: "application/json"` +
  `responseSchema`) instead of free prose, keeping the existing per-student
  scoping and the untrusted-topic delimiting (H5) exactly as today.
- **R2:** The JSON contract is:
  ```json
  {
    "summary": "one short paragraph, constructive, never discouraging",
    "score": 72,
    "dimensions": [
      { "label": "Content depth", "score": 80, "note": "one short clause" },
      { "label": "Clarity", "score": 75, "note": "..." },
      { "label": "Confidence", "score": 70, "note": "..." },
      { "label": "Listening", "score": 68, "note": "..." },
      { "label": "Fluency", "score": 70, "note": "..." }
    ],
    "strengths": ["...", "..."],
    "improvements": ["...", "..."]
  }
  ```
  Dimension labels are the fixed 5 already rendered by `place-me-UI`
  (Content depth / Clarity / Confidence / Listening / Fluency) — schema
  enforces exactly these five, in this order, so the frontend never has to
  handle an unknown label.
- **R3:** `parseFeedbackResponse` validates the shape defensively before it
  ever reaches the DB or a student: `score` and every dimension `score`
  clamped/rejected outside 0–100, exactly 5 dimensions with the exact
  expected labels, `strengths`/`improvements` capped at a small max length
  (same defense-in-depth spirit as N2's topic-length constraint — a verbose
  or malformed model reply must fail loudly, not corrupt a row or 500 a
  route).
- **R4:** The existing `TRANSCRIPTION_FAILED_MESSAGE` short-circuit
  (`feedbackGeneration.js`) — used when transcription itself produced no
  transcript — returns the equivalent structured shape with `score: null`,
  empty `dimensions`/`strengths`/`improvements`, and the existing message as
  `summary`. Guardrail #1 already required this path never fabricate a
  performance judgment from silence; a null score (not a real number, not
  a made-up low score) keeps that true under the new schema too.
- **R5:** Migration `0017_feedback_structured_output.sql` adds
  `score integer`, `dimensions jsonb not null default '[]'`,
  `strengths jsonb not null default '[]'`, `improvements jsonb not null
  default '[]'` to `feedback`, plus
  `check (score is null or (score between 0 and 100))`. `body` is unchanged
  (now holds `summary`). No RLS policy change — same reasoning as `0007`:
  `feedback` has no client-writable policy today and doesn't need one for
  these columns either.
- **R6:** `db/feedback.js`'s `insertFeedback`, `getFeedbackForRoomAndUser`,
  and `listFeedbackForUserAndRooms` are extended to write/read the four new
  columns.
- **R7:** `GET /api/rooms/:id/feedback/mine` response gains
  `score, dimensions, strengths, improvements` alongside the unchanged
  `feedback` key. `GET /api/history/mine` (`buildSessionHistory`) gains the
  same four fields per session.
- **R8:** `place-me-UI/src/lib/api.ts`'s `getMyFeedback` return type is
  extended to match; `ended.$roomId.tsx` (and `app.ended.tsx`, its
  native-shell twin) render `ScoreRing`/`ScoreBar`/`FeedbackList` from the
  real response instead of the `demo.ts` mock imports, with a defined
  fallback state for `score: null` (transcription-failed case) that doesn't
  render a 0 as if it were a real low score.

### Security, privacy, and operations

- **R9:** No change to authentication, RLS, or retention — feedback rows
  are still service-role-only inserts, still `select own` only, still
  deleted on account deletion via the existing `feedback` FK cascade.
- **R10:** Gemini JSON-mode failures (malformed JSON, wrong dimension
  labels, out-of-range scores) must surface as this student's own
  generation error (existing per-student isolation in
  `feedbackGeneration.js`'s `generateForParticipant`), never abort the
  batch or another student's result.
- **R11:** Guardrail #1's human-verification gate applies to this change in
  full: a real session, a real low-scoring dimension included, confirmed by
  a human that the framing still reads constructive and non-discouraging —
  not just that the JSON parses.

## Design

### Prompt (`domain/feedbackPrompt.js`)

Keep the existing structure (per-student scoping check, untrusted-topic
delimiting, full attributed transcript) and replace only the closing
instruction block: instead of "Respond with a single plain paragraph,"
instruct the model to score across the five fixed dimensions and return the
JSON contract above, with an explicit line carried over unchanged from
today's prompt: *"Never discouraging — a low score must still read as
specific and actionable, not harsh."* Pass `responseSchema` via
`generationConfig` (Gemini's structured-output mode) rather than relying on
prompt wording alone to keep the shape reliable — a stricter, additive
version of `topicPrompt.js`'s existing JSON-parsing pattern (topics already
parse a JSON reply; feedback currently doesn't).

### Gemini client (`llm/geminiClient.js`)

`callGemini`'s request body gains `generationConfig: { responseMimeType:
"application/json", responseSchema }`, passed through from
`buildFeedbackPrompt`/`generateFeedback`. `generateTopic`'s call path is
untouched (topics keep their existing shape).

### Generation orchestration (`domain/feedbackGeneration.js`,
`agent/feedbackWorker.js`)

`generate(prompt)` now resolves to the structured object instead of a
string. `generateForParticipant`'s `result.body` becomes the whole object;
`feedbackWorker.js`'s `insertFeedbackFn` call is expanded to pass
`body: result.body.summary, score: result.body.score, dimensions:
result.body.dimensions, strengths: result.body.strengths, improvements:
result.body.improvements`. The `TRANSCRIPTION_FAILED_MESSAGE` short-circuit
returns the matching structured stub per R4 instead of a bare string.

### Schema (migration `0017`)

```sql
alter table public.feedback
  add column if not exists score integer,
  add column if not exists dimensions jsonb not null default '[]',
  add column if not exists strengths jsonb not null default '[]',
  add column if not exists improvements jsonb not null default '[]',
  add constraint feedback_score_range check (score is null or (score between 0 and 100));
```

### API contract

`GET /api/rooms/:id/feedback/mine`:
```json
{
  "feedback": "prose summary, unchanged key/meaning",
  "score": 72,
  "dimensions": [{ "label": "Content depth", "score": 80, "note": "..." }],
  "strengths": ["..."],
  "improvements": ["..."],
  "rating": true,
  "ratingReason": "..."
}
```
`score`/`dimensions`/`strengths`/`improvements` are `null`/`[]` for
pre-migration rows and for the transcription-failed stub — callers must
treat absence as "not available," never render a missing score as 0.

`GET /api/history/mine` — each session object in `sessions[]` gains the
same four fields, sourced the same way.

### Frontend (`place-me-UI` only, pending the open scope question above)

`ended.$roomId.tsx`/`app.ended.tsx`: drop the `feedbackScores` /
`feedbackStrengths` / `feedbackImprovements` imports from `lib/demo.ts` at
this call site (leave `demo.ts` itself alone — other routes may still use
it), source `ScoreRing`/`ScoreBar`/`FeedbackList` from the real
`getMyFeedback` response, and add a "score pending" state distinct from
"feedback pending" for the transcription-failed case (`score: null`) so it
doesn't render `ScoreRing score={0}`. `lib/api.ts`'s `getMyFeedback` return
type gains the four new fields.

## Risks

| Risk | Likelihood/impact | Mitigation | Owner |
|---|---|---|---|
| Gemini JSON mode returns malformed/incomplete JSON despite `responseSchema` | Medium / one student loses feedback | R3's defensive parse validation fails that student's `generateForParticipant` call only (existing per-student isolation), logs, doesn't throw across the batch | this session |
| A genuinely low score reads as discouraging despite prompt wording | Low probability, high guardrail-#1 impact | R11 — mandatory human verification with a real low-scoring session before "done" | user (human gate) |
| Migration adds columns while `feedbackWorker.js` still inserts the old shape (deploy-order gap) | Medium / insert fails or silently drops new fields | Migration applied manually before the code paths that write the new columns ship, same sequencing discipline as every prior migration in §3 of `PLAN.md` | user (manual apply step) |
| Editing `place-me-UI` on top of its existing uncommitted "wire real API" changes | Medium / merge/consistency risk in someone else's in-flight work | Resolved by the open scope question above before any edit there | user |
| `gd-proto` work landing on the wrong branch (`feat/be-4-room-level` instead of a fresh branch off `dev`) | Low if caught now / rework later if not | New branch off `dev` per `BRANCHING.md`, confirmed before first commit | this session |

## Acceptance Criteria

- [ ] **AC1:** A live Gemini call for a real transcript returns the 5-field
      JSON contract; `parseFeedbackResponse` accepts it.
- [ ] **AC2:** A deliberately malformed/out-of-range mock Gemini response is
      rejected by `parseFeedbackResponse` with a clear error, and that
      failure isolates to one student in `generateFeedbackForRoom` (existing
      isolation test pattern, extended).
- [ ] **AC3:** `insertFeedback`/`getFeedbackForRoomAndUser` round-trip all
      four new columns.
- [ ] **AC4:** `GET /api/rooms/:id/feedback/mine` and `GET /api/history/mine`
      both return the new fields in a live/integration test.
- [ ] **AC5:** The transcription-failed stub (R4) has `score: null` and
      empty arrays, never a fabricated number.
- [ ] **AC6 (guardrail #1, human gate):** A real ended session with at least
      one below-average dimension score, viewed by a real human, reads as
      constructive and specific, not discouraging.
- [ ] **AC7 (pending open scope question):** `place-me-UI`'s
      `ended.$roomId.tsx` renders real score/rubric/strengths/improvements,
      with the three `demo.ts` mock imports removed from that call site.

## Implementation Tasks

- [ ] Branch `feat/be-6-be-7-feedback-structured-output` off `dev` (not off
      `feat/be-4-room-level`).
- [ ] RED/GREEN: `feedbackPrompt.test.js` — new JSON-schema prompt shape.
- [ ] RED/GREEN: `feedbackPrompt.test.js` — `parseFeedbackResponse` shape
      validation (valid input, missing dimension, out-of-range score,
      wrong label, oversized arrays).
- [ ] RED/GREEN: `geminiClient.test.js` — `generationConfig` passthrough.
- [ ] RED/GREEN: `feedbackGeneration.test.js` — structured `generate()`
      result, transcription-failed stub shape.
- [ ] RED/GREEN: `feedbackWorker.test.js` — persists all four new fields.
- [ ] Migration `0017_feedback_structured_output.sql`.
- [ ] `db/feedback.js` read/write extension + its existing tests.
- [ ] `api/routes/rooms.js` + `domain/sessionHistory.js` response extension
      + `historyApi.test.js`/`roomsApi.test.js` updates.
- [ ] (Pending scope answer) `place-me-UI` frontend wiring.
- [ ] Update `place-me-UI/docs/BACKEND_REQUIREMENTS.md` BE-6/BE-7 rows to
      "code complete."
- [ ] Update `docs/engineering/PLAN.md` §5f and §3 (new migration row).

## Testing

- Unit: prompt construction, response parsing/validation (valid + every
  rejection case), transcription-failed stub shape.
- Integration: `feedbackWorker`/`feedbackGeneration` end-to-end with a
  mocked `generate`, DB round-trip via `db/feedback.js`, both API routes.
- Manual/real-device: one real session end-to-end, real Gemini call,
  human-read result (AC6).
- Regression: existing feedback-rating (`FeedbackRating.jsx`,
  `rateFeedback`), `apps/web`'s unmodified rendering of the unchanged
  `feedback` string key, history page's existing behavior for pre-migration
  rows (nulls, not crashes).

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| AC1–AC5 | `npm test` output (server workspace) | Pending |
| AC6 | Manual real-session record, guardrail #1 | Pending |
| AC7 | Manual browser check against real API | Pending |

## Monitoring

Existing `console.error` per-student failure logging in
`feedbackWorker.js`/`feedbackGeneration.js` extended to note JSON-parse
failures distinctly from network/Gemini-error failures, so a spike in
malformed responses (e.g. after a model version change) is distinguishable
from ordinary transient errors in logs. No new dashboard.

## Rollout

Apply migration `0017` to the live Supabase project before merging the code
that writes the new columns (same order as every prior migration — see
`PLAN.md` §3). `place-me-UI` frontend change (if in scope) ships after the
API change is live, so it never renders `undefined` for the new fields.

## Rollback

Migration is additive only (new nullable/defaulted columns, no drop/rename)
— safe to leave in place even if the code is rolled back; old code simply
never reads the new columns. Reverting the application code makes
`feedback`/`insertFeedback` calls omit the new fields again (columns stay
`null`/`[]`), no data loss. No `body` semantics changed, so a rollback of
`apps/web`/`place-me-UI` rendering is a plain revert of those files.

## Approvals

- Specification: pending user approval (this conversation)
- Architecture: N/A (no provider/architecture change — same Gemini
  endpoint, same Supabase table, additive schema only)
- Security: N/A pending — no auth/RLS/retention change, but flag for
  `placeme-security` skim given the new field is student-facing scored data
- Pilot: N/A — no pilot-facing rollout change beyond what's already covered
  by guardrail #1's human gate (AC6)
