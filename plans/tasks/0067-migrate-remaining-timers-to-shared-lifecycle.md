# Task 0067: Migrate pumping, feeding, and sleep onto the shared timer lifecycle

**Branch**: `feature/migrate-remaining-timers-to-shared-lifecycle`
**Depends on**: 0066
**Source**: `plans/decision-maps/unified-timer-contract/decisions/resolved/010-shared-timer-seam.md`
(resolved, amended 2026-08-05) · **User stories**: As a maintainer, I want the remaining three timer
types running on the shared lifecycle module, so that no duplicated restore sequence or duplicated
record definition is left anywhere.

## What to build

The three remaining timer types — pumping, feeding, and sleep, in that order — registered against the
shared timer lifecycle module Task 0066 built, with their duplicated restore blocks and duplicated
record arithmetic deleted. This is a restructuring: it changes no observable behavior.

Migration order is deliberate: pumping is the smallest, feeding moves per-side arithmetic, sleep is
the largest context and holds the only real divergences. Migrate and verify one type at a time; do
not start the next until the integration suite is green for the previous one.

Adapters live at `src/services/timer-adapters/<type>-timer-adapter.ts` alongside the tummy time
adapter. Each supplies the same six members Task 0066 fixed: activity-type literal, storage service,
`timer_data` codec, `buildRecord(startedAt, endedAt, payload)`, Live Activity detail argument and type
literal, and the `RESTORE_TIMER` dispatch. The duration rule stays module-owned and is not an adapter
member.

Each type builds a record in two places today — the restore lock-conflict branch and the local stop
path. Both must go through that type's `buildRecord`, so each type ends with one definition of its
record rather than two.

### Pumping

- `timer_data` carries the identity, `side`, and the pause fields.
- The record carries `side` plus the span. `volumeMl` never lived in local timer state and must not
  enter it: it rides on the stop command (widget stop handler, the Watch `stopPumpingWithVolume`
  message, and zero when switching babies). The adapter's `buildRecord` receives no volume.
- Live Activity detail argument is the pumping `side`; type literal is `"pumping"`.

### Feeding

- `timer_data` carries the identity, `side`, `type`, `leftAccumulatedSeconds`,
  `rightAccumulatedSeconds`, `currentSideStartedAt`, and the pause fields.
- Feeding's per-side arithmetic currently sits inline in the restore lock-conflict branch and must
  move into `buildRecord`: start from the accumulated left and right seconds, and when the timer is
  not paused add the current side's elapsed seconds since `currentSideStartedAt` (falling back to
  `startedAt`) to left, to right, or to both, according to `side`. Then derive `side` for the record —
  `both` when left and right are both positive, otherwise whichever is larger, ties going to `left` —
  and keep `lastFinishedSide` as the timer's own `side`. `leftDurationSeconds` and
  `rightDurationSeconds` stay `undefined` when zero. Record `type` is `"breast"`.
- Live Activity detail argument is the side as `LiveActivityBreastSide`; type literal is `"feeding"`.

### Sleep

Sleep carries every divergence in the set. Preserve each one exactly, through an adapter member or a
module option — never by silently dropping it:

- **`removeLock`.** Sleep alone calls `removeLock(babyId, "sleep")` from `useActiveTimers` inside the
  completion-secured short circuit. The other three do not. Keep it.
- **Obsolescence guards.** Sleep writes its guards inline as
  `isStoppingRef.current || stopVersionRef.current !== stopVersionAtStart` where the other three call
  `isTimerRestoreObsolete`. These are the same condition; sleep adopts the shared guard. Confirm the
  skip branches behave identically, including the two places sleep skips a block rather than returning.
- **Morning classification.** The restore path resolves `morningClassification` and
  `morningClassificationVersion` from the stored snapshot, falling back to `classifyNewMorningSleep`
  over the loaded sleeps with the configured `dayStartHour` and `napContinuationMinutes` and a
  reference time of `max(now, startedAt)`, and defaulting the version to `MORNING_CLASSIFICATION_VERSION`.
  The server-only branch resolves the same two fields from the decoded `timer_data` with the same
  fallback. Both fields reach `RESTORE_TIMER`, the persisted snapshot, the reconciled `timer_data`,
  and `buildRecord`.
- **The `alreadyStopped` proximity test.** Sleep's server-only branch releases the lock not only when
  `isTimerCompletionSecured` returns true but also when any loaded sleep starts within 5000 ms of
  `lock.startedAt`. No other type does this. Carry it as an optional adapter member the module calls
  alongside `isTimerCompletionSecured`; the other three adapters do not supply it.
- Record fields are the span plus `type` (`nap` or `night`, decoded as `night` only on an exact
  `"night"`) and the two classification fields. Live Activity detail argument is the sleep type; type
  literal is `"sleep"`.
- Sleep's restore also feeds prediction and classification state that lives outside the timer restore.
  Anything that is not part of the shared sequence stays in the context.

### Non-obvious constraints

- `src/__tests__/external-timer-stop-providers.integration.test.tsx` renders all four real providers
  and is these contexts' only behavioral contract. It must pass with **no edit to the test file**
  after each type migrates. An edit to that file is the signal that the move changed behavior.
