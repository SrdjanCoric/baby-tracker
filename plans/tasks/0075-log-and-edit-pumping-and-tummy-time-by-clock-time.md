# Task 0075: Log and edit pumping and tummy time by clock time

**Branch**: `feature/log-and-edit-pumping-and-tummy-time-by-clock-time`
**Depends on**: 0072, 0074
**Execution classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes
**Source**: `plans/decision-maps/unified-timer-contract/clusters/timer-time-editing.md` and its member
`decisions/resolved/009-clock-time-log-editing.md` (resolved), with the edit-screen proof items from
`decisions/resolved/018-disagreeing-length-display.md` · **User stories**: As a caregiver, I want to
enter and correct a pumping session and a tummy time by their real clock times, so that every activity
in the app is logged the same way and none of them asks me to do arithmetic.

## What to build

The rule set Task 0072 applied to sleep, applied to the two remaining types on four screens:
`app/pumping/manual.tsx`, `app/edit/pumping.tsx`, `app/tummyTime/manual.tsx`, and
`app/edit/tummyTime.tsx`. Each takes a **start time** and an **end time**, with duration shown as a
derived read-only readout, built on the shared start/end form section Task 0072 extracted.

The two types are combined into one task by the owner's decision on 2026-08-05: once the shared section
exists, both are the same mechanical application of one rule set, and neither carries type-specific
behavior the way sleep carries classification and feeding carries its bottle and solids branching.

The form's shape is settled and drawn in
[`plans/decision-maps/unified-timer-contract/prototypes/clock-time-entry-mock.html`](../decision-maps/unified-timer-contract/prototypes/clock-time-entry-mock.html).
Read it before implementing.

### Task 0072 is the executable reference

Task 0072's merged sleep implementation is the reference for all four screens in this task. Read
`src/components/StartEndTimeSection.tsx`, `app/sleep/manual.tsx`, `app/edit/sleep.tsx`, and their
component tests before implementing. Reuse `StartEndTimeSection` directly; do not create pumping- or
tummy-time-specific copies or duplicate its iOS/Android merge, dismiss, clamp, display, or live-bound
behavior.

Carry the sleep screens' caller-side pattern across, parameterized only by the activity's fields and
duration cap:

- provide stable bound callbacks so `Date.now()` is evaluated when the picker opens, while the
  shared Android callback remains stable across unrelated renders;
- keep the picker value inside the displayed range and ensure a fresh form and an edit whose stored
  `endedAt` is absent never render inert End pills or inverted bounds;
- keep a separate initialized baseline for change detection, so a display fallback for a missing
  endpoint does not make the edit dirty or rewrite stored times by itself; and
- write start, end, and derived duration only after an actual time edit, leaving non-time-only saves
  on their existing path.

Pumping keeps its `volumeMl` field and 500 ml validation beside the shared section; they do not
belong in the shared time component. `TimerLifecycleAdapter` is also intentionally not the seam for
this work: it adapts running-timer storage, lock payloads, restoration, Live Activities, and
stop-to-record construction. Manual entry and saved-record editing continue through their existing
add/update context APIs, and all activity timer adapters remain unchanged.

### Today

Both manual screens pair a start-time picker with a `durationMinutes` input and a `QUICK_DURATIONS`
row — `[5, 10, 15, 20, 30, 45]` for pumping and `[1, 2, 3, 5, 10, 15]` for tummy time. Both edit
screens expose the minutes field alone, with no start-time and no end-time control, and recompute
`endedAt = startedAt + durationSeconds` on save. Pumping additionally carries a `volumeMl` input on
both screens, which is untouched by this task, as is its 500 ml volume cap.

### Bounds

Every bound is shown as the picker's own range, and none is a new number — each restates a validator
already shipped in `src/validators/pumping.ts` and `src/validators/tummyTime.ts`.

- Neither picker accepts a future value, which each type's future-start validator already enforces.
- There is no floor in time.
- An end must be at least **one minute** after its start, restating the one-minute minimum
  `validateManualPumping` and `validateManualTummyTime` already impose.
- The per-type duration caps survive on the derived value: **one hour** for pumping (`3600` seconds)
  and **two hours** for tummy time (`7200` seconds). Note that
  `decisions/resolved/009-clock-time-log-editing.md` names the sixty-minute pumping cap but not tummy
  time's, which is carried here on the same terms.
