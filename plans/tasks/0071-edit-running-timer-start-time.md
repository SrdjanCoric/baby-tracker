# Task 0071: Edit a running timer's start time in place

**Branch**: `feature/edit-running-timer-start-time`
**Depends on**: 0069, 0070
**Source**: `plans/decision-maps/unified-timer-contract/clusters/timer-time-editing.md` and its member
`decisions/resolved/007-running-timer-start-time-edit.md` (resolved) · **User stories**: As the
caregiver who started a timer, I want to correct its start time without stopping it, so that noticing
the baby fell asleep before I hit the button costs one step instead of four.

## What to build

An in-place start-time edit on the running-timer view of all four activity screens —
`app/sleep/index.tsx`, `app/feeding/index.tsx`, `app/pumping/index.tsx`, and
`app/tummyTime/index.tsx` — for the caregiver who started the timer.

Today, correcting a late-started timer costs four steps: stop, delete the record, find the second
button, and re-enter the earlier time. There is no start-time display on a running timer at all, and
`updateTimerData` in `src/services/active-timer-service.ts` writes only the `timer_data` JSONB column,
so no path updates `started_at` on a live lock.

### The control

The running-timer view gains a start-time label that names both the value and the caregiver who
started the timer. The caregiver's name needs no new lookup:
`src/contexts/active-timers-context.tsx` already hydrates `startedByName` onto the lock from the users
table, falling back to `common.someone`. The label respects the 12/24-hour preference, as Task 0043
made every timer start-time surface do.

Tapping the label opens the same picker "Started earlier" uses. Only the caregiver who started the
timer may edit, so the label is tappable only when the lock's `started_by` is the current user.

### Who may edit

The starter alone. The owner cut household timer control on 2026-08-05: one caregiver never controls a
timer another started, on any surface, though the second phone still displays it. This needs **no
policy change** — the row policy at `supabase/migrations/020_add_active_timers.sql` is already
`USING (started_by = auth.uid())` and stays that way.

The dashboard card keeps the read-only gate it applies today: `app/(tabs)/index.tsx` computes
`isLockedByOther` and `src/components/DashboardCard.tsx` sets `onPress={undefined}` and `disabled`
from it, so no activity screen has to hydrate a lock it does not own and the edit control is reachable
only from the starter's own running screen. Editing from the dashboard card, even for the starter's
own timer, is deferred rather than excluded.

### The accepted range

`now - 12h` through `now`, floored further at the end of the previous saved activity **of the same
type**. The clamp is **shown rather than applied after the fact**: the picker's `minimumDate` is the
later of `now - 12h` and that previous end, and its `maximumDate` is `now`, so a caregiver cannot pick
a value the app then silently changes.

Both bounds must hold on **Android as well as iOS**. Today all four screens set
`minimumDate={Platform.OS === "ios" ? yesterdayStart : undefined}` and
`maximumDate={Platform.OS === "ios" ? new Date() : undefined}`, with Android rolling a future
selection back one day and clamping at the same floor. Android must not be able to produce a value the
server then rejects.

The twelve-hour floor follows from the cleanup horizon, for the reason Task 0070 states. The
previous-end floor puts overlap out of reach for a running timer, which is deliberately a different
policy from the warn-and-allow rule saved records follow — the app holds two overlap rules on purpose,
because a running timer's anchor drives live surfaces and has no correction path until it stops.

### "Started earlier" tightens to the identical bounds

"Started earlier" survives unchanged in role — it is still how a caregiver starts a timer that is
already running late, which is not the same as correcting one. Its bounds tighten from the current
yesterday-midnight floor, which reaches as far as forty-seven hours back, to the same
`max(now - 12h, previous same-type end)` through `now` range. This closes the same deletion hole on the
pre-start path. All four screens are copy-paste identical here, so this is one bounds helper applied
four times.

Dropping this from the task would leave two contradictory floors on a single screen — a twelve-hour
edit bound and a forty-seven-hour start bound — so it is not separable.

### The write

A direct `UPDATE` on `active_timers.started_at`, with **no new RPC**. Add the write path to
`src/services/active-timer-service.ts` alongside `updateTimerData`, which writes `timer_data` only.

The direct write follows from migration `056` already granting `UPDATE` on the table to
`authenticated`, and from the sync engine writing allowlisted tables generically: a queued start edit
replays as a direct write regardless, so an RPC would be an authority the replay path bypasses. The
trigger from Task 0070 is the binding authority instead, which is why that task is a prerequisite —
the client must never offer a value the database then rejects.

### Propagation

- **The second phone** needs no new machinery. `active_timers` carries `REPLICA IDENTITY FULL`,
  `src/contexts/active-timers-context.tsx` already subscribes to remote changes and dispatches
  `UPDATE_LOCK` on a changed row, and the dashboard derives the other caregiver's elapsed time from
  `lock.startedAt`.
- **The widget and the Watch** both render `Text(startDate, style: .timer)` against a `started_at`
  fetched over REST (`targets/widget/index.swift`, `targets/watch/index.swift`), so moving the anchor
  re-derives every elapsed display on their next fetch without a per-second push. Neither native target
  changes.
- **The Live Activity** is the one surface that needs work. Its anchor is passed at creation, and no
  "update the anchor" path exists today — only start and end. The **editing device must re-anchor its
  own Live Activity** when the start moves, either by adding an anchor-update call or by ending and
  restarting it. No cross-device channel is involved, because the only caregiver who can edit is the
  one whose device holds that Live Activity. After Task 0069 the anchor is `started_at` with no
  `totalPausedMs` shift on any of the four types, which is why this task waits on 0069 rather than
  writing the shift and having 0069 remove it.

