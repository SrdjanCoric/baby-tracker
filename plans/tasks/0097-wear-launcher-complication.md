# Task 0097: Wear launcher complication

**Branch**: `feature/wear-launcher-complication`
**Depends on**: 0089
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I open the app straight from my watch face.

## Implementation classification

- **Change class**: `code`
- **Validation tier**: `canonical`
- **TDD applicable**: `true`

## What to build

A watch-face complication that launches the Wear app — parity with the iOS complication, which is
launcher-only (`ios/SofiBabyWatchComplication/`, 61 LOC). Wear equivalent: a small-image/icon
complication data source whose tap action opens the app. Explicitly out of scope (brief non-goal):
rich Tiles or data-bearing complications.

**Apple Watch parity boundary**: the complication is launcher-only. Do not add live activity data,
timers, progress, configurable complication content, Tiles, or watch-face actions.

Depends only on the 0089 scaffold; can land in parallel with the data tasks.

## Implementation work

- [x] Complication data source (icon + tap-to-launch) registered in the Wear manifest.
- [x] App icon asset sized for complication slots.
- [x] Test: data source returns valid complication data for supported types.

## Validation boundary

No watch-face picker or tap check runs in this task. The project-wide Wear integration decision
closes Tasks 0090–0097 on automated seam tests and Android builds; Task 0098 verifies the
complication on a Wear OS 4 emulator with the complete activity set.

## Human checkpoints

- [x] [verify] Add the complication to a watch face on a Wear OS 4 emulator and tap it. ·
      Expected: app opens. · Failure: complication absent from picker or tap does nothing. ·
      Reason: watch-face slot integration is not unit-assertable. · Disposition: deferred to Task
      0098's consolidated Wear OS 4 integration matrix by this task's validation boundary; no
      manual device verification is required for Task 0097.

## Acceptance criteria

- [x] Complication provider registration and launch intent are covered by automated seams; picker
      and tap confirmation remain assigned to Task 0098.
- [x] CI green.
- [x] The complication exposes no data-bearing or interactive capability beyond launching the app.

## Implementation decisions

- The provider returns only small-image or monochromatic-image complication data and attaches an
  immutable explicit launch intent for `MainActivity`; all data-bearing request types return no
  update.
- `ICON` precedes `SMALL_IMAGE` in picker metadata so watch faces that support both prefer the
  tintable monochromatic representation.
- The Wear drawable is a byte-for-byte copy of the shipped watchOS/iOS complication artwork rather
  than an independently drawn approximation.
- CI caches Robolectric's Maven runtime artifacts with a key tied to the Wear dependency
  declaration.

## Review decisions

- skipped (minor): TR-2 — The no-data acceptance criterion lacks a test for data-bearing request types — User requested this pass be limited to TR-1, TR-3, and TR-5.
- skipped (minor): TR-4 — Complication tests use tautological assertions that miss image and tap-action regressions — User requested this pass be limited to TR-1, TR-3, and TR-5.
- skipped (minor): TR-6 — The template test pins an exact AndroidX dependency version — User requested this pass be limited to TR-1, TR-3, and TR-5.
- skipped (minor): TR-7 — Complication images do not provide ambient-mode variants — User requested this pass be limited to TR-1, TR-3, and TR-5.
- skipped (minor): TR-8 — The Wear test module declares an unused AndroidX Test dependency — User requested this pass be limited to TR-1, TR-3, and TR-5.

## Implementation evidence

- RED/GREEN cycles proved `SMALL_IMAGE` and legacy `ICON`/modern `MONOCHROMATIC_IMAGE` requests each
  return valid image data with a tap action targeting `MainActivity`; the focused Robolectric suite
  passed in the final Wear build. Log:
  `/tmp/agent-workflows/e2f8af45fd34/0e2225458ba4/wear-focused.log`.
- A generated-template test failed before provider registration, then passed with the protected
  complication service, tintable-first `ICON,SMALL_IMAGE` picker metadata, zero update period, the
  exact shipped watchOS/iOS complication PNG, source, and AndroidX dependency. The complete plugin
  suite passed 2 tests. Log:
  `/tmp/agent-workflows/e2f8af45fd34/0e2225458ba4/wear-plugin.log`.
- Clean Android prebuild succeeded, and `./gradlew :wear:testDebugUnitTest :wear:assembleDebug`
  passed in 19 seconds. The provider has no timer, activity-data, Tile, configuration, periodic
  refresh, or watch-face action path beyond launching the app.

## Completion record

- Built the Wear launcher complication under `plugins/with-wear-os/android/wear/`, including the
  protected provider registration, launcher-only data source, shipped brand artwork, and explicit
  tap action.
- README: updated **Wear OS Native Integration** with the launcher-only complication and no-data
  boundary. The affected prose passed one `write-well` audit pass with no findings.
- Review outcome: TR-1, TR-3, and TR-5 fixed. TR-2, TR-4, TR-6, TR-7, and TR-8 were skipped at the
  user's request to limit remediation to those three findings. No security risk was accepted.
- Automated proof: `npm run check:code` passed on 2026-08-25. The bounded log is
  `/tmp/agent-workflows/e2f8af45fd34/0e2225458ba4/canonical.log`.
- Validation harness: generated Android Gradle output is excluded from ESLint, with a regression
  test covering the Robolectric report path.
- Manual verification: none required for this task. Watch-face picker and tap confirmation remain
  assigned to Task 0098 by the validation boundary.
