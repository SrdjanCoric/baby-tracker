# Decision: entering and editing activities by clock time

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** cluster
**Cluster:** timer time editing
**Depends on:** [stop time rewind](008-stop-time-rewind.md), [running timer start time edit](007-running-timer-start-time-edit.md), [what pause means](006-pause-semantics.md)
**Claim:** none

## Question

What bounds, validation, and recomputation rules govern a start time and an end time entered by hand,
on both the manual logging screens and the saved-record edit screens, for all four activity types?
The form's shape is settled; see Context. What is open is the rule set behind it.

## Context

A saved sleep shows its length in minutes, so correcting a wake from 5:43 to 5:30 means subtracting 13
and typing the new total. The same is true when logging a past entry, which pairs a start-time picker
with a minutes field.

[Stop time rewind](008-stop-time-rewind.md) resolved that no surface offers an end time at
stop, so this record is the only correction route for a mistimed stop as well as the entry path for
anything logged by hand.

The owner settled the form during that session, so it is an input here rather than a question:

- The manual logging screens gain an **End Time** field beside the existing Start Time, built from the
  same date and time pills, so it inherits the picker, the formatting, and the 12/24-hour preference.
- The saved-record edit screens gain **Start Time** and **End Time**, neither of which exists today.
- The minutes input and the `QUICK_DURATIONS` chips go from both. Duration becomes a derived
  read-only readout under the two pickers.
- It applies to sleep, feeding, pumping, and tummy time.

[`prototypes/clock-time-entry-mock.html`](../../prototypes/clock-time-entry-mock.html), published at
<https://claude.ai/code/artifact/2dc8a9f5-8f13-42b8-bf0a-c09191277dfc>, draws both forms as they are
today and as settled. Read it before planning this.

What the form does not settle is the rule set: what bounds an end time, whether the previous-activity
clamp from [running timer start time edit](007-running-timer-start-time-edit.md) governs a
saved record or the master plan's warn-and-allow overlap policy does, whether an edited time
recomputes the stored `morningClassification`, what happens to a pre-existing paused sleep whose
stored duration disagrees with its own interval, and whether an entry may be shorter than the
60-second floor that discards a timer.

Dropping the chips withdraws a working capability from 4.7.1 builds, which reach users only through
the store. The owner accepted that trade. Whether a fast path for a known-length entry returns in
another form is open.

## Evidence

- All four manual screens pair a start-time picker with a `durationInput` and a `QUICK_DURATIONS` row:
  `app/sleep/manual.tsx:28` and `:51` (`15/30/45/60/90/120`), `app/feeding/manual.tsx:34`
  (`5/10/15/20/30/45`), `app/pumping/manual.tsx:29` (same), `app/tummyTime/manual.tsx:25`
  (`1/2/3/5/10/15`).
- All four edit screens expose the minutes field alone, with no start-time and no end-time control,
  and recompute `endedAt = startedAt + durationSeconds` on save: `app/edit/sleep.tsx:77` to `79`, and
  the same lines in `edit/feeding.tsx`, `edit/pumping.tsx`, and `edit/tummyTime.tsx`. Editing the
  duration of a paused sleep therefore collapses its interval onto the stored duration and discards
  the pause.
- `validateSleepEndTime` in `src/validators/sleep.ts` already rejects an end before its start and is
  the only end-time rule in the tree. `validateSleepDuration` bounds the duration between 0 and 86400
  seconds. No migration adds a check constraint on `duration_seconds`.
- `shouldDiscardTimerDuration` in `src/utils/timer-duration.ts` discards a timer under 60 seconds in
  production. No equivalent floor applies to a hand-entered activity.
- `on_sleep_update_last_ended` in `supabase/migrations/053_tombstone_aware_wake_window_reminders.sql`
  fires on `INSERT OR UPDATE OF ended_at, deleted OR DELETE` and recomputes
  `babies.last_sleep_ended_at`, which `supabase/functions/check-wake-window-reminders/index.ts:216`
  reads as the wake time for a push reminder.
- `morningClassification` is written only at stop and on a type change,
  `src/contexts/sleep-context.tsx:1322` and `:1548`. No path recomputes it when times move.
- `src/services/duplicate-detection.ts:313` calls two entries duplicates when their durations differ
  by 60 seconds or less, so an edit can push two entries into that window.
- Master-plan decisions on manual sleep overlap (warn, allow, union for statistics) and ambiguous
  morning sleep confirmation.
