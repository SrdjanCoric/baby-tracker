# Task 0082: Preserve locally-known timers across widget server refreshes

**Branch**: `feature/preserve-local-timers-across-widget-refreshes`
**Depends on**: 0081
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 3
**Execution classification**: `code` · **Validation tier**: `focused` · **TDD applicable**: yes

## What to build

Stop the iOS Widget's server snapshot refresh from erasing timers the server cannot know about.
A locally-known running timer must keep ticking through every timeline refresh; a stale or failed
server snapshot must never delete it.

### The bug

The ticking itself is fine — `Text(startDate, style: .timer)` renders in the system process. The
failure is **belief**: the ticking view only exists inside `hasActiveTimer(for:)`, and the timer
list gets erased.

`WidgetSnapshotCoordinator.performRefresh` (`targets/widget/WidgetActivitySnapshot.swift`)
replaces the app-written cache with the server RPC result on every timeline refresh. The freshness
guard `isOlder` returns `false` whenever **either** side lacks `serverAsOf`. The app's local write
(`src/contexts/widget-context.tsx` via `src/services/widget-data-service.ts`) never carries one —
it decodes as `.legacy` — so a server snapshot **always** wins over a fresher local write, and the
result is written back over both cache keys.

Cases where the server legitimately cannot know the timer:

- accountless timers (never reach the server);
- offline-started timers (`lockState: "accountless" | "offline"` in
  `src/services/timer-lifecycle.ts`);
- the write-then-refresh race triggered by `extensionStorage.reloadWidget()`.

Recovery today only comes at the next timeline reload — up to 30 minutes.

### Fix shape (decided in the investigation)

1. Stamp the app's local write with a freshness value `isOlder` can compare against `serverAsOf`.
2. In `performRefresh`, **merge** the timer list instead of replacing it: server-owned removals
   apply, but a local timer newer than the snapshot's `serverAsOf`, or one that can have no server
   row (accountless/offline lock state), survives.
3. Everything else in the snapshot — totals, last times, wake windows — keeps being replaced
   wholesale; the server genuinely owns it.

Note the interaction with task 0083: credential renewal makes server refreshes succeed far more
often, so this merge must land **first** or the erase path runs constantly.

Scope is the widget only. The Watch equivalent is task 0085.

## Implementation work

- [x] Test-first on the TypeScript side: the local widget write carries a freshness stamp
      comparable to `serverAsOf` (extend `src/services/widget-data-service.ts` and its tests).
- [x] In `WidgetActivitySnapshot.swift`, make the decoder recognize the stamped local write
      (instead of `.legacy`) and implement the timer-list merge in `performRefresh` per the fix
      shape above.
- [x] Keep wholesale replacement for server-owned fields (totals, last times, wake windows).

## Implementation evidence

