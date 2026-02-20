/**
 * Statistics calculation utilities for the baby tracker app
 */

import type { StoredFeedingEntry } from "@/services/feeding-storage";
import { countFeedingSessions } from "@/utils/feeding-sessions";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";

export type StatisticsPeriod = "today" | "7days" | "30days";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface FeedingStats {
  totalCount: number;
  totalDurationSeconds: number;
  breastCount: number;
  bottleCount: number;
  solidsCount: number;
  totalBottleVolumeMl: number;
}

export interface SleepStats {
  totalDurationSeconds: number;
  napCount: number;
  nightCount: number;
  averageNapDurationSeconds: number;
}

export interface DiaperStats {
  totalCount: number;
  wetCount: number;
  dirtyCount: number;
  mixedCount: number;
}

export interface PumpingStats {
  totalCount: number;
  totalVolumeMl: number;
  totalDurationSeconds: number;
}

export interface TummyTimeStats {
  sessionCount: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
}

export function getDateRangeForPeriod(
  period: StatisticsPeriod,
  referenceDate: Date = new Date()
): DateRange {
  const start = new Date(referenceDate);
  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "7days":
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "30days":
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end };
}

export function filterEntriesByDateRange<T>(
  entries: T[],
  range: DateRange,
  getDateField: (entry: T) => string
): T[] {
  return entries.filter((entry) => {
    const entryDate = new Date(getDateField(entry));
    return entryDate >= range.start && entryDate <= range.end;
  });
}

export function calculateFeedingStats(feedings: StoredFeedingEntry[]): FeedingStats {
  let totalDurationSeconds = 0;
  let breastCount = 0;
  let bottleCount = 0;
  let solidsCount = 0;
  let totalBottleVolumeMl = 0;

  for (const feeding of feedings) {
    if (feeding.durationSeconds) {
      totalDurationSeconds += feeding.durationSeconds;
    }

    switch (feeding.type) {
      case "breast":
        breastCount++;
        break;
      case "bottle":
        bottleCount++;
        if (feeding.amountMl) {
          totalBottleVolumeMl += feeding.amountMl;
        }
        break;
      case "solid":
        solidsCount++;
        break;
    }
  }

  return {
    totalCount: countFeedingSessions(feedings),
    totalDurationSeconds,
    breastCount,
    bottleCount,
    solidsCount,
    totalBottleVolumeMl,
  };
}

export function calculateSleepStats(sleeps: StoredSleepEntry[]): SleepStats {
  let totalDurationSeconds = 0;
  let napCount = 0;
  let nightCount = 0;
  let totalNapDurationSeconds = 0;

  for (const sleep of sleeps) {
    if (sleep.durationSeconds) {
      totalDurationSeconds += sleep.durationSeconds;
    }

    if (sleep.type === "nap") {
      napCount++;
      if (sleep.durationSeconds) {
        totalNapDurationSeconds += sleep.durationSeconds;
      }
    } else {
      nightCount++;
    }
  }

  const averageNapDurationSeconds = napCount > 0
    ? Math.round(totalNapDurationSeconds / napCount)
    : 0;

  return {
    totalDurationSeconds,
    napCount,
    nightCount,
    averageNapDurationSeconds,
  };
}

export function calculateDiaperStats(diapers: StoredDiaperEntry[]): DiaperStats {
  let wetCount = 0;
  let dirtyCount = 0;
  let mixedCount = 0;

  for (const diaper of diapers) {
    switch (diaper.type) {
      case "wet":
        wetCount++;
        break;
      case "dirty":
        dirtyCount++;
        break;
      case "mixed":
        mixedCount++;
        break;
    }
  }

  return {
    totalCount: diapers.length,
    wetCount,
    dirtyCount,
    mixedCount,
  };
}

export function calculatePumpingStats(pumpings: StoredPumpingEntry[]): PumpingStats {
  let totalVolumeMl = 0;
  let totalDurationSeconds = 0;

  for (const pumping of pumpings) {
    if (pumping.volumeMl) {
      totalVolumeMl += pumping.volumeMl;
    }
    if (pumping.durationSeconds) {
      totalDurationSeconds += pumping.durationSeconds;
    }
  }

  return {
    totalCount: pumpings.length,
    totalVolumeMl,
    totalDurationSeconds,
  };
}

export function calculateTummyTimeStats(tummyTimes: StoredTummyTimeEntry[]): TummyTimeStats {
  let totalDurationSeconds = 0;

  for (const session of tummyTimes) {
    if (session.durationSeconds) {
      totalDurationSeconds += session.durationSeconds;
    }
  }

  const averageDurationSeconds = tummyTimes.length > 0
    ? Math.round(totalDurationSeconds / tummyTimes.length)
    : 0;

  return {
    sessionCount: tummyTimes.length,
    totalDurationSeconds,
    averageDurationSeconds,
  };
}

