# Decision: editing a running timer's start time

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** cluster
**Cluster:** timer time editing
**Depends on:** none
**Claim:** none

## Question

Can a caregiver change a running timer's start time in place, what range of values is accepted, and
what happens to the existing "started earlier" entry path?

## Context

Noticing the baby fell asleep before the timer started currently costs four steps: stop, delete the
record, find the second button, and re-enter the earlier time. The caregiver asked for one step.

Editing `started_at` on a live lock moves an anchor that the widget, the Live Activity, the Watch, and
the other caregiver's phone are all rendering from, so propagation is part of the answer rather than a
detail. Bounds need deciding too. A start time in the future is nonsense, and a start time that
reaches back past the previous activity's end creates the overlap the master plan already handles for
manual sleep by warning and preserving both records.

Whether "started earlier" survives as a separate entry point is a product call. It stays useful for
starting a timer that is already running late, which is not the same as correcting one.

## Evidence

- No path updates `started_at` today. `src/services/active-timer-service.ts` writes only `timer_data`
  in `updateTimerData`, and `acquire_timer_lock` takes `p_started_at` at creation alone
  (`supabase/migrations/045_fix_timer_lock_started_at.sql`,
  `046_fix_timer_lock_overload.sql`).
- `cleanup_stale_timer_locks` is `DELETE FROM public.active_timers WHERE started_at <
  pg_catalog.now() - INTERVAL '12 hours'` at `supabase/migrations/056_authorize_active_timer_controls.sql:273`.
  A start rewound past that horizon makes a live lock eligible for deletion.
- "Started earlier" is a pre-start affordance only. On all four screens it sets `customStartTime`,
  which `onStart()` forwards to the lock; the control disappears once the timer runs. Its picker bounds
  are `minimumDate` of yesterday 00:00 and `maximumDate` of now on iOS, with Android rolling a future
  selection back one day and clamping at the same floor. See `app/sleep/index.tsx` around lines 296 to
  320 and 405 to 415, and the equivalent blocks in `app/feeding`, `app/pumping`, and `app/tummyTime`.
  Task `0043` made those labels and pickers preference-aware.
- Both Swift surfaces render `Text(startDate, style: .timer)` against a `started_at` fetched over
  REST: `targets/widget/index.swift:1342`, `:1367`, `:1774`, `:2230`, `:2297`, and
  `targets/watch/index.swift:1135`. Moving the anchor re-derives every elapsed display without a
  per-second push. `active_timers` carries `REPLICA IDENTITY FULL`, so Realtime already delivers the
  changed row to every household device.
- The Live Activity anchor is passed at creation and is already derived rather than raw, since for a
  resumed pause it is `started_at + totalPausedMs` (`src/contexts/sleep-context.tsx:840` and `:950`).
- Client read-only gate to rewrite: `app/(tabs)/index.tsx:615` computes `isLockedByOther`, and
  `src/components/DashboardCard.tsx:248` to `251` sets `onPress={undefined}` and `disabled` from it.
- Master-plan decision on manual sleep overlap: warn, allow, union for statistics.
- `plans/tasks/0056-keep-active-timer-locks-reclaimable.md`, which bounds `started_at` writes.

## Resolution