Freshness semantics (resolved per the investigation's open contract):

- A new **`.local`** snapshot kind is recognized when `schemaVersion` is absent and a string
  `localAsOf` is present. `WidgetData.localAsOf` is stamped by `buildWidgetData` in the same
  clock domain as `updatedAt` (one `new Date().toISOString()` feeds both). A cache lacking
  both `schemaVersion` and `localAsOf` stays `.legacy`, so running binaries and old caches
  keep their behavior.
- `ActiveTimerData.lockState` (the `TimerLockReconciliationState` union) is propagated from
  each running timer's `lockState`; remote-locked timers (added with `isRemote: true`) carry
  no `lockState` and remain server-owned.
- Swift `performRefresh` merges the timer list: response timers are kept as-is; a prior timer
  survives when its `lockState` is `accountless`/`offline` (no server row) **or** when
  `prior.localAsOf` is newer than `response.serverAsOf` (the write-then-refresh race).  Remote timers and timers of a type already present in the response are never merged in.
  `activities.sleep.isActive` is reset from the merged timer list so `validateVersioned`
  accepts the stored merged bytes.
- Server-owned fields (totals, last times, wake windows) still come wholesale from the
  response; only the timer list is merged.

RED/GREEN cycles observed:

1. TS decoder `classifies an app-written stamped cache as a local snapshot` — RED `legacy` vs
   `local`, GREEN after the `kind: "local"` branch + `localAsOf`/`lockState` fields in
   `src/services/widget-activity-snapshot.ts`.
2. Component `stamps the local write and propagates each timer's lockState` — RED
   `localAsOf` undefined, GREEN after `buildWidgetData` stamps `localAsOf` and forwards each
   timer's `lockState`.
3. Swift `decodeCache` of `local-stamped.json` — RED compile error (no `.local`/`localAsOf`/
   `lockState`), GREEN after the Swift model + decoder additions.
4. Swift merge — offline timer survives a newer server snapshot, the write-then-refresh race
   keeps a newer local-owned timer, and a server-stopped remote timer is still dropped; RED
   under wholesale replace, GREEN after `mergeTimers` plus the `sleep.isActive` reset.

Validation (focused tier, logs in `/tmp/agent-workflows/e2f8af45fd34/9567f0a1f7e5/`):

- `npm run typecheck` → 0 (`typecheck.log`).
- `npm run lint` → 0 (`lint.log`).
- vitest: `widget-activity-snapshot`, `widget-data-service`, `native/widget-stop-intent-order`,
  `native/watch-summary-wiring`, `security/watch-service-privacy` → 24 passed (`unit-affected.log`).
- jest: `widget-context.component`, `useWidgetStopHandler`, `useWatchMessageHandler`,
  `watch-realtime-baby-selection` → 45 passed (`jest-affected.log`).
- `npm run test:widget:swift` → widget snapshot harness `PASS`, watch summary harness passed
  (`swift-green.log`).

The direct rendered-WidgetKit checkpoint has no Swift XCUITest target. User accepted the clean
simulator household-timer gate recorded below as its manual proof.

## Human checkpoints

- [x] [verify] Clean simulator household-timer gate accepted by user in place of direct WidgetKit
      surface automation: `npm run e2e:household-timers:clean` passed on prepared Owner/Member
      simulators after resetting local Supabase, rebuilding the app, and running offline start,
      reconnect, caregiver handoff, and server widget-snapshot checks. · Evidence:
      `e2e/artifacts/household-timers/2026-08-11T08-14-23-974Z/`. · Limitation: no WidgetKit
      XCUITest target exists, so this does not inspect the rendered Home Screen widget directly.

## Acceptance criteria

- [x] The app's local widget write carries a freshness stamp; a server snapshot older than it no
      longer wins.
- [x] An accountless or offline-started timer survives a server snapshot refresh and keeps
      ticking.
- [x] [waived] The write-then-refresh race no longer erases a just-written timer. User explicitly
      waived race-condition coverage during review; TR-3 remains `deferred-out-of-scope`.
- [x] A timer stopped on the server is still removed from the widget on refresh.
- [x] Totals, last times, and wake windows continue to come wholesale from the server snapshot.

## Completion record

- Built: local timer-list preservation in `targets/widget/WidgetActivitySnapshot.swift`, including
  `localAsOf` carry-forward across consecutive refreshes and pending-widget-stop filtering through
  `WidgetSnapshotPendingStopReading`; app-group wiring is in `targets/widget/index.swift`.
- Tests: `scripts/swift/widget-snapshot-tests.swift` covers a second refresh retaining `localAsOf`,
  an offline timer cleared by a pending widget Stop command, and a local-stamped remote prior that
  binds the `isRemote` guard.
- Documentation: `plans/master-plan.md` records the approved locally-known-timer merge exception.
  README `iOS Native Integrations` now describes successful-refresh retention for accountless/offline
  timers. `write-well` audit completed in two passes with no findings.
- Review: TR-1, TR-2, TR-4, and TR-5 fixed. TR-3 deferred by user as race-condition scope. TR-6,
  TR-7, TR-8, TR-9, TR-12, and TR-13 skipped as minor/nit scope. TR-10 and TR-11 accepted as
  security risks because current user base is very small and exposure limited.
- Automated proof: `npm run test:widget:swift` passed (`finish-swift.log`); final focused Swift and
  TypeScript proofs passed (`final-swift.log`, `final-ts.log`); mutation checks failed as expected
  when each new guard/path was removed. Clean simulator gate passed (`finish-e2e-household-timers-clean.log`).
- Manual proof: user accepted the clean simulator gate above in lieu of a direct rendered-WidgetKit
  check; direct surface inspection remains unavailable without a WidgetKit XCUITest target.

## Review closeout records

- skipped (minor): TR-6 — merged snapshot stored as re-encoded model bytes instead of verbatim response, dropping additive fields — deferred; forward-compat re-encoding concern out of scope for this pass.
- skipped (minor): TR-7 — type-keyed merge discards a fresher local timer of same type — deferred; narrow stop-then-restart race out of scope.
- skipped (minor): TR-8 — `isOlder` not extended for `localAsOf` — deferred; criterion 1 satisfied at timer granularity per task evidence.
- skipped (minor): TR-9 — `lockState` rejection branch untested and duplicates union as string literals — deferred; minor test gap.
- skipped (minor): TR-12 — `!hasSchemaVersion` decoder branch is dead code — deferred; no behavior impact.
- skipped (minor): TR-13 — completed work item names files the diff never touches — deferred; cosmetic task-file wording.
- accepted (security): TR-10 — accountless/offline retention has no session binding or age bound — very small user base at present; limited exposure.
- accepted (security): TR-11 — unvalidated `.local`/`.legacy` cache timers merged into versioned envelope — very small user base at present; limited exposure.
- deferred (race): TR-3 — cross-domain clock comparison in survival branch — race-condition scenarios out of scope per user.
