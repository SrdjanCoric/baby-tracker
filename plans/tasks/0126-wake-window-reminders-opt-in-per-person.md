# Task 0126: Send wake-window and bedtime reminders only to people who turned them on

**Branch**: `feature/wake-window-reminders-per-person`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/notifications.md`) · **User stories**: mom turns on wake-window reminders and gets them; dad, who never turned them on, gets none.

## What to build

Wake-window and bedtime reminders become a personal choice. The baby's sleep settings (day start, day end, nap count, wake windows) stay shared.

| Situation | Who gets the reminder |
| --- | --- |
| Mom turned reminders on for Mia; dad didn't | Mom's devices only |
| Both turned them on | Both |
| Mom turned them on, then off | Nobody |
| Mom turned them on for Mia but not Leo | Mom, for Mia only |
| A member of another household | Never |
| A sleep timer is running for the baby | Nobody (today's rule) |

Existing data: whoever's choice is stored today keeps reminders on for that baby, decided in the checkpoint below.

## Decided

- My settings control my phone. — Owner decision 2026-10-08.
- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.

## Clarifications

## Non-goals

- Quiet hours, privacy toggles and push language on server pushes (separate future work).
- Feeding reminders (already per person).

## Context

Today the on/off switch is stored per baby in the shared wake-window settings, and the due-reminders query joins every household member with a push token. So once anyone turns it on, everyone gets it. The scheduled function and the edge function `check-wake-window-reminders` have no tests.

## Implementation work

- [ ] The on/off choice is stored per person per baby; the shared baby settings keep the rest — proven in a new `scripts/sql/wake-window-reminder-tests.sql`
- [ ] Due reminders go only to the people in the table — proven in `scripts/sql/wake-window-reminder-tests.sql`
- [ ] The settings screen turns reminders on and off for the current person only — proven in the sleep settings component test
- [ ] Existing data is migrated as decided — proven in `scripts/sql/wake-window-reminder-tests.sql`

## Human checkpoints

- [ ] [decision] Existing households where reminders are on: keep them on for every current member, or only for the owner? (`talk-it-through`)
- [ ] [confirm-db] New migration moving the on/off choice to per person.

## Acceptance criteria

- [ ] `npm run test:sql:setup && npm run test:sql` passes and includes the new file.
- [ ] `npm run check:code` passes.
- [ ] `docs/usage/notifications.md`: the reminders `[Bug]` line is removed.
