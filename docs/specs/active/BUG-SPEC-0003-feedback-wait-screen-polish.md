# BUG-SPEC-0003 — Post-session feedback wait is under-designed relative to its emotional stakes

**Status:** Implemented (code, tests, lint, build all green; no guardrail #1
gate applies — see Verification — so this can move to
`docs/specs/completed/` once merged)
**Owner:** Claude Code (agent-assisted), approved by repository owner (shiva9198)
**Incident/issue:** `/impeccable critique` end-to-end UI review,
`.impeccable/critique/2026-07-30T17-08-16Z__apps-web-src.md`, Priority Issue
P1 ("The post-session feedback wait is under-designed relative to its
emotional stakes"). Approved for implementation alongside BUG-SPEC-0001 and
BUG-SPEC-0002 in conversation on 2026-07-30 (user selected all 5 critique
issues, P0 first; this is issue 3/5, second of the two P1s, picked up in the
order `docs/engineering/PROGRESS.md` recorded as next — user said "next P1"
after BUG-SPEC-0002 merged).
**Severity:** Medium (Visibility of System Status heuristic, scored 3/4 but
explicitly docked for this exact spot in the critique — a reassurance/trust
gap during the single highest-stakes wait in the product, not a security or
data-loss bug).
**First affected release:** Present since `LobbyPage`'s `ended` status and
feedback polling shipped (W4/W6).

## Problem

**Expected behavior:** A student who just finished speaking live in front of
other real students, and is now waiting for Gemini-generated feedback, sees
a wait state whose visual weight matches how much is riding on it —
comparable to the polish `MatchPage` already gives its own (lower-stakes)
"searching for a match" wait.

**Observed behavior:** `LobbyPage.jsx`'s `status === 'ended'` view
(`apps/web/src/pages/LobbyPage.jsx:289-296`) shows only a static line of
text, `Generating your feedback…`, with no spinner, no animation, no
reassurance copy about how long it normally takes — for up to
`MAX_FEEDBACK_POLLS * POLL_INTERVAL_MS` = 40 × 3000ms = **2 minutes**. The
critique calls this out by direct comparison: `MatchPage`'s searching state
(`apps/web/src/pages/MatchPage.jsx:106-160`) gets a pulsing icon, a bold
headline, and a full reassurance paragraph ("We'll take you straight into
the room... If nobody turns up... we'll tell you rather than leave you
waiting") for a lower-stakes wait (finding a match), while the higher-stakes
wait (being judged on live speech just given) gets one flat sentence.

**Affected users:** Every student, every session, once it ends and before
feedback has generated (which is the common case, not an edge case).

**Frequency:** Every completed session.

**Evidence:** Source read of `apps/web/src/pages/LobbyPage.jsx:281-317`
(the `ended` block) against `apps/web/src/pages/MatchPage.jsx:100-160` (the
`queued`/searching block it's being compared to).

## Goals

- Replace the bare `Generating your feedback…` text with a spinner (visual
  weight/motion, matching the existing `animate-spin` pattern this file
  already uses for `LiveRoomAudio`'s own Suspense fallback one screen state
  up) plus a short reassurance paragraph that explains what's happening and
  roughly how long it takes — matching, not exceeding, the tone and format
  `MatchPage` already uses for its own wait state.
- Add `aria-live="polite"` to this status region so it satisfies the same
  "Visibility of System Status" heuristic the critique explicitly docked
  this exact spot for — one attribute, directly in scope, not a separate
  accessibility initiative.
- Leave the already-considered `feedbackFailed` message ("Your feedback is
  taking longer than expected...") and the resolved-`feedback` display
  untouched — only the in-flight "still generating" branch changes.
- Cover the new branch with a regression test.

## Non Goals

- Any change to feedback generation, polling cadence, timeout threshold, or
  the Gemini prompt/content itself — this is presentation-only, around
  content that's already fetched or already in flight the same way it is
  today.
- Any change to `feedbackFailed`'s copy or to the resolved-feedback display
  (`FeedbackRating`, the feedback text itself).
- The remaining 2/5 issues from the same critique (button/busy-state
  vocabulary drift, P2; missing skeleton loading states, P2) — tracked
  separately, picked up after this one per `PROGRESS.md`'s recorded order.
- Broader `aria-live` coverage elsewhere in the app (e.g. `MatchPage`'s
  status checklist, `LobbyPage`'s countdown timer) — the critique's Sam
  persona flag names those too, but they're a separate, wider accessibility
  pass, not this specific P1's stated fix ("add a spinner plus reassurance
  copy"). Not silently dropped, just out of scope here.
- Any redesign of the surrounding `ended` card layout (transcript section,
  overall spacing) beyond the one feedback-status block.

## Requirements

- **R1:** While `status === 'ended'` and `feedback` is not yet set and
  `feedbackFailed` is `false`, the feedback block must render a spinner
  (animated icon) alongside a headline and a reassurance sentence about
  typical wait time, instead of the current bare "Generating your
  feedback…" text node.
- **R2:** The container for this status text must have `aria-live="polite"`
  so screen readers are told when it changes (spinner → resolved feedback,
  or spinner → failed message) without needing to re-focus the page.
- **R3:** Once `feedback` resolves, or once `feedbackFailed` becomes `true`,
  the spinner/reassurance block must be replaced exactly as it is today
  (no behavior change to those two branches beyond the shared `aria-live`
  wrapper).
- **R4:** No new API calls, no new dependencies, no change to
  `MAX_FEEDBACK_POLLS`/`POLL_INTERVAL_MS` or any polling logic.

## Design

Reuse the icon + two-line-copy shape `MatchPage` already establishes
(bold headline + secondary reassurance paragraph in `text-text-secondary`),
scaled down to fit inside `LobbyPage`'s existing `ended`-card slot rather
than introducing a new visual language:

```jsx
<div aria-live="polite">
  {feedback != null ? (
    <p className="mt-1 text-body-md text-on-surface">{feedback}</p>
  ) : feedbackFailed ? (
    <p className="mt-1 text-body-md text-on-surface">
      Your feedback is taking longer than expected. It'll appear under History once it's ready.
    </p>
  ) : (
    <div className="mt-2 flex items-start gap-3">
      <span className="material-symbols-outlined animate-spin text-2xl text-primary" aria-hidden="true">
        progress_activity
      </span>
      <div>
        <p className="text-body-md font-semibold text-on-surface">Generating your feedback…</p>
        <p className="mt-1 text-body-sm text-text-secondary">
          Gemini is reviewing the discussion now — this usually takes under a
          minute, occasionally up to two for longer sessions. It'll appear
          here the moment it's ready.
        </p>
      </div>
    </div>
  )}
</div>
```

The `feedback != null` check (rather than a plain truthy `feedback`) preserves
the original code's `??` semantics exactly — only `null`/`undefined` falls
through to the next branch, not any falsy value (e.g. an empty string) —
caught in `pr-review` and fixed before merge.

The icon/animation reuses the same `material-symbols-outlined animate-spin`
pattern already used one screen-state up in this same file (the
`LiveRoomAudio` Suspense fallback, `apps/web/src/pages/LobbyPage.jsx:268-274`
— "Connecting to the audio room…"), so this isn't a new pattern for the
codebase, just applied to the one place the critique flagged as missing it.

## Tests

- `LobbyPage.test.jsx` (extended): while `status === 'ended'` and feedback
  hasn't resolved yet, the spinner/reassurance copy renders (e.g. assert on
  the "Generating your feedback…" heading plus the reassurance sentence,
  and that the animated icon is present); once `getMyFeedback` resolves
  with real feedback text, the spinner disappears and the feedback text
  renders instead (existing behavior, now via the wrapped markup — must
  still pass).

## Verification

- `npm test` (root): full server + web suite must stay green, plus the new
  case(s) above.
- `npm run lint`: must stay clean, no new warnings.
- `npm run build --workspace=apps/web`: must stay clean.
- Guardrail #1 (human verification for room/audio/transcription/
  attribution/feedback work) does **not** strictly apply — this changes
  only the loading/wait presentation around feedback, not feedback
  generation, attribution, or content. Noted here rather than silently
  skipped, consistent with how BUG-SPEC-0002 handled the same question. No
  manual click-through against a live session was performed this session
  (no live Supabase session available); risk is low given unit coverage of
  the new branch and zero change to the underlying data flow.

## Rollout / Rollback

- Rollout: standard PR → `dev`, no migration, no env var, no feature flag
  (purely additive presentation change).
- Rollback: revert the PR; no data or schema implication.
