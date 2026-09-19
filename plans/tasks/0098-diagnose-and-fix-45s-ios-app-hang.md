# Task 0098: Diagnose and fix the 45-second fully-blocked iOS hang

**Branch**: `hotfix/4.9.19-ios-main-thread-hang`
**Depends on**: none
**Base**: `hotfix/4.9` (the 4.9 integration line; its tip is the latest shipped hotfix). Not `main`.
**Source**: Sentry REACT-NATIVE-7, 2026-09-14 → 2026-09-18, 48 events, 17 users, iOS 4.9.14,
foreground, plus the related REACT-NATIVE-H (fatal watchdog kill, 1 user) and REACT-NATIVE-A/C
(2-second hangs, 8 users) · **User stories**: a caregiver opening the app never stares at a frozen
screen for close to a minute or gets the app killed by the watchdog.

## What to build

The main thread is fully blocked for a consistent 44.5–45.3 seconds in the foreground, shortly after
app start (every event's `app_start_time` is within minutes of the hang). The JavaScript thread is
idle in the captured samples and the main thread sits in a Mach message wait, which points at a
synchronous wait on the main thread rather than JavaScript work.

Deliverable: the cause identified through the `diagnose` loop, the blocking wait removed or moved
off the main thread, and a regression test at the seam the diagnosis exposes. The consistent
duration is the primary clue — a fixed timeout somewhere in native or bridged code.

| Outcome of diagnosis | Result |
| --- | --- |
| Cause found and reproducible | Fix + regression test at the exposed seam, ship as 4.9 patch |
| Cause found, not reproducible locally | `[decision]` on shipping a targeted fix with device verification only |
| Cause not found after two hypothesis batches | `[decision]`; produce a `handoff` with ruled-out hypotheses |

## Decided

- Start from evidence, not guesses: pull every thread's stack for at least three events across
  different devices before forming hypotheses, and record them in the PR.
- The 2-second hangs (A, C) and the watchdog kill (H) are treated as the same investigation only if
  their main-thread stacks match; otherwise they stay out of scope.

## Clarifications

## Non-goals

- General startup performance work.
- Android ANRs — Task 0099.

## Context

Sentry captured 16 threads per event including `io.sentry.app-hang-tracker`; the default thread
listing shows only the top frames, so the full per-thread stacks must be fetched explicitly. The
shared-session lock acquire timeout is 10 seconds, so it does not explain 45 seconds by itself.
Devices span iPhone 11 Pro Max to iPhone 16 on iOS 26.4–26.6. Sentry issue:
https://sofibaby.sentry.io/issues/REACT-NATIVE-7

## Implementation work

- [ ] Collect full thread stacks for three or more events and write the ranked hypotheses into the
      PR (`diagnose` phases 1–4).
- [ ] Build a feedback loop that reproduces the blocked main thread locally (simulator, device, or
      a throwaway harness around the suspected wait).
- [ ] Remove or relocate the blocking wait; proved by a regression test at the seam the loop exposed.
- [ ] Original repro no longer hangs; hang tracker records nothing over 2 seconds in that scenario.
- [ ] Bump `app.json` and add a release note.

## Human checkpoints

- [ ] [decision] Choose the path per the outcome table if the cause is found but not reproducible,
      or not found after two hypothesis batches (`talk-it-through`).
- [ ] [verify] Cold-start the device build ten times over a day of normal use · Expected: no new
      REACT-NATIVE-7 event for the device · Failure: a new fully-blocked hang · Reason: hang timing
      depends on real-device network and lock conditions.

## Acceptance criteria

- [ ] PR records the confirmed hypothesis and the ruled-out ones.
- [ ] The regression test fails before the fix and passes after.
- [ ] `npm run test:unit` and `npm run test:component` pass with no new failures.
- [ ] Device verification passes.
