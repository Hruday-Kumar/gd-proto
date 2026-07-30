# BUG-SPEC-0002 — No cancel/exit affordance in MatchPage's queue or LobbyPage's waiting state

**Status:** Implemented (code, tests, lint, build all green; no guardrail #1
gate applies — see Verification — so this can move to
`docs/specs/completed/` once merged)
**Owner:** Claude Code (agent-assisted), approved by repository owner (shiva9198)
**Incident/issue:** `/impeccable critique` end-to-end UI review,
`.impeccable/critique/2026-07-30T17-08-16Z__apps-web-src.md`, Priority Issue
P1 ("No cancel/exit affordance in any waiting state — this is systemic, not
a Lobby-only gap"). Approved for implementation alongside BUG-SPEC-0001 in
conversation on 2026-07-30 (user selected all 5 critique issues, P0 first;
this is issue 2/5, first of the two P1s, picked up in the order
`docs/engineering/PROGRESS.md` recorded as next).
**Severity:** Medium (User Control and Freedom heuristic, scored 1/4 in the
critique — a usability/trust gap, not a security or data-loss bug)
**First affected release:** Present since MatchPage (W4) and LobbyPage's
waiting status (W4/W6) shipped.

## Problem

**Expected behavior:** A student who queued for a random match, or who is
sitting in a room that hasn't gone live yet, can back out with one visible,
labeled action instead of relying on an undiscoverable side-effect of
navigating elsewhere or waiting out a timeout.

**Observed behavior:**
- `MatchPage.jsx`: once `queued` is `true`, the only ways out are the
  90-second `MAX_QUEUE_WAIT_MS` timeout (`giveUpRef`, line 67) firing on its
  own, or navigating away via the sidebar (which happens to call
  `leaveMatchQueue` in the unmount cleanup at line 43, but nothing on-screen
  says so). There is no visible "Cancel matching" control.
- `LobbyPage.jsx`: while `status === 'waiting'` there is no "Leave room"
  affordance at all — a student can only leave by clicking a sidebar link or
  logging out, neither of which is labeled for this purpose. (Note: this is
  already safe today — `isSessionInProgress` (`apps/web/src/rooms/
  sessionGuard.js`) returns `false` for `status === 'waiting'`, so the
  BUG-SPEC-0001 nav guard does not block this navigation. The gap here is
  discoverability, not safety.)

**Affected users:** Any student queued for a random match or sitting in a
not-yet-started room who wants to back out.

**Frequency:** Every queue/waiting-room visit; no special conditions needed.

**Evidence:** Source read of `apps/web/src/pages/MatchPage.jsx` (no cancel
button in the `queued` branch) and `apps/web/src/pages/LobbyPage.jsx` (no
button in the `status === 'waiting'` branches, lines 227-248).

## Goals

- Add a visible, labeled "Cancel matching" button to `MatchPage` while
  `queued` is `true`, using the existing `leaveMatchQueue` call already
  wired into the unmount/give-up paths — no new API.
- Add a visible, labeled "Leave room" affordance to `LobbyPage`'s
  `status === 'waiting'` branches (both creator and non-creator), navigating
  the student back to `/` — no new API, since leaving during `waiting` is
  already unguarded and side-effect-free client-side.
- Cover both with regression tests.

## Non Goals

- Any "leave a live room" or "leave a room I already joined but hasn't
  started" **server-side** path (freeing a `room_participants` seat,
  notifying other participants, etc.). This is exactly **N14** from
  `docs/engineering/PLAN.md` §5e ("no late-join, no leave-room path"),
  which the user explicitly decided 2026-07-30 to leave as-is for the pilot
  scale (`PILOT_READINESS.md` already expects a founder watching every
  early session manually). This spec only adds a client-side affordance for
  states that are already safe to leave; it does not reopen that decision.
- Anything about the `live` or `ended` states — those stay governed by
  BUG-SPEC-0001's nav guard, untouched here.
