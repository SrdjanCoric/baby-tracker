# Task 0127: Keep each baby's running timer on that baby's card

**Branch**: `feature/keep-baby-timer-lock-on-own-card`
**Depends on**: 0119
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/test-audit.md`, `docs/usage/timers.md`) · **User stories**: parents of twins see Leo's running sleep only on Leo's card; tapping Stop on Mia's card never stops Leo's timer.

## What to build

In a household with two or more babies, a running timer lock (the server record that says "this baby has this timer running, started by this person") belongs to exactly one baby.

| Situation | Result |
| --- | --- |
| A live update says baby B's timer started, changed or stopped while baby A is selected | Nothing on A's Home cards changes. |
| Baby A is selected and only baby B has a running lock of a type | A's card for that type shows no running timer. |
| Baby A and baby B both have a running lock of the same type | A's card shows A's lock; B's card shows B's when B is selected. |
| Stop, pause or resume pressed on A's card | Only A's lock is affected. B's lock is untouched. |
| A live update has no baby id | It changes nothing on any card. |

## Decided

- A test that exposes a real bug here means this task fixes the bug too. — Owner decision: test and fix ship together so the branch merges green.
- Every household member is equal: any member's lock shows on the matching baby's card for everyone. — Owner decision, `docs/usage/household.md`.

## Clarifications

## Non-goals

- Switching babies while timers run (the "Stop & Switch" dialog). Separate task.
- Guest mode. Separate task.
- Lock Screen Live Activities. Separate task.

## Context

A break-it run removed the baby check from the live-update handler and from the lock lookup in the timer-lock provider. No test failed, because every existing test uses a single baby. The code is believed correct today; this task proves it.

## Implementation work

- [ ] A live update for another baby's lock never changes the selected baby's cards, for start, change and stop — proven in `src/contexts/active-timers-realtime.component.test.tsx`
- [ ] Looking up the running lock for an activity returns only the selected baby's lock when two babies hold the same type — proven in `src/contexts/active-timers-realtime.component.test.tsx`
- [ ] Stop, pause and resume on one baby's card act only on that baby's lock — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] Any bug these tests expose is fixed in the same change.

## Acceptance criteria

- [ ] Removing either baby check in the timer-lock provider makes at least one new test fail (checked by hand once, then reverted).
- [ ] `npm run check:code` passes.
