# Task 0057: Bind Live Activity identity to the timer, not the activity type

**Branch**: `feature/bind-live-activity-to-timer-identity`
**Depends on**: none
**Source**: Task 0052 native/sync audit, 2026-08-01 · **User stories**: a caregiver starting a timer sees the Dynamic Island count from that timer's start, not from an older one; ending a timer never dismisses a Live Activity that belongs to a different timer

## What to build

The native Live Activity controller keys activities by `activityType` in both directions, and the
JavaScript service passes no identity beyond the type:

- starting a timer first looks for an existing activity whose `activityType` matches and, if one is
  found, returns that activity's id instead of creating a new one;
- the by-type fallback used when id-based cleanup fails ends every activity of that type.

`TimerActivityAttributes` already carries `babyName`, and activity attributes are immutable once an
activity starts, so an adopted activity keeps the previous timer's `startTime`. The update path
carries the existing `effectiveStartTimeISO` forward rather than resetting it, so nothing corrects
the display afterward. The result, with a single baby on a single device: if any same-type activity
survives — a cleanup that failed, a push-to-start activity, a stale activity from an interrupted
timer — the next timer of that type adopts it and the Dynamic Island counts from the older start.

Twelve provider call sites across the feeding, sleep, pumping and tummy-time contexts reach the
by-type fallback.

Give the Live Activity a stable identity tied to the timer instance rather than to the activity type.
Prefer a stable identifier over a display name, since names are not unique. Starting a timer must
either reuse the activity belonging to that same timer or create a new one; ending by fallback must
narrow to that timer's activity.

Excluded: the widget's own relative-time ladder, which is Task 0059.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/10-definition-of-done.md`

- [ ] Cover the failure path — id-based cleanup returning false — not only the happy path.
- [ ] Keep the permanent regression test at the lowest reliable seam, per the bug-PR decision in the master plan.
- [ ] The tracked native source is the config plugin payload under `plugins/`, not the gitignored `ios/` prebuild output.

## Implementation work

- [ ] Add a stable timer identity to the Live Activity attributes and thread it through the start and end-by-type paths in the native controller and the JavaScript service.
- [ ] Change the start path so it reuses only an activity belonging to the same timer, and otherwise creates a new activity with the current start time.
- [ ] Narrow the by-type fallback at all four providers to the timer being completed.
- [ ] Add a provider-level regression test that forces id-based cleanup to return false and asserts the fallback targets only the completed timer's activity.
- [ ] Add a test that a newly started timer never adopts a surviving activity from an earlier timer of the same type, and that its displayed start is the new timer's start.
- [ ] Run `npm run test:unit` and `npm run test:component`.

## Human checkpoints

- [ ] [verify] Confirm the Dynamic Island on a physical device · Steps: start a feeding timer, force-quit the app so the activity survives, reopen and start a new feeding timer · Expected: the Dynamic Island counts from the new timer's start · Failure: it shows the earlier elapsed time, or the activity disappears while the timer is still running · Reason: Live Activity and Dynamic Island lifecycle cannot be proved in JavaScript tests or reliably in a simulator.

## Acceptance criteria

- [ ] Starting a timer never adopts an activity belonging to a different timer.
- [ ] The displayed elapsed time always derives from the running timer's own start.
- [ ] The by-type fallback ends only the completed timer's activity.
- [ ] A regression test forces the id-based cleanup failure and proves the narrowed fallback.
- [ ] The release owner has confirmed the Dynamic Island behavior on a device.
