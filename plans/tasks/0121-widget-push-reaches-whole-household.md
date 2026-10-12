# Task 0121: Send widget pushes to the whole household, including the starter, and no one else

**Branch**: `feature/widget-push-recipients`
**Depends on**: 0094
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/cross-device-isolation.md`) · **User stories**: mom starts a sleep, dad stops it; mom's widget refreshes too. Another family's widgets never get our pushes.

## What to build

When a timer starts or stops, the widget push goes to every push token of every member of that baby's household.

| Recipient | Gets the widget push? |
| --- | --- |
| A member of the household, not involved | Yes |
| The person who started the timer, when someone else stopped it | Yes |
| The person who stopped it | Yes (their other devices refresh too) |
| A member of another household | Never |
| A user with no household | Never |
| A token with no device token | Skipped |

Recipients are checked against a real local database.

## Decided

- Today the starter is skipped on a stop; that is a bug. — Owner rule: any stop reaches every device in the household.
- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.

## Clarifications

## Non-goals

- Pushes for pause, resume and start-time edits (none exist today; separate future work).
- Activity notifications (separate task).
- Live Activity push-to-start.

## Context

Push recipient tests today use a fake database that returns the same rows whatever the filters are. A break-it run made widget pushes go to every user and every test still passed. Reading the code shows the starter is excluded on stops. Local Supabase runs through `npm run check`; one live-database test already exists (`test:realtime`).

## Implementation work

- [ ] Widget push recipients for start and stop follow the table, checked against a real local database — proven in a new live-database test file run by `npm run check`
- [ ] The starter's devices get the push when another member stops the timer — proven in the same file
- [ ] The fast handler test fails when recipients are filtered wrongly — proven in `src/__tests__/widget-push-handler.test.ts`

## Acceptance criteria

- [ ] `npm run check` passes and runs the new live test.
- [ ] Removing the household filter from the widget push makes the live test fail (checked by hand once, then reverted).
- [ ] `docs/usage/cross-device-isolation.md`: the "starter's widget gets no refresh push" `[Bug]` line is removed.
