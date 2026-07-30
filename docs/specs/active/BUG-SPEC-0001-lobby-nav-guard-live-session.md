# BUG-SPEC-0001 — In-app navigation can silently drop a student from a live GD session

**Status:** Implementing (code, tests, lint, and build are green; blocked
from moving to `docs/specs/completed/` until the guardrail #1 human
verification below is recorded — see Rollout)
**Owner:** Claude Code (agent-assisted), approved by repository owner (shiva9198)
**Incident/issue:** `/impeccable critique` end-to-end UI review,
`.impeccable/critique/2026-07-30T17-08-16Z__apps-web-src.md`, Priority Issue P0.
Approved for implementation in conversation on 2026-07-30 (user selected this
P0 first, "production ready", scope: all 5 critique issues, this is issue 1/5).
**Severity:** High (multi-user real-time session integrity; not a security or
data-loss bug, but breaks a live session for other real participants)
**First affected release:** Present since W6 (LobbyPage live-room UX shipped
2026-07-26 per `docs/engineering/PROGRESS.md`)

## Problem

**Expected behavior:** Once a student is in a `live` group-discussion session,
or has finished speaking and is waiting on their feedback to generate, leaving
the room (by any means) should require confirmation, because leaving tears
down their LiveKit audio connection and affects the other real students still
in the room.

**Observed behavior:** `LobbyPage.jsx`'s `beforeunload` guard (lines 143-160)
only intercepts an actual browser tab close or hard refresh. It does nothing
for React Router client-side navigation. `AppShell.jsx`'s sidebar/bottom nav
links (Home, New Room, Join by Code, Random Match, History) and its "Log out"
button remain fully clickable and unguarded the entire time `LobbyPage` is
rendered, including while `status === 'live'`. Clicking any of them
immediately unmounts `LiveRoomAudio` with no warning and no confirmation,
dropping that student's microphone from a session the other participants are
actively relying on.

**Affected users:** Any student in a live or just-finished GD room; the impact
lands on the *other* participants in that room, not just the one who
navigates away.

**Frequency:** Every accidental or curious click on the persistent sidebar nav
during a live session reproduces this; no special conditions needed.

**Evidence:** Source read of `apps/web/src/components/AppShell.jsx` (NavLink
list has no guard-aware click handling) and `apps/web/src/pages/LobbyPage.jsx`
(guard is `beforeunload`-only, scoped to
`status === 'live' || (status === 'ended' && !feedback && !feedbackFailed)`).

## Goals

- Require explicit confirmation before any in-app navigation (nav-link click
  or "Log out") away from `LobbyPage` while that same session-in-progress
  window applies.
- Reuse the existing session-in-progress definition (live, or ended-but-
  feedback-not-yet-resolved) as the single source of truth for both the
  existing `beforeunload` guard and the new in-app guard, instead of
  duplicating the condition.
- Add a regression test proving the guard blocks navigation when active and
  does not obstruct navigation when inactive.

## Non Goals

- Browser back/forward button interception. This app uses `<BrowserRouter>`
  (`apps/web/src/main.jsx`), not a React Router data router
  (`createBrowserRouter`/`RouterProvider`); `useBlocker` (the mechanism that
  would cover back/forward) only works under a data router. Migrating the
  router is an architecture change outside a P0 bug-fix scope and would need
  its own ADR/spec if pursued later.
- The other 4 issues from the same critique (no cancel/exit affordance in
  `MatchPage`'s queue and `LobbyPage`'s waiting state; the under-designed
  post-session feedback-wait screen; button/busy-state vocabulary drift;
  missing skeleton loading states). Tracked separately, not touched here.
- Any redesign of `AppShell`'s visual layout or the "give a live room its own
  shell" alternative mentioned in the critique's provocative questions; this
  fix keeps the existing shell and adds a guard, the smaller and safer change.

## Requirements

- **R1:** While a `LobbyPage` session is in progress (`status === 'live'`, or
  `status === 'ended'` with feedback neither received nor failed), clicking
  any `AppShell` nav link or the "Log out" button must show a confirmation
  prompt before navigating away; declining must leave the user on the room
  with no state change.
