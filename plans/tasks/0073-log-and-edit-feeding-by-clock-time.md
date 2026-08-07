# Task 0073: Log and edit a feeding by clock time

**Branch**: `feature/log-and-edit-feeding-by-clock-time`
**Depends on**: 0072
**Execution classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes
**Source**: `plans/decision-maps/unified-timer-contract/clusters/timer-time-editing.md` and its member
`decisions/resolved/009-clock-time-log-editing.md` (resolved), with the edit-screen proof items from
`decisions/resolved/018-disagreeing-length-display.md` · **User stories**: As a caregiver, I want to
enter and correct a breast feed by its real clock times, so that the length of a feed is something I
state rather than something I calculate.

## What to build

The rule set Task 0072 applied to sleep, applied to feeding: `app/feeding/manual.tsx` and
`app/edit/feeding.tsx` take a **start time** and an **end time**, with duration shown as a derived
read-only readout, built on the shared start/end form section Task 0072 extracted.

The form's shape is settled and drawn in
[`plans/decision-maps/unified-timer-contract/prototypes/clock-time-entry-mock.html`](../decision-maps/unified-timer-contract/prototypes/clock-time-entry-mock.html).
Read it before implementing.

### Task 0072 is the executable reference

Task 0072's merged sleep implementation is the reference for this task, not merely its prose. Read
`src/components/StartEndTimeSection.tsx`, `app/sleep/manual.tsx`, `app/edit/sleep.tsx`, and their
component tests before changing feeding. Reuse `StartEndTimeSection` directly; do not create a
feeding-specific copy or duplicate its iOS/Android merge, dismiss, clamp, display, or live-bound
behavior.

Carry the sleep screens' caller-side pattern across with only feeding's policy substituted:

- provide stable bound callbacks so `Date.now()` is evaluated when the picker opens, while the
  shared Android callback remains stable across unrelated renders;
- keep the picker value inside the displayed range and ensure a fresh form and an edit whose stored
  `endedAt` is absent never render inert End pills or inverted bounds;
- keep a separate initialized baseline for change detection, so a display fallback for a missing
  endpoint does not make the edit dirty or rewrite stored times by itself; and
- write start, end, and derived duration only after an actual time edit, leaving non-time-only saves
  on their existing path.

`TimerLifecycleAdapter` is intentionally not the seam for this work. It adapts running-timer
storage, lock payloads, restoration, Live Activities, and stop-to-record construction. These manual
and saved-record edit screens continue to call their existing add/update context APIs. The timer
adapters and running-timer lifecycle remain unchanged.

### An end time appears only where a duration exists

This is the one place feeding differs from the other three types. **A bottle feed and a solids entry
are moments** and keep the single time picker they have — `app/feeding/manual.tsx` writes those with a
start alone, no `endedAt` and no `durationSeconds`. Only **breastfeeding** gains an End Time.

`app/feeding/manual.tsx` is the largest screen in this group and branches its save across breast,
bottle, and solids. Only the breast branch changes; the bottle branch's `amountMl` and the solids
branch are untouched, as are the volume chips those branches use. `QUICK_DURATIONS` of
`[5, 10, 15, 20, 30, 45]` and the `durationMinutes` state serve breastfeeding only and go with it.

`app/edit/feeding.tsx` recomputes `endedAt = startedAt + durationSeconds` on save today and holds a
`durationMinutes` state alongside `amountMl`. The minutes field and that derivation go for a breast
feed; a bottle record's edit screen keeps its single time and its volume.

### Bounds

Every bound is shown as the picker's own range, and none is a new number — each restates a validator
already shipped in `src/validators/feeding.ts`.

- Neither picker accepts a future value, which `validateFeedingStartTimeNotInFuture` already enforces.
- There is no floor in time.
- An end must be at least **one minute** after its start, restating the one-minute minimum
  `validateManualBreastfeeding` already imposes.
- The **two-hour** feeding cap survives on the derived value. Note that
  `decisions/resolved/009-clock-time-log-editing.md` names only the twenty-four-hour sleep cap and the
  sixty-minute pumping cap; feeding's own cap is `7200` seconds in `src/validators/feeding.ts` and is
  carried here on the same terms.
- The end picker offers `start + 1 minute` through the earlier of now and `start + 2h`; the start
  picker offers up to the earlier of now and `end - 1 minute`.
- Save stays disabled until the two times are a minute apart, on the breast branch only.

`validateManualBreastfeeding` takes `durationSeconds`, so it needs an **end-time-aware entry point**
reached with a duration derived from two times rather than typed. Its thresholds do not change.
`validateManualBottleFeeding` is untouched.

### What a save writes

