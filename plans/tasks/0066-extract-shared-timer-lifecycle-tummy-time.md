# Task 0066: Extract the shared timer lifecycle module and migrate tummy time

**Branch**: `feature/extract-shared-timer-lifecycle-tummy-time`
**Depends on**: none
**Source**: `plans/decision-maps/unified-timer-contract/decisions/resolved/010-shared-timer-seam.md`
(resolved, amended 2026-08-05) · **User stories**: As a maintainer, I want one implementation of the
timer restore sequence and one definition of each type's record, so that every later timer behavior
change lands once instead of four times.

## What to build

One shared timer lifecycle module plus a per-type adapter interface, with tummy time as its first
and only consumer. This is a restructuring: it changes no observable behavior.

The module lives at `src/services/timer-lifecycle.ts` and the first adapter at
`src/services/timer-adapters/tummy-time-timer-adapter.ts`. Adapters are registered by the context
that owns the type; the module never imports a context.

### What the module takes over

Everything the four contexts already do identically inside their restore path:

- the obsolescence guards around `stopVersionRef` and the baby-binding token
  (`isTimerRestoreObsolete`, `isCurrentBabyBinding`), applied at every point the context applies them
  today;
- the pending-stop read and match (`readPendingTimerStop` + `isPendingStopForTimer`);
- identity resolution (`resolveTimerIdentity`) and its backfill into local storage when the stored
  snapshot carries no `timerInstanceId` or `activityId`;
- the completion-secured short circuit (`isTimerCompletionSecured`): end the Live Activity by id with
  the `endLiveActivityByType` fallback, clear the stored active timer, dispatch `STOP_TIMER`, release
  the lock, and fall back to `queuePendingLockRelease` when the release throws;
- `reconcileTimerLock` together with its `persistLockState` callback, and `refreshLocks()` when the
  reconciled state is not `offline`;
- the lock-conflict path: `acceptTimerCompletion`, read the existing record by
  `completion.activityId`, build and persist the record when absent, `markTimerCompletionDurable`,
  dispatch the add and `STOP_TIMER`, clear the stored timer, end the Live Activity, and
  `showTimerConflictNotice`;
- the server-only lock hydration branch reached when no local snapshot exists but a lock row is owned
  by the current user (`getActiveTimerLock` + `lock.startedBy === user.id`), including its own
  completion-secured release;
- the Live Activity restart, including `isLiveActivityRunningWithTimeout` and the `effectiveStartTime`
  arithmetic `startedAt + totalPausedMs` applied only when `totalPausedMs > 0`;
- duration arithmetic for the recorded activity.

### What the adapter supplies

Six members, and nothing else:

1. the activity-type literal used against `active_timers` and the lock RPCs (`"tummy_time"`);
2. the storage service used for `getActiveTimer`, `setActiveTimer`, `clearActiveTimer`, and the
   by-id record read;
3. the `timer_data` codec — encode the payload written into the lock row, decode the
   `Record<string, unknown>` read back from it;
4. `buildRecord(startedAt, endedAt, payload)` over that type's decoded payload, returning the type's
   create-input;
5. the Live Activity detail argument passed as the third argument of `startTimerLiveActivity`, plus
   the Live Activity type literal used by `endLiveActivityByType` (`"tummyTime"`);
6. the `RESTORE_TIMER` dispatch for that type.

The duration rule is **not** an adapter member. All eight arithmetic sites across the four contexts
compute the same thing today, so the module owns it.

### Duration arithmetic the module ships

`durationSeconds = Math.max(0, Math.floor((endedAt - startedAt - totalPausedMs) / 1000))`.

This is today's arithmetic. The restore lock-conflict branch already clamps with `Math.max(0, …)`
while the local stop path does not; the module clamps in both, which can differ only for an end time
before the start time. Do not change the pause treatment here — the counted-pause rule is a separate
behavior decision landing later in the pause-semantics cluster.

### Record construction is adapter-owned and called from every write path

Tummy time builds a record in two places today, with the arithmetic written out twice: the restore
lock-conflict branch and the local stop path in `stopTummyTime`. Both must call the tummy adapter's
`buildRecord`, so the type has one definition of its record rather than two. `buildRecord` takes a
decoded payload, not the live `activeTimer` reducer snapshot, so the local stop path passes a payload
built from its snapshot.

### Separating restore from the entries load

