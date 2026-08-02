import { useCallback } from "react";
import {
  useDiaper,
  useFeeding,
  useGrowth,
  usePumping,
  useSleep,
  useTummyTime,
} from "@/contexts";
import type { UtcActivityRange } from "@/services/activity-range-loader";

/**
 * Converts an inclusive local date range (as picked in export/report screens)
 * into the half-open UTC range the activity range loaders expect.
 */
export function toInclusiveUtcRange(startDate: Date, endDate: Date): UtcActivityRange {
  return {
    start: startDate.toISOString(),
    end: new Date(endDate.getTime() + 1).toISOString(),
  };
}

/**
 * Returns a resolver that pulls the given range for every exportable activity
 * collection into local storage, so export and report readers see the full
 * selected range instead of the startup-capped cache. Rejects when any
 * collection fails to load, so callers surface the failure instead of
 * producing a partial export.
 */
export function useActivityRangeResolver(): (range: UtcActivityRange) => Promise<void> {
  const { loadFeedingRange } = useFeeding();
  const { loadSleepRange } = useSleep();
  const { loadDiaperRange } = useDiaper();
  const { loadPumpingRange } = usePumping();
  const { loadGrowthRange } = useGrowth();
  const { loadTummyTimeRange } = useTummyTime();

  return useCallback(
    async (range: UtcActivityRange) => {
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
      loadFeedingRange,
      loadSleepRange,
      loadDiaperRange,
      loadPumpingRange,
      loadGrowthRange,
      loadTummyTimeRange,
    ]
  );
}
