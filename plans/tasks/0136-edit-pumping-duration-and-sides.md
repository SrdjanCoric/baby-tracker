# Task 0136: Edit and log a pumping session with duration and minutes per side

**Branch**: `feature/edit-pumping-sides`
**Depends on**: 0133, 0135
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-12 · **Mock**: `docs/design/edit-pumping.html` · **User stories**: a parent opens a 20-minute pumping session with 5 minutes paused, sees left 12 and right 8, corrects right to 10 and saves.

## What to build

The pumping edit form becomes, top to bottom: Start, Duration, a quiet line "Paused 5m · ends 8:25 AM", Minutes per side (Left, Right), Finished on (Left / Right / Both), Amount (ml), Notes, Save. Build it exactly as the "Decided" frame in `docs/design/edit-pumping.html` shows. The side picker moves from the top of the form to below the minutes. The manual pumping log form gets the same Duration and Minutes per side fields; its line reads only "ends 8:25 AM".

The field rules and the input rules are the breast feed's from Task 0135, applied to the pumping entry's fields: Start slides the entry; Duration is whole minutes, at least 1; Paused is shown when above 0 and never edited; End is Start + Duration + Paused; Left and Right are whole minutes, blank allowed, each at most Duration, their sum unchecked; a side that no longer fits is marked with "Left can't be longer than the session (3m)" and Save is disabled; sides never change on their own; Finished on saves the entry's side.

Saving a pumping entry never clears its sides.

## Decided

- Pumping matches the breast feed form exactly, plus the Amount field. — Owner decision 2026-10-12.
- Reuse what Task 0135 built for the duration field, the paused/ends line and the side minute fields. — Two forms, one behaviour.

## Clarifications

## Non-goals

- Tummy time (Task 0137).
- Suggesting a next pumping side.
- Editing the pause.

## Context

Task 0133 gives pumping entries their per-side seconds and Task 0135 builds the field behaviour. The mock's "Today" column and green bars are explanation, not design.

## Implementation work

- [ ] The pumping edit form renders the fields, order, labels and paused/ends line from the mock, hiding the "Paused" text when 0 — proven in `app/edit/pumping.component.test.tsx`
- [ ] Every input rule behaves as on the breast feed form, with the pumping error text and disabled Save — proven in `app/edit/pumping.component.test.tsx`
- [ ] Saving writes duration, sides, finished side, end and amount, and never clears sides — proven in `app/edit/pumping.component.test.tsx`
- [ ] The manual pumping log offers Duration and Minutes per side with the same rules and the "ends" line — proven in `app/pumping/manual.component.test.tsx`
- [ ] All nine locales carry the new strings — proven in a new per-feature locale test under `src/i18n/`, like the existing ones there

## Acceptance criteria

- [ ] The rendered forms match the "Decided" frame of `docs/design/edit-pumping.html` in text, order, colour and placement.
- [ ] `npm run check:code` passes.