- **Decision:** A running timer's start time is editable in place, on the activity screen, for all four
  activity types. The running screen gains a start-time label that names both the value and the
  caregiver who started the timer, and tapping it opens the same picker "Started earlier" uses. Only
  the caregiver who started the timer may edit it, so the dashboard card keeps the read-only gate it
  applies today to a lock another caregiver started. Editing directly from the dashboard card, for the
  starter's own timer, is deferred rather than excluded. The accepted range is
  `now - 12h` through `now`, floored further at the end of the previous saved activity of the same
  type. The clamp is shown rather than applied after the fact. The picker's `minimumDate` is the later
  of `now - 12h` and that previous end, and its `maximumDate` is `now`, so a caregiver cannot pick a
  value the app then silently changes. The same bounds govern "Started earlier", which survives
  unchanged in role and tightens from its current yesterday-midnight floor to the twelve-hour one. The
  write is a direct `UPDATE` on `active_timers.started_at` with no new RPC. On the server, a trigger
  rejects a start in the future or more than twelve hours back, and it fires only when `started_at`
  actually changes, so an unrelated `timer_data` write to a lock cleanup has not yet swept is not
  collaterally rejected. The previous-end clamp is presentation only and is never enforced
  server-side.

  **Scope cut.** This decision was resolved while household timer control was live, and it originally
  gave the edit to any household caregiver, turned the dashboard card's read-only gate into
  navigation, and disabled the control on a lock marked stopping. The owner cut household timer
  control on 2026-08-05: one caregiver never controls a timer another started, on any surface. The
  second phone still displays that timer and still cannot touch it. So the edit is the starter's
  alone, the card's gate stays as it is, and there is no stopping marker to disable against. No policy
  change is needed for any of this, because the row policy at
  `supabase/migrations/020_add_active_timers.sql:53` is already `USING (started_by = auth.uid())` and
  now stays that way. Everything else below stands: the bounds, the shown clamp, the direct write, the
  trigger, and the tightening of "Started earlier".
- **Rationale:** The twelve-hour floor follows from the cleanup horizon. Because
  `cleanup_stale_timer_locks` deletes any lock whose `started_at` predates twelve hours ago, a start
  rewound past the horizon makes a live timer's lock immediately eligible for deletion, leaving the
  running timer with no lock while every other household device stops seeing it. Matching the edit
  bound to the horizon closes that by construction, and closes it for "Started earlier" too, whose
  yesterday-midnight floor already reaches as far as forty-seven hours back. Narrowing costs only
  sessions longer than twelve hours, which no timer here plausibly records. The direct write follows
  from migration `056` already granting `UPDATE` on the table to `authenticated` and from the sync
  engine writing allowlisted tables generically, since a queued start edit replays as a direct write
  regardless: an RPC would be an authority the replay path bypasses, while a trigger binds every
  writer. Propagation needs no new machinery, because Realtime already carries the row and both
  Swift surfaces anchor a system timer to `started_at`. Showing the clamp in the picker keeps the
  offered range and the accepted range the same, so nothing a caregiver picks is silently rewritten.
- **Alternatives rejected:** *Warn, allow, and keep both records on overlap*, the policy the master
  plan sets for manual sleep. Rejected in favor of a clamp that puts overlap out of reach for a running
  timer, accepting that the app now holds two overlap rules. *A threshold below which a small overlap
  stays silent.* Introduces a magic number that [stop time rewind](008-stop-time-rewind.md) and
  [clock time log editing](009-clock-time-log-editing.md) would each have to honor. *Keeping the
  yesterday-midnight floor* so the two entry points agree without any change. Leaves the deletion hole
  open. *Raising the cleanup horizon to admit longer rewinds.* Two changes where one suffices, and
  abandoned locks would then linger proportionally longer. *A dedicated `update_timer_start` RPC.* Buys
  a single validation authority that offline replay bypasses anyway, and adds client plumbing for a
  control only the app offers. *Editing from every parity surface, with a coarse adjuster on the widget
  and the Watch.* Invents a second editing model at a different granularity than the picker. *Removing
  "Started earlier" now that a running timer is correctable.* Withdraws a working capability from 4.7.1
  builds and forces a caregiver who knows the real time up front to start a wrong timer and briefly
  publish a wrong anchor to every surface.
