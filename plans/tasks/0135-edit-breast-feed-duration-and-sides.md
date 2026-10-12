# Task 0135: Edit and log a breast feed with duration and minutes per side

**Branch**: `feature/edit-breast-feed-sides`
**Depends on**: 0132
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-12 · **Mock**: `docs/design/edit-breast-feed.html` · **User stories**: a mother opens a 6-minute feed with 3 minutes paused, sees left 5 and right 1, lowers the duration to 3, is told left no longer fits, sets left to 2 and saves.

## What to build

The breast feed edit form becomes, top to bottom: Start, Duration, a quiet line "Paused 3m · ends 1:09 PM", Minutes per side (Left, Right), Finished on (Left / Right / Both), Notes, Save. Build it exactly as the "Decided" frames in `docs/design/edit-breast-feed.html` show, including the error state. The manual breast log form gets the same Duration and Minutes per side fields; its line reads only "ends 1:09 PM" because a manual entry has no pause.

| Field | Editable | Value |
| --- | --- | --- |
| Start | yes | timestamp; moving it slides the entry, nothing else changes |
| Duration | yes, whole minutes, at least 1 | saved duration |
| Paused | no | saved `pausedSeconds`; text absent when 0 |
| End | no | Start + Duration + Paused |
| Left, Right | yes, whole minutes, blank allowed | saved side seconds |
| Finished on | yes | saved `lastFinishedSide` |

| Input | Result |
| --- | --- |
| Left or Right greater than Duration | that field marked, message "Left can't be longer than the feed (3m)", Save disabled |
| Left + Right greater than Duration, each alone fits | allowed ("Both" counts time twice) |
| Both side fields blank | saved with no side seconds |
| Duration lowered | side fields keep their values; the rule above decides |
| Start moved | Duration, sides and Paused unchanged; End follows |
| Bottle or solids entry | form unchanged |

Saving never resets the sides to zero (today any time change does).

## Decided

- Start plus durations, End derived. — Owner decision 2026-10-12, after comparing with other trackers; it removes every case where start, end, pause and sides could disagree.
- Sides never change on their own. — Owner decision; the app must not guess which side to cut.
- Pause is shown, never edited. — Owner decision; it is a recorded fact.

## Clarifications

## Non-goals

- Pumping (Task 0136) and tummy time (Task 0137).
- Sleep edit screen.
- Auto-shrinking sides.
- Editing the pause.

## Context

The shared start/end section currently derives duration from the two pickers and bounds each picker; this form stops using an End picker for breast feeds, so a duration number field and a derived end line are needed in its place. The feed's `lastFinishedSide` is what the side picker already edits. The mock's "Today" column and green bars are explanation, not design.

## Implementation work

- [ ] The breast edit form renders the fields, order, labels and paused/ends line from the mock, hiding the "Paused" text when 0 — proven in `app/edit/feeding.component.test.tsx`
- [ ] Every row of the input table behaves as stated, including the exact error text and disabled Save — proven in `app/edit/feeding.component.test.tsx`
- [ ] Saving writes duration, sides, finished side and end as the field table defines and never zeroes sides — proven in `app/edit/feeding.component.test.tsx`
- [ ] The manual breast log offers Duration and Minutes per side with the same rules and the "ends" line — proven in `app/feeding/manual.component.test.tsx`
- [ ] All nine locales carry the new strings — proven in a new per-feature locale test under `src/i18n/`, like the existing ones there

## Acceptance criteria

- [ ] The rendered forms match the "Decided" frames of `docs/design/edit-breast-feed.html` in text, order, colour and placement.
- [ ] `npm run check:code` passes.
