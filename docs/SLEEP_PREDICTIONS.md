# Sleep Predictions

Sleep predictions use recent completed sleep sessions to estimate the next nap or bedtime. The prediction model, drift detectors, and dashboard card share the same morning resolver.

## Morning resolution

For a given calendar date:

1. The morning anchor is the configured day start minus 3 hours 3 minutes.
2. A completed sleep that starts before the anchor, crosses it, and ends no later than the reference time establishes the provisional morning wake.
3. A subsequent sleep that starts before day start is an automatic night continuation when its awake gap is less than or equal to the configured sleep-continuation allowance. The default allowance is 25 minutes, and caregivers can change it in Sleep Settings. The same allowance joins fragmented naps.
4. A subsequent pre-day-start sleep with a longer gap needs confirmation. The app saves or starts the sleep first, then asks whether it was the First nap or Back to sleep.
5. First nap keeps the provisional wake, stores the sleep as `nap`, and settles that morning. Back to sleep stores it as `night` and uses the sleep's end as the morning wake. A later pre-day-start sleep can require another answer when another gap exceeds the allowance.
6. Sleep that starts at day start or later remains automatic nap sleep.

Sleep duration does not decide the morning role. The resolver also ignores wake-window expectations, awake-to-sleep ratios, and how much of the sleep occurs after day start.

When no completed overnight sleep crosses the anchor, the first eligible early-window sleep keeps the legacy continuation behavior. For example, with a 09:00 day start, a sleep from 07:05 to 10:30 remains continuation when the prior overnight sleep ended at 05:53 and did not cross the 05:57 anchor.

Future sessions, deleted sessions, stale sessions from another morning, and sessions that begin in the evening do not qualify.

## Confirmation state

New sleep sessions carry versioned morning-classification metadata with one of these states:

- `automatic`
- `unresolved`
- `confirmed_first_nap`
- `confirmed_night_continuation`

The database columns are nullable so rows created before this feature remain distinguishable. Legacy rows are not backfilled and keep the morning behavior that existed when they were recorded. A row inserted by an older client receives version provenance from the database default, which lets a current client detect ambiguity without preventing the older client from recording sleep.

Unanswered questions persist in local storage and Supabase. The app presents the oldest one first, including its date and start time, and does not offer a dismiss action. Sleep timers and other activity tracking remain available. Widget and Watch sleep starts also remain available; the Watch can direct the caregiver to confirm on the phone.

A confirmation changes both the classification and the visible `nap` or `night` type in one local-first update. The durable queue sends both fields to Supabase, and Realtime applies the same result on other caregiver devices. An unrelated partial update from an older client omits the new fields and cannot clear a confirmed answer.

Changing the Nap/Night type later is an authoritative correction for an applicable morning sleep. The correction updates its confirmed classification so timeline, statistics, historical grouping, and predictions continue to agree.

## Prediction withholding

Any unresolved morning suppresses sleep predictions. Unresolved mornings are also excluded from model training and bedtime or morning drift detection. Other tracking remains available while an answer is pending.

Answering or correcting a question removes its unresolved state and recomputes the affected consumers immediately. Deleting an unresolved sleep does the same. Multiple unanswered mornings remain withheld until every question has been resolved or its sleep has been deleted.

## Earlier morning drift

Morning-boundary suggestions use final wakes from the morning resolver. The detector examines the last seven recorded mornings. A morning qualifies when its final wake is at least 60 minutes before the configured day start and its first subsequent nap begins no more than 15 minutes before the age-based first wake window. A recorded morning without a first nap remains in the seven-morning history but does not qualify.

At least five mornings must qualify. The banner suggests the median qualifying final wake and leaves the boundary unchanged until the caregiver accepts the update. Dismissing the banner keeps the configured boundary.

Morning drift uses only the first wake window and first nap. Later wake windows, the final daytime wake window, and bedtime do not affect the suggestion.

## Shared consumers

`resolveMorningSleep()` in `src/utils/sleepPredictions.ts` supplies:

- current-morning qualification for `SleepPredictionCard`;
- the final wake used to count completed naps;
- historical grouping for prediction training and drift detection.

Confirmed night continuations are excluded from naps even when their awake gap exceeds the automatic allowance. Confirmed first naps remain naps even when they begin before day start.

## Time transitions

The prediction card reevaluates morning qualification at local midnight and at the next morning anchor. Pending questions are found across stored dates, so crossing midnight does not hide an unanswered confirmation.

After the configured day end, the latest completed sleep keeps the card in its Bedtime state when that sleep is stored as `night` and ends after the current date's day-end boundary. The card does not treat that session's end as a new wake for another bedtime prediction. This state expires at midnight. The normal Nighttime state then remains until the morning anchor, when morning qualification resumes.

Later wake-window calculations and bedtime prediction use the existing model after morning wake and nap count have been resolved.

## Verification

Resolver and model cases live in `src/utils/__tests__/sleepPredictions.test.ts`. Storage and sync coverage verifies versioned metadata and durable confirmation updates. Component tests cover the inline question, answer actions, timer controls, and prediction priority. Migration and SQL tests verify legacy null rows, old-client inserts, partial updates, defaults, constraints, and household RLS.
