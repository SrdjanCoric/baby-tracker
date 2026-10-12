# Task 0124: Prove leaving a household and removing a caregiver work on the server

**Branch**: `feature/test-leave-and-remove-caregiver`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/household.md`) · **User stories**: grandma leaves the family household and lands in her own empty one; the owner removes a caregiver who then can't see the baby.

## What to build

Server rules for leaving and removal, checked against the real database.

| Action | Result |
| --- | --- |
| A non-owner leaves | They move to a new, empty household they own. The old household, its babies and entries are unchanged. They can no longer read or write the old household's data. |
| The owner removes a caregiver | Same result for the caregiver. |
| A non-owner tries to remove someone | Refused. Nothing changes. |
| The owner tries to leave | Refused (today's behavior). |
| A member of another household tries to remove a caregiver | Refused. |
| A timer the leaving person started is running | It keeps running for the household; other members can still stop it. |

## Decided

- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.
- A removed caregiver's running timer stays with the household. — Owner decision 2026-10-08.

## Clarifications

## Non-goals

- Ownership passing on when the owner leaves (low priority, separate).
- What the removed person's phone shows afterwards.
- Account deletion (next task).

## Context

`leave_household` and `remove_caregiver` have no tests. The app-side tests mock the server, so the real rules are unproven. SQL tests run in `npm run check`.

## Implementation work

- [ ] Leave and removal follow the table — proven in a new `scripts/sql/household-membership-tests.sql`, run by `npm run test:sql`
- [ ] The leaving person's running timer survives and stays stoppable by other members — proven in the same file
- [ ] Any bug these tests expose is fixed in the same change.

## Acceptance criteria

- [ ] `npm run test:sql:setup && npm run test:sql` passes and includes the new file.