- **Consequences:** The read-only gate for a non-owned lock is untouched. `app/(tabs)/index.tsx:615`
  keeps computing `isLockedByOther` and `src/components/DashboardCard.tsx:248` to `251` keep disabling
  the card from it, so no activity screen has to hydrate a lock it does not own, and the edit control
  is reachable only from the starter's own running screen. Two overlap policies now coexist: clamped
  for timer start edits, warn-and-allow for manual entry.
  [Stop time rewind](008-stop-time-rewind.md) resolved that no surface offers an end time at stop, so
  the clamp is inherited instead by [clock time log editing](009-clock-time-log-editing.md), which
  has to reconcile the two policies since it edits the very records manual entry creates. The paused
  case needs no rule of its own. This decision was written when the anchor was `started_at` for sleep
  and `started_at + totalPausedMs` for the other three;
  [showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md)
  has since made a resumed pause count on all four, so the anchor is `started_at` everywhere and
  moving it shifts every surface consistently. `morningClassification` is written at stop, so a
  running-timer edit is picked up with no recompute; only saved-record edits still face that question.
  Task `0056` and this trigger guard the same column against the same future-value write, so they must
  be sequenced or merged deliberately at planning time. That task is open and unplanned, it claims a
  migration number the tree has not reached, and the tree's head is `059`. A caregiver editing offline
  queues a write validated against `now()` at edit time but revalidated at replay time, so a
  long-queued edit can be rejected on replay. The Live Activity anchor is set at creation, so the
  editing device must update its own Live Activity when the start moves; no cross-device channel is
  involved, because the only caregiver who can edit is the one whose device holds that Live Activity.
- **Non-goals:** Editing the stop time, which is [stop time rewind](008-stop-time-rewind.md). Editing
  saved records by clock time, which is [clock time log editing](009-clock-time-log-editing.md).
  Inline editing from the dashboard card, the widgets, the Watch, or the Live Activity. Changing the
  twelve-hour cleanup horizon. Changing the manual-entry overlap policy. Clamping against activities of
  a different type. Editing any in-progress detail other than the start time. Editing a timer another
  caregiver started, or any other widening of `active_timers` row access, which the household timer
  control cut removed from this map entirely.
- **Required proof:** Real-provider tests against local Supabase, run for all four activity types and
  not sleep alone: the starter edits the start time of their own running timer; a start in the future
  is rejected; a start more than twelve hours back is rejected; and a `timer_data`-only update to a
  lock older than twelve hours still succeeds, proving the guard fires on `started_at` changes alone.
  A test that a household caregiver who did not start the timer is refused the `UPDATE` by the row
  policy, which is the cut stated as a bar rather than assumed. A test that the edited anchor reaches a
  second household device through Realtime, and that a widget and Watch fetch after the edit re-anchor
  their elapsed display, since the second phone keeps displaying a timer it cannot touch. Component
  tests on all four activity screens that the picker's `minimumDate` is the later of `now - 12h` and
  the previous same-type activity's end, that its `maximumDate` is `now`, and that "Started earlier"
  applies the identical bounds. A test that a start edited mid-run is the value the stop finalizes into
  the saved record, and that the editing device's own Live Activity re-anchors to the new start. The
  representative two-account sleep smoke required by the master plan, extended so the starter edits and
  the second account sees the moved anchor.

## Follow-on

- **Newly sharp decisions:** None. The stale Live Activity anchor and the offline replay rejection were
  both raised here as cross-device problems and both went with the household timer control cut: the
  editing device owns the only Live Activity involved, and a queued edit is the starter's own. What
  survives of the replay question is stated as a consequence above, not as a decision. Whether the
  previous-end clamp or the master plan's warn-and-allow policy governs saved-record editing was sharp
  enough to state here, and [clock time log editing](009-clock-time-log-editing.md) has since answered
  it: saved records warn and allow, the clamp stays a running-timer rule, and the two policies coexist
  on purpose.
- **Still-foggy areas:** Whether the clamp should ever consider activities of a different type, since a
  feed and tummy time can legitimately overlap while two naps cannot. Whether the dashboard card
  eventually gains inline editing for the starter's own timer.
