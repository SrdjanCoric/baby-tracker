# Decision: what pause means

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** cluster
**Cluster:** pause semantics
**Depends on:** [derived-data blast radius](003-sleep-derivation-blast-radius.md)
**Claim:** none

## Question

What does pausing a timer mean for the recorded activity, and does the answer differ between feeding,
sleep, pumping, and tummy time?

## Context

Two caregivers want opposite behavior from the same button. The caregiver in the feedback thread
pauses when they think their son is waking, then resumes ten minutes later and expects the clock to
have kept running, so a timer paused at 38 minutes should resume near 48. The owner pauses when their
daughter stops feeding and expects the paused span to be excluded, which is what the code does now.

Both readings are coherent because they answer different questions. "Was the baby asleep during those
ten minutes?" and "how long did the baby actually feed?" are different measurements, and pause is
currently one control serving both.

The nap continuation setting overlaps here. A sleep that resumes within the configured allowance
already counts as one nap for predictions, which covers part of what the pause-and-resume workaround
was doing by hand.

Options that need weighing include keeping true pause, switching to wall-clock continuation, offering
both through separate controls, and removing pause in favor of stop plus a continuation rule. Whatever
is chosen has to answer for existing paused timers restored from AsyncStorage after an update, and for
`toggle_timer_pause` in migration `056`.

## Evidence

- `src/contexts/sleep-context.tsx` lines 253 to 267 and 1400 to 1460, the `pausedAt` and
  `totalPausedMs` reducer and the pause and resume callbacks.
- The same pattern in `src/contexts/feeding-context.tsx`, `src/contexts/pumping-context.tsx`, and
  `src/contexts/tummyTime-context.tsx`.
- `supabase/migrations/056_authorize_active_timer_controls.sql`, `toggle_timer_pause`.
- `src/services/live-activity-service.ts`, `pauseTimerLiveActivity` and `resumeTimerLiveActivity`.
- `src/hooks/useWidgetPauseHandler.ts` and `src/__tests__/security/toggle-timer-pause.security.test.ts`.
- Nap continuation handling in the sleep context and `src/utils/sleep-patterns.ts`.
- Every timer stops through `acceptTimerCompletion(babyId, type, start, timer, requestedStopTime)`,
  which already accepts a requested stop time and returns `completion.stoppedAt`. The record is then
  written with `durationSeconds = stoppedAt - startedAt - totalPausedMs`, at
  `src/contexts/sleep-context.tsx` line 1319, `src/contexts/tummyTime-context.tsx` line 795, and the
  matching lines in the feeding and pumping contexts.
- Stopping a pumping timer requires a volume before the record can be written,
  `app/pumping/index.tsx` lines 111 to 116. Bottle and solids feeds require their own detail. Sleep
  and tummy time capture nothing at stop.
- `calculatePumpingStats` reports `totalCount` and `calculateTummyTimeStats` reports `sessionCount` as
  raw record counts, `src/utils/statistics.ts` lines 204 and 224. Feeding instead merges records
  separated by less than one hour, `src/utils/feeding-sessions.ts` line 4.
- The widget carries the endpoints a pause span needs. `targets/widget/index.swift` writes `pausedAt`
  at line 840 and computes `pauseDurationMs` from it at resume, line 763. The Watch writes `pausedAt`
  at line 1345.

## Resolution

- **Decision:** A pause counts as elapsed time when the caregiver comes back to it, and is discarded
  when they do not.

  Stopping works the same way on all four timers. Stopping a paused timer ends the record at
  `pausedAt`, not at the moment stop was pressed, so the span between the pause and the stop never
  reaches the record and a pause left open by accident can inflate nothing.

  Resuming split by timer type when this decision was made. A sleep resumed after a pause continues as
  though the pause had not happened, so the span counts, `totalPausedMs` stops being subtracted, and a
  saved sleep's `durationSeconds` becomes `endedAt - startedAt`. Feeding, pumping, and tummy time were
  to keep subtracting a resumed pause as they did then.

  The split followed what each timer measures. Sleep is a state the baby is in, so a span the caregiver
  returned from was still sleep. The other three are activities somebody performs, so a span the
  caregiver returned from was not feeding, pumping, or tummy time.

  **Superseded.**
  [Showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md)
  extends the sleep rule to all four types, so feeding, pumping, and tummy time also stop subtracting a
  resumed pause. That decision was forced by
  [clock time log editing](009-clock-time-log-editing.md), whose form holds a start and an end with the
  length derived from them and therefore cannot express a record that stores less than its own
  interval. The stop rule and its reasoning stand unchanged. The rationale below for keeping the
  subtraction on the other three types is superseded with the rule it defended.

  Nothing else changes. The pause button stays one tap on every surface, `toggle_timer_pause` keeps
  its signature and its meaning as a state toggle, no column is added, no record is backfilled, and no
  consumer is repointed.

