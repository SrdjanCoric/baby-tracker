# Task 0100: Fix the Android Fabric addViewAt crash on Home

**Branch**: `hotfix/4.9.21-android-addviewat-crash`
**Depends on**: none
**Base**: `hotfix/4.9` (the 4.9 integration line; its tip is the latest shipped hotfix). Not `main`.
**Source**: Sentry REACT-NATIVE-5, 2026-09-14 → 2026-09-18, 6 events, 2 users, Android 4.9.14,
Home screen, one user signed out · **User stories**: a caregiver landing on Home never has the app
crash while the screen is laying out.

## What to build

Fabric's mount phase throws "The specified child already has a parent" while inserting a view into
a Home-screen container. That happens when the same native view is mounted twice in one batch —
typically a component that re-keys or reorders children while a prior mount is still committing.

Deliverable: the Home-screen component whose children produce the double mount, identified through
the `diagnose` loop, and a change so its children keep stable identity across the state change that
triggers the crash. Regression test at the component seam.

| Outcome of diagnosis | Result |
| --- | --- |
| Offending component found and reproducible | Fix + component regression test |
| Not reproducible after two hypothesis batches | `[decision]` on a defensive guard vs. deferring |

## Decided

- Reproduce first with `diagnose`. The feedback loop is an Android emulator driving Home through
  the state transitions visible in the event (signed-out Home, household absent, sync initialized)
  with the crash as the signal.
- No upgrade of React Native or react-native-screens on the 4.9 line — the fix must be local.

## Clarifications

## Non-goals

- The navigation double-tap crash already fixed in 4.9.16.
- iOS.

## Context

Both events are on Android 16 Xiaomi devices; the crashed insert is at index 6 of a parent with
many children, on the root view `/`. Sentry issue:
https://sofibaby.sentry.io/issues/REACT-NATIVE-5

## Implementation work

- [ ] Reproduce the double mount on Home (`diagnose` phases 1–3), recorded in the PR.
- [ ] Children of the offending component keep stable identity across the triggering state change;
      proved in the component's existing test file under `app/(tabs)/`.
- [ ] The repro no longer crashes.
- [ ] Bump `app.json` and add a release note.

## Human checkpoints

- [ ] [decision] Path per the outcome table if not reproducible (`talk-it-through`).
- [ ] [verify] Android device, signed out: open the app cold five times · Expected: no crash, no
      new REACT-NATIVE-5 event · Failure: either · Reason: Fabric mount timing differs per device.

## Acceptance criteria

- [ ] The component regression test fails before and passes after the fix.
- [ ] `npm run test:component` passes with no new failures.
- [ ] Device verification passes.
