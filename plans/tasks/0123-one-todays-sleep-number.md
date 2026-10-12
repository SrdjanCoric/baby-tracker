# Task 0123: Show the same "today's sleep" on Home, the widget and Statistics

**Branch**: `feature/one-todays-sleep-number`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/stats-and-timeline.md`) · **User stories**: a parent checks today's sleep on the Home card, the widget and the Statistics Day view and sees the same number.

## What to build

"Today's sleep" for the selected baby is one number, computed one way, everywhere it shows: Home sleep card, iPhone widget, Statistics sleep Day view.

| Rule | Behavior |
| --- | --- |
| Which day | The baby's sleep day: from its day-start hour (sleep settings, default 06:00) to the same hour next day. |
| Sleep crossing day start | Only the part inside today's sleep day counts. |
| Sleep crossing midnight only | Counts on the sleep day it belongs to. |
| Overlapping sleeps | Counted once. |
| Running sleep | Counts up to now, or up to its pause. |
| No sleeps today | 0. |

## Decided

- Sleep uses the baby's day start on every screen. — Owner decision 2026-10-08.
- Overlapping sleeps count once everywhere; a running sleep counts. — Owner decision 2026-10-08.

## Clarifications

## Non-goals

- The PDF report's sleep totals and the Week view's overlap double-count (separate future work).
- Feeding, diaper, pumping and tummy totals.

## Context

Today Home clips to the sleep day but doesn't merge overlaps and leaves the running sleep out; the widget counts from midnight, by full length, without merging. Home's test swaps in fixed numbers, and the sleep-flow integration test checks its own copy of the code. Three planted bugs in these totals went uncaught.

## Implementation work

- [ ] One today's-sleep calculation follows the table — proven in a new unit test next to it
- [ ] The Home sleep card shows that number — proven in `app/(tabs)/index.component.test.tsx`
- [ ] The widget data carries that number — proven in `src/contexts/widget-context.component.test.tsx`
- [ ] One tricky fixture (overlap, crossing day start, running sleep) gives the same number on Home, the widget and the Statistics Day view — proven in the new unit test

## Acceptance criteria

- [ ] `npm run check:code` passes.
- [ ] `docs/usage/stats-and-timeline.md`: the widget day-start `[Bug]` line is updated to cover only the PDF.