- **R2:** Confirming the prompt must navigate/sign out exactly as it would
  have without the guard (no change to destination or sign-out behavior).
- **R3:** Outside that window (`waiting`, or `ended` with feedback resolved),
  nav links and "Log out" must behave exactly as before — no added friction.
- **R4:** The session-in-progress condition must be defined once and shared
  between the existing `beforeunload` handler and the new in-app guard, so
  the two can never silently drift apart.
- **R5:** Existing security, consent, retention, and API contracts remain
  intact (this is client-side navigation UX only; no server/API/RLS surface
  is touched).

## Design

### Reproduction and root cause

1. Two students join a room; the creator starts it (`status` becomes
   `live`).
2. Either student clicks "Home" (or any other sidebar link) in `AppShell`.
3. `LobbyPage` unmounts, tearing down `<LiveRoomAudio>` (and its LiveKit
   connection) with no confirmation — because `AppShell`'s `NAV_LINKS` render
   as plain `NavLink`s with no awareness of what page/state they're navigating
   away from, and `LobbyPage`'s only protective mechanism
   (`window.beforeunload`) is a browser-native event that never fires for
   client-side route changes.

Root cause: the "is a session in progress" fact lives entirely inside
`LobbyPage`'s local state, and `AppShell` (the component that owns the only
always-visible exits) has no way to see it. Existing tests never caught this
because there are no frontend tests in this repo yet (`apps/web` has no test
script or test files; all current automated tests are under
`apps/server/test/`).

### Fix

1. **Extract the session-in-progress rule into a pure, shared function** —
   `apps/web/src/rooms/sessionGuard.js`, exporting
   `isSessionInProgress(status, feedback, feedbackFailed)`. `LobbyPage`'s
   existing inline `beforeunload` condition and the new in-app guard both
   call this one function; the logic itself does not change.
2. **Share that fact with `AppShell` via a small React context** —
   `apps/web/src/rooms/RoomSessionGuardContext.jsx` exposes:
   - `RoomSessionGuardProvider` — holds `{ active, message }` in state.
   - `useRoomSessionGuard()` — read hook for `AppShell`.
   - `useSetRoomSessionGuard(active, message)` — effect-based write hook
     `LobbyPage` calls with the result of `isSessionInProgress(...)`; clears
     itself on unmount/status change so a guard can never outlive the page
     that raised it.
   The provider wraps `<App />`'s routed content once, in `App.jsx`, above
   both `AppShell` and the page content — since exactly one route (and so at
   most one `LobbyPage`) is ever mounted at a time, a single shared slot is
   sufficient; no need for a stack/registry.
3. **Guard the exits in `AppShell`** — both the desktop sidebar `NavLink`s,
   the mobile bottom-nav `NavLink`s, and the two "Log out" buttons
   (desktop + mobile) check `useRoomSessionGuard()` before acting. When
   active, the click handler calls `event.preventDefault()`, then
   `window.confirm(message)`; only on `true` does it proceed
   (`navigate(link.to)` for nav links, the existing `signOut()` call for
   log out). When inactive, behavior is unchanged (`NavLink` navigates
   natively, no extra handler cost).
4. **`LobbyPage`** replaces its inline `sessionInProgress` boolean with
   `isSessionInProgress(status, feedback, feedbackFailed)` and adds
   `useSetRoomSessionGuard(inProgress, 'Leaving now will disconnect your microphone from the live session. Other participants may be affected.')`
   alongside its existing `beforeunload` effect (both now read the same
   underlying fact).

**Alternative considered and rejected:** migrating `<BrowserRouter>` to a data
router so `useBlocker` could cover every navigation path including
back/forward. Rejected for this fix because it's a router-wide architecture
change (affects every route, needs its own design review/ADR per
`ENGINEERING.md`) and the critique's concrete finding was specifically about
the always-visible `AppShell` nav, which the context-based guard fully
covers.