export interface DailyBreakdown {
  date: string;
  dayLabel: string;
  feedingCount: number;
  sleepMinutes: number;
  diaperCount: number;
}

export function calculateWeeklyBreakdown<T>(
  entries: T[],
  getDateField: (entry: T) => string,
  referenceDate: Date = new Date()
): Map<string, T[]> {
  const breakdown = new Map<string, T[]>();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    breakdown.set(dateKey, []);
  }

  for (const entry of entries) {
    const entryDate = new Date(getDateField(entry));
    const dateKey = entryDate.toISOString().split("T")[0];
    if (breakdown.has(dateKey)) {
      breakdown.get(dateKey)!.push(entry);
    }
  }

  return breakdown;
}

export interface DailyAverages {
  sleepHoursPerDay: number;
  feedingsPerDay: number;
  wetDiapersPerDay: number;
  dirtyDiapersPerDay: number;
  totalDiapersPerDay: number;
  pumpingMlPerDay: number;
  tummyTimeMinutesPerDay: number;
  daysInPeriod: number;
}

export function calculateDailyAverages(
  feedingStats: FeedingStats,
  sleepStats: SleepStats,
  diaperStats: DiaperStats,
  pumpingStats: PumpingStats,
  tummyTimeStats: TummyTimeStats,
  daysInPeriod: number = 7
): DailyAverages {
  const days = Math.max(daysInPeriod, 1);

  return {
    sleepHoursPerDay: Math.round((sleepStats.totalDurationSeconds / 3600 / days) * 10) / 10,
    feedingsPerDay: Math.round((feedingStats.totalCount / days) * 10) / 10,
    wetDiapersPerDay: Math.round((diaperStats.wetCount / days) * 10) / 10,
    dirtyDiapersPerDay: Math.round((diaperStats.dirtyCount / days) * 10) / 10,
    totalDiapersPerDay: Math.round((diaperStats.totalCount / days) * 10) / 10,
    pumpingMlPerDay: Math.round((pumpingStats.totalVolumeMl / days) * 10) / 10,
    tummyTimeMinutesPerDay: Math.round((tummyTimeStats.totalDurationSeconds / 60 / days) * 10) / 10,
    daysInPeriod: days,
  };
}

export function calculateDailyBreakdown<T>(
  entries: T[],
  getDateField: (entry: T) => string,
  daysBack: number,
  referenceDate: Date = new Date()
): Map<string, T[]> {
  const breakdown = new Map<string, T[]>();

  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    breakdown.set(dateKey, []);
  }

  for (const entry of entries) {
    const entryDate = new Date(getDateField(entry));
    const dateKey = entryDate.toISOString().split("T")[0];
    if (breakdown.has(dateKey)) {
      breakdown.get(dateKey)!.push(entry);
    }
  }

  return breakdown;
}

export interface ExtendedFeedingStats extends FeedingStats {
  avgTimeBetweenSessionsSeconds: number;
  leftDurationSeconds: number;
  rightDurationSeconds: number;
  leftRightBalancePercent: { left: number; right: number } | null;
  bottleFormulaVolumeMl: number;
  bottleBreastMilkVolumeMl: number;
}

const SESSION_GAP_MS = 60 * 60 * 1000;
const MAX_FEEDING_GAP_S = 86400;

export function calculateExtendedFeedingStats(
  feedings: StoredFeedingEntry[]
): ExtendedFeedingStats {
  const base = calculateFeedingStats(feedings);

  let leftDurationSeconds = 0;
  let rightDurationSeconds = 0;
  let bottleFormulaVolumeMl = 0;
  let bottleBreastMilkVolumeMl = 0;

  for (const feeding of feedings) {
    if (feeding.leftDurationSeconds) leftDurationSeconds += feeding.leftDurationSeconds;
    if (feeding.rightDurationSeconds) rightDurationSeconds += feeding.rightDurationSeconds;
    if (feeding.type === "bottle" && feeding.amountMl) {
      if (feeding.contentType === "formula") bottleFormulaVolumeMl += feeding.amountMl;
      else if (feeding.contentType === "breastMilk") bottleBreastMilkVolumeMl += feeding.amountMl;
    }
  }

  const totalLR = leftDurationSeconds + rightDurationSeconds;
  const leftRightBalancePercent = totalLR > 0
    ? {
        left: Math.round((leftDurationSeconds / totalLR) * 100),
        right: Math.round((rightDurationSeconds / totalLR) * 100),
      }
    : null;

  const avgTimeBetweenSessionsSeconds = calculateAvgTimeBetweenSessions(feedings);

  return {
    ...base,
    avgTimeBetweenSessionsSeconds,
    leftDurationSeconds,
    rightDurationSeconds,
    leftRightBalancePercent,
    bottleFormulaVolumeMl,
    bottleBreastMilkVolumeMl,
  };
}

