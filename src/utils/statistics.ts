/**
 * Statistics calculation utilities for the baby tracker app
 */

import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";

export type StatisticsPeriod = "daily" | "weekly";

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

  if (period === "daily") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
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
    totalCount: feedings.length,
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