**Concurrency/failure behavior:** no server state is touched; this is a pure
client-side confirmation gate. If `window.confirm` is unavailable (unlikely in
any supported browser), the guard fails open (nav proceeds) rather than
trapping the user — acceptable since the underlying `beforeunload` protection
still exists for hard navigation.

## Risks

| Risk | Mitigation |
|---|---|
| Guard state leaks after `LobbyPage` unmounts (e.g. user does confirm and leave), leaving nav permanently blocked | `useSetRoomSessionGuard`'s effect cleanup unconditionally clears the guard on unmount, independent of how the unmount happened |
| Guard blocks navigation the user actually wants (e.g. waiting-room state, which is safe to leave) | Guard is scoped to the same `live`/`pending-feedback` window as the existing, already-shipped `beforeunload` guard — not wider |
| Regression in `AppShell` for the common case (no active session) | Regression test asserts unguarded nav is unchanged when the guard is inactive |
| `window.confirm` is a blocking, unstyled browser dialog — weaker UX than a custom modal | Accepted for this fix (matches the existing `beforeunload` prompt's browser-native style); a custom in-app modal is a `/impeccable delight`-scope polish item, not this P0 |

## Acceptance Criteria

- [x] The original reproduction (click a nav link during a live session) is
      blocked behind a confirmation prompt; declining keeps the user on the
      room.
- [x] A regression test covers `isSessionInProgress` and the `AppShell`
      guard's confirm/cancel branches.
- [x] Nav behavior outside the guarded window (waiting, or ended-with-
      feedback-resolved) is unchanged, with a test proving it.

## Implementation Tasks

- [x] Add failing regression tests (pure-function + component-level).
- [x] Implement `sessionGuard.js` and `RoomSessionGuardContext.jsx`.
- [x] Wire the guard through `App.jsx`, `LobbyPage.jsx`, and `AppShell.jsx`.
- [x] Add minimal frontend test infrastructure (`apps/web` had none):
      `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`.
- [x] Update `docs/engineering/PROGRESS.md`.

## Testing

- **Unit:** `apps/web/src/rooms/sessionGuard.test.js` — `isSessionInProgress`
  across `waiting`, `live`, `ended` with no feedback yet, `ended` with
  feedback, `ended` with `feedbackFailed`.
- **Component:** `apps/web/src/components/AppShell.test.jsx` — renders
  `AppShell` inside `RoomSessionGuardProvider` + `MemoryRouter`:
  - guard inactive → clicking a nav link navigates immediately, no
    `window.confirm` call.
  - guard active, `window.confirm` mocked to return `false` → navigation is
    blocked (location unchanged).
  - guard active, `window.confirm` mocked to return `true` → navigation
    proceeds to the clicked link.
  - guard active → "Log out" is likewise gated behind the same confirm.
- Manual/human verification (see Rollout): still required per guardrail #1
  before this is considered fully done for a real multi-person room.

## Verification

Commands run from repo root after implementation:

```sh
npm test --workspace=@placeme/web
npm test --workspace=@placeme/server
npm run lint
npm run build
```

Environment: local, Node 22 (per `.nvmrc`). Before/after evidence and exact
results recorded in the implementation summary.

## Monitoring

No new server-side signal exists for this (purely client-side). If this
recurs, it would show up as a support report ("I got disconnected/kicked out
mid-session by clicking somewhere") rather than a metric; no dashboard change
proposed for a UI confirmation gate.

## Rollout

Ship on the normal `fix/* → dev` PR path. No migration, no feature flag
needed (pure client-side, backward compatible, no API change). Per guardrail
#1, this touches live-room/audio-adjacent behavior, so it is not to be marked
fully "done" until a real human (ideally two, to actually observe a live
multi-participant room) clicks a nav link mid-session and confirms the prompt
appears and blocks/allows correctly. That verification is called out as a
residual risk/open item in the implementation summary and in
`docs/engineering/PROGRESS.md`, not silently skipped.

## Rollback

Pure client-side change with no data/schema impact — revert the PR if a
regression appears. No forward-fix data cleanup required either way.
