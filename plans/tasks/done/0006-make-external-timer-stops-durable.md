# Task 0006: Make external timer stops durable

**Branch**: `feature/durable-external-timer-stops`
**Depends on**: none
**Source**: production bug hunt 2026-07-14 · **User stories**: stopping a running timer from the iOS widget, Live Activity, routed action, or app UI records exactly one completed activity; reopening or foregrounding the app cannot resurrect or duplicate a stopped timer

## What to build

Make timer stopping an idempotent persisted command across feeding, sleep, pumping, and tummy time. A pending external stop must remain available until the matching local timer has loaded and the stop has been consumed, and local timer restoration must not reject that timer merely because the external stop already released its server lock. Every timer context must reject stale asynchronous restoration after a stop starts or completes.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [x] Keep the shared timer-stop semantics explicit and consistently typed across all four timer activities.
- [x] Add deterministic regression tests for cold-start pending stops, foreground stops, stale restoration, repeated stop delivery, and sub-minute discard behavior.
- [x] Preserve the canonical lint, typecheck, and test commands as passing proof.

## AFK tasks

- [x] Reproduce the pending-stop cold-start failure and non-sleep stale-restore race with failing tests before changing production code.
- [x] Prevent the widget stop handler from consuming a pending command before its matching timer is available, while still discarding commands that target an older timer.
- [x] Allow a matching pending external stop to restore from local timer storage even after the extension released the server lock, then consume it exactly once at its recorded stop timestamp.
- [x] Apply the sleep context's stop-in-progress/version protection to feeding, pumping, and tummy time restoration paths.
- [x] Verify normal in-app stops, routed pause/resume actions, alerts, lock release retries, and Live Activity cleanup still behave correctly.

## Acceptance criteria

- [x] A widget stop delivered while the app is terminated is recorded after the app next loads, using the external `stoppedAt` time.
- [x] A pending stop is not cleared merely because the provider has not restored its timer yet.
- [x] Missing server lock state caused by the external stop does not erase the matching local timer before it can be finalized.
- [x] Repeated delivery or repeated taps produce no duplicate activity entries.
- [x] A timer started after a stale stop command is never stopped by that command.
- [x] Feeding, sleep, pumping, and tummy-time restore operations cannot re-enable a timer after stopping has begun.
- [x] Focused regression tests, typecheck, and lint pass.

## Implementation notes

- Added a typed timer-stop coordinator shared by the widget handler and all four timer contexts.
- The iOS intent now persists the baby-targeted stop command before releasing the server lock.
- Pending commands wait through cold-start/provider restoration, are retried if restoration races an in-flight read, and are cleared only when consumed or proven stale by a newer timer.
- Feeding, pumping, and tummy-time restoration now use the same stop-version guard already established for sleep. Matching pending stops bypass missing-lock cleanup and do not restart Live Activities.
- Compare-and-clear semantics prevent an older handler pass from deleting a newer stop command. Stale stops no longer clear a newer timer's pending pause/resume action.

## Software Repository Guidelines result

- **Mode**: implement + review
- **References loaded**: `00-overview`, `01-style-and-code-quality`, `02-testing`, `06-code-health-and-maintainability`, `10-definition-of-done`
- **Complete**: strict TypeScript passed; changed TypeScript files have zero ESLint warnings; deterministic unit and component regressions cover cold start, foreground delivery, in-flight restoration, stale/newer timers, repeated delivery, baby targeting, sub-minute discard, and restore-version invalidation.
- **Deferred to task 0010**: repository-wide warning cleanup and the pre-existing full component-suite i18next setup failure.
- **Decisions required**: none.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed with 83 pre-existing warnings; no warnings in newly changed TypeScript files.
- `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npm run test:unit` — 96 files / 2,190 tests passed.
- Focused Vitest timer/data-loss/service-outage regressions — 4 files / 48 tests passed.
- `useWidgetStopHandler.component.test.tsx` — 5 tests passed.
- Timer activity integration + timer alert component regressions — 2 suites / 19 tests passed.
- Full component suite — 39/40 suites and 520 tests passed; `app/(tabs)/index.component.test.tsx` has a pre-existing `initReactI18next` Jest setup failure tracked by task 0010.
- Swift intent proof: source inspection confirms `pendingWidgetStop` is written before the `active_timers` DELETE request. No generated iOS project is committed, so the highest-level unattended substitute was the component lifecycle suite.

## Review and documentation

- Automatic Standards, Spec, Bug, and guideline review found no blocker or major findings after race review and fixes.
- Security lens skipped: no authentication, authorization, secret, dependency, or permission boundary changed.
- README unchanged because this is an internal correctness fix with no user-facing setup, command, or workflow change.