- The other 3 remaining issues from the same critique (post-session
  feedback-wait screen under-designed (P1); button/busy-state vocabulary
  drift (P2); missing skeleton loading states (P2)). Tracked separately.
- Any visual/layout redesign beyond adding the one button per page.

## Requirements

- **R1:** While `MatchPage`'s `queued` state is `true`, a visible "Cancel
  matching" button must be present. Clicking it must call the same
  `leaveMatchQueue(session)` request the existing timeout/unmount paths use,
  stop the poll/timeout timers (`stopWaiting()`), and return the UI to the
  pre-queue state (`queued: false`) without setting `gaveUp` (that flag is
  reserved for the timeout's own copy — "Nobody else is free right now" —
  which would be a misleading message for a deliberate cancel).
- **R2:** While `LobbyPage`'s `status === 'waiting'`, a visible "Leave room"
  link/button must be present (shown for both the creator's and the
  non-creator's waiting views), navigating to `/` on click. No API call.
- **R3:** Neither addition changes behavior for any other status
  (`live`, `ended`) or for `MatchPage`'s idle/`gaveUp`/error states.
- **R4:** Existing security, consent, retention, and API contracts remain
  intact (client-side UI only, reusing an existing endpoint for R1 and no
  endpoint at all for R2).

## Design

`MatchPage`: add a "Cancel matching" `<button>` inside the `queued` status
list or near the existing "Find me a group" button, visible only when
`queued && !gaveUp`. Its handler stops the timers, awaits
`leaveMatchQueue(session)` (best-effort, same `.catch(() => {})` pattern
already used elsewhere in this file so a network hiccup doesn't trap the
student on a dead-end screen), and resets `setQueued(false)`.

`LobbyPage`: add a "Leave room" link (styled as a secondary/text action, not
competing with the creator's primary "Start session" button) inside both the
`isCreator && status === 'waiting'` block and the `status === 'waiting' &&
!isCreator` block. Shipped as a plain `<Link to="/">` rather than an
imperative `useNavigate()` call — same destination, but a real anchor is the
better default for a page-leaving action (works with open-in-new-tab,
middle-click, etc., and needs no extra hook).

## Tests

- `MatchPage.test.jsx` (new): "Cancel matching" button is absent before
  queuing and while `gaveUp`; appears once queued; clicking it calls
  `leaveMatchQueue`, stops polling (no further `getActiveRoom` calls), and
  returns the UI to the pre-queue "Find me a group" state.
- `LobbyPage.test.jsx` (new, or extended if one exists by the time this
  lands): "Leave room" is present for both creator and non-creator waiting
  views and absent once `status` is `live` or `ended`; clicking it navigates
  to `/`.

## Verification

- `npm test` (root), Node 22: **337/337 server + 15/15 web tests green**
  (10 pre-existing web tests + 5 new: 2 in `MatchPage.test.jsx`, 3 in
  `LobbyPage.test.jsx`).
- `npm run lint`: clean — same 3 pre-existing `only-export-components`
  warnings as before (`AuthContext.jsx`, `RoomSessionGuardContext.jsx` ×2),
  no new warnings. `npx oxlint apps/server/src`: clean, untouched by this
  change.
- `npm run build --workspace=apps/web`: clean, builds in ~180ms, bundle
  sizes essentially unchanged (this is two buttons/links, no new
  dependency).
- Guardrail #1 does not apply here (no room/audio/transcription/
  attribution/feedback behavior changed — both affordances only appear in
  pre-live, no-mic states, and R2's "Leave room" is a plain client-side
  `<Link>`, not a new API call). **Not yet done:** an actual manual
  click-through in a running dev server against a signed-in session (queue →
  Cancel matching; join a room → Leave room while waiting) — this session
  had no live Supabase session available to sign in with. Low risk given the
  unit-test coverage of both new code paths, but noted here rather than
  silently skipped.

## Rollout / Rollback

- Rollout: standard PR → `dev`, no migration, no env var, no feature flag
  needed (purely additive UI).
- Rollback: revert the PR; no data or schema implication.
