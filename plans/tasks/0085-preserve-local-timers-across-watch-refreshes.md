# Task 0085: Preserve locally-known timers across Watch summary refreshes

**Branch**: `feature/preserve-local-timers-across-watch-refreshes`
**Depends on**: 0082, 0084
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 3 extended to the Watch (approved 2026-08-10)

## What to build

Apply task 0082's timer-preservation fix to the Apple Watch. `WatchActivitySummary.swift` uses the
same `isOlder`/`serverAsOf` freshness-guard pattern as the widget's snapshot coordinator, so the
same erase bug is presumed: an app-written summary without `serverAsOf` always loses to a server
response, deleting locally-known timers the server cannot know about (accountless, offline-started,
or a write-then-refresh race).

First confirm the bug actually exists on the Watch — this was inferred from the shared code
pattern, not reproduced. If reconnaissance shows the Watch write path already carries a comparable
freshness stamp or the Watch never receives app-local timer writes, record that finding in this
task file and close it as not applicable instead of changing code.

If confirmed, mirror 0082's fix shape:

1. Ensure the app's Watch-bound local write carries the freshness stamp introduced in 0082.
2. Merge the timer list in the Watch's refresh path instead of replacing it: server-owned removals
   apply; a local timer newer than the response's `serverAsOf`, or one with no possible server row,
   survives.
3. Server-owned fields (totals, last times) keep being replaced wholesale.

## Implementation work

- [ ] Reconnaissance: trace how app-local timer writes reach the Watch and whether `isOlder` in
      `WatchActivitySummary.swift` can erase them; record the finding here.
- [ ] If confirmed: reuse/extend the 0082 freshness stamp on the Watch-bound write (TypeScript
      side, test-first where it touches `src/services/`).
- [ ] If confirmed: implement the timer-list merge in the Watch refresh path
      (`WatchActivitySummary.swift`).

## Human checkpoints

- [ ] [verify] On a paired simulator or physical Watch: start a timer while offline or
      accountless, let a Watch summary refresh run. · Expected: the timer stays visible and
      ticking on the Watch; a timer stopped on the server is still removed. · Failure: the local
      timer disappears after a refresh. · Reason: no Swift test target exists; watchOS refresh
      behavior is only observable on simulator/device. (Skip if reconnaissance closes the task as
      not applicable.)

## Acceptance criteria

- [ ] The reconnaissance finding (bug confirmed or not applicable) is recorded in this file.
- [ ] If confirmed: a locally-known timer survives a Watch server refresh; server-owned removals
      still apply; server-owned fields still replace wholesale.