function calculateAvgTimeBetweenSessions(feedings: StoredFeedingEntry[]): number {
  if (feedings.length < 2) return 0;

  const sorted = [...feedings].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  const sessionEnds: number[] = [];
  const sessionStarts: number[] = [];
  let currentSessionStart = new Date(sorted[0].startedAt).getTime();
  let currentSessionEnd = new Date(sorted[0].endedAt || sorted[0].startedAt).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const currStart = new Date(sorted[i].startedAt).getTime();
    const currEnd = new Date(sorted[i].endedAt || sorted[i].startedAt).getTime();

    if (currStart - currentSessionEnd >= SESSION_GAP_MS) {
      sessionStarts.push(currentSessionStart);
      sessionEnds.push(currentSessionEnd);
      currentSessionStart = currStart;
      currentSessionEnd = currEnd;
    } else {
      currentSessionEnd = Math.max(currentSessionEnd, currEnd);
    }
  }
  sessionStarts.push(currentSessionStart);
  sessionEnds.push(currentSessionEnd);

  if (sessionStarts.length < 2) return 0;

  let totalGap = 0;
  let gapCount = 0;
  for (let i = 1; i < sessionStarts.length; i++) {
    const gapSeconds = (sessionStarts[i] - sessionEnds[i - 1]) / 1000;
    if (gapSeconds > 0 && gapSeconds < MAX_FEEDING_GAP_S) {
      totalGap += gapSeconds;
      gapCount++;
    }
  }

  return gapCount > 0 ? Math.round(totalGap / gapCount) : 0;
}

export interface ExtendedSleepStats extends SleepStats {
  longestStretchSeconds: number;
}

export function calculateExtendedSleepStats(
  sleeps: StoredSleepEntry[]
): ExtendedSleepStats {
  const base = calculateSleepStats(sleeps);

  const longestStretchSeconds = sleeps.reduce(
    (max, s) => Math.max(max, s.durationSeconds || 0),
    0
  );

  return { ...base, longestStretchSeconds };
}

export interface ExtendedDiaperStats extends DiaperStats {
  stoolColorDistribution: Record<string, number>;
}

export function calculateExtendedDiaperStats(
  diapers: StoredDiaperEntry[]
): ExtendedDiaperStats {
  const base = calculateDiaperStats(diapers);

  const stoolColorDistribution: Record<string, number> = {};
  for (const diaper of diapers) {
    if ((diaper.type === "dirty" || diaper.type === "mixed") && diaper.stoolColor) {
      stoolColorDistribution[diaper.stoolColor] =
        (stoolColorDistribution[diaper.stoolColor] || 0) + 1;
    }
  }

  return { ...base, stoolColorDistribution };
}

export interface Rolling7DayAverage {
  feedingsPerDay: number;
  sleepSecondsPerDay: number;
  wetDiapersPerDay: number;
  dirtyDiapersPerDay: number;
  totalDiapersPerDay: number;
  tummyTimeSecondsPerDay: number;
}

export function calculateRolling7DayAverage(
  feedings: StoredFeedingEntry[],
  sleeps: StoredSleepEntry[],
  diapers: StoredDiaperEntry[],
  tummyTimes: StoredTummyTimeEntry[],
  referenceDate: Date = new Date()
): Rolling7DayAverage {
  const end = new Date(referenceDate);
  end.setHours(0, 0, 0, 0);
  end.setMilliseconds(end.getMilliseconds() - 1);

  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const range: DateRange = { start, end };

  const filteredFeedings = filterEntriesByDateRange(feedings, range, (e) => e.startedAt);
  const filteredSleeps = filterEntriesByDateRange(sleeps, range, (e) => e.startedAt);
  const filteredDiapers = filterEntriesByDateRange(diapers, range, (e) => e.changedAt);
  const filteredTummyTimes = filterEntriesByDateRange(tummyTimes, range, (e) => e.startedAt);

  const feedingStats = calculateFeedingStats(filteredFeedings);
  const diaperStats = calculateDiaperStats(filteredDiapers);

  const totalSleepSeconds = filteredSleeps.reduce(
    (sum, s) => sum + (s.durationSeconds || 0), 0
  );
  const totalTummySeconds = filteredTummyTimes.reduce(
    (sum, t) => sum + (t.durationSeconds || 0), 0
  );

  return {
    feedingsPerDay: Math.round((feedingStats.totalCount / 7) * 10) / 10,
    sleepSecondsPerDay: Math.round(totalSleepSeconds / 7),
    wetDiapersPerDay: Math.round((diaperStats.wetCount / 7) * 10) / 10,
    dirtyDiapersPerDay: Math.round((diaperStats.dirtyCount / 7) * 10) / 10,
    totalDiapersPerDay: Math.round((diaperStats.totalCount / 7) * 10) / 10,
    tummyTimeSecondsPerDay: Math.round(totalTummySeconds / 7),
  };
}
