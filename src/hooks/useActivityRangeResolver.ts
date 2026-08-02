import { useCallback } from "react";
import { useAuth, useBaby } from "@/contexts";
import { useActivityRangeLoader } from "./useActivityRangeLoader";
import { ACTIVITY_RANGE_LOAD_ERROR } from "@/constants/activity-range";
import type { UtcActivityRange } from "@/services/activity-range-loader";

/**
 * Converts an inclusive local date range (as picked in export/report screens)
 * into the half-open UTC range the activity range loaders expect.
 */
export function toHalfOpenUtcRange(startDate: Date, endDate: Date): UtcActivityRange {
  return {
    start: startDate.toISOString(),
    end: new Date(endDate.getTime() + 1).toISOString(),
  };
}

/**
 * Resolves the given range for every exportable activity collection into local
 * storage, so export and report readers see the full selected range instead of
 * the startup-capped cache.
 *
 * Unlike the context-bound range loaders used by Timeline and Statistics, this
 * resolver commits fetched ranges to storage without dispatching the full
 * merged collection into the activity context reducers, so opening an export or
 * report does not repopulate every timeline and dashboard consumer with the
 * entire fetched history.
 *
 * Rejects when any collection fails to load, so callers surface the failure
 * instead of producing a partial export. A signed-in user whose household
 * profile could not be resolved is treated as unverified rather than falling
 * back to the startup-capped local cache, so the failure is surfaced instead of
 * a silently incomplete export.
 */
export function useActivityRangeResolver(): (range: UtcActivityRange) => Promise<void> {
  const { selectedBaby } = useBaby();
  const { user } = useAuth();
  const babyId = selectedBaby?.id ?? null;
  const householdId = user?.householdId ?? null;
  const authenticated = Boolean(householdId);
  const storageScope = `${user?.id ?? "guest"}:${householdId ?? "local"}:${
    selectedBaby?.id ?? "none"
  }`;
  const acceptEntries = useCallback(() => {}, []);

  const feedingsLoader = useActivityRangeLoader({
    table: "feedings",
    babyId,
    authenticated,
    storageScope,
    acceptEntries,
  });
  const sleepLoader = useActivityRangeLoader({
    table: "sleep_sessions",
    babyId,
    authenticated,
    storageScope,
    acceptEntries,
  });
  const diapersLoader = useActivityRangeLoader({
    table: "diapers",
    babyId,
    authenticated,
    storageScope,
    acceptEntries,
  });
  const pumpingLoader = useActivityRangeLoader({
    table: "pumping_sessions",
    babyId,
    authenticated,
    storageScope,
    acceptEntries,
  });
  const growthLoader = useActivityRangeLoader({
    table: "growth_measurements",
    babyId,
    authenticated,
    storageScope,
    acceptEntries,
  });
  const tummyTimeLoader = useActivityRangeLoader({
    table: "tummy_time_sessions",
    babyId,
    authenticated,
    storageScope,
    acceptEntries,
  });

  const loadFeedingsRange = feedingsLoader.loadRange;
  const loadSleepRange = sleepLoader.loadRange;
  const loadDiapersRange = diapersLoader.loadRange;
  const loadPumpingRange = pumpingLoader.loadRange;
  const loadGrowthRange = growthLoader.loadRange;
  const loadTummyTimeRange = tummyTimeLoader.loadRange;

  return useCallback(
    async (range: UtcActivityRange) => {
      if (user && !householdId) {
        throw new Error(ACTIVITY_RANGE_LOAD_ERROR);
      }
      await Promise.all([
        loadFeedingsRange(range),
        loadSleepRange(range),
        loadDiapersRange(range),
        loadPumpingRange(range),
        loadGrowthRange(range),
        loadTummyTimeRange(range),
      ]);
    },
    [
      user,
      householdId,
      loadFeedingsRange,
      loadSleepRange,
      loadDiapersRange,
      loadPumpingRange,
      loadGrowthRange,
      loadTummyTimeRange,
    ]
  );
}