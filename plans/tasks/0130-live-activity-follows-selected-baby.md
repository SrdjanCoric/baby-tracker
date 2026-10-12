# Task 0130: Make the Lock Screen timer follow the selected baby

**Branch**: `feature/live-activity-follows-selected-baby`
**Depends on**: 0128, 0094
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/timers.md`, Lock Screen) · **User stories**: a parent of twins with both babies sleeping sees the selected baby's sleep on the Lock Screen; stopping one baby's sleep never removes the other baby's Lock Screen timer.

## What to build

On iPhone, the Live Activity (Lock Screen and Dynamic Island timer) shows the selected baby's running timer of each type.

| Situation | Result |
| --- | --- |
| A's sleep runs, switch to B, start B's sleep | Lock Screen shows B's sleep. A's sleep keeps running in the app and on the server. |
| Switch back to A | Lock Screen shows A's sleep. No flip-flop on later switches. |
| Stop A's sleep while B's sleep runs | A's Live Activity ends. B's timer and, when B is selected, B's Live Activity are untouched. |
| A stop cannot find the Live Activity by its id | Nothing ends for any other baby. |
| Selected baby has no running timer of that type | No Live Activity for that type. |

## Decided

- One Live Activity per type, following the selected baby. — Owner decision 2026-10-08 (simpler than one per baby).
- Live Activities have no buttons; tapping opens the app. — Current design, unchanged.
- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.

## Clarifications

## Non-goals

- One Live Activity per baby at the same time.
- Push-to-start for other members (its own task).
- Android ongoing notifications.

## Context

Today starting B's sleep ends every other sleep Live Activity, and the stop fallback ends Live Activities by type for every baby. Four existing assertions expect the by-type fallback; they are wrong under the decided behavior and must be rewritten. The Swift selection helper is never tested with another baby.

## Implementation work

- [ ] Switching babies shows the selected baby's running timer on the Lock Screen and never stops the other baby's timer — proven in `src/services/timer-lifecycle.test.ts`
- [ ] Stopping one baby's timer never ends another baby's Live Activity, including when lookup by id fails — proven in `src/services/timer-lifecycle.test.ts` and `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] Choosing which Live Activity to keep considers the baby, not only the type — proven in `scripts/swift/live-activity-push-token-tests.swift`
- [ ] The existing assertions that expect ending by type for every baby are rewritten to the decided behavior — proven in the same files

## Human checkpoints

- [ ] [verify] On an iPhone with two babies: start A's sleep, switch to B, start B's sleep, switch back, stop A. · Expected: Lock Screen follows the selected baby; stopping A never removes B's running sleep. · Failure: Lock Screen shows the wrong baby or loses B. · Reason: Live Activities only render on a device.

## Acceptance criteria

- [ ] `npm run check:code` passes (includes the Swift tests).
- [ ] `docs/usage/timers.md`: the two Lock Screen `[Bug]` lines are removed.