Both forms prefill Start and End from the record's **own stored timestamps**, so a breast feed's real
end is shown for the first time.

The stored `durationSeconds` is rewritten as `end - start` **only when the caregiver actually changed
one of the two times**. A save that touched only a note, a side, or a volume leaves `durationSeconds`
and `endedAt` exactly as stored. That rule protects a feeding written before Task 0068, whose stored
length is smaller than its own interval because the old code subtracted `totalPausedMs`; the span is
recoverable from nowhere, since `totalPausedMs` never reaches a saved record. A deliberate time edit
converges such a record on its interval, because the caregiver has just stated what the interval is.

After Task 0068 every newly written feeding satisfies `durationSeconds === endedAt - startedAt`, so the
derived readout equals the stored length with nothing to explain. Legacy records are never backfilled.

### What this task does not wire

The duplicate and overlap check for feeding is a separate decision,
`decisions/resolved/019-interval-overlap-non-sleep.md`, which is planned after this cluster so the
check is wired into these screens' final shape once. `app/feeding/manual.tsx` and `app/edit/feeding.tsx`
run no duplicate check today and still run none after this task.

Nothing here reaches the widget, the Watch, or the Live Activity: every surface is a saved record in
the app. `src/utils/feeding-sessions.ts` merges breast feeds less than an hour apart from their
endpoints and re-derives from the saved row, so it needs no change.

### User-authorized sleep parity extension

During remediation of the feeding edit bounds, the same pre-existing failure was confirmed in Task
0072's sleep edit screen. A stored sleep shorter than one minute produced an inverted End picker
range, so both End controls were inert; the same record also could not receive a note-only or
type-only edit because Save revalidated its unchanged interval. This task now carries the settled
parity fix: clamp the sleep End minimum to its live maximum when no valid End value exists, validate
the interval only after an actual time edit, and otherwise preserve the stored timestamps and
duration exactly. Sleep retains its own 24-hour maximum.

### User-authorized moment-picker and edit cleanup

The restored bottle/solids Android picker retained two pre-existing mainline defects after the
parallel `SingleTimeSection` was removed: merging today's date into a late prior-day time could
produce a future moment, and merging a selected time preserved stale seconds and milliseconds. This
task now fixes those root behaviors in `app/feeding/manual.tsx` by clamping merged date/time values to
live `now` and normalizing time selections to minute precision. The feeding edit screen also derives
its breast time-change flags once and expresses non-breast Save eligibility without a literal
always-true branch.

## Implementation work

- [x] Use Task 0072's sleep screens and component tests as the executable template, reusing
      `StartEndTimeSection` directly and substituting only feeding's fields, validator, and two-hour
      cap. Do not change `TimerLifecycleAdapter` or any activity timer adapter.
- [x] Add an end-time-aware entry point to `validateManualBreastfeeding` in `src/validators/feeding.ts`
      reached with a duration derived from two times, leaving every threshold unchanged and
      `validateManualBottleFeeding` untouched.
- [x] Rebuild the breastfeeding branch of `app/feeding/manual.tsx` on the shared start/end form section
      from Task 0072: add End Time, remove `durationMinutes`, `durationInput`, and `QUICK_DURATIONS`,
      and derive the saved `durationSeconds` and `endedAt` from the two times.
- [x] Leave the bottle and solids branches as moment records with their single time picker, their
      volume input, and their existing save paths.
- [x] Rebuild `app/edit/feeding.tsx` on the shared section for a breast record: add Start Time and End
      Time, remove the minutes field and the `endedAt = startedAt + durationSeconds` derivation, and
      prefill both pickers from the record's own stored timestamps. A bottle record keeps its single
      time and its volume field.
- [x] Implement the conditional save: write `durationSeconds = end - start` only when a time actually
      changed, leaving `durationSeconds` and `endedAt` untouched on a note-only, side-only, or
      volume-only save.
- [x] Add the End Time label, the derived Duration label, and any new validation strings to all nine
      locale files under `src/i18n/locales/`, and remove keys the dropped chips and minutes field leave
      unused.
- [x] Component tests on both screens for a breast feed: the end picker offers `start + 1 minute`
      through the earlier of now and `start + 2h`, the start picker offers up to the earlier of now and
      `end - 1 minute`, the duration readout is derived and not editable, no minutes input and no
      quick-duration chips remain, and Save is disabled until the two times are a minute apart.
      `app/edit/feeding.tsx` has no component test today, so this is a new file.
- [x] Port the Task 0072 call-site regression proofs: a fresh manual form opens both End pickers, an
      edit with a recent start and no stored `endedAt` opens both End pickers without becoming dirty,
      and a picker opened after the screen has remained mounted receives a freshly evaluated `now`
      ceiling. Rely on `StartEndTimeSection` tests rather than duplicating its platform-internal tests
      in each feeding screen.
