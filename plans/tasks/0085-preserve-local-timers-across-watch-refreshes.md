# Task 0085: Preserve locally-known timers across Watch summary refreshes

**Branch**: `feature/preserve-local-timers-across-watch-refreshes`
**Depends on**: 0082, 0084
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 3 extended to the Watch (approved 2026-08-10)
**Change class**: `mixed` · **Validation tier**: `canonical` · **TDD applicable**: `true`

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

## Reconnaissance finding

Confirmed on 2026-08-12. The app publishes locally-known timers with `lockState` and a root
`localAsOf` stamp, and `syncToWatch` sends the complete app snapshot to the Watch. However, the
dedicated multi-baby Watch envelope omitted `localAsOf`, while the Watch summary decoder discarded
both `localAsOf` and each timer's `lockState`. A stamped app snapshot was therefore treated as legacy
and rejected once a versioned server cache existed. When a local snapshot was cached, both the full
refresh and changed-timer probe wrote the server response wholesale, erasing an accountless,
offline-started, or newer app-written timer. The existing portable Swift summary harness provides an
automated coordinator seam even though there is no Xcode Watch unit-test target.

## Implementation work

- [x] Reconnaissance: trace how app-local timer writes reach the Watch and whether `isOlder` in
      `WatchActivitySummary.swift` can erase them; record the finding here.
- [x] If confirmed: reuse/extend the 0082 freshness stamp on the Watch-bound write (TypeScript
      side, test-first where it touches `src/services/`).
- [x] If confirmed: implement the timer-list merge in the Watch refresh path
      (`WatchActivitySummary.swift`).

## Human checkpoints

- [x] [verify] On a paired simulator or physical Watch: start a timer while offline or
      accountless, let a Watch summary refresh run. · Expected: the timer stays visible and
      ticking on the Watch; a timer stopped on the server is still removed. · Failure: the local
      timer disappears after a refresh. · Reason: no Swift test target exists; watchOS refresh
      behavior is only observable on simulator/device. (Skip if reconnaissance closes the task as
      not applicable.)

## Acceptance criteria

- [x] The reconnaissance finding (bug confirmed or not applicable) is recorded in this file.
- [x] If confirmed: a locally-known timer survives a Watch server refresh; server-owned removals
      still apply; server-owned fields still replace wholesale.

## Verification evidence

- TypeScript transport RED→GREEN: `npm run test:unit --
  src/services/widget-data-service.test.ts` failed when the dedicated Watch envelope omitted
  `localAsOf`, then passed 8/8 after the envelope carried the app snapshot stamp.
- Swift merge RED→GREEN: `npm run test:widget:swift` first failed when a full refresh erased the
  offline fixture timer, then passed after both full-refresh and changed-timer-probe paths merged
  locally-known timers. The harness covers accountless/offline survival, the newer-local race,
  freshness-stamp carry-forward, newer server removal, and wholesale replacement of summary totals.
- Swift phone-payload RED→GREEN: the same harness failed when a stamped multi-baby Watch envelope
  was rejected over a versioned base, then passed after stamped local payloads gained their own
  freshness ordering.
- Timer-probe RED→GREEN: the Swift harness failed when merge-only `lockState` provenance changed
  the lightweight timer fingerprint, then passed after fingerprint normalization ignored it.
- Stable focused checks passed: `npm run test:widget:swift`, targeted ESLint for the two changed
  TypeScript files, repository TypeScript typecheck, and `git diff --check`. Logs are under
  `/tmp/agent-workflows/e2f8af45fd34/39f39e542a95/`.
- Final canonical proof passed on 2026-08-12: `npm run check:code` completed with 117/117 component
  suites (1,080 tests), 65/65 CI-contract tests, production Widget and Watch Swift typechecks, the
  Watch summary harness, and the production-bundle gate. The output-only-capped log is at
  `/tmp/agent-workflows/baby-tracker/feature-preserve-local-timers-across-watch-refreshes/canonical.log`.
- README disposition: the Apple Watch section now describes local timer preservation and later
  server-owned removal. The affected paragraph passed one complete `write-well` audit pass.
- Paired Watch simulator proof passed on 2026-08-12 with the current `SofiBabyWatch` target on the
  active `SofiBaby Owner` / Apple Watch Series 11 pair. The activation refresh retained the seeded
  offline Sleep timer, and screenshots 13 seconds apart showed it ticking from 9:28 to 9:41. A later
  server-stopped summary removed the timer and disabled active-timer polling. Evidence is under
  `/tmp/agent-workflows/baby-tracker/feature-preserve-local-timers-across-watch-refreshes/` as
  `watch-local-survives-1.png`, `watch-local-survives-2.png`, and `watch-server-stopped.png`.

## Review decisions

- skipped (minor): TR-5 — `reconcileOverlays` uses the raw response rather than the installed merged data — because I don't care about those
- skipped (minor): TR-7 — local/server freshness compares clocks that may be skewed — because I don't care about those

## Completion record

- Built the Watch transport stamp and summary-coordinator merge across
  `src/services/widget-data-service.ts`, `targets/watch/WatchActivitySummary.swift`, and their
  TypeScript and portable Swift coverage.
- Kept server-owned summary fields authoritative, preserved eligible local timers for one refresh,
  excluded pending stops, and normalized timer probes so preserved provenance does not create
  redundant fetches.
- Review outcome: TR-1, TR-2, TR-3, TR-4, and TR-6 were fixed with regression tests. TR-5 and TR-7
  were skipped as minor at the user's direction for the reasons recorded above. No security risk was
  accepted.
- Documentation and final proof are recorded above. All implementation work, acceptance criteria,
  and the paired-Watch checkpoint are complete.
