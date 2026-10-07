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

- [x] Every row of the table holds for each activity table the function serves — proven in
      `src/__tests__/activity-notification-push.test.ts`.

## Human checkpoints

- [ ] [confirm-db] Owner deploys the updated `send-activity-notification` to production, then
      confirms a just-logged diaper still notifies the other caregiver.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.

## Implementation evidence

- Classification: `code`; validation tier: `canonical`; TDD applicable: `true`.
- Added the age check after existing tombstone and missing-identity checks, before database or
  push work. A strictly greater-than-60-minute age returns and logs `past activity`.
- Timestamp columns derive from the current activity-table schema (migrations 001 and 040):
  feeding, sleep, pumping, and tummy-time `ended_at`/`started_at`; diaper `changed_at`; growth
  `measured_at`. No insertion/update timestamp fallback was added.
- Follow-up approved by the owner: extract the age rule and move its case matrix to direct tests;
  use one timestamp-column map to define the allowed tables; name the limit and explicitly keep
  unreadable timestamps; explain historical-import suppression; log skipped time and age; remove
  machine-local log paths from durable evidence.
- `src/__tests__/fixtures/activity-notification-webhooks.json` contains 24 synthetic PostgreSQL
  webhook payloads, covering past, boundary, recent, and future times for all six tables.
  Generated using read-only local Supabase queries with UTC timezone, `jsonb_populate_record`
  against each actual table type, and `jsonb_build_object('old_record', NULL, 'record', r,
  'type', 'INSERT', 'table', <table>, 'schema', 'public')`. This mirrors the installed local
  `supabase_functions.http_request()` producer, whose definition was inspected. The database
  serializes TIMESTAMPTZ values as offset strings such as `2026-10-07T10:59:59.999+00:00`.
  These fixtures pass through request JSON into the registered handler and its iOS/Android
  delivery paths; they contain no existing database records.
- TDD RED: 16 past-activity cases sent two notifications instead of skipping; 82 compatibility
  cases passed. GREEN: all 98 original cases passed after the check. Added 14 compatibility
  cases for recent start-only records and the inside-boundary millisecond, bringing coverage
  to 112 cases across all six served tables. The extraction preserved this green behavior before
  moving age cases into direct tests. Removing diagnostic metadata made six logging expectations
  fail; restoring it returned them to green.
- Focused validation: `npm run test:unit -- src/__tests__/activity-notification-push.test.ts
  src/__tests__/security/` passed (16 files, 280 tests, including 150 activity cases).
  `npx eslint src/__tests__/activity-notification-push.test.ts
  supabase/functions/send-activity-notification/activity-age.ts --max-warnings=0` passed.
  `npx tsc --noEmit --skipLibCheck --target es2022 --module esnext
  supabase/functions/send-activity-notification/activity-age.ts` passed.
  `git diff --check` passed.
- The Docker-backed `npm run check` acceptance criterion remains unchecked for finish-task's
  canonical validation. The owner production-deployment checkpoint remains unchecked.
- Decisions, clarifications, unrequested additions, and discovered out-of-scope work: none.
- Ready for manual task-review; task status remains in progress until the later lifecycle steps.
