# Task 0134: Freeze the running readout over a pause for breast feeding, pumping and tummy time

**Branch**: `feature/freeze-non-sleep-readout-over-pause`
**Depends on**: 0132
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-12 · **User stories**: a mother pauses nursing at 1:00, changes a diaper for 3 minutes, resumes; the timer shows 1:00 while paused, continues from 1:00 on resume, and every surface agrees.

## What to build

For a running breast feeding, pumping or tummy time timer, every readout shows what stopping right now would save under Task 0132: time since start minus every resumed pause. While paused the number stands still at the pause moment. On resume it continues from that value. Sleep keeps today's behaviour: frozen while paused, then jumping forward on resume to include the pause.

| Surface | Breast, pumping, tummy time | Sleep |
| --- | --- | --- |
| Timer screen elapsed | start → now, minus resumed pauses | unchanged |
| Home card elapsed | same | unchanged |
| Lock Screen Live Activity on the starter's phone | same, after pause, resume and app restart | unchanged |
| Live Activity on other members' phones (server push) | same | unchanged, including the known shift the server push still applies |
| Widget tile | same | unchanged |
| Watch | same | unchanged |
| Start time shown on the screen | the real start, never shifted | unchanged |

The readout and the saved entry never disagree by more than the second that ticks between reading and stopping.

## Decided

- Readout equals what a stop would save, per type. — The rule Task 0069 set, now applied to two rules instead of one.
- The start time shown stays the real start. — Shifting the start to fake a frozen elapsed value was removed in Task 0069 and stays removed.
- Sleep surfaces are not touched, including the server-push shift listed as a bug in `docs/usage/timers.md`. — Out of scope; separate task if wanted.

## Clarifications

## Non-goals

- Sleep in any way.
- Edit screens.
- Changing how the widget or Watch send pause spans; only how the three types consume them.

## Context

Every running surface computes elapsed from the real start and, for a paused timer, from the pause moment; the widget and Watch send a pause span and an accumulated value with each pause or resume. The server function that pushes Live Activities to other household members shifts the start by the pause total for all types today. Tests for the three types currently assert "counts the paused span after resume" on each screen and must flip; the sleep tests stay.

## Implementation work

- [ ] The three timer screens freeze while paused and continue from the frozen value after resume; sleep still counts the pause — proven in `app/feeding/index.component.test.tsx`, `app/pumping/index.component.test.tsx`, `app/tummyTime/index.component.test.tsx`, `app/sleep/index.component.test.tsx`
- [ ] The Home card shows the same number as the screen for all four types — proven in `src/components/DashboardCard.component.test.tsx`
- [ ] The starter's Live Activity shows the frozen-then-continued value across pause, resume and app restart for the three types — proven in `src/services/live-activity-service.test.ts` and `src/__tests__/native/native-resume-real-start.test.ts`
- [ ] Pause and resume arriving from the widget or the Watch produce the same value as a tap on the phone, for the three types — proven in `src/contexts/widget-context.component.test.tsx` and `src/hooks/useWatchMessageHandler.component.test.tsx`
- [ ] The server push for other members' Live Activities follows the per-type rule — proven in a new `supabase/functions/send-widget-push/live-activity.test.ts`

## Acceptance criteria

- [ ] Every surface in the table has a passing test for at least one of the three types and for sleep.
- [ ] `npm run check:code` passes.