- The end picker offers `start + 1 minute` through the earlier of now and the type's cap; the start
  picker offers up to the earlier of now and `end - 1 minute`.
- Save stays disabled until the two times are a minute apart.

`validateManualPumping` and `validateManualTummyTime` take `durationSeconds`, so each needs an
**end-time-aware entry point** reached with a duration derived from two times rather than typed. Their
thresholds do not change.

### What a save writes

All four forms prefill Start and End from the record's **own stored timestamps**, so each record's real
end is shown for the first time.

The stored `durationSeconds` is rewritten as `end - start` **only when the caregiver actually changed
one of the two times**. A save that touched only a note or a pumping volume leaves `durationSeconds`
and `endedAt` exactly as stored. That rule protects records written before Task 0068, whose stored
length is smaller than their own interval because the old code subtracted `totalPausedMs`; the span is
recoverable from nowhere, since `totalPausedMs` never reaches a saved record. A deliberate time edit
converges such a record on its interval.

After Task 0068 every newly written pumping session and tummy time satisfies
`durationSeconds === endedAt - startedAt`, so the derived readout equals the stored length with nothing
to explain. Legacy records are never backfilled.

### What this task does not wire

The duplicate and overlap check for pumping and tummy time is a separate decision,
`decisions/resolved/019-interval-overlap-non-sleep.md`, planned after this cluster so the check is
wired into these screens' final shape once. None of these four screens runs a duplicate check today and
none does after this task. That decision also notes that `app/pumping/manual.tsx` and
`app/tummyTime/manual.tsx` destructure only their add function from context and will need the entry
list — that is its work, not this task's.

`calculatePumpingStats` and `calculateTummyTimeStats` read the stored duration and re-derive from the
saved row, so they need no change here. The summed-minutes effect of the counted-pause rule belongs to
Task 0068 and is already accepted there.

Nothing here reaches the widget, the Watch, or the Live Activity: every surface is a saved record in
the app.

### Why this task waits on Task 0074

Task 0074 opens running-timer start editing to a caregiver with no account, and it edits
`src/contexts/pumping-context.tsx` and `src/contexts/tummyTime-context.tsx` — the same two contexts this
task adds a manual-entry entry point to. That shared artifact is the reason for the dependency, not any
overlap in screens: 0074 changes the running-timer views `app/pumping/index.tsx` and
`app/tummyTime/index.tsx`, while this task changes only `manual.tsx` and the `app/edit/` screens.

Two consequences to expect on a tree that already has 0074. `TimerLockReconciliationState` carries a
distinct account-less value alongside `"offline"`, so any lock-state handling touched here must keep
those two apart. And the running-timer start-edit label no longer renders a caregiver name — if a
pumping or tummy-time test in this task asserts on that label, assert the field name and time only.

## Implementation work

- [x] Use Task 0072's sleep screens and component tests as the executable template, reusing
      `StartEndTimeSection` directly and substituting only the activity fields and cap: one hour for
      pumping and two hours for tummy time. Do not change `TimerLifecycleAdapter` or any activity
      timer adapter.
- [x] Add end-time-aware entry points to `validateManualPumping` in `src/validators/pumping.ts` and
      `validateManualTummyTime` in `src/validators/tummyTime.ts`, reached with a duration derived from
      two times, leaving every threshold unchanged.
- [x] Rebuild `app/pumping/manual.tsx` on the shared start/end form section from Task 0072: add End
      Time, remove `durationMinutes` and `QUICK_DURATIONS`, derive the saved `durationSeconds` and
      `endedAt` from the two times, and leave the `volumeMl` input and its 500 ml cap untouched.
- [x] Rebuild `app/tummyTime/manual.tsx` the same way, removing its own `durationMinutes`,
      `durationInput`, and `QUICK_DURATIONS`.
- [x] Rebuild `app/edit/pumping.tsx` and `app/edit/tummyTime.tsx` on the shared section: add Start Time
      and End Time, remove the minutes field and the `endedAt = startedAt + durationSeconds`
      derivation, and prefill both pickers from each record's own stored timestamps. Pumping's edit
      screen keeps its volume field.
