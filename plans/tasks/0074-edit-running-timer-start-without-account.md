# Task 0074: Edit a running timer's start time without an account

**Branch**: `feature/edit-running-timer-start-without-account`
**Depends on**: none
**Source**: conversation 2026-08-07, from a simulator session on Task 0073's branch · **User stories**:
As a caregiver using the app without an account, I want to correct my running timer's start time, so
that noticing the baby fell asleep before I hit the button costs one step instead of four — the same as
it does for a signed-in caregiver.

## What to build

Task 0071 shipped in-place start-time editing on the running-timer view of all four activity screens —
`app/sleep/index.tsx`, `app/feeding/index.tsx`, `app/pumping/index.tsx`, and `app/tummyTime/index.tsx`.
A caregiver with no account cannot reach it: the control renders, looks identical to the working one,
and does nothing on tap. This task opens that path and removes the starter name from the control.

Three things change together. None of them is complete without the others: the state distinction is
what makes the local write correct, the local write is what makes the control worth enabling, and the
label is the surface the caregiver actually sees.

### An account-less timer is not an offline timer

`TimerLockReconciliationState` in `src/services/timer-lock-reconciliation.ts` is today
`"offline" | "reconciling" | "owned" | "conflicted"`. Each of the four contexts starts a timer by
initialising the state to `"offline"` and upgrading to `"owned"` only inside an `if (user?.id)` block
that acquires the lock, with a `catch` that logs "proceeding offline" and leaves the initial value in
place.

So `"offline"` means two unrelated things: a caregiver who is signed in and whose server write is
deferred, and a caregiver who has no account and whose write has nowhere to go. **They are not the same
state and must stop sharing a value.** A signed-in offline edit still has to queue and reconcile; an
account-less edit must never queue, because there is no user to attribute the queued write to and no
row it could ever reconcile against.

Add a distinct state for the account-less case and set it wherever a timer is started or restored with
no user id. Leave `"offline"` meaning exactly "signed in, server write deferred" — every existing
consumer of `"offline"` keeps its current behavior for signed-in caregivers.

### The local edit writes locally and stops there

`editRunningTimerStartTime` in `src/services/timer-lifecycle.ts` currently branches on
`lockState === "offline"` to choose between `queuePendingTimerStartEdit` and `updateTimerStartTime`,
both of which take a `userId`. After that branch it already does the local work the account-less path
needs: it recomputes the timer payload, refreshes the Live Activity, calls
`adapter.storage.setActiveTimer`, and dispatches the edited start.

For an account-less timer, skip the server write and the pending-edit queue entirely and run only that
local tail. The caregiver's data is local, so the start-time override is a local write and needs no
round trip.

Two guards stand in front of that function and both currently require a user id:

- the four context callbacks (`editSleepStartTime` and its siblings in `src/contexts/sleep-context.tsx`,
  `feeding-context.tsx`, `pumping-context.tsx`, and `tummyTime-context.tsx`) return early on
  `!user?.id` and pass `userId: user.id` through;
- the four screens compute `canEditTimerStart` as
  `Boolean(user?.id && (timerLock ? timerLock.startedBy === user.id : hasLocalTimerOwnership))`, whose
  `user?.id &&` prefix short-circuits before the local-ownership branch can ever be reached.

Both must admit the account-less caregiver. `RunningTimerStartEditor` in
`src/components/RunningTimerStartEditor.tsx` renders a plain `View` rather than a `Pressable` when
`canEdit` is false — same pill, same styling, no `onPress` and no `accessibilityRole="button"` — which
is why the control looks live and is not. Enabling the gate is what makes it real.

### The authenticated path does not move

Task 0071 restricted running-timer start editing to the caregiver who started the timer, matching the
row policy `USING (started_by = auth.uid())` on `active_timers`. That restriction stays exactly as it
is. A signed-in caregiver still may not edit a timer another caregiver started, on any surface, and the
policy needs no change. This task only opens a path that never touches the server.

The accepted range is also already settled by Task 0071 and carries over unchanged: `now - 12h` through
`now`, floored further at the end of the previous saved activity of the same type, shown as the
picker's own `minimumDate` and `maximumDate` on both platforms rather than clamped after the fact.

### The start-edit label carries no name

Task 0071 specified a label naming both the start value and the caregiver who started the timer.
**That decision is reversed here.** Only the caregiver who started a timer may edit it, so naming them
on their own control tells them nothing they do not already know, and for an account-less caregiver it
resolves to "Someone" — the app attributing the timer to a stranger on a device with one user.

