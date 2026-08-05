# Decision: setting the real end time when stopping

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** none
**Cluster:** none
**Depends on:** [derived-data blast radius](003-sleep-derivation-blast-radius.md), [running timer start time edit](007-running-timer-start-time-edit.md)
**Claim:** none

## Question

At stop, can a caregiver set an end time earlier than now, and where in the flow does that happen?
This record's answer is a no, so it produces no tasks of its own and instead sets the scope of
[clock time log editing](009-clock-time-log-editing.md).

## Context

Nobody reaches the phone the moment the baby wakes. The caregiver described stopping at 5:43 for a
5:30 wake, then editing the saved record and doing the subtraction themselves. The owner does the
same arithmetic daily.

The design space runs from a confirmation step on every stop to a rewind offered only after the fact,
and the cost of an extra tap falls on the common case where now is the right answer. Bounds matter as
well: an end time before the start time is invalid, and one that reaches back past a resume boundary
interacts with whatever [pause semantics](006-pause-semantics.md) settles on.

Household control raises a second case. If B stops A's timer with a rewound end time, the decision in
[record ownership on remote stop](../../deferred/household-timer-control/004-remote-stop-record-ownership.md) has to carry that time.

The premise turned out to be narrower than the record assumed. The owner reads the same complaint as
being about hand-entered activities. The arithmetic is demanded when you log a past entry and when
you edit one from the Timeline, for every activity type, not only for the entry a timer just wrote.

## Evidence

- `src/services/timer-completion-service.ts`, first accepted stop time. `acceptTimerCompletion` at
  lines 87 to 108 is idempotent per device and returns the first accepted `stoppedAt`, so a second
  stop carrying a different time silently returns the first.
- `src/services/timer-stop-coordinator.ts` and `src/services/external-timer-command-service.ts`, the
  external stop paths that supply their own timestamps.
- All four contexts already accept an optional stop time and default it to now:
  `stopSleep` at `src/contexts/sleep-context.tsx:1230` with `requestedEndTime ?? new Date()` at
  `:1296`, and the same shape in `stopBreastfeeding` (`feeding-context.tsx:757`), `stopPumping`
  (`pumping-context.tsx:619`), and `stopTummyTime` (`tummyTime-context.tsx:729`). Only
  `src/hooks/useWatchMessageHandler.ts:211` supplies a value; no user-facing control does.
- `shouldDiscardTimerDuration` in `src/utils/timer-duration.ts` drops any timer under 60 seconds in
  production, and the four contexts evaluate it against the requested stop time before the completion
  is accepted, so a rewind chosen at stop can discard the record silently.
- Stopping from an activity screen dismisses that screen immediately. `handleStopSleep` calls
  `exitModal(router)` at `app/sleep/index.tsx:107` to `118`, and the other three screens match, so no
  post-stop affordance can live on the screen the stop was issued from.
- Pumping is the only type with a second step at stop today: `handleRequestStop` opens a volume sheet
  and `handleConfirmStop` performs the stop, `app/pumping/index.tsx:105` to `124`.
- Both hand-entry paths ask for minutes. All four manual screens pair a start-time picker with a
  `durationInput` and a `QUICK_DURATIONS` row: `app/sleep/manual.tsx:28` and `:51`,
  `app/feeding/manual.tsx:34`, `app/pumping/manual.tsx:29`, `app/tummyTime/manual.tsx:25`. All four
  edit screens expose the minutes field alone with no start-time and no end-time control, and
  recompute `endedAt = startedAt + durationSeconds` on save: `app/edit/sleep.tsx:77` to `79`, and the
  same lines in `edit/pumping.tsx`, `edit/tummyTime.tsx`, and `edit/feeding.tsx`.
- [`prototypes/clock-time-entry-mock.html`](../../prototypes/clock-time-entry-mock.html), published at
  <https://claude.ai/code/artifact/2dc8a9f5-8f13-42b8-bf0a-c09191277dfc>, draws both forms as they
  are today and as the owner settled them during this session.
- Master-plan decision that in-app timer completion converges on one durable result.

## Resolution

- **Decision:** No. Stopping a timer records the moment the stop was issued, or `pausedAt` when the
  timer is paused under [what pause means](006-pause-semantics.md), on every surface that can stop
  one. No stop-time picker, no confirmation step, no secondary "ended earlier" control, and no
  pre-set end time on a running screen. The `stopped_at` marker from
  [record ownership on remote stop](../../deferred/household-timer-control/004-remote-stop-record-ownership.md) therefore always carries an
  observed moment rather than a caregiver-chosen one, and a household caregiver stopping someone
  else's timer chooses no time either.

  The need behind the question is real and is answered by clock-time entry instead. Both hand-entry
  paths take a start time and an end time and derive the duration from them, so nobody subtracts.
  That work is [clock time log editing](009-clock-time-log-editing.md), whose scope this decision
  widens from editing a saved activity to both entry points across all four activity types.

