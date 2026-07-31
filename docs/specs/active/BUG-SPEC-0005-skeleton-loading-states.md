# BUG-SPEC-0005 — Bare "Loading…" text instead of skeleton states

**Status:** Implemented (code, tests, lint, build all green; guardrail #1
does not apply — see Rollout; no browser-automation tool was available
this session, so the visual check is a residual manual item, not
performed here)
**Owner:** Claude Code (agent-assisted), approved by repository owner (shiva9198)
**Incident/issue:** `/impeccable critique` end-to-end UI review,
`.impeccable/critique/2026-07-30T17-08-16Z__apps-web-src.md`, Priority
Issue P2 ("No skeleton states; bare 'Loading…' text contradicts the
product register's own stated rule"). Approved alongside BUG-SPEC-0001-4
in conversation on 2026-07-30 (user selected all 5 critique issues); this
is issue 5/5, the last one, picked up per direct user instruction
("last critique issue (skeleton states)") after BUG-SPEC-0004 merged.
**Severity:** Low (Aesthetic/Consistency polish — every affected spot
already resolves correctly, this only changes what the wait looks like).
**First affected release:** Present since each affected page shipped
(W7 history, and the ended-view transcript block that predates
BUG-SPEC-0003's feedback-wait fix).

## Problem

**Expected behavior:** `reference/product.md`'s own rule for this
register: "Skeleton states for loading, not spinners in the middle of
content." A loading region should be shaped like the content it's about
to become, so the layout doesn't jump and the wait reads as "the app is
fetching your specific data," not "the app has stalled."

**Observed behavior, confirmed by source read:** three spots still fall
back to a single, unshaped line of gray text with no visual weight and no
resemblance to what's about to appear:

- `HistoryPage.jsx:99` — the whole session list's initial load
  (`!sessions && !error`). Once loaded, this area becomes two stat tiles
  plus a list of session cards; while loading, it's one line of text with
  nothing else on the page.
- `HistoryPage.jsx:66` (inside `SessionTranscript`, the per-session
  "View transcript" disclosure) — once loaded, this becomes a handful of
  `speaker: text` lines; while loading, it's the same bare "Loading…".
- `LobbyPage.jsx:330` — the ended-session view's transcript block. Same
  shape mismatch as the `HistoryPage` transcript case above (not the
  feedback-wait block directly above it, which BUG-SPEC-0003 already
  fixed with a spinner + reassurance copy).

**Affected users:** Any student viewing their session history, or the
end-of-session summary of a room they were just in.

**Frequency:** Every page load/transcript-expand until the underlying
`getMyHistory`/`getRoomTranscript` call resolves — typically well under a
second in the pilot's expected traffic, but the shape mismatch is visible
every single time regardless of how fast the network is.

**Evidence:** Source read of `apps/web/src/pages/HistoryPage.jsx` and
`apps/web/src/pages/LobbyPage.jsx`; cross-checked against
`reference/product.md`'s "Skeleton states for loading, not spinners in
the middle of content" rule and `docs/templates/bug-fix-specification.md`.

## Goals

- Replace all three bare "Loading…" spots with a skeleton shaped like the
  content that will actually appear there.
- Keep it to exactly these three spots — the ones the critique named and
  a source read confirms still exist.

## Non Goals

- The `LobbyPage.jsx` feedback-generation wait (the spinner + reassurance
  copy directly above the transcript block) — already fixed by
  BUG-SPEC-0003, not touched here.
- `ConsentPage.jsx`'s `LoadingScreen` (`label="Checking your consent
  status…"`) — that's a full-page auth/session bootstrap gate, not a
  content region with a predictable shape to skeleton toward; out of
  scope for this finding, which named specific content-shaped spots.
- Any change to what data is fetched, when, or how errors are handled —
  presentation-only, around the exact same loading/loaded/error branches
  already in place.

## Requirements

- **R1:** `HistoryPage`'s initial session-list load renders a skeleton
  shaped like 2 stat tiles + a few session-card rows, not bare text.
- **R2:** `HistoryPage`'s `SessionTranscript` disclosure, while its
  transcript is loading, renders a skeleton shaped like a few
  `speaker: text` lines, not bare text.
- **R3:** `LobbyPage`'s ended-view transcript block, while loading,
  renders the same transcript-line skeleton as R2 (same shape, same
  component — one visual vocabulary for "a transcript is loading",
  matching `reference/product.md`'s "consistent affordances across the
  surface" rule).
- **R4:** All three skeletons respect `prefers-reduced-motion` (already
  handled globally by `apps/web/src/index.css`'s `*` reduced-motion rule,
  which catches Tailwind's `animate-pulse`; confirmed, not re-implemented).
- **R5:** No change to the error or loaded branches already present at
  each of the three spots.

## Design

### Reproduction and root cause

Root cause: these three spots predate this repo's `/impeccable` design
system pass (`DESIGN.md`/`reference/product.md`) and were written before
any skeleton pattern existed anywhere in the app — there was nothing to
copy from at the time, and nothing has revisited them since. No test
caught this because a skeleton-vs-bare-text difference is a visual
judgment call, not a behavior a unit test asserts on its own (the
loading/loaded/error *branches themselves* are already correct and
already covered).

### Fix

Two small, shared, reusable components (product register: "consistent
affordances across the surface" — one skeleton vocabulary, not three
one-off shapes):

- **`apps/web/src/components/TranscriptSkeleton.jsx`** — a handful of
  `animate-pulse` bars in two varying widths per row (mimicking a short
  "speaker name" bar + a longer "text" bar), matching `TranscriptList`'s
  actual `<ul><li>` shape closely enough that swapping one for the other
  causes no layout jump. Used at both R2 and R3.
- **`apps/web/src/components/HistoryListSkeleton.jsx`** — two pulsing
  stat-tile placeholders (matching `HistoryPage`'s real stat-tile
  markup/classes) plus a few pulsing session-card placeholders (title bar
  + subtitle bar + status-pill-shaped bar), matching the real list's
  actual card structure. Used at R1.

Both use the existing `surface-container-high`/`rounded-lg`/`rounded-xl`
tokens already in `DESIGN.md`, not new colors — a skeleton is a muted
version of the real content, not a new visual language.

**Alternative considered and rejected:** a single generic `<Skeleton
width height />` primitive composed ad hoc at each call site. Rejected
because the two shapes (transcript lines vs. history list) are
different enough that a generic primitive would just move the "three
different one-off shapes" problem into three different composition call
sites instead of solving it — two purpose-built, named components are
more legible at each usage site and cheaper to keep in sync if the real
markup they mimic changes later.

## Risks

| Risk | Mitigation |
|---|---|
| Skeleton shape drifts out of sync with the real markup over time | Both skeletons live next to (and are named after) the exact component/markup they mimic, making the relationship obvious to a future editor |
| Regression in the already-correct loaded/error branches | Tests assert all three branches (loading/loaded/error) still render correctly, not just the new skeleton |
| Motion sensitivity | Reduced-motion already globally handled (R4); no per-component work needed, confirmed rather than assumed |

## Acceptance Criteria

- [ ] `HistoryPage`'s initial load shows the history-list skeleton, not
      bare text; the real stat tiles + session list still render once
      `getMyHistory` resolves, unchanged from before.
- [ ] `HistoryPage`'s `SessionTranscript` shows the transcript skeleton
      while loading; the real transcript (or the "no speech" / error
      copy) still renders once `getRoomTranscript` resolves, unchanged.
- [ ] `LobbyPage`'s ended-view transcript block shows the same transcript
      skeleton while loading; the real transcript / error copy still
      renders once resolved, unchanged.
- [ ] A regression test covers all three spots' loading/loaded/error
      branches.

## Implementation Tasks

- [ ] Add failing regression tests (RED) for all three spots.
- [ ] Implement `TranscriptSkeleton.jsx` and `HistoryListSkeleton.jsx`.
- [ ] Wire them into `HistoryPage.jsx` (both spots) and `LobbyPage.jsx`.
- [ ] Update `docs/engineering/PROGRESS.md`.

## Testing

- **`apps/web/src/components/TranscriptSkeleton.test.jsx`** (new) — renders
  a recognizable skeleton (e.g. a stable `data-testid`), doesn't crash.
- **`apps/web/src/components/HistoryListSkeleton.test.jsx`** (new) — same.
- **`apps/web/src/pages/HistoryPage.test.jsx`** (new file — this page had
  no test coverage before this fix) — loading shows the list skeleton;
  once `getMyHistory` resolves, the skeleton is gone and real content
  shows; error still shows the existing error copy; empty-sessions state
  unchanged; `SessionTranscript`'s own loading/loaded/error branches
  covered via the expand toggle.
- **`apps/web/src/pages/LobbyPage.test.jsx`** (extend existing file) — new
  case: `ended` status with no transcript yet shows the transcript
  skeleton, not bare text; existing transcript-loaded and
  transcript-error cases unchanged.

## Verification

Commands run from repo root after implementation:

```sh
npm test
npm run lint
npm run build
```

Environment: local, Node 22 (`.nvmrc`). Before/after evidence recorded in
the implementation summary.

## Monitoring

None needed — presentation-only, no new failure mode to detect.

## Rollout

Ship on the normal `fix/* → dev` PR path. No migration, no feature flag
(purely presentational, backward compatible, no API change). Guardrail #1
does not apply — no room/audio/transcription/attribution/feedback
behavior changes, only the loading-state presentation around data that
was already being fetched and displayed correctly.

## Rollback

Pure client-side presentational change — revert the PR if a regression
appears. No data impact either way.
