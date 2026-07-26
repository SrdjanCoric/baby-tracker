# Sleep Predictions

Sleep predictions use recent completed sleep sessions to estimate the next nap or bedtime. The prediction model and dashboard card share the same morning resolution rules.

## Morning resolution

For a given calendar date:

1. The morning anchor is the configured day start minus 3 hours 3 minutes.
2. A completed sleep that starts before the anchor, crosses it, and ends no later than the reference time establishes the morning wake.
3. The first subsequent sleep starting at or after the anchor and before day start is a continuation of night sleep. Its stored `nap` or `night` type and duration do not affect this role.
4. An active continuation keeps the dashboard in its normal sleeping state. When it ends, its end time becomes the final morning wake.
5. Only the first eligible early-window sleep is continuation. Later early-window sleeps are evaluated as naps.
6. A sleep starting at day start or later cannot replace morning wake. A daytime sleep remains available to the nap model regardless of duration.

The resolver derives these roles without changing stored sleep entries. Future sessions, stale sessions from a prior morning, and sessions starting the same evening do not qualify for the current morning.

If there is neither a completed sleep crossing the anchor nor an eligible continuation, the dashboard asks the caregiver to track night sleep after the anchor. Before the anchor it shows the normal nighttime state.

## Shared consumers

`resolveMorningSleep()` in `src/utils/sleepPredictions.ts` is the authoritative resolver. It supplies:

- current-morning qualification for `SleepPredictionCard`;
- the final wake used when counting completed naps;
- historical morning wake and nap grouping used to train the prediction model.

Persisted sleep types remain unchanged. The resolver assigns prediction-only roles so fragmented sleep stored as a nap can still continue the night, while a long daytime nap remains in the nap list.

## Time transitions

The prediction card reevaluates morning qualification at local midnight and at the next morning anchor. This prevents the previous day's wake from carrying into a new date and allows the track-sleep prompt to appear at the anchor without requiring navigation or a sleep-data mutation.

Later wake-window calculations and bedtime prediction use the existing model after morning wake and nap count have been resolved.

## Verification

The utility tests in `src/utils/__tests__/sleepPredictions.test.ts` cover the resolver boundaries and historical grouping. `src/components/SleepPredictionCard.component.test.tsx` covers the fragmented-morning production sequence and the midnight-to-anchor transition through the real resolver.
