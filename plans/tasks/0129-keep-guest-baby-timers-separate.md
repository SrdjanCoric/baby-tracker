# Task 0129: Keep guest-mode timers on the right baby

**Branch**: `feature/guest-baby-timers-separate`
**Depends on**: 0128
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/timers.md`, Multiple babies) · **User stories**: a parent using the app without an account, with twins, never sees Mia's timer on Leo's card and never saves Mia's sleep under Leo.

## What to build

Guest mode (no account, data only on the phone, no server lock) follows the same per-baby rules as signed-in use.

| Situation (guest) | Result |
| --- | --- |
| A's timer runs, switch to B, B has no timer | B's cards show no timer. A's timer keeps running. |
| Stop on B's card after switching | Only a timer that belongs to B can be stopped there; nothing is saved under B with A's start time. |
| A→B→A with timers on both | Both keep running; each stops and saves under its own baby. |
| Reopen the app | Each baby's timer comes back on its own baby. |

## Decided

- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.

## Clarifications

## Non-goals

- Signed-in switching (done in the previous task).
- Turning a guest into an account.

## Context

Guest timers skip the server-lock check, so when the new baby has no timer nothing clears the old baby's timer from the screen. Stopping it then saves a B entry with A's start time. Found by reading code; no test covers it. The existing guest test asserts the switch but not that B's timer is empty.

## Implementation work

- [ ] After a guest switches to a baby with no timer, that baby shows no timer and the other baby's timer keeps running — proven in `src/__tests__/activity-provider-baby-binding.integration.test.tsx`
- [ ] A guest stop on B never saves an entry for B from A's timer — proven in `src/__tests__/activity-provider-baby-binding.integration.test.tsx`
- [ ] Guest A→B→A keeps both timers, each saved under its own baby on stop, for each timer type — proven in `src/__tests__/activity-provider-baby-binding.integration.test.tsx`
- [ ] Any bug these tests expose is fixed in the same change.

## Acceptance criteria

- [ ] The guest switch test fails on `main` before the fix and passes after.
- [ ] `npm run check:code` passes.
- [ ] `docs/usage/timers.md`: the guest `[Bug]` line is removed.