- `@react-native-community/datetimepicker` usage and the date-picker provider work from completed task
  `0026`.
- [Derived-data blast radius](003-sleep-derivation-blast-radius.md) for which consumers read
  the interval and which read the stored duration.

## Resolution

- **Decision:** Both hand-entry paths take a start time and an end time under one rule set, for all
  four activity types.

  **Bounds.** Neither picker accepts a future value, which is what every manual screen enforces today
  through `maximumDate={new Date()}` and `validateSleepStartTimeNotInFuture`. There is no floor in
  time. The twelve-hour floor from
  [running timer start time edit](007-running-timer-start-time-edit.md) exists to keep a
  running lock inside the `cleanup_stale_timer_locks` horizon, and a record that already exists cannot
  be lost that way. An end must be at least one minute after its start, which restates the
  one-minute minimum the four manual validators already impose rather than introducing a number, and
  minute-granular pickers make that the smallest expressible span anyway. The existing per-type
  duration caps survive on the derived value: twenty-four hours for sleep, sixty minutes for pumping.

  Every bound is shown as the picker's own range, following the rule
  [running timer start time edit](007-running-timer-start-time-edit.md) set. The end picker
  offers `start + 1 minute` through the earlier of now and `start + cap`; the start picker offers up to
  the earlier of now and `end - 1 minute`. Nothing a caregiver can pick is rejected afterwards, and
  Save stays disabled until the two times are a minute apart, which is the gate the manual screens
  already apply to the minutes field.

  An end time appears only where a duration exists: sleep, breastfeeding, pumping, and tummy time. A
  bottle feed and a solids entry are moments, and they keep the single time picker they have.

  **Overlap.** Saved records follow the master plan: warn, allow, and union for statistics. The edit
  screens gain a duplicate and overlap check, evaluated against the post-edit values and excluding the
  record being edited. Only `app/sleep/manual.tsx` runs such a check today, so this rule wires sleep's
  edit screen and
  [interval overlap detection for feeding, pumping, and tummy time](019-interval-overlap-non-sleep.md)
  wires the other three types on both paths. Each type keeps the detection its checker performs, so
  sleep compares intervals and the other three compare proximity until that decision changes it. The
  clamp from
  [running timer start time edit](007-running-timer-start-time-edit.md) stays a running-timer
  rule and does not follow the record. The app therefore holds two overlap rules on purpose. A running
  timer's anchor drives live surfaces and has no correction path until it stops, while a saved record
  can be corrected or deleted at any time, and clamping saved records would leave every already
  overlapping record uneditable.

  **Sleep type and morning classification.** Moving a sleep's times re-derives its Nap or Night type
  the way the add screen does, and a caregiver's tap on the toggle afterwards wins. The toggle stays
  the answer to the ambiguous-morning question the master plan requires to remain editable.
  Classification is recomputed on a time edit by the path that already recomputes it. `updateSleep`
  flips it to `confirmed_first_nap` or `confirmed_night_continuation` when the type is edited and the
  start falls inside `[getMorningThreshold(dayStartHour), dayStartHour)`, and that predicate must read
  the edited start rather than `existing.startedAt`, which is the only line this rule changes. A start
  moved into that window with no toggle re-runs `classifyNewMorningSleep` and lands on `unresolved` or
  `automatic`, which the standing confirmation prompt then handles with no new surface. A start moved
  out of it returns a stale `confirmed_*` to `automatic`.

  **What a save writes.** Both forms prefill Start and End from the record's own stored timestamps.
  The current derivation of `endedAt` from the minutes field goes, so a record's real end is shown for
  the first time. The stored `durationSeconds` is rewritten as `end - start` only when the caregiver
  actually changed one of the two times; a save that touched only a note, a side, a volume, or a type
  leaves it exactly as stored.

  This is why the decision stays out of pause accounting. When it was written, a paused feeding,
  pumping, or tummy time record stored less than its own interval under
  [what pause means](006-pause-semantics.md), and the record did not say how much was
  paused, because `totalPausedMs` lives on the running timer and is never saved. A sleep recorded
  before that decision has the same disagreement for the opposite reason.
  [Showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md)
  has since removed the disagreement for every new record of all four types, so what remains is the
  legacy set. Under this rule neither is touched by an incidental save, and a deliberate time edit
  converges the record on its interval because the caregiver has just stated what the interval is.

  **The dropped chips.** Nothing replaces them. Both pickers default to now on the add screens, so a
  nap that just ended is a few taps on the start picker alone.