### Offline

A caregiver editing offline queues a write validated against `now()` at edit time but revalidated by
the Task 0070 trigger at replay time, so a long-queued edit can be rejected on replay. This is a stated
consequence, not a defect to engineer around. The queued edit is always the starter's own.

### What the stop records

A start edited mid-run is the value the stop finalizes into the saved record. After Task 0067 record
construction is adapter-owned inside `src/services/timer-lifecycle.ts` and reads the lock's
`started_at`, so this should hold by construction — prove it rather than assume it.

## Implementation work

- [ ] Add a shared bounds helper computing `minimumDate` as the later of `now - 12h` and the previous
      saved same-type activity's `endedAt`, and `maximumDate` as `now`, for one activity type.
- [ ] Add a start-time write to `src/services/active-timer-service.ts` issuing a direct `UPDATE` on
      `active_timers.started_at` for a lock the current user started, with no new RPC.
- [ ] Add the start-time label to the running-timer view of all four activity screens, naming the value
      in the caregiver's 12/24-hour preference and the starter from `lock.startedByName`, tappable only
      when the current user started the timer.
- [ ] Open the existing picker from the label, bounded by the shared helper on **both** iOS and
      Android, and write the picked value through the new service path.
- [ ] Repoint "Started earlier" on all four screens from the yesterday-midnight floor to the same
      shared bounds helper.
- [ ] Re-anchor the editing device's own Live Activity when the start moves, adding an anchor-update
      path or ending and restarting it.
- [ ] Component tests on all four activity screens: the picker's `minimumDate` is the later of
      `now - 12h` and the previous same-type activity's end, its `maximumDate` is `now`, "Started
      earlier" applies the identical bounds, and the bounds hold on the Android branch as well as iOS.
- [ ] Component tests that the label renders the start value and the starter's name, and that it is not
      tappable for a lock the current user did not start.
- [ ] Real-provider tests against local Supabase, for **all four activity types** and not sleep alone:
      the starter edits the start time of their own running timer and the row changes; a start in the
      future is rejected; a start more than twelve hours back is rejected; and a `timer_data`-only
      update to a lock older than twelve hours still succeeds.
- [ ] A real-provider test that a household caregiver who did not start the timer is refused the
      `UPDATE` by the row policy. This is the household timer control cut stated as a bar rather than
      assumed.
- [ ] A test that the edited anchor reaches a second household device through the `active_timers`
      Realtime subscription and re-renders its elapsed display.
- [ ] A test that a start edited mid-run is the value the stop finalizes into the saved record.
- [ ] A test that the editing device's own Live Activity re-anchors to the new start.

## Human checkpoints

- [ ] [verify] Extend the representative two-account sleep smoke so the starter edits the running
      timer's start time and the second account sees the moved anchor · Steps: on simulator A start a
      sleep timer, on simulator B confirm the timer is displayed and not controllable, on A tap the
      start-time label and move the start earlier, then read B's elapsed display · Expected: A's
      screen, A's Live Activity, and B's dashboard all re-anchor to the new start, and B still cannot
      touch the timer · Failure: B's elapsed time stays anchored to the old start, or B gains any
      control · Reason: the master plan requires household timer behavior to be proved through the
      two-account iOS smoke against local Supabase, which needs two simulators and separate caregiver
      accounts.
- [ ] [verify] After editing a running timer's start, read the elapsed display on the iOS widget and on
      the Apple Watch · Steps: start a timer, edit its start earlier from the app, then foreground the
      widget and the Watch app · Expected: both re-anchor their elapsed display to the new start on
      their next fetch · Failure: either surface keeps counting from the old start · Reason: both
      render `Text(startDate, style: .timer)` in native targets fed over REST, which no simulator-free
      automated suite in this repository exercises end to end.

## Acceptance criteria

- [ ] On all four activity screens, the caregiver who started a running timer sees a start-time label
      naming the value and the starter, and can change the start in place without stopping the timer.
- [ ] A caregiver who did not start the timer sees no edit control and is refused the write by the row
      policy; the dashboard card's existing read-only gate is unchanged.
- [ ] The picker offers `max(now - 12h, previous same-type activity end)` through `now` on both iOS and
      Android, so nothing a caregiver can pick is rejected afterwards.
- [ ] "Started earlier" applies those identical bounds on all four screens, replacing the
      yesterday-midnight floor.
- [ ] The edited anchor reaches the second household phone through Realtime, the widget and Watch
      re-anchor on their next fetch, and the editing device's own Live Activity re-anchors.
- [ ] A start edited mid-run is the value the stop writes into the saved record.
- [ ] The write is a direct `UPDATE` on `active_timers.started_at` with no new RPC and no policy change.
- [ ] Both `[verify]` checkpoints confirmed by the owner.

## Non-goals

- Editing the stop time, refused by `decisions/resolved/008-stop-time-rewind.md`.
- Editing saved records by clock time, which is Tasks 0072 through 0074.
- Inline editing from the dashboard card, the widget, the Watch, or the Live Activity.
- Editing a timer another caregiver started, or any widening of `active_timers` row access.
- Changing the twelve-hour cleanup horizon or the server-side guard, which is Task 0070.
- Clamping against activities of a different type.
- Editing any in-progress detail other than the start time.
- Changing the manual-entry overlap policy, which stays warn-and-allow.
