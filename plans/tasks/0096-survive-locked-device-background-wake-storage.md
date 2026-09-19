# Task 0096: Survive a background wake while the device is locked (AsyncStorage)

**Branch**: `hotfix/4.9.17-locked-device-storage-wake`
**Depends on**: none
**Base**: `hotfix/4.9` (the 4.9 integration line; its tip is the latest shipped hotfix). **Not `main`**: main carries
the unreleased 4.10 work and must not be pulled into a production hotfix.
**Source**: Sentry REACT-NATIVE-8, 2026-09-14 → 2026-09-19, 58 events, 22 users, all iOS 4.9.14, all
`in_foreground: false` · **User stories**: a caregiver whose phone is locked in a pocket never has the
app crash-loop or drop a queued write because iOS woke it in the background.

## What to build

When iOS wakes the app in the background while the device is locked, the app's persistent storage
files are unreadable (data protection returns "Operation not permitted" on the storage manifest).
Today that read failure escapes as an unhandled promise rejection from whichever startup or resume
path touches storage first.

After this task, a storage read or write attempted while protected data is unavailable is an expected
outcome, not an error: the caller skips the work that needed the data, leaves local state untouched,
and retries on the next foreground activation. No unhandled rejection reaches the global handler and
nothing is reported to Sentry at error level for this condition.

| Condition | Result |
| --- | --- |
| Storage read fails with the iOS "not permitted" file-protection error while the app is not in the foreground | Skip the dependent work silently; retry on next foreground |
| Storage read fails with the same error while the app is in the foreground | Surface as today (real error); report to Sentry |
| Storage read fails with any other error | Unchanged behavior |
| Storage read succeeds in the background | Unchanged behavior |
| Foreground state cannot be determined | Treat as foreground |

## Decided

- The reproduction comes first, through the `diagnose` skill: a locked-screen background wake on a
  simulator or device that produces the same storage error is the feedback loop. No fix is proposed
  until it reproduces — a fix without a repro is a `[decision]` checkpoint, not a commit.
- Skipping is the only recovery. No retry loop, no queueing of the skipped work, no change to the
  data-protection class of the storage files — that is a separate decision if skipping proves
  insufficient.
- The fix ships as a 4.9 patch release built from its hotfix branch and bumps the patch version.

## Clarifications

## Non-goals

- The shared-session native lock's abandonment errors on the same wake path — Task 0097.
- Changing which background wakes the app registers for (push, Live Activity, background refresh).
- Android.

## Context

The error is `NSCocoaErrorDomain 257` / `NSPOSIXErrorDomain 1` on the AsyncStorage manifest under
`Library/Application Support`. Every event has `in_foreground: false` and most have the device on
battery, consistent with a push-driven wake while locked. The unhandled rejection is reported through
`onunhandledrejection`, so the failing call has no catch on its chain. The 4.9.14 → 4.9.16 hotfixes
did not touch this path. Sentry issue: https://sofibaby.sentry.io/issues/REACT-NATIVE-8

## Implementation work

- [ ] Build the feedback loop: a repeatable locked-device background wake that reproduces the
      storage error, recorded in the PR (`diagnose` phases 1–3).
- [ ] Storage access on the background wake path treats the file-protection error as "skip and
      retry later" per the table above; proved in the unit test for the storage boundary.
- [ ] No unhandled rejection reaches the global handler on that wake; proved in the same test file.
- [ ] The original repro no longer produces the Sentry error (`diagnose` phase 7).
- [ ] Bump `app.json` to 4.9.17 and add a release note.

## Human checkpoints

- [ ] [decision] If the wake cannot be reproduced locally after the diagnose loop, choose between
      shipping the defensive skip without a repro or adding temporary production instrumentation
      (`talk-it-through`).
- [ ] [verify] On a device build: lock the phone, trigger a push or Live Activity update, unlock ·
      Expected: no new REACT-NATIVE-8 event for that device in Sentry · Failure: a new event appears ·
      Reason: iOS data protection is not simulated faithfully by the simulator.

## Acceptance criteria

- [ ] The storage-boundary unit test proves the skip-and-retry behavior for every row of the table.
- [ ] `npm run test:unit` and `npm run test:component` pass with no new failures.
- [ ] The device verification above passes.