- **Rationale:** Every bound above already exists somewhere in the tree, so the rule set adds no new
  number. The future bound, the one-minute minimum, the twenty-four-hour sleep cap, and the
  sixty-minute pumping cap are all restatements of shipped validators in clock-time form, so the two
  entry paths cannot disagree about the same activity.

  The overlap warning already exists for sleep on the add path and the union already protects
  statistics, so extending the check to the edit path introduces no new policy. A clamp would have to
  decide what to do with every record that overlaps today, including the ones a caregiver deliberately
  kept through Continue anyway.

  Recomputing classification costs one predicate reading a different variable because
  `updateSleep` was already written to recompute on a type edit. Leaving it stale would let an edited
  time move a sleep into or out of the ambiguous morning window while the stored answer kept pointing
  at the old one, which is the staleness
  [derived-data blast radius](003-sleep-derivation-blast-radius.md) named.

  The save rule follows from what the caregiver did rather than from what the form computed. A form
  that always wrote its derived value would make a note fix on a paused feeding lengthen it by the
  paused span with nothing on screen to say so, and there would be no way back, since the span is not
  stored anywhere. Writing only on a real time change makes every length change an act the caregiver
  performed.

- **Alternatives rejected:**
  - *Clamp saved records at the previous same-type activity's end, as a running timer is clamped.* One
    overlap rule instead of two. Rejected because it contradicts the master plan decision that overlap
    is legitimate with confirmation, and because a record that already overlaps, whether written by a
    4.7.1 build or kept through Continue anyway, would become uneditable until its neighbour was fixed
    first.
  - *Warn on entry and stay silent on edit,* which is today's behavior. Rejected because it
    makes the edit screen the silent route to the overlap the add screen warns about.
  - *Always write `end - start` on save, on all four types.* The simplest rule, and start, end, and
    duration could never disagree again. Rejected because it changes a paused record's length on a save
    the caregiver made for another reason, and because the subtracted span cannot be recovered.
  - *Never derive duration for feeding, pumping, and tummy time.* Protects the pause subtraction.
    Rejected because moving those records' times would then leave a length matching
    neither the pickers nor the readout.
  - *Let the Nap/Night toggle alone decide the type.* Nothing surprises the caregiver. Rejected
    because a sleep dragged from afternoon to late evening would stay labelled Nap until somebody
    noticed, and because the add screen already derives the type from the times.
  - *Derive the type purely from the times and drop the toggle.* Rejected because the toggle is how
    the master plan's ambiguous morning sleep is confirmed as first nap or night continuation, and it
    must stay editable.
  - *Keep the quick-duration chips, repointed to set `end = start + N`.* Preserves a capability 4.7.1
    builds have and costs little. Rejected because it puts two ways to set the same value on every add
    form while being meaningless on the edit forms, which must agree with them.
  - *A typeable duration readout that moves the end time.* Covers add and edit alike. Rejected because
    it reinstates the arithmetic the decision exists to remove, in a third field that interacts with
    the other two.

