import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import {
  useBaby,
  useDiaper,
  useFeeding,
  useGrowth,
  useHealth,
  usePumping,
  useTummyTime,
} from "@/contexts";
import type { ActivityRangeStatus, UtcActivityRange } from "@/services/activity-range-loader";
import {
  getAllHistoryRange,
  getCalendarStatisticsRange,
  pointInActivityRange,
} from "@/utils/statistics-ranges";
import type { StatsCategory } from "./CategoryTabs";
import { ActivityRangeBoundary } from "./ActivityRangeBoundary";

type RangeCategory = Exclude<StatsCategory, "sleep">;
interface StatisticsActivityRangeProps {
  category: RangeCategory;
  period: string;
  children: ReactNode;
}

export function StatisticsActivityRange({
  category,
  period,
  children,
}: StatisticsActivityRangeProps) {
  const { selectedBaby } = useBaby();
  const feeding = useFeeding();
  const diaper = useDiaper();
  const pumping = usePumping();
  const tummyTime = useTummyTime();
  const growth = useGrowth();
  const health = useHealth();

  const range = useMemo(
    () => category === "growth" || category === "health"
      ? getAllHistoryRange()
      : getCalendarStatisticsRange(
          period === "7days" || category === "tummyTime" ? "7days" : "today"
        ),
    [category, period]
  );

  let timestamps: string[];
  let loadRange: (requestedRange: UtcActivityRange) => Promise<void>;
  let getRangeStatus: (requestedRange: UtcActivityRange) => ActivityRangeStatus;
  switch (category) {
    case "feeding":
      timestamps = feeding.feedings
        .filter((entry) => entry.babyId === selectedBaby?.id)
        .map((entry) => entry.startedAt);
      loadRange = feeding.loadFeedingRange;
      getRangeStatus = feeding.getFeedingRangeStatus;
      break;
    case "diapers":
      timestamps = diaper.diapers
        .filter((entry) => entry.babyId === selectedBaby?.id)
        .map((entry) => entry.changedAt);
      loadRange = diaper.loadDiaperRange;
      getRangeStatus = diaper.getDiaperRangeStatus;
      break;
    case "pumping":
      timestamps = pumping.pumpings
        .filter((entry) => entry.babyId === selectedBaby?.id)
        .map((entry) => entry.startedAt);
      loadRange = pumping.loadPumpingRange;
      getRangeStatus = pumping.getPumpingRangeStatus;
      break;
    case "tummyTime":
      timestamps = tummyTime.tummyTimes
        .filter((entry) => entry.babyId === selectedBaby?.id)
        .map((entry) => entry.startedAt);
      loadRange = tummyTime.loadTummyTimeRange;
      getRangeStatus = tummyTime.getTummyTimeRangeStatus;
      break;
    case "growth":
      timestamps = growth.measurements
        .filter((entry) => entry.babyId === selectedBaby?.id)
        .map((entry) => entry.measuredAt);
      loadRange = growth.loadGrowthRange;
      getRangeStatus = growth.getGrowthRangeStatus;
      break;
    case "health":
      timestamps = health.healthEntries
        .filter((entry) => entry.babyId === selectedBaby?.id)
        .map((entry) => entry.loggedAt);
      loadRange = health.loadHealthRange;
      getRangeStatus = health.getHealthRangeStatus;
      break;
  }

  const status = getRangeStatus(range);
  const hasCachedData = timestamps.some((timestamp) =>
    pointInActivityRange(timestamp, range)
  );
  const retry = useCallback(() => {
    loadRange(range).catch(() => {});
  }, [loadRange, range]);

  useEffect(() => {
    if (status !== "unverified") return;
    loadRange(range).catch(() => {});
  }, [loadRange, range, status]);

  return (
    <ActivityRangeBoundary
      status={status}
      hasCachedData={hasCachedData}
      onRetry={retry}
    >
      {children}
    </ActivityRangeBoundary>
  );
}
