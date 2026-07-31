# BUG-SPEC-0004 — Button size and busy-state vocabulary drifts across pages

**Status:** Implemented (code, tests, lint, build all green, visually
verified in a real browser; no guardrail #1 gate applies — see
Verification — so this can move to `docs/specs/completed/` once merged)
**Owner:** Claude Code (agent-assisted), approved by repository owner (shiva9198)
**Incident/issue:** `/impeccable critique` end-to-end UI review,
`.impeccable/critique/2026-07-30T17-08-16Z__apps-web-src.md`, Priority Issue
P2 ("Button and busy-state vocabulary drifts across pages that perform the
identical action"). Approved for implementation alongside BUG-SPEC-0001/2/3
in conversation on 2026-07-30 (user selected all 5 critique issues, P0 and
both P1s already shipped); this is issue 4/5, first of the two remaining
P2s, picked up per direct user instruction ("Button/busy-state vocabulary
P2") after BUG-SPEC-0003 merged.
**Severity:** Low (Consistency and Standards heuristic, scored 2/4 — a
polish/trust-signal gap a design-literate user notices immediately, not a
functional or data-safety bug).
**First affected release:** Present since each affected page shipped
(W4/W5/W6 — these are among the app's oldest screens).

## Problem

**Expected behavior:** Every primary submit button that performs the "create
this room" / "start this session" / "sign the student in" class of action
uses one button-height token and one busy-state pattern, so the same kind of
action reads identically everywhere in the app.

**Observed behavior, confirmed by source read of every primary submit
button in `apps/web/src/pages/*.jsx`:**

- **Height drift:** `button-primary`'s own documented token in `DESIGN.md`
  (`padding: "0.75rem 2rem"`, i.e. `py-3 px-8`) is followed by
  `LoginPage.jsx:98`, `SignupPage.jsx:105`, `ConsentPage.jsx:171`,
  `NewRoomPage.jsx:75,100`, and `LobbyPage.jsx:237` — but
  `JoinRoomPage.jsx:55` and `MatchPage.jsx:213` use `py-6` instead, twice
  the documented vertical padding, with no product reason for the
  difference.
- **Busy-state drift:** `ConsentPage.jsx:173-180` shows a spinner
  (`material-symbols-outlined animate-spin`) plus busy-state text
  ("Recording…") — the only primary submit button in the app that does.
  Every other primary submit button swaps to text-only busy copy with no
  spinner: `LoginPage.jsx:100` ("Signing in…"), `SignupPage.jsx:107`
  ("Creating account…"), `NewRoomPage.jsx:77` ("Working…"),
  `JoinRoomPage.jsx:57` ("Joining…"), `MatchPage.jsx:215` ("Looking for a
  match…"), `LobbyPage.jsx:239` ("Starting…"). One button,
  `NewRoomPage.jsx:97-103` ("Create room with this topic"), has **no**
  busy-state indication at all — it reads identically whether idle or
  mid-submit, even though it shares the same `busy` flag (and is disabled
  the same way) as the neighboring "Generate & create room" button.

**Affected users:** Every student, on every page with a primary submit
action (login, signup, consent, new room — both paths, join-by-code,
match, lobby start).

**Frequency:** Every visit to any of these seven screens.

**Evidence:** Source read of all seven files named above; cross-checked
against `DESIGN.md`'s `components.button-primary` token (line 78-82) and
its prose Buttons section (line 160-164), neither of which documents a
second size or a text-only busy variant.

## Goals

- Normalize every primary submit button's vertical padding to `py-3`
  (`DESIGN.md`'s own documented token), removing the two `py-6` outliers.
- Normalize every primary submit button's busy state to the same pattern:
  an animated spinner icon (`material-symbols-outlined animate-spin`,
  `aria-hidden="true"`) plus the button's existing busy-state copy,
  reusing the exact icon/animation `ConsentPage.jsx` and `LobbyPage.jsx`
  already establish elsewhere in this codebase — not inventing a new
  pattern.
- Extract the icon+label pairing into one small shared component
  (`apps/web/src/components/ButtonBusyLabel.jsx`) so this specific class of
  drift — the same visual idea reimplemented slightly differently per page
  — cannot silently reoccur the way it did before this fix.
- Give `NewRoomPage.jsx`'s "Create room with this topic" button a busy
  state for the first time, consistent with its sibling button and with
  the fact that it shares the same `busy` flag.
- Cover the changed busy-state rendering with tests; add the minimum test
  scaffolding for the four pages (`LoginPage`, `SignupPage`, `NewRoomPage`,
  `JoinRoomPage`) that currently have zero test files, matching this repo's
  now-established `apps/web` testing pattern (`vitest` + RTL).

## Non Goals

- Any change to what each button's action actually does (sign-in, sign-up,
  consent recording, topic generation/submission, room join, matchmaking,
  session start) — presentation-only.
- `ConsentPage.jsx`'s spinner markup is the reference pattern being
  generalized; it is refactored to use the new shared component for
  consistency, but its visible behavior does not change.
- The remaining 1/5 issue from the same critique (missing skeleton loading
  states, P2) — tracked separately, picked up after this one.
- Any broader design-token audit (colors, radii, shadows) beyond button
  height/busy-state — out of scope for this specific P2.
- `MatchPage.jsx`'s "give-up" state secondary button
  (`Start a room and share the code` / `Or try matching again`) and
  `LobbyPage`'s/`MatchPage`'s secondary "Cancel"/"Leave" affordances —
  these are not primary submit buttons and were not named in the critique
  finding.

## Requirements

- **R1:** `JoinRoomPage.jsx`'s "Join room" button and `MatchPage.jsx`'s
  "Find me a group" button use `py-3` instead of `py-6`.
- **R2:** While busy, the following buttons render the shared spinner icon
  alongside their existing busy-state text instead of text-only:
  `LoginPage` ("Sign in"), `SignupPage` ("Create account"), `NewRoomPage`
  ("Generate & create room"), `JoinRoomPage` ("Join room"), `MatchPage`
  ("Find me a group"), `LobbyPage` ("Start session"). `ConsentPage`'s
  existing spinner is refactored to the same shared component, not
  duplicated logic.
- **R3:** `NewRoomPage.jsx`'s "Create room with this topic" button shows a
  busy-state label ("Creating…" + spinner) while `busy` is true, matching
  its sibling button's disabled timing exactly (same `busy` flag, no new
  state).
- **R4:** No change to any button's `disabled` condition, any handler, any
  API call, or any non-busy label text.
- **R5:** The shared `ButtonBusyLabel` component takes a `label` prop and
  renders the icon (`aria-hidden="true"`, so screen readers get only the
  text) plus the label, matching `ConsentPage`'s current accessible output
  exactly.

## Design

New file, `apps/web/src/components/ButtonBusyLabel.jsx`:

```jsx
export function ButtonBusyLabel({ label }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="material-symbols-outlined animate-spin text-base" aria-hidden="true">
        progress_activity
      </span>
      {label}
    </span>
  );
}
```

Each affected button becomes (pattern shown for `JoinRoomPage`; identical
shape elsewhere):

```jsx
<button
  type="submit"
  disabled={busy || !code.trim()}
  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
>
  {busy ? <ButtonBusyLabel label="Joining…" /> : 'Join room'}
</button>
```

Buttons that don't already have `flex items-center justify-center` in their
`className` (JoinRoomPage, MatchPage, NewRoomPage x2, LobbyPage's Start
session) gain it, purely so the icon and label sit inline — no other
class changes.

`LoginPage`/`SignupPage` currently render an `arrow_forward` icon next to
the idle label and hide it while busy; that idle-state icon is untouched,
only the busy branch changes from a bare string to
`<ButtonBusyLabel label="Signing in…" />` (or "Creating account…").

## Tests

- New `apps/web/src/components/ButtonBusyLabel.test.jsx`: renders the given
  label and an `aria-hidden` spinner icon.
- New `apps/web/src/pages/LoginPage.test.jsx`: while `signIn`'s promise is
  pending, the button shows the spinner + "Signing in…"; the idle
  `arrow_forward` icon is not present while busy.
- New `apps/web/src/pages/SignupPage.test.jsx`: same shape for `signUp` /
  "Creating account…".
- New `apps/web/src/pages/NewRoomPage.test.jsx`: while `generateTopic`'s
  promise is pending, "Generate & create room" shows the spinner +
  "Working…"; while a custom-topic submit is pending, "Create room with
  this topic" shows the spinner + "Creating…".
- New `apps/web/src/pages/JoinRoomPage.test.jsx`: while `joinRoomByCode`'s
  promise is pending, the button shows the spinner + "Joining…"; the
  button's class list contains `py-3` and not `py-6`.
- `MatchPage.test.jsx` (extended): the "Find me a group" button's class
  list contains `py-3` and not `py-6`; while `requestMatch`'s promise is
  pending, the button shows the spinner + "Looking for a match…".
- `LobbyPage.test.jsx` (extended): while `startRoom`'s promise is pending,
  "Start session" shows the spinner + "Starting…".
- `ConsentPage.test.jsx`: none exists yet and none is added — out of scope
  for this fix (its behavior is unchanged, only its internal markup is
  refactored to the shared component); if this regresses, the existing
  manual/human verification path for consent (guardrail #3) would catch it,
  and BUG-SPEC-0001's precedent already treats "no test file existed before
  this repo's first `apps/web` tests" pages as pre-existing gaps, not this
  fix's to backfill wholesale.

## Verification

- `npm test` (root): full server + web suite must stay green, plus all new
  cases above.
- `npm run lint`: must stay clean, no new warnings.
- `npm run build --workspace=apps/web`: must stay clean.
- Guardrail #1 does not apply — no room/audio/transcription/attribution/
  feedback behavior changes, presentation-only.
- **Visually verified in a real browser**, not just via unit tests:
  started `apps/web`'s Vite dev server and drove it with Playwright
  (Chromium). Confirmed on `LoginPage` — idle button height is `44px`
  (`py-3`, the documented `DESIGN.md` token) and stays exactly `44px` once
  busy (submitting a deliberately-wrong credential pair against the real
  Supabase auth endpoint), with the spinner icon rendering inline next to
  "Signing in…" rather than growing the button or replacing it with
  bare text. Screenshots taken before and during the busy state confirm
  this visually, not just via the DOM. The other five buttons share the
  identical `ButtonBusyLabel` component and markup shape, so the same
  visual behavior applies to them by construction; this was not
  separately re-screenshotted per page (would only be re-confirming the
  same component rendering identically, not new information).

## Rollout / Rollback

- Rollout: standard PR → `dev`, no migration, no env var, no feature flag.
- Rollback: revert the PR; no data or schema implication.