- **Consequences:**
  - All eight screens change. The four add screens lose `durationInput` and `QUICK_DURATIONS` and gain
    an End Time field; the four edit screens lose the minutes field and gain both pickers, which is new
    surface rather than a modification. The derivation at `app/edit/*.tsx:77` to `:79` is replaced by
    the conditional write described above.
  - The four `validateManual*` functions are reached with a duration derived from two times rather
    than typed, so they need an end-time-aware entry point. Their thresholds do not change.
  - `useDuplicateCheck` is called from the edit screens for the first time, with the edited record
    excluded by id so it cannot match itself, and with the post-edit times. Sleep's edit screen is the
    only one this decision wires, since sleep's add screen is the hook's only call site in the tree;
    the other three types are wired by
    [interval overlap detection for feeding, pumping, and tummy time](019-interval-overlap-non-sleep.md).
    The 60-second confidence rule at `src/services/duplicate-detection.ts:315` becomes reachable by
    editing.
  - An edited `ended_at` fires `on_sleep_update_last_ended` and moves `babies.last_sleep_ended_at`, so
    a time edit reschedules the wake-window push that
    `supabase/functions/check-wake-window-reminders/index.ts:216` drives. A time edit is not a
    client-only change.
  - The morning predicate in `updateSleep` at `src/contexts/sleep-context.tsx:1541` to `:1553` moves
    from `existing.startedAt` to the edited start. `MORNING_CLASSIFICATION_VERSION` is stamped as it
    is today.
  - A record whose stored length disagrees with its own interval shows the interval in the derived
    readout while the Timeline row label still shows the stored length, until a time is touched. After
    [showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md)
    this describes only records written before that change, since no new record can disagree.
  - [Backfilling historical paused sleeps](017-paused-sleep-backfill.md) keeps its scope. This
    decision repairs an old paused sleep only when a caregiver deliberately edits its times, one
    record at a time.
  - Nothing reaches the widget, the Watch, or the Live Activity; every surface here is a saved record
    in the app.
  - An edit made offline replays through the sync engine as a generic table write. Unlike the running
    timer's start, no server-side recheck applies, because a past time stays past, so a queued edit
    lands as issued.
  - Released 4.7.1 builds keep writing the same columns from a minutes field, so records from both
    versions remain readable by both. Those builds lose nothing, and this build drops only the chips,
    which the owner accepted.
  - Sleep type, sleep-day bucket, bedtime averages and their standard deviation, wake windows, and the
    prediction and drift model all re-derive from the saved row, so they need no change beyond the
    recomputation named above.

- **Non-goals:** Any change to pause accounting, settled by
  [what pause means](006-pause-semantics.md). Backfilling records written before it, which is
  [backfilling historical paused sleeps](017-paused-sleep-backfill.md). A stop-time control on any
  surface, refused by [setting the real end time when stopping](008-stop-time-rewind.md).
  Changing the running timer's bounds or its clamp. Storing a paused span on a saved record, or any
  other schema change. An end time on a bottle feed, a solids entry, a diaper, or a growth
  measurement. Changing how statistics union overlapping sleep. Editing times from the widget, the
  Watch, the Live Activity, or the dashboard card. Making the Timeline's edit route easier to find.

- **Required proof:** Component tests on all eight screens, for all four activity types: the end
  picker offers `start + 1 minute` through the earlier of now and the type's cap, the start picker
  offers up to the earlier of now and `end - 1 minute`, the duration readout is derived and not
  editable, no minutes input and no quick-duration chips remain, and Save is disabled until the two
  times are a minute apart.

  A prefill test that a sleep whose stored `durationSeconds` is smaller than its own interval opens
  showing the real start and end rather than `start + duration`.

  Save-rule tests, on sleep and on one of the three subtracting types: a save that changes only a note
  leaves `durationSeconds` and `endedAt` unchanged, and a save that moves a time writes
  `end - start`.

  Overlap tests: editing a sleep so that it overlaps another warns and preserves both records through
  Continue anyway, Cancel writes nothing, and the record being edited never matches itself.

  Classification tests: moving a sleep's start across the day boundary re-derives Nap or Night, a
  toggle after that wins, a start moved into `[getMorningThreshold(dayStartHour), dayStartHour)`
  re-runs classification and can land `unresolved`, a start moved out of it returns a `confirmed_*`
  to `automatic`, and the predicate reads the edited start rather than the stored one.

  Real-provider tests against local Supabase: an edited `ended_at` reaches
  `babies.last_sleep_ended_at` through `on_sleep_update_last_ended`, and the twenty-four-hour sleep
  cap and sixty-minute pumping cap are rejected on save as well as bounded in the picker.

  The standing bar from [derived-data blast radius](003-sleep-derivation-blast-radius.md):
  after a time-editing save on a paused sleep, the Day view block, the Timeline daily summary, the
  Timeline row label, the CSV export, and the PDF report all report the same number.

  The representative two-account sleep smoke, extended so one caregiver edits the times of a record
  the other created and both see the result.

## Follow-on

- **Newly sharp decisions:**
  - [Showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md),
    which was charted into the timer time editing cluster on the assumption that it set what this form
    displays, and which resolved instead by removing the disagreement from the write path and moving
    to pause semantics.
  - [Interval overlap detection for feeding, pumping, and tummy time](019-interval-overlap-non-sleep.md),
    now that every hand-entered record of those types carries an end time.
- **Still-foggy areas:**
  - Whether a caregiver ever needs to see or restore a record's paused span, which nothing stores.
  - Whether a session shorter than a minute, such as a brief tummy time, deserves a way to be
    recorded at all. It cannot be logged today either.