- [x] Component tests that a bottle feed and a solids entry show **no** End Time field and still save
      with a start alone.
- [x] A prefill test that a feeding whose stored `durationSeconds` is smaller than its own interval
      opens showing the real start and end rather than `start + duration`.
- [x] Save-rule tests: a save that changes only a note or a side leaves `durationSeconds` and `endedAt`
      unchanged, and a save that moves a time writes `end - start`.
- [x] A test that the two-hour feeding cap is rejected on save as well as bounded in the picker.
- [x] The Task 0068 edit-screen proof items: a feeding written after the counted-pause rule opens with
      a derived length equal to its stored length and no annotation, and one written before it opens
      showing its real interval while the Timeline row still shows the stored length, converging only
      when a time is edited and saved.
- [x] Apply the same legacy-interval recovery policy to `app/edit/sleep.tsx`: a stored sub-minute sleep
      opens both End pickers, accepts a note-only or type-only save without rewriting time fields, and
      still enforces the one-minute floor and 24-hour cap after a time edit.
- [x] Clamp restored Android bottle/solids date and time merges to live `now`, clear seconds and
      milliseconds after a time selection, and cover both behaviors through the manual screen.
- [x] Derive `startChanged`, `endChanged`, and `timeChanged` once in `app/edit/feeding.tsx`; preserve
      read-only non-breast Save behavior through an explicit type condition rather than `: true`.

## Acceptance criteria

- [x] A breast feed on `app/feeding/manual.tsx` and `app/edit/feeding.tsx` takes a start time and an
      end time, with a derived read-only duration and no minutes input or quick-duration chips.
- [x] A bottle feed and a solids entry keep their single time picker and gain no end time.
- [x] Both screens prefill from the record's own stored timestamps, so a legacy paused feeding opens
      showing its real interval.
- [x] Every bound is the picker's own range: no future value, end at least a minute after start, the
      two-hour cap honored, and Save disabled until the two times are a minute apart.
- [x] `durationSeconds` is rewritten as `end - start` only when a time actually changed; a note-only,
      side-only, or volume-only save leaves the stored length exactly as it was.
- [x] A feeding written after Task 0068 opens with a derived length equal to its stored length and no
      annotation; one written before opens showing its real interval and converges only on a saved time
      edit.
- [x] No duplicate or overlap check is added on either screen.
- [x] Feeding reuses Task 0072's shared time section and caller pattern; it introduces no parallel
      picker implementation and makes no running-timer adapter change.
- [x] No schema change and nothing reaching the widget, the Watch, or the Live Activity.
- [x] A stored sub-minute sleep has operable End controls and preserves its stored interval on a
      non-time save; changing either time must satisfy the existing sleep limits.
- [x] Android bottle/solids moment edits cannot merge into the future and save exactly the displayed
      minute, while feeding edit change detection has one source of truth.

## Non-goals

- Sleep except for the user-authorized legacy-interval parity fix above; pumping and tummy time remain
  Tasks 0072 and 0075.
- Wiring the duplicate or overlap check for feeding, which is
  `decisions/resolved/019-interval-overlap-non-sleep.md`.
- An end time on a bottle feed, a solids entry, a diaper, or a growth measurement.
- Any change to pause accounting, settled by Task 0068, or backfilling records written before it.
- Changing the bottle volume input, the volume chips, or the feeding-type filter.
- Changing the running timer's bounds or its clamp, which is Task 0071.
- Any schema change.

## Review decisions

- skipped (minor): TR-11 — No test proves the required one-minute Save-disabled gate on either screen — User requested remediation focus on TR-1 through TR-10.
- skipped (minor): TR-12 — Edit-screen no-minutes and no-chip assertions are vacuous — User requested remediation focus on TR-1 through TR-10.
- skipped (minor): TR-13 — Counted-pause derived-length test cannot prove equality with stored length — User requested remediation focus on TR-1 through TR-10.
- skipped (minor): TR-14 — Edit End-ceiling test does not prove a fresh `now` value — User requested remediation focus on TR-1 through TR-10.
- skipped (minor): TR-15 — Feeding clock-time behavior is absent from README.md — User requested remediation focus on TR-1 through TR-10.
- skipped (minor): TR-16 — Reversed manual times surface the minimum-duration error instead of end-before-start — User requested remediation focus on TR-1 through TR-10.
- fixed after follow-up: TR-17 — Android single-time merge preserves stale seconds and milliseconds — User later authorized the root fix in the restored manual picker.
- skipped (minor): TR-18 — Disabled-button press assertion does not exercise save-path rejection — User requested remediation focus on TR-1 through TR-10.
