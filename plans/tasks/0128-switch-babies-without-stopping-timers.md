# Task 0128: Switch babies without stopping their timers

**Branch**: `feature/switch-babies-keep-timers`
**Depends on**: 0127
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/timers.md`, Multiple babies) · **User stories**: a signed-in parent of twins starts Mia's sleep, switches to Leo, starts Leo's sleep, switches back, and finds Mia's sleep still running with the right time.

## What to build

A signed-in user with two or more babies can switch the selected baby at any time. Switching never stops, pauses or clears any timer.

| Situation | Result |
| --- | --- |
| Switch babies while any timer runs | Switch happens at once. No dialog. Every timer keeps running. |
| Start sleep on A, switch to B, start sleep on B, switch back to A | A's sleep shows as running with elapsed time counted from its real start. B's sleep keeps running. |
| Back on A, pause, resume or stop A's sleep | Works. B's timer is unaffected. A's stop saves one entry under A. |
| Switch to a baby that has no running timer | That baby's cards show no timer. The other baby's timer is untouched in local storage and on the server. |
| Start a timer on A after switching away and back | Never fails with "locked by" the same user. |
| Close and reopen the app with both timers running | Both come back, each on its own baby. |

All four timer types (feeding, sleep, pumping, tummy time) behave the same.

## Decided

- Switching babies keeps every timer running; the "Stop & Switch" dialog is removed. — Owner decision 2026-10-08.
- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.

## Clarifications

## Non-goals

- Guest mode (no account). Separate task.
- Lock Screen Live Activity behavior on switch. Separate task.
- Watch switching babies (accepted limitation).

## Context

Reading the code suggests that on a switch the check that compares the stored timer with the server lock runs with the new baby but the old baby's timer, decides the timer is gone, and clears it. The lock stays on the server, so restarting fails with "locked by" yourself until the app reopens. No test runs two babies' timers; a break-it run that made all babies share one timer slot failed only tests that check storage key names.

## Implementation work

- [ ] Selecting another baby while timers run switches at once and stops nothing — proven in `src/components/BabySelector.component.test.tsx`
- [ ] A→B→A with sleep running on both keeps both running, with correct elapsed time, for each timer type — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] After switching back, pause, resume and stop on A work and save one entry under A only — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] Switching to a baby with no timer leaves the other baby's stored timer and server lock untouched — proven in `src/services/timer-lifecycle.test.ts`
- [ ] Restoring after reopen brings back both babies' timers on the right babies — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] Two babies' stored timers of the same type are independent — proven in `src/services/sleep-storage.test.ts` and `src/services/pumping-storage.test.ts`

## Acceptance criteria

- [ ] The A→B→A test fails on `main` before the fix and passes after.
- [ ] `npm run check:code` passes.
- [ ] `docs/usage/timers.md`: the "Stop & Switch" and "switching can wipe" `[Bug]` lines are removed and the matching `[Decided]` lines are ticked with their test.