- **Rationale:** A stop-time control cannot exist on every surface that stops a timer. The widget,
  the lock screen, and the Watch host no picker, which is the same constraint that made
  [control surface coverage](../../deferred/household-timer-control/005-control-surface-coverage.md) forbid a confirmation before stopping,
  and it forbids this for the same reason. A control that appears on the phone alone leaves four
  activity types explaining two stop behaviors.

  Solving it at the entry form covers strictly more. A caregiver who logs a nap by hand never had a
  way to say when it ended, and a caregiver who stopped late has an entry to correct; one form
  answers both, while a rewind at stop answers only the second. The rewind would have bought one
  Timeline tap and cost a permanent second control on four running screens.

  Two mechanisms make a chosen stop time worse than an observed one. The 60-second discard
  in `src/utils/timer-duration.ts` runs against the requested stop time before the completion is
  accepted, so a rewind that shortens a session below the floor destroys the record instead of
  shortening it. And `stopped_at` is first-write-wins under `stopped_at IS NULL`, so a second
  caregiver's rewind would be dropped by the same guard that arbitrates concurrent stops, with
  nothing on any surface to say so. Once the record exists, neither hazard does.

  No code has to change. The `requestedEndTime` parameter stays on all four
  contexts, exercised only by the Watch command path at
  `src/hooks/useWatchMessageHandler.ts:211`, and no user-facing control supplies it today.

- **Alternatives rejected:** *An "ended earlier" secondary control on the activity screen*, mirroring
  the existing "Started earlier" and the start-time edit from
  [running timer start time edit](007-running-timer-start-time-edit.md). It costs nothing on the
  common case and reuses a picker that already exists. Rejected because it is reachable on the phone
  alone, so the widget, the Watch, and the lock screen would keep stopping at now while the phone
  did not, and because it leaves a hand-logged entry as it is. *A stop-time sheet on every
  stop.* Collides directly with the no-confirmation rule in
  [control surface coverage](../../deferred/household-timer-control/005-control-surface-coverage.md), and bills every ordinary stop for the
  rare one. *A pre-set "ends at" row on the running screen*, symmetric with the start-time row.
  Requires the caregiver to anticipate the rewind before pressing stop, which inverts the order in
  which a late wake is noticed. *A bounded post-stop adjust affordance on the dashboard.* It would
  have to live there, since the activity screen dismisses itself at `app/sleep/index.tsx:113`. It
  also edits a saved record, which the edit screen already does, with no window to expire and no new
  surface to build.

- **Consequences:**
  - [Clock time log editing](009-clock-time-log-editing.md) is now the only correction route for a
    mistimed stop, and it widens accordingly. The owner settled its form during this session: the
    manual screens gain an End Time field beside the existing Start Time, the edit screens gain both
    Start Time and End Time where they expose neither today, the minutes input and the
    `QUICK_DURATIONS` chips go from both, and duration becomes a derived read-only readout. It applies
    to sleep, feeding, pumping, and tummy time. See
    [`prototypes/clock-time-entry-mock.html`](../../prototypes/clock-time-entry-mock.html).
  - Dropping the quick-duration chips withdraws a working capability from 4.7.1 builds, which reach
    users only through the store and have no update channel. The owner accepted that trade; whether a
    fast path for a known-length entry returns in another form belongs to
    [clock time log editing](009-clock-time-log-editing.md).
  - Two questions that [running timer start time edit](007-running-timer-start-time-edit.md) and
    [derived-data blast radius](003-sleep-derivation-blast-radius.md) routed here transfer to
    [clock time log editing](009-clock-time-log-editing.md) intact: what bounds an end time and
    whether it inherits the previous-activity clamp, and whether an edited end recomputes the stored
    `durationSeconds` and the stored `morningClassification`. Both citing records are corrected.
  - The server-side consequence transfers with them. No stop path writes an end a caregiver chose, so
    `on_sleep_update_last_ended` and the wake-window push it drives are reached only by an edit made
    after the record exists.
  - A stop-written duration keeps deriving from the accepted stop time as it does today,
    minus `totalPausedMs` for feeding, pumping, and tummy time under
    [what pause means](006-pause-semantics.md).
  - This record produces no tasks. Its `Plannable` is `none` and it leaves the timer time editing
    cluster, which is now [running timer start time edit](007-running-timer-start-time-edit.md) and
    [clock time log editing](009-clock-time-log-editing.md).

- **Non-goals:** The bounds, validation, and overlap policy for an edited time, which belong to
  [clock time log editing](009-clock-time-log-editing.md). What stopping a paused timer records,
  settled by [what pause means](006-pause-semantics.md). Which surfaces may stop a timer, settled by
  [control surface coverage](../../deferred/household-timer-control/005-control-surface-coverage.md). Removing the `requestedEndTime`
  parameter or the Watch path that supplies it. How long a marked stop may wait for finalization,
  which is [lifetime of an unfinalized stop](../../deferred/household-timer-control/015-unfinalized-stop-lifetime.md). Correcting sleeps
  recorded under the old pause accounting, which is
  [backfilling historical paused sleeps](017-paused-sleep-backfill.md).

- **Required proof:** No behavior changes, so this decision adds no test of its own. It is held by
  coverage required elsewhere: the proof in
  [what pause means](006-pause-semantics.md) that a paused timer stops at `pausedAt`, and the proof in
  [record ownership on remote stop](../../deferred/household-timer-control/004-remote-stop-record-ownership.md) that a second stop leaves
  `stopped_at` unchanged. Any task that later adds a stop-time control to any surface contradicts this
  record and must reopen it rather than extend it.

## Follow-on

- **Newly sharp decisions:** Whether a fast path for a known-length entry survives the removal of the
  quick-duration chips, and in what form. It is sharp enough to state and belongs inside
  [clock time log editing](009-clock-time-log-editing.md) rather than in a record of its own.
- **Still-foggy areas:** Whether the Timeline should surface its edit path more prominently now that
  it is the only way to correct a mistimed stop. The route exists and is unchanged by this decision,
  so this is a discoverability question nobody has phrased yet.
