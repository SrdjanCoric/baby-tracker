# Task 0110: Do not notify caregivers about activities that ended over an hour ago

**Branch**: `feature/no-push-for-past-activities`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-07 (planning app imports) · **User stories**: when a caregiver
imports months of history, the other caregivers do not get one notification per imported record.

## What to build

The activity notification function (`send-activity-notification`, called by the production
database webhook for each new activity record) decides whether to push to the other caregivers with
this table. "Activity time" is the record's end time when it has one, else its single time (start,
change, measurement, or log time, by record type).

| Record | Result |
| --- | --- |
| Tombstoned (deleted) | No push (unchanged) |
| Missing baby or logger | No push (unchanged) |
| Activity time more than 60 minutes before the function runs | No push; logged as skipped "past activity" |
| Activity time missing or unreadable | Push as today |
| Activity time within the last 60 minutes, or in the future | Push as today |

Everything else the function does is unchanged.

## Decided

- Activities that ended more than an hour ago do not notify — owner, 2026-10-07, chosen over
  marking imported records, which would change every activity table.
- A night sleep stopped now notifies, because its end time is recent.
- No agent deploys to production; the owner deploys the function before any build containing app
  import is submitted.

## Clarifications

## Non-goals

- The webhook configuration, which lives outside the repository.
- Feeding, wake-window, timer, and Live Activity pushes.

## Context

Migration 012 replaced the activity insert triggers with database webhooks configured in the
Supabase dashboard. The function already skips tombstoned records and sends only to caregivers with
activity notifications enabled. Without this rule, importing 3,600 records would send up to 3,600
pushes to each such caregiver. Accepted side effect: a record saved more than an hour after the
activity ended (late hand entry, or a phone that was offline) no longer notifies.

## Implementation work

- [ ] Every row of the table holds for each activity table the function serves — proven in
      `src/__tests__/activity-notification-push.test.ts`.

## Human checkpoints

- [ ] [confirm-db] Owner deploys the updated `send-activity-notification` to production, then
      confirms a just-logged diaper still notifies the other caregiver.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.