- **Rationale:** For sleep this closes the two-clock split in
  [derived-data blast radius](003-sleep-derivation-blast-radius.md) by making the two clocks
  the same clock. Every live sleep surface already measures `endedAt - startedAt` and so already counts
  a paused span as sleep; only the stored `durationSeconds` disagreed, and it is read by six places
  including the Timeline row label that sits one tab from the Day view block showing a different number
  for the same nap. Dropping the subtraction makes them agree, and it agrees with the caregiver who
  expected 38 minutes to resume near 48.

  Counting the span is safe because of the stop rule. The objection to counting a paused span is the
  pause left open for two hours, and that objection only exists if stopping bills the open pause. Under
  this decision the record ends where the caregiver stopped attending to it, so a span counts only when
  they explicitly resumed, which is them stating the baby was asleep through it.

  For feeding, pumping, and tummy time the same reasoning points the other way, and their totals
  already read `durationSeconds`, so subtracting a resumed pause is both the honest measurement and the
  behavior already shipped.

- **Alternatives rejected:**
  - *Pause always excludes, on all four timers.* One identical rule, and it matches how the owner uses
    the button. Rejected because delivering it for sleep is not a matter of leaving code alone: every
    sleep total measures the interval today, so honoring the exclusion requires either falsifying
    `startedAt`, splitting the record, or storing pause spans and repointing every interval consumer.
    Each of those was examined below and each costs more than the disagreement it fixes.
  - *Shift `startedAt` forward by the paused span at stop.* One record, one invariant, no migration,
    and already the idiom in `src/utils/ongoing-sleep.ts`. Rejected because `startedAt` would stop
    meaning the moment start was pressed, and the sleep type, the sleep-day bucket, the bedtime average,
    and `morningClassification` all re-derive from that shifted moment.
  - *Split the record at each pause.* The most truthful account of the gap and it needs no new field.
    Rejected on three collisions: stopping a pumping timer demands a volume that the widget's and
    Watch's stop buttons cannot collect, since both send a stop command with a volume of zero; a split
    doubles `calculatePumpingStats.totalCount` and `calculateTummyTimeStats.sessionCount`, which are
    raw record counts; and undoing that damage requires continuation-style merge logic on every
    counting surface, including the `Nap Schedule` panel from
    [per-nap-slot statistics](014-per-nap-slot-statistics.md), whose slot numbering would
    otherwise shift on any paused day.
  - *Store the pause spans on the record and have every interval consumer subtract them.* Keeps both
    timestamps real, keeps one record, and is the only option that can draw the real gap inside a Day
    view block. Rejected on cost against benefit. It needs a migration, a new field through every
    writer, validator, and sync path, and edits to every interval consumer named in the audit plus the
    CSV and PDF. What that buys is sleep totals shrinking by an amount they have never counted
    correctly anyway.
  - *Treat a sleep pause as a continuation, counting spans under `napContinuationMinutes` and
    subtracting longer ones.* Reuses a threshold the user already controls and needs no schema change.
    Rejected because the stop rule solves the same problem without a threshold, and a threshold would
    make one nap's recorded duration depend on a setting's value at the moment it was stopped.
  - *Two controls, one that excludes and one that keeps counting.* Rejected on control budget: a second
    button would have to reach the dashboard card, four activity screens, three widget sizes, the
    Watch, and the Live Activity.

