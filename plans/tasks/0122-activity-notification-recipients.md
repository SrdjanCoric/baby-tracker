# Task 0122: Send activity notifications only to the other members who turned them on

**Branch**: `feature/activity-notification-recipients`
**Depends on**: 0121
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/notifications.md`) · **User stories**: dad logs a diaper; mom gets "Dad logged a diaper" if she turned it on; dad gets nothing; no other family gets anything.

## What to build

When a member logs an entry that notifies (feeding, sleep, diaper, pumping, growth, tummy time, not older than 1 hour), the push "{name} logged a {activity}" goes to:

| Recipient | Gets it? |
| --- | --- |
| Another member of the same household who turned activity notifications on | Yes |
| Another member who turned them off | No |
| The person who logged it | No |
| A member of another household | Never |

Recipients are checked against a real local database.

## Decided

- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.
- Which entries notify (types, 1-hour limit, no health, no deletions) stays as today. — Already tested.

## Clarifications

## Non-goals

- Quiet hours, privacy toggles and push language on server pushes (separate future work).
- Widget pushes (previous task).

## Context

A break-it run removed the household filter and the sender exclusion from the activity notification function; every test passed because the fake database ignores filters. Shares the live-database test setup created by the widget push task.

## Implementation work

- [ ] Activity notification recipients follow the table, checked against a real local database — proven in the live-database test file added by the widget push task, or a sibling file run by `npm run check`
- [ ] The fast handler test fails when recipients are filtered wrongly — proven in `src/__tests__/activity-notification-push.test.ts`

## Acceptance criteria

- [ ] `npm run check` passes and runs the new live test.
- [ ] Removing the household filter or the sender exclusion makes the live test fail (checked by hand once, then reverted).
