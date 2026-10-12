# Task 0137: Show paused time on the tummy time edit screen

**Branch**: `feature/tummy-time-edit-paused-line`
**Depends on**: 0132
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-12 · **Mock**: `docs/design/edit-tummy-time.html` · **User stories**: a parent opens a 12-minute tummy time with 2 minutes paused and sees 10 minutes with "Paused 2m" under it; moving End earlier cannot make the session shorter than a minute.

## What to build

The tummy time edit form keeps Start and End as editable pickers. Duration becomes End − Start − Paused, read-only. Directly under Duration a quiet grey line shows "Paused" with the value right-aligned, exactly as `docs/design/edit-tummy-time.html` shows; the line is absent when the saved pause is 0, which is every manual entry.

| Edit | Result |
| --- | --- |
| End moved | Duration recomputed; End picker cannot go below Start + Paused + 1 minute |
| Start moved | Duration recomputed; Start picker cannot go above End − Paused − 1 minute |
| Entry with no pause | form looks as today except Duration is the saved value |
| Save | writes start, end and duration = End − Start − Paused; pause unchanged |

## Decided

- Tummy time keeps Start and End; no sides, no editable duration. — Owner decision 2026-10-12.
- Pause is shown, never edited. — It is a recorded fact.

## Clarifications

## Non-goals

- Breast feed and pumping forms (Tasks 0135, 0136).
- Sleep edit screen.
- Manual tummy time log (no pause to show).

## Context

The shared start/end section derives its duration from the two pickers and accepts bounds for each; it needs to subtract a pause and show the line. Sleep uses the same section and must not change.

## Implementation work

- [ ] The tummy time edit form shows the corrected Duration and the paused line from the mock, absent when 0 — proven in `app/edit/tummyTime.component.test.tsx`
- [ ] Picker bounds keep Duration at least one minute above zero with the pause included — proven in `app/edit/tummyTime.component.test.tsx` and `src/components/StartEndTimeSection.component.test.tsx`
- [ ] Saving writes duration = End − Start − Paused and leaves the pause unchanged — proven in `app/edit/tummyTime.component.test.tsx`
- [ ] The sleep edit form is unchanged — proven in `app/edit/sleep.component.test.tsx`

## Acceptance criteria

- [ ] The rendered form matches the "Decided" frame of `docs/design/edit-tummy-time.html` in text, order, colour and placement.
- [ ] `npm run check:code` passes.
