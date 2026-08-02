import { useCallback } from "react";
import {
  useAuth,
  useDiaper,
  useFeeding,
  useGrowth,
  usePumping,
  useSleep,
  useTummyTime,
} from "@/contexts";
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
 * This uses the same context-bound range loaders as Timeline and Statistics, so
 * coverage resolved for an export is reused by the other surfaces and the
 * contexts stay consistent with what the export reads. `commitPulledRange`
 * prunes local rows the server no longer returns, so a resolver that skipped
 * the context dispatch would leave Timeline showing entries the export omits.
 *
 * Rejects when any collection fails to load, so callers surface the failure
 * instead of producing a partial export. A signed-in user whose household
 * profile could not be resolved is treated as unverified rather than falling
 * back to the startup-capped local cache, so the failure is surfaced instead of
 * a silently incomplete export.
 */
export function useActivityRangeResolver(): (range: UtcActivityRange) => Promise<void> {
  const { user } = useAuth();
  const householdId = user?.householdId ?? null;

  const { loadFeedingRange } = useFeeding();
  const { loadSleepRange } = useSleep();
  const { loadDiaperRange } = useDiaper();
  const { loadPumpingRange } = usePumping();
  const { loadGrowthRange } = useGrowth();
  const { loadTummyTimeRange } = useTummyTime();

  return useCallback(
    async (range: UtcActivityRange) => {
      if (user && !householdId) {
        throw new Error(ACTIVITY_RANGE_LOAD_ERROR);
      }
      await Promise.all([
        loadFeedingRange(range),
        loadSleepRange(range),
        loadDiaperRange(range),
        loadPumpingRange(range),
        loadGrowthRange(range),
        loadTummyTimeRange(range),
      ]);
    },
    [
      user,
      householdId,
      loadFeedingRange,
      loadSleepRange,
      loadDiaperRange,
      loadPumpingRange,
      loadGrowthRange,
      loadTummyTimeRange,
    ]
  );
}