- **Consequences:**
  - Four contexts drop `- totalPausedMs` from the sleep duration only, and all four pass `pausedAt` as
    the requested stop time when the timer is paused. The seam exists already, since
    `acceptTimerCompletion(..., requestedStopTime)` takes one. Under
    [showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md)
    the subtraction is dropped for all four durations rather than for sleep alone.
  - A saved sleep now satisfies `durationSeconds === endedAt - startedAt`, so the Day view block, the
    Timeline daily summary, the Timeline row label, the CSV export, the PDF report, the night-sleep
    achievement, and the edit screen's prefill agree without any of them changing. `app/edit/sleep.tsx`
    recomputes `endedAt = startedAt + durationSeconds` on save, which is consistent with the invariant
    for the first time.
  - `src/utils/ongoing-sleep.ts` must stop shifting the start by `totalPausedMs`, and while a pause is
    open the running entry must end at `pausedAt` rather than at now, so the live view shows what
    stopping right then would record. The `effectiveStartTime` idiom in all four contexts follows the
    same split.
  - The Live Activity for sleep resumes from full elapsed time rather than active time, which is the
    behavior the feedback thread asked for. `pauseTimerLiveActivity` and `resumeTimerLiveActivity` are
    called with the elapsed figure their context computes, so the split lands there too.
  - The widget's `TogglePause` intent and the Watch both keep sending `pauseDurationMs` and
    `accumulatedSeconds`. For sleep the app stops accumulating what they send; for the other three it
    keeps accumulating. Neither native target needs a change for this decision.
  - `pausedAt` stays in `timer_data` for any paused timer, and the pause path already writes it. This
    was a requirement while household timer control was live, because a different device might have
    finalized the stop and could only truncate to `pausedAt` if the value was on the row. The owner cut
    that work on 2026-08-05, so the device that paused is always the device that stops, and the value
    is now merely carried rather than depended on. Nothing changes in the code either way.
  - Records written before this change are untouched. A sleep paused under the old code keeps a
    `durationSeconds` smaller than its interval and keeps showing two numbers, which is what it shows
    today. [Backfilling historical paused sleeps](017-paused-sleep-backfill.md) settled that they are
    never corrected, in the data or on screen.
  - A timer restored from AsyncStorage across the update carries a `totalPausedMs` from the old
    meaning. For sleep it is ignored from then on, so that timer records slightly more than the old
    code would have. Nothing is lost, and no migration is needed.
  - Released build 4.7.1 keeps subtracting locally and keeps writing spanless, pause-subtracted sleeps
    with an end time at the stop moment. The disagreement it produces is the one that exists today, and
    it ends when that build does.
  - `toggle_timer_pause` keeps its signature, its `isPaused` boolean validation, and its meaning, and
    now keeps its owner-only guard as well. Widening it to a shared `is_household_member` predicate was
    the one change this decision expected, and it went with the household timer control cut of
    2026-08-05. Only the caregiver who started a timer can pause it, which is what ships today.

- **Non-goals:** No change to the pause control on any surface, and no second control. No change to
  `napContinuationMinutes`, its default, or where continuation merging applies. No schema change, no
  new field, and no backfill of existing records. No decision about editing a saved or running timer's
  times, which belongs to [timer time editing](../../clusters/timer-time-editing.md). No decision about
  whether the Day view should draw a gap, which this decision makes moot for new sleeps because there
  is no stored gap to draw.

- **Required proof:** One sleep paused and resumed, proving the Day view block, the Timeline daily
  summary, the Timeline row label, the CSV export, and the PDF report all report the same number,
  which is the standing bar from the audit. One sleep paused and then stopped without resuming,
  proving the record ends at `pausedAt` and that `babies.last_sleep_ended_at` receives that time
  through `on_sleep_update_last_ended`. A pause and resume performed entirely on the widget and
  again on the Watch with the app never foregrounded, proving the span counts.

  The coverage this decision first required, that a resumed feeding, pumping, or tummy time span stays
  excluded, is inverted by
  [showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md),
  which requires the opposite and states the replacement. The item this decision also required, a stop
  issued while paused from one household device and finalized by another, is dropped: the household
  timer control cut of 2026-08-05 means no device ever finalizes another's stop. Coverage that the
  running sleep entry stops growing while a pause is open.

## Follow-on

- **Newly sharp decisions:** [backfilling historical paused sleeps](017-paused-sleep-backfill.md).
- **Still-foggy areas:** What should happen to a sleep left paused until
  `cleanup_stale_timer_locks` removes the lock at twelve hours. The lock disappears and no record is
  written, which is today's behavior, and the stop rule now implies an answer that no code applies.
  It was adjacent to
  [lifetime of an unfinalized stop](../../deferred/household-timer-control/015-unfinalized-stop-lifetime.md),
  which went with the household timer control cut, so this question is now on its own and belongs to
  whoever next touches `cleanup_stale_timer_locks`.