- Each context keeps its reducer, its entries list, its non-timer surface, and its public start, stop,
  pause, and resume API. Start, pause, and resume stay outside the module.
- Each context's restore is currently fused with its entries load (`loadPumpings`, `loadFeedings`,
  `loadSleeps`). Split each the way Task 0066 split `loadTummyTimes`: restore becomes its own function
  taking the loaded entries list, with call order and `foregroundRefreshKey` behavior unchanged.
- `timer_data` stays `Record<string, unknown>` on the wire; no payload gains or loses a field.
- If a type cannot be expressed through the six members without an interface change, change the
  interface deliberately and re-verify the already-migrated types rather than special-casing inside
  the module.

## Implementation work

**Implementation classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**:
yes.

- [x] Write the pumping adapter, route both pumping record sites through `buildRecord`, split restore
      out of `loadPumpings`, delegate to the module, and delete the duplicated block.
- [x] Run the integration suite unedited and confirm pumping is green before starting feeding.
- [x] Write the feeding adapter with the per-side accumulation and side-derivation rules inside
      `buildRecord`, route both feeding record sites through it, split restore out of `loadFeedings`,
      delegate, and delete the duplicated block.
- [x] Run the integration suite unedited and confirm feeding is green before starting sleep.
- [x] Write the sleep adapter, including the optional `alreadyStopped` proximity member, route both
      sleep record sites through `buildRecord`, split restore out of `loadSleeps`, delegate, and
      delete the duplicated block while keeping `removeLock`, the classification resolution, and the
      prediction-facing state in the context.
- [x] Confirm no context still contains the restore sequence and no type still computes its record in
      two places.

## Implementation decisions

- Feeding's two pre-migration record paths disagreed for an inconsistent future
  `currentSideStartedAt`: conflict recovery clamped the current-side elapsed time to zero while the
  local stop path could subtract time. The owner chose the safe shared behavior on 2026-08-05:
  `buildRecord` clamps current-side elapsed time to zero before adding it to the accumulated side
  durations. Valid timer behavior is unchanged, and no saved side duration can become negative.
- The three pre-migration local stop paths allowed a negative duration when paused time exceeded
  wall-clock elapsed time, while their conflict-recovery paths already clamped the same input. The
  owner retained the shared helper's safe zero-clamp during review remediation on 2026-08-05. Valid
  timer behavior is unchanged, and inconsistent timer state can no longer save a negative duration.

## Implementation evidence

- Adapter TDD observed RED for each missing adapter module, then GREEN after implementation; the
  final adapter run passed 4 files and 17 tests.
- The unedited real-provider integration contract passed after pumping, after feeding, and after
  sleep; the final run passed all 42 tests.
- Focused validation passed: TypeScript, targeted ESLint, all 138 unit files (2,535 tests), and all
  92 component files (851 tests).
- The two-account iOS sleep smoke remains the declared manual `[verify]` checkpoint for
  `finish-task`.

## Human checkpoints

- [ ] [verify] After sleep migrates, run the two-account sleep smoke: `npm run e2e:household-timers`
      against local Supabase with two iOS simulators and the separate caregiver accounts it
      provisions. · Expected: the suite passes, the second account keeps seeing a timer it cannot
      control, and it keeps seeing the record the starter's device writes. · Failure: any suite
      failure, a timer the second account can control, or a missing record on the second account. ·
      Reason: the smoke needs two booted iOS simulators and a running local Supabase, which CI does
      not provide; the master plan keeps device E2E as a human release gate.

## Acceptance criteria

- [x] One unit test per adapter builds that type's record from `startedAt`, `endedAt`, and a decoded
      payload with no `activeTimer` in scope: pumping's `side`, feeding's per-side durations with the
      derived side and `lastFinishedSide`, and sleep's `type` with both morning-classification fields.
- [x] The feeding adapter test covers a running left, right, and `both` timer, a paused timer at stop
      (no current-side elapsed added), a one-sided feed leaving the other side `undefined`, and the
      tie case resolving to `left`.
- [x] One round-trip test per adapter over the `timer_data` each context writes today, asserting every
      field survives encode and decode, including absent optional fields.
- [x] The sleep adapter test proves the `alreadyStopped` proximity member matches a sleep starting
      within 5000 ms of the lock start and does not match one outside it, and that no other adapter
      supplies the member.
- [x] `src/__tests__/external-timer-stop-providers.integration.test.tsx` passes with zero changes to
      the test file after each of the three migrations.
- [x] No context file contains the shared restore sequence, and each type's record arithmetic appears
      exactly once, inside its adapter.
- [x] The full component and unit suites pass unchanged; no test file is edited to accommodate the
      move.
- [ ] The two-account sleep smoke `[verify]` checkpoint is confirmed passed.

## Non-goals

- No behavior change of any kind. No decision from the unified timer contract map is implemented here.
- The four contexts are not collapsed into one provider.
- The start, pause, and resume paths do not move into the module.
- No `stopped_at` handling, no remote-stop finalization, and no new `timer_data` field.
- No change to how pumping volume reaches a record: it stays on the stop command.
