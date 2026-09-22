# Task 0099: Stop the foreground date-picker ANR on the sleep screen

**Branch**: `hotfix/4.9.20-foreground-picker-anr`
**Depends on**: none
**Base**: `hotfix/4.9` (the 4.9 integration line; its tip is the latest shipped hotfix). Not `main`.
**Source**: Sentry REACT-NATIVE-6, 2026-09-14, Android 4.9.14, `in_foreground: true`, view
`/sleep` · **User stories**: a caregiver adjusting a sleep time on Android never has the app freeze
and get killed as unresponsive.

## What to build

Task 0095 stopped the Android date-picker ANR for the backgrounded case by unmounting the spinner
when the app leaves the foreground. This event is the same scroll storm in the foreground: a large
programmatic date change drives the native number picker one step per 100 ms on the main thread,
each step posting further work, until Android declares the app unresponsive.

After this task, a programmatic change of the picker's value or bounds on Android with a delta
larger than 60 seconds never queues a multi-step scroll animation: the picker jumps to the target
value. Changes within that threshold may animate at most one native step per wheel.

| Condition | Result |
| --- | --- |
| Programmatic value or bound change, delta larger than 60 seconds | Jump, no animation |
| Programmatic change within 60 seconds | At most one native step per wheel |
| User drag or fling | Unchanged |
| App backgrounded mid-change | Unmount per Task 0095 (unchanged) |

## Decided

- Reproduce first with `diagnose`: the feedback loop is an Android emulator with animator scale
  raised, a large `minimumDate`/`maximumDate` shift on the sleep screen, and the main thread's message
  queue depth as the signal. The large-delta source on the sleep screen must be identified, not
  assumed.
- The `react-native-date-picker` version stays pinned at 5.0.13 per the existing codegen test; the
  fix is on our side of the boundary or a patch applied at install, not an upgrade.

## Clarifications

- 2026-09-22 diagnosis: the deterministic component loop reproduces the JavaScript large-delta
  path—changing the value or either bound by more than 60 seconds remounts the Android picker,
  while a user emission is treated as user input. Source inspection of the pinned 5.0.13 Android
  implementation also confirmed a separate native clamp path: `WheelChangeListenerImpl.onChange`
  calls `animateToDate(minDate|maxDate)` and returns without emitting to JavaScript when a fling
  lands outside the bounds. The wrapper fix covers the JavaScript prop-change path; the native
  clamp path remains a platform checkpoint rather than an assumption that the wrapper intercepts
  it.
- The configured `SofiBaby_Pixel_7_API_35` emulator was used with a release APK and raised
  animator scales. The app reached the seeded sleep screen and five corrected large hour-wheel
  flings retained app focus with no ANR, fatal, or React Native error in logcat. `dumpsys gfxinfo`
  was captured before and after, but Android does not expose the main-message-queue depth through
  that command, so no queue-depth claim is made. The device checkpoint remains open for a
  production-device measurement.

## Implementation classification

- Change class: mixed (production/test code plus app version and release-note updates).
- Validation tier: canonical (`npm run test:component` and `npm run test:ci`, with focused picker tests first).
- TDD applicable: yes; the picker behavior is executable production and component-test code.

## Non-goals

- The background unmount from Task 0095 stays as is.
- iOS pickers.
- Other Android screens that mount the community picker rather than this one.

## Context

Task 0095 records the library mechanism in detail and notes the large-delta source was
unidentified; this task's diagnosis closes that gap. The event's stack shows the same
`changeValueByOne` → `setText` → `post` chain. Sentry issue:
https://sofibaby.sentry.io/issues/REACT-NATIVE-6

## Implementation work

- [ ] Identify and reproduce the large-delta trigger on the sleep screen (`diagnose` phases 1–3),
      recorded in the PR.
- [x] A programmatic large delta jumps instead of animating; proved in
      `src/components/BoundedAndroidDateTimePicker.component.test.tsx`.
- [ ] The repro no longer floods the main thread; main-thread queue stays under the ANR threshold.
- [x] Bump `app.json` and add a release note.

## Human checkpoints

- [ ] [verify] Android device: open sleep, edit a time to the far end of its bounds, repeat five
      times · Expected: no ANR dialog, no new REACT-NATIVE-6 event · Failure: either appears · Reason:
      ANR timing is device-specific.

## Acceptance criteria

- [x] The component test proves the jump-vs-animate table.
- [x] `npm run test:component` and `npm run test:ci` pass with no new failures.
- [ ] Device verification passes.

## Implementation record (2026-09-22)

- `BoundedAndroidDateTimePicker` remounts for large programmatic value/bound changes, clears its
  user-change guard after every commit, and keeps the native change callback stable across parent
  timer ticks. The component test now covers the rendered date and bounds as well as the
  jump-versus-animate decisions.
- Focused RED/GREEN proof: `npx jest --runTestsByPath
  src/components/BoundedAndroidDateTimePicker.component.test.tsx --runInBand` passed all 8 tests
  after the remediation. The release APK was built and exercised on the configured API 35
  emulator; the five-fling log is retained at the branch task log directory, with no ANR or fatal
  entry. Queue depth is not available from the emulator's public diagnostics, so the manual device
  checkpoint remains intentionally open.
- Canonical validation: `npm run test:component` passed 119 suites and 1101 tests; `npm run test:ci`
  passed all 65 tests with no failures.
