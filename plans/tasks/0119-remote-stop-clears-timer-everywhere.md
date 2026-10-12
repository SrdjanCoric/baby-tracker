# Task 0119: Prove a stop on one device clears the timer on every household device

**Branch**: `feature/remote-stop-clears-everywhere`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/cross-device-isolation.md`) · **User stories**: dad stops the sleep on his Android phone; mom's iPhone card, her widget and her Watch all show the sleep as stopped.

## What to build

When another household member stops, pauses or resumes a timer, this phone reflects it everywhere it shows timers.

| Live update received on this phone | Home card | Widget data | Watch data |
| --- | --- | --- | --- |
| Another member's timer for the selected baby was stopped | No running timer | No running timer | No running timer |
| Another member paused it | Paused | Paused | Paused |
| Another member resumed it | Running | Running | Running |
| This phone started that timer and someone else stopped it | No running timer, no duplicate entry saved, local stored copy cleared | No running timer | No running timer |

"Widget data" and "Watch data" mean what the phone hands to the widget and the Watch, not their screens.

## Decided

- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.
- Stopping saves one entry, credited to whoever stopped it. — Owner decision, `docs/usage/timers.md`.

## Clarifications

## Non-goals

- Server pushes to widgets and Live Activities (separate tasks).
- The widget's and Watch's own Swift screens.
- Offline behavior.

## Context

A break-it run removed the step that drops a lock when a "timer deleted" live update arrives: the other caregiver's phone kept showing the timer running and no test failed. Removing the lock list from the widget data also went uncaught, and so did skipping the starter's local cleanup after a remote pumping stop. This is the owner's "Android stop doesn't reach the Watch" fear.

## Implementation work

- [ ] A remote stop, pause and resume live update change the Home card for the selected baby — proven in `src/contexts/active-timers-realtime.component.test.tsx`
- [ ] The same updates change the data handed to the widget and the Watch — proven in `src/contexts/widget-context.component.test.tsx`
- [ ] On the starter's phone a remote stop clears the stored timer and saves no entry, for each timer type — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] Any bug these tests expose is fixed in the same change.

## Acceptance criteria

- [ ] Removing the lock-drop step on a "timer deleted" update, or the lock list from the widget data, makes a new test fail (checked by hand once, then reverted).
- [ ] `npm run check:code` passes.
