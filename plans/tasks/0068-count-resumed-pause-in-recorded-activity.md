# Task 0068: Count a resumed pause and end a stopped paused timer at `pausedAt`

**Branch**: `feature/count-resumed-pause-in-recorded-activity`
**Depends on**: 0067
**Source**: `plans/decision-maps/unified-timer-contract/clusters/pause-semantics.md` and its two members,
`decisions/resolved/006-pause-semantics.md` and
`decisions/resolved/018-disagreeing-length-display.md` (both resolved) · **User stories**: As a
caregiver, I want a timer I paused and came back to keep counting, and a timer I paused and never
resumed to record nothing after the pause, so that the number I see on a saved activity is the one I
lived through.

**Execution classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

One pause rule for the recorded activity across all four timer types — feeding, sleep, pumping, and
tummy time — applied wherever an activity record is written.

### The rule

1. **A resumed pause counts.** The recorded `durationSeconds` is `endedAt - startedAt`. The
   `totalPausedMs` subtraction is dropped for every type, not for sleep alone. Every record written
   after this change satisfies the invariant `durationSeconds === endedAt - startedAt`.
2. **A pause left open bills nothing.** Stopping a paused timer ends the record at `pausedAt`, not at
   the moment the stop was issued. This holds on every surface that can stop a timer.

The two halves are one rule and must land together. Counting a resumed pause is only safe because a
span the caregiver never returned from never reaches the record.

### Where the rule applies

After Task 0067 the duration arithmetic and record construction are owned by
`src/services/timer-lifecycle.ts`, so the duration change is one site. Task 0066 shipped it as
`durationSeconds = Math.max(0, Math.floor((endedAt - startedAt - totalPausedMs) / 1000))` and
explicitly deferred the pause treatment to this task; the `Math.max(0, …)` clamp stays.

The stop-time truncation applies at every path that produces a stop time for a running timer:

- each context's own stop callback (`stopBreastfeeding`, `stopSleep`, `stopPumping`,
  `stopTummyTime`), which today passes `requestedEndTime ?? new Date()` straight through to
  `acceptTimerCompletion` with no regard for the pause state. When the timer is paused, the requested
  stop time is `pausedAt`;
- external stops, which reach the same callbacks: `useWidgetStopHandler` calls the type's stop with
  the command's `eventAt` for widget, Watch, and routed stops. No separate handling is needed once the
  context callbacks truncate, but the behavior must be proved through that seam;
- the restore lock-conflict path inside the lifecycle module, which today passes `new Date(Date.now())`
  to `acceptTimerCompletion`. When the restored snapshot carries `isPaused` with a `pausedAt`, that
  value is the stop time.

`acceptTimerCompletion(babyId, type, startedAt, timer, requestedStopTime)` already takes a requested
stop time and returns `completion.stoppedAt`, so no seam is added. Its idempotence is unchanged: a
retried stop reuses the recorded completion, so truncation is decided once.

### What does not change

- No schema change, no new column, no stored pause span. `totalPausedMs` stays on the running timer
  only and is still accumulated on resume, because the widget, the Watch, and the Live Activity keep
  sending `pauseDurationMs` and `accumulatedSeconds`; the app simply stops subtracting it from what it
  records. The Watch target does not change. The widget target preserves a queued pause timestamp as
  the stop command's `eventAt` when a pause and stop arrive together, so the open pause is not billed.
- No backfill and no correction of records written before this change. A legacy paused record keeps a
  `durationSeconds` smaller than its interval, in the data and on screen, which
  `decisions/resolved/017-paused-sleep-backfill.md` settled. A timer restored from `AsyncStorage`
  across the update carries a `totalPausedMs` written under the old meaning; it is ignored from then
  on for every type, so that timer records slightly more than the old code would have. Nothing is lost
  and no migration is needed.
- No change to the pause control on any surface, no second control, and no change to
  `toggle_timer_pause`, which keeps its signature, its `isPaused` validation, and its owner-only
  guard.
