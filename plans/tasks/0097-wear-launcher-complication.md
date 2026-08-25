# Task 0097: Wear launcher complication

**Branch**: `feature/wear-launcher-complication`
**Depends on**: 0089
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I open the app straight from my watch face.

## What to build

A watch-face complication that launches the Wear app — parity with the iOS complication, which is
launcher-only (`ios/SofiBabyWatchComplication/`, 61 LOC). Wear equivalent: a small-image/icon
complication data source whose tap action opens the app. Explicitly out of scope (brief non-goal):
rich Tiles or data-bearing complications.

**Apple Watch parity boundary**: the complication is launcher-only. Do not add live activity data,
timers, progress, configurable complication content, Tiles, or watch-face actions.

Depends only on the 0089 scaffold; can land in parallel with the data tasks.

## Implementation work

- [ ] Complication data source (icon + tap-to-launch) registered in the Wear manifest.
- [ ] App icon asset sized for complication slots.
- [ ] Test: data source returns valid complication data for supported types.

## Human checkpoints

- [ ] [verify] Add the complication to a watch face on a Wear OS 4 emulator and tap it. ·
      Expected: app opens. · Failure: complication absent from picker or tap does nothing. ·
      Reason: watch-face slot integration is not unit-assertable.

## Acceptance criteria

- [ ] Complication appears in the watch-face complication picker and launches the app on tap.
- [ ] CI green.
- [ ] The complication exposes no data-bearing or interactive capability beyond launching the app.