- [x] Implement the conditional save on all four screens: write `durationSeconds = end - start` only
      when a time actually changed, leaving `durationSeconds` and `endedAt` untouched on a note-only or
      volume-only save.
- [x] Add the End Time label, the derived Duration label, and any new validation strings for both types
      to all nine locale files under `src/i18n/locales/`, and remove keys the dropped chips and minutes
      fields leave unused.
- [x] Component tests on all four screens: the end picker offers `start + 1 minute` through the earlier
      of now and the type's cap, the start picker offers up to the earlier of now and `end - 1 minute`,
      the duration readout is derived and not editable, no minutes input and no quick-duration chips
      remain, and Save is disabled until the two times are a minute apart. Neither edit screen has a
      component test today, so both are new files.
- [x] Port the Task 0072 call-site regression proofs for each type: a fresh manual form opens both End
      pickers, an edit with a recent start and no stored `endedAt` opens both End pickers without
      becoming dirty, and a picker opened after the screen has remained mounted receives a freshly
      evaluated `now` ceiling. Rely on `StartEndTimeSection` tests rather than duplicating its
      platform-internal tests in all four screens.
- [x] Prefill tests, one per type, that a record whose stored `durationSeconds` is smaller than its own
      interval opens showing the real start and end rather than `start + duration`.
- [x] Save-rule tests, one per type: a save that changes only a note — or, for pumping, only the volume
      — leaves `durationSeconds` and `endedAt` unchanged, and a save that moves a time writes
      `end - start`.
- [x] Tests that the one-hour pumping cap and the two-hour tummy time cap are rejected on save as well
      as bounded in the picker.
- [x] The Task 0068 edit-screen proof items, per type: a record written after the counted-pause rule
      opens with a derived length equal to its stored length and no annotation, and one written before
      it opens showing its real interval while the Timeline row still shows the stored length,
      converging only when a time is edited and saved.

## Acceptance criteria

- [x] All four screens take a start time and an end time, with a derived read-only duration and no
      minutes input or quick-duration chips.
- [x] All four prefill from each record's own stored timestamps, so a legacy paused record opens
      showing its real interval.
- [x] Every bound is the picker's own range: no future value, end at least a minute after start, the
      one-hour pumping and two-hour tummy time caps honored, and Save disabled until the two times are
      a minute apart.
- [x] `durationSeconds` is rewritten as `end - start` only when a time actually changed; a note-only or
      volume-only save leaves the stored length exactly as it was.
- [x] Pumping's `volumeMl` input, its 500 ml cap, and every non-time field on all four screens are
      unchanged.
- [x] A record of each type written after Task 0068 opens with a derived length equal to its stored
      length and no annotation; one written before opens showing its real interval and converges only
      on a saved time edit.
- [x] No duplicate or overlap check is added on any of the four screens.
- [x] Pumping and tummy time reuse Task 0072's shared time section and caller pattern; they introduce
      no parallel picker implementation and make no running-timer adapter change.
- [x] No schema change and nothing reaching the widget, the Watch, or the Live Activity.
- [x] With this task merged, all eight hand-entry screens across the four activity types take clock
      times under one rule set.

## Non-goals

- Sleep and feeding, which are Tasks 0072 and 0073.
- Wiring the duplicate or overlap check for pumping or tummy time, and taking the entry list into those
  two manual screens, which are `decisions/resolved/019-interval-overlap-non-sleep.md`.
- Any change to pause accounting, settled by Task 0068, or backfilling records written before it.
- Changing the pumping volume input or its 500 ml cap.
- Changing the running timer's bounds or its clamp, which is Task 0071.
- Recording a session shorter than a minute, which no manual validator permits today either.
- Any schema change.

## Review decisions

- skipped (minor): TR-5 — The pumping edit screen now enforces the 500 ml volume cap on save, a
  non-time behavior change the task excludes — excluded from this remediation pass.
- skipped (minor): TR-6 — Locale keys orphaned by the removed pumping minutes field and
  quick-duration chips were left in all nine locale files — excluded from this remediation pass.
- skipped (minor): TR-7 — The counted-pause tests on both new edit screens cannot fail — excluded
  from this remediation pass.