`loadTummyTimes` currently loads the entries list, the daily goal, the goal source, the age group, and
the milestone suggestion, and then runs the timer restore in the same function against the `tummyTimes`
list it just loaded. Split the timer restore out into its own function that takes the loaded entries
list as an argument, so the module can own the restore half while the context keeps the entries half.
Keep the single `useEffect` and the same call order, so a restore still sees the entries the same run
loaded and the `foregroundRefreshKey` behavior is unchanged.

### Current tummy-time payload

Tummy time writes only the identity and pause fields into `timer_data`: the resolved identity,
`isPaused`, `totalPausedMs`, `pausedAt`. Its record carries only the bare span — `id`, `babyId`,
`startedAt`, `endedAt`, `durationSeconds`. The extraction leaves the payload exactly as it is today
and adds no field.

### Non-obvious constraints

- `timer_data` stays `Record<string, unknown>` on the wire and is not typed at the database level.
  The codec is a client-side boundary only.
- The context keeps its reducer, its entries list, its non-timer surface, and its public start, stop,
  pause, and resume API. The start, pause, and resume paths stay in the context — the source decision
  deliberately leaves whether they move as open fog.
- `src/__tests__/external-timer-stop-providers.integration.test.tsx` (2221 lines, 40+ tests) renders
  all four real providers and is the four contexts' only behavioral contract. It must pass with **no
  edit to the test file**. An edit to that file is the signal that the move changed behavior.
- Adapter interface changes get expensive once three more contexts depend on it, so design the six
  members against all four types' known payloads — sleep's `type` plus two morning-classification
  fields, feeding's per-side fields, pumping's `side`, tummy time's bare span — even though only tummy
  time registers one here.

## Implementation work

**Implementation classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**:
yes.

- [x] Define the adapter interface and the module's public entry points in
      `src/services/timer-lifecycle.ts`, with the module-owned duration rule.
- [x] Write the tummy time adapter with all six members over today's payload and record shape.
- [x] Route both tummy time record-construction sites — the restore lock-conflict branch and
      `stopTummyTime` — through the adapter's `buildRecord`.
- [x] Split the timer restore out of `loadTummyTimes` into its own function taking the loaded entries
      list, preserving call order and `foregroundRefreshKey` behavior.
- [x] Move the shared restore sequence listed above into the module and delete the duplicated block
      from `tummyTime-context.tsx`, keeping every guard, early return, and error log at the same
      point in the sequence.
- [x] Keep the context's `refreshLocks`, `liveActivityIdRef`, `isStoppingRef`, `stopVersionRef`, and
      baby-binding state owned by the context and passed into the module.

## Acceptance criteria

- [x] A unit test builds a tummy time record from `startedAt`, `endedAt`, and a decoded payload with
      no `activeTimer` in scope, asserting the bare span and the module's duration rule.
- [x] A unit test round-trips the `timer_data` payload tummy time writes today through the adapter's
      codec — encode, decode, and assert every field survives, including a missing `pausedAt` and a
      zero `totalPausedMs`.
- [x] A unit test asserts the module clamps a negative span to `0` seconds and floors a fractional
      second, and that a paused span is subtracted exactly once.
- [x] `src/__tests__/external-timer-stop-providers.integration.test.tsx` passes with zero changes to
      the test file, covering tummy time restore, stale-restore races, offline reconnect and
      reconciliation, lock conflicts, sub-minute stops, and Live Activity cleanup.
- [x] `tummyTime-context.tsx` no longer contains the restore sequence, and its record-construction
      arithmetic appears once, inside the adapter.
- [x] The full component and unit suites pass unchanged; no test file is edited to accommodate the
      move.

## Implementation notes

- The tummy-time adapter is created with `babyId` in its closure so its required three-argument
  `buildRecord(startedAt, endedAt, payload)` can return the complete create input without adding a
  field to `timer_data`.
- Record persistence remains a restore-call dependency, preserving the adapter's six-member shape
  while the context keeps the existing household database versus local storage choice.
- RED: the new adapter/duration unit test failed because neither public module existed.
- GREEN: the adapter/duration tests pass (3 tests); the unchanged real-provider integration suite
  passes (42 tests); the full unit suite passes; the full component suite passes (92 suites, 850
  tests); TypeScript and targeted ESLint checks pass.

## Non-goals

- No behavior change of any kind. No decision from the unified timer contract map is implemented here.
- The four contexts are not collapsed into one provider.
- The start, pause, and resume paths do not move into the module.
- No `stopped_at` handling, no remote-stop finalization, and no new `timer_data` field.
- No other type is migrated; pumping, feeding, and sleep keep their current code.
