# Task 0120: Prove a stop never touches another household's timer

**Branch**: `feature/stop-household-isolation`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/cross-device-isolation.md`) · **User stories**: a parent stops their baby's sleep from the Watch; another family's running sleep keeps running.

## What to build

Two households, each with a running sleep timer. Every way household A can stop, pause, resume or complete its timer leaves household B's timer exactly as it was.

| Action by a member of household A | Household A's timer | Household B's timer |
| --- | --- | --- |
| Stop through the app's normal path | Stopped, one entry saved | Running, unchanged |
| Stop through the Watch's backup path (phone unreachable) | Stopped | Running, unchanged |
| Stop from the widget | Stopped | Running, unchanged |
| Pause, resume | Paused, running | Unchanged |
| Same baby id guessed for B's baby | Refused | Unchanged |
| Two babies in household A, same type running; stop one | That baby's stopped | A's other baby and B unchanged |

The rules are checked against the real database access rules, not against fakes.

## Decided

- The database is the last line of defence; the app's own stop request must also name the baby. — Both layers are tested so one failing alone is caught.
- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.

## Clarifications

## Non-goals

- Push recipients (separate tasks).
- Realtime scoping (already tested live).

## Context

Every timer delete ends in the database. A break-it run removed the baby filter from the app's release and lock lookup queries; nothing failed, because the access rules are the only guard and their tests can't run without local Supabase. No existing SQL test sets up two households that both have a running timer. SQL tests run in `npm run check` (`test:sql:setup` then `test:sql`), which needs Docker.

## Implementation work

- [ ] Two households with running timers: each stop, pause, resume and completion path in A leaves B untouched — proven in a new `scripts/sql/household-timer-isolation-tests.sql`, run by `npm run test:sql`
- [ ] Two babies in one household with the same type running: stopping one leaves the other — proven in `scripts/sql/household-timer-isolation-tests.sql`
- [ ] The app's release and lock lookup requests always name the baby and timer type — proven in `src/services/active-timer-service.test.ts`
- [ ] Any bug these tests expose is fixed in the same change.

## Acceptance criteria

- [ ] `npm run test:sql:setup && npm run test:sql` passes and includes the new file.
- [ ] Dropping the baby filter from the app's release request makes a test fail (checked by hand once, then reverted).
- [ ] `npm run check:code` passes.