Remove the name from this control completely, for every caregiver, signed in or not. The label becomes
the field name and the time alone, with no separator left dangling. `RunningTimerStartEditor` loses its
`starterName` prop, and each of the four screens loses the `timerStarterName` computation feeding it.

This is the control's label only. `startedByName` stays hydrated on the lock and keeps every other
consumer it has today — the lock-holder name in `src/contexts/active-timers-context.tsx`, the widget
context line, and `lockHolderName` in `src/services/timer-lock-reconciliation.ts`. The `common.someone`
translation key stays for those call sites, where it describes a genuinely unknown *other* caregiver
and is correct. Do not remove the key and do not change those five call sites.

## Implementation work

- [ ] Add a distinct account-less value to `TimerLockReconciliationState` and set it wherever a timer is
      started or restored with no user id, in all four contexts. Leave `"offline"` meaning "signed in,
      write deferred" and confirm every existing `"offline"` consumer keeps its behavior for a signed-in
      caregiver.
- [ ] Branch `editRunningTimerStartTime` on the new state: run the local tail only — payload recompute,
      Live Activity refresh, `adapter.storage.setActiveTimer`, dispatch — and call neither
      `updateTimerStartTime` nor `queuePendingTimerStartEdit`.
- [ ] Make `userId` optional through the edit path so the account-less call needs no placeholder or
      sentinel user id.
- [ ] Drop the `!user?.id` early return from the four context edit callbacks so an account-less caregiver
      with a local running timer reaches the lifecycle function.
- [ ] Drop the `user?.id &&` prefix from `canEditTimerStart` on all four screens so local ownership alone
      authorizes the edit, keeping `timerLock.startedBy === user.id` as the rule whenever a lock exists.
- [ ] Remove the `starterName` prop from `RunningTimerStartEditor` and the ` · <name>` segment from its
      label, and delete the `timerStarterName` computation from all four screens.
- [ ] Tests that an account-less caregiver's start-time pill is a `Pressable` with
      `accessibilityRole="button"` on each of the four screens, opens the picker, and commits.
- [ ] A test that an account-less edit calls `setActiveTimer` and dispatches the edited start while
      calling neither `updateTimerStartTime` nor `queuePendingTimerStartEdit`.
- [ ] A test that a signed-in offline edit still queues through `queuePendingTimerStartEdit`, proving the
      two states did not collapse back together.
- [ ] A test that a signed-in caregiver still cannot edit a timer another caregiver started.
- [ ] A test that the start-edit label renders the field name and the time with no name segment and no
      trailing separator, for both a signed-in and an account-less caregiver.
- [ ] A test that the Task 0071 bounds still apply on the account-less path: `now - 12h` through `now`,
      floored at the previous saved activity of the same type.

## Human checkpoints

- [ ] [confirm-security] This widens the `canEditTimerStart` authorization gate. Confirm the account-less
      branch can reach neither `active_timers` nor the pending-edit queue, that no placeholder user id is
      ever written or enqueued, and that the `USING (started_by = auth.uid())` policy and the signed-in
      starter-only rule are untouched.

## Acceptance criteria

- [ ] A caregiver with no account, with a running timer on any of the four activity screens, can tap the
      start-time pill, pick a value within the Task 0071 bounds, and see the timer's elapsed time and
      stored start reflect it.
- [ ] That edit produces no `active_timers` write and no queued pending edit.
- [ ] An account-less timer carries a lock state distinct from `"offline"`, and a signed-in offline edit
      still queues exactly as it does today.
- [ ] A signed-in caregiver still cannot edit a timer another caregiver started, and the `active_timers`
      row policy is unchanged.
- [ ] The start-edit control shows the field name and the time only — no caregiver name, no dangling
      separator — for every caregiver.
- [ ] `common.someone` and its five non-screen call sites are unchanged.
- [ ] No schema change and no migration.

## Non-goals

- Editing a running timer's start time from the dashboard card, which Task 0071 deferred and which stays
  deferred.
- Any change to the `active_timers` row policy or to server-side start-time validation, which is Task
  0070's guard.
- Sign-in, account creation, or any change to how an account-less caregiver's data syncs once they do
  create an account.
- Pause, resume, stop, or duration accounting on a running timer.
- The clock-time entry and edit screens for saved records, which are Tasks 0072, 0073, and 0075.