- No change to `napContinuationMinutes` or to where continuation merging applies.
- No annotation, badge, or explanatory copy anywhere about a legacy record's two numbers.

### Deliberately accepted cost

`calculateTummyTimeStats` and `calculatePumpingStats` summed minutes rise by every resumed pause span,
in totals parents measure against a goal. Record counts are untouched because no record is split. The
owner accepted this to keep one rule across the four timers and chose to watch it in use. Prove it
with explicit tests so the overcount is deliberate rather than incidental.

## Implementation work

- [x] Drop the `- totalPausedMs` term from the module-owned duration rule so it reads
      `durationSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000))`, and update the module's
      duration tests to assert the invariant rather than the subtraction.
- [x] Truncate the requested stop time to `pausedAt` when the timer is paused, in each of the four
      context stop callbacks, so an in-app stop, a widget stop, a Watch stop, and a routed stop all
      record an end of `pausedAt`.
- [x] Truncate the same way in the lifecycle module's restore lock-conflict path, using the restored
      snapshot's `pausedAt` when it is paused instead of the current time.
- [x] Per type, write tests for a timer paused and resumed: the saved record's `durationSeconds`
      equals `endedAt - startedAt` and includes the resumed span.
- [x] Per type, write tests for a timer paused and then stopped without resuming: the record ends at
      `pausedAt`, and the span between the pause and the stop reaches nothing.
- [x] Prove the truncation through the external stop seam, so a widget, Watch, or routed stop issued
      while paused records `pausedAt` rather than the command's `eventAt`.
- [x] Add explicit total tests: `calculateTummyTimeStats` and `calculatePumpingStats` include a resumed
      pause span in their summed minutes while `sessionCount` and `totalCount` stay unchanged.
- [x] For one paused-and-resumed sleep, prove the Timeline daily summary, the Timeline row label, the
      CSV export, and the PDF report all report the same number, without changing any of those
      consumers. This is the standing bar from
      `decisions/resolved/003-sleep-derivation-blast-radius.md` and it is met by construction once the
      invariant holds.
- [x] Keep `src/__tests__/external-timer-stop-providers.integration.test.tsx` passing, adjusting only
      assertions that encode the old subtraction.

## Implementation evidence

- RED: the four adapter seams and shared duration test failed on the old pause subtraction; the real
  providers failed on resumed-pause discard and paused-stop truncation; the restore-conflict seam
  failed because it requested the current time.
- GREEN: all four adapter files pass (23 tests), the provider integration suite passes (45 tests),
  the statistics and completed-sleep consumer proof passes (65 tests), and the Timeline component
  shows the same ten-minute duration in its daily summary and row.
- Focused pre-review validation: targeted ESLint and repository TypeScript checking pass.
- README: updated `Timer Exclusivity` with the saved-duration and paused-stop rules. The affected
  prose passed one complete `write-well` audit with no findings.
- Final automated proof: `npm run check:code` passed lint, strict type checking, 139 unit-test files
  / 2,546 tests, 93 component suites / 860 tests, 65 CI-contract tests, and the production-bundle
  development-tool exclusion. Log:
  `/tmp/agent-workflows/baby-tracker/feature-count-resumed-pause-in-recorded-activity/canonical.log`.
- Local Supabase simulator proof: on `SofiBaby Owner` / iOS 26.5, a sleep started at
  `2026-08-06T10:54:38.744Z`, paused at `2026-08-06T10:54:39.826Z`, and was stopped later without
  resuming. The saved `sleep_sessions.ended_at` and `babies.last_sleep_ended_at` both equal the
  captured pause instant, `duration_seconds` is 1, and no sleep lock remains.
- skipped (minor): TR-9 — The Timeline summary/row test does not exercise a resumed pause — User
  limited this remediation pass to major/minor findings TR-1–TR-8.
- skipped (minor): TR-10 — The duration helper retains an unused pause parameter and an unreachable
  fallback — User limited this remediation pass to major/minor findings TR-1–TR-8.

## Human checkpoints

- [x] [verify] Against local Supabase, start a sleep timer, pause it, wait, then stop without
      resuming. Inspect the written `sleep_sessions` row and the baby's `babies.last_sleep_ended_at`.
      · Expected: the row's `ended_at` is the pause moment, and `last_sleep_ended_at` equals that same
      moment, denormalized by the `update_baby_last_sleep_ended_at` trigger on `sleep_sessions`.
      · Failure: `ended_at` or `last_sleep_ended_at` is the stop moment, or the two disagree.
      · Reason: the repository has no SQL test harness — `supabase/` holds only `config.toml`,
      `functions/`, and `migrations/` — so a database trigger's effect cannot be asserted from the
      TypeScript suites.
- [x] [verify] On a device, start a timer, then pause and resume it entirely from the iOS widget
      without ever foregrounding the app, and stop it from the widget. Repeat with the Apple Watch.
      · Expected: each saved record's length includes the paused span, and `durationSeconds` equals
      `endedAt - startedAt`. · Failure: the record excludes the paused span, or the two numbers differ.
      · Reason: the pause and resume originate in native widget and Watch targets and are delivered
      through App Group storage and `WatchConnectivity`, which no simulator-free automated suite in
      this repository exercises end to end.

## Acceptance criteria

- [x] A feeding, a sleep, a pumping, and a tummy time record each written after a pause and resume
      satisfies `durationSeconds === endedAt - startedAt` and includes the resumed span.
- [x] A timer of each of the four types stopped while paused, from the app and from an external
      command, records an end of `pausedAt`.
- [x] `calculateTummyTimeStats` and `calculatePumpingStats` summed minutes include a resumed pause
      span while their record counts are unchanged.
- [x] For a paused-and-resumed sleep, the Timeline daily summary, the Timeline row label, the CSV
      export, and the PDF report report the same number, with no consumer repointed.
- [x] Records written before this change are untouched: no backfill runs and a legacy paused record
      still shows its stored length.
- [x] No schema change, no new field, and no change to `toggle_timer_pause` or the Watch target; the
      widget target changes only to preserve queued pause-before-stop ordering.
- [x] Both `[verify]` checkpoints confirmed by the owner.

## Completion record

- **Built:** all four recorded timer types count a resumed pause in `durationSeconds`; stopping a
  paused timer uses `pausedAt` across in-app, queued external, and restore-conflict paths. Feeding
  side durations remain reconciled with the recorded total, and short paused pumping completions
  preserve entered volume.
- **Decisions:** the saved interval is the source of duration truth, a pause left open ends the
  interval at its pause instant, existing records are not backfilled, and running-surface alignment
  remains assigned to Task 0069.
- **Relevant files:** the shared lifecycle in `src/services/timer-lifecycle.ts`, the four timer
  contexts and adapters under `src/contexts/` and `src/services/timer-adapters/`, queued widget
  ordering in `targets/widget/index.swift`, and the provider and cross-consumer integration suites
  under `src/__tests__/`.
- **Documentation:** README `Timer Exclusivity` describes the current saved-duration and paused-stop
  rules; the affected prose passed one `write-well` audit pass with no findings.
- **Review:** TR-1 through TR-8 were fixed. TR-9 and TR-10 were skipped as minor because the user
  limited remediation to TR-1 through TR-8. TR-11 was deferred to the already-planned Task 0069.
  Security review found no issue, and no security risk was accepted.
- **Automated proof:** `npm run check:code` passed lint, type checking, 2,546 unit tests, 860
  component tests, 65 CI-contract tests, and production-bundle validation.
- **Manual proof:** local Supabase on the `SofiBaby Owner` iOS 26.5 simulator saved a paused sleep's
  `ended_at` at `2026-08-06T10:54:39.826Z`; the baby's `last_sleep_ended_at` matched and no sleep lock
  remained. The owner confirmed the physical iOS widget and Apple Watch pause, resume, and stop
  checks passed with saved durations equal to their recorded intervals.
