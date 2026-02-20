/**
 * Report Aggregator
 * Aggregates statistics for PDF report sections
 */

import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredGrowthEntry } from "@/services/growth-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import type { Gender } from "@/types/growth-chart";
import type {
  ReportOptions,
  ReportMetadata,
  SummaryStats,
  FeedingReportStats,
  SleepReportStats,
  DiaperReportStats,
  PumpingReportStats,
  GrowthReportStats,
  TummyTimeReportStats,
  GrowthMeasurementPoint,
} from "@/types/report";
import {
  calculatePercentileFromMeasurement,
  calculateAgeInMonths,
} from "@/utils/percentile-calculator";

export interface RawReportData {
  feedings: StoredFeedingEntry[];
  sleeps: StoredSleepEntry[];
  diapers: StoredDiaperEntry[];
  pumpings: StoredPumpingEntry[];
  growth: StoredGrowthEntry[];
  tummyTimes: StoredTummyTimeEntry[];
}

function isInDateRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

function filterByDateRange<T>(
  entries: T[],
  startDate: Date,
  endDate: Date,
  getDate: (entry: T) => Date
): T[] {
  return entries.filter((entry) => {
    const entryDate = getDate(entry);
    return isInDateRange(entryDate, startDate, endDate);
  });
}

function getDaysBetween(startDate: Date, endDate: Date): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function _getUniqueDays(entries: { date: Date }[]): Set<string> {
  return new Set(
    entries.map((e) => e.date.toISOString().split("T")[0])
  );
}

export function aggregateMetadata(options: ReportOptions): ReportMetadata {
  const totalDays = getDaysBetween(options.startDate, options.endDate);
  const babyAgeMonths = options.babyBirthDate
    ? calculateAgeInMonths(options.babyBirthDate)
    : undefined;

  return {
    babyName: options.babyName,
    babyAgeMonths,
    startDate: options.startDate,
    endDate: options.endDate,
    generatedAt: new Date(),
    totalDays,
  };
}

export function aggregateSummary(
  data: RawReportData,
  startDate: Date,
  endDate: Date
): SummaryStats {
  const filteredFeedings = filterByDateRange(
    data.feedings,
    startDate,
    endDate,
    (e) => new Date(e.startedAt)
  );
  const filteredSleeps = filterByDateRange(
    data.sleeps,
    startDate,
    endDate,
    (e) => new Date(e.startedAt)
  );
  const filteredDiapers = filterByDateRange(
    data.diapers,
    startDate,
    endDate,
    (e) => new Date(e.changedAt)
  );
  const filteredPumpings = filterByDateRange(
    data.pumpings,
    startDate,
    endDate,
    (e) => new Date(e.startedAt)
  );
  const filteredTummyTimes = filterByDateRange(
    data.tummyTimes,
    startDate,
    endDate,
    (e) => new Date(e.startedAt)
  );
  const filteredGrowth = filterByDateRange(
    data.growth,
    startDate,
    endDate,
    (e) => new Date(e.measuredAt)
  );

  const totalSleepMinutes = filteredSleeps.reduce(
    (sum, s) => sum + (s.durationSeconds || 0) / 60,
    0
  );

  const totalPumpingMl = filteredPumpings.reduce(
    (sum, p) => sum + (p.volumeMl || 0),
    0
  );

  const totalTummyTimeMinutes = filteredTummyTimes.reduce(
    (sum, t) => sum + (t.durationSeconds || 0) / 60,
    0
  );

  return {
    totalFeedings: filteredFeedings.length,
    totalSleepMinutes: Math.round(totalSleepMinutes),
    totalDiapers: filteredDiapers.length,
    totalPumpingMl: Math.round(totalPumpingMl),
    totalTummyTimeMinutes: Math.round(totalTummyTimeMinutes),
    growthMeasurements: filteredGrowth.length,
  };
}

export function aggregateFeeding(
  feedings: StoredFeedingEntry[],
  startDate: Date,
  endDate: Date
): FeedingReportStats {
  const filtered = filterByDateRange(
    feedings,
    startDate,
    endDate,
    (e) => new Date(e.startedAt)
  );

  const totalDays = getDaysBetween(startDate, endDate);
  const breastFeedings = filtered.filter((f) => f.type === "breast");
  const bottleFeedings = filtered.filter((f) => f.type === "bottle");
  const solidFeedings = filtered.filter((f) => f.type === "solid");

  const breastTotalMinutes = breastFeedings.reduce(
    (sum, f) => sum + (f.durationSeconds || 0) / 60,
    0
  );
  const breastLeftMinutes = breastFeedings.reduce(
    (sum, f) => sum + (f.leftDurationSeconds || 0) / 60,
    0
  );
  const breastRightMinutes = breastFeedings.reduce(
    (sum, f) => sum + (f.rightDurationSeconds || 0) / 60,
    0
  );

  const bottleTotalMl = bottleFeedings.reduce(
    (sum, f) => sum + (f.amountMl || 0),
    0
  );
  const formulaCount = bottleFeedings.filter(
    (f) => f.contentType === "formula"
  ).length;
  const breastMilkCount = bottleFeedings.filter(
    (f) => f.contentType === "breastMilk"
  ).length;

  const uniqueFoods = [
    ...new Set(solidFeedings.map((f) => f.foodType).filter(Boolean) as string[]),
  ];

  return {
    total: filtered.length,
    byType: {
      breast: breastFeedings.length,
      bottle: bottleFeedings.length,
      solid: solidFeedings.length,
    },
    breastfeeding: {
      totalSessions: breastFeedings.length,
      totalMinutes: Math.round(breastTotalMinutes),
      avgDurationMinutes:
        breastFeedings.length > 0
          ? Math.round(breastTotalMinutes / breastFeedings.length)
          : 0,
      leftMinutes: Math.round(breastLeftMinutes),
      rightMinutes: Math.round(breastRightMinutes),
    },
    bottle: {
      totalSessions: bottleFeedings.length,
      totalMl: Math.round(bottleTotalMl),
      avgMl:
        bottleFeedings.length > 0
          ? Math.round(bottleTotalMl / bottleFeedings.length)
          : 0,
      byContentType: {
        formula: formulaCount,
        breastMilk: breastMilkCount,
      },
    },
    solid: {
      totalSessions: solidFeedings.length,
      uniqueFoods,
    },
    avgPerDay: totalDays > 0 ? Math.round((filtered.length / totalDays) * 10) / 10 : 0,
  };
}

export function aggregateSleep(
  sleeps: StoredSleepEntry[],
  startDate: Date,
  endDate: Date
): SleepReportStats {
  const filtered = filterByDateRange(
    sleeps,
    startDate,
    endDate,
    (e) => new Date(e.startedAt)
  );

  const totalDays = getDaysBetween(startDate, endDate);
  const naps = filtered.filter((s) => s.type === "nap");
  const nights = filtered.filter((s) => s.type === "night");

  const totalMinutes = filtered.reduce(
    (sum, s) => sum + (s.durationSeconds || 0) / 60,
    0
  );
  const napTotalMinutes = naps.reduce(
    (sum, s) => sum + (s.durationSeconds || 0) / 60,
    0
  );
  const nightTotalMinutes = nights.reduce(
    (sum, s) => sum + (s.durationSeconds || 0) / 60,
    0
  );

  const durations = filtered
    .map((s) => (s.durationSeconds || 0) / 60)
    .filter((d) => d > 0);

  return {
    totalMinutes: Math.round(totalMinutes),
    totalSessions: filtered.length,
    avgDurationMinutes:
      filtered.length > 0 ? Math.round(totalMinutes / filtered.length) : 0,
    avgPerDay: totalDays > 0 ? Math.round((totalMinutes / totalDays) * 10) / 10 : 0,
    byType: {
      nap: {
        count: naps.length,
        totalMinutes: Math.round(napTotalMinutes),
        avgMinutes:
          naps.length > 0 ? Math.round(napTotalMinutes / naps.length) : 0,
      },
      night: {
        count: nights.length,
        totalMinutes: Math.round(nightTotalMinutes),
        avgMinutes:
          nights.length > 0 ? Math.round(nightTotalMinutes / nights.length) : 0,
      },
    },
    longestSleepMinutes: durations.length > 0 ? Math.round(Math.max(...durations)) : 0,
    shortestSleepMinutes: durations.length > 0 ? Math.round(Math.min(...durations)) : 0,
  };
}

export function aggregateDiapers(
  diapers: StoredDiaperEntry[],
  startDate: Date,
  endDate: Date
): DiaperReportStats {
  const filtered = filterByDateRange(
    diapers,
    startDate,
    endDate,
    (e) => new Date(e.changedAt)
  );

  const totalDays = getDaysBetween(startDate, endDate);

  const wet = filtered.filter((d) => d.type === "wet").length;
  const dirty = filtered.filter((d) => d.type === "dirty").length;
  const mixed = filtered.filter((d) => d.type === "mixed").length;

  const stoolColors: Record<string, number> = {};
  filtered.forEach((d) => {
    if (d.stoolColor) {
      stoolColors[d.stoolColor] = (stoolColors[d.stoolColor] || 0) + 1;
    }
  });

  return {
    total: filtered.length,
    avgPerDay: totalDays > 0 ? Math.round((filtered.length / totalDays) * 10) / 10 : 0,
    byType: { wet, dirty, mixed },
    stoolColors,
  };
}

export function aggregatePumping(
  pumpings: StoredPumpingEntry[],
  startDate: Date,
  endDate: Date
): PumpingReportStats {
  const filtered = filterByDateRange(
    pumpings,
    startDate,
    endDate,
    (e) => new Date(e.startedAt)
  );

  const totalDays = getDaysBetween(startDate, endDate);

  const totalMl = filtered.reduce((sum, p) => sum + (p.volumeMl || 0), 0);
  const totalMinutes = filtered.reduce(
    (sum, p) => sum + (p.durationSeconds || 0) / 60,
    0
  );

  const leftSessions = filtered.filter((p) => p.side === "left");
  const rightSessions = filtered.filter((p) => p.side === "right");
  const bothSessions = filtered.filter((p) => p.side === "both");

  return {
    totalSessions: filtered.length,
    totalMl: Math.round(totalMl),
    avgMlPerSession:
      filtered.length > 0 ? Math.round(totalMl / filtered.length) : 0,
    avgSessionsPerDay:
      totalDays > 0 ? Math.round((filtered.length / totalDays) * 10) / 10 : 0,
    totalMinutes: Math.round(totalMinutes),
    avgMinutesPerSession:
      filtered.length > 0 ? Math.round(totalMinutes / filtered.length) : 0,
    bySide: {
      left: {
        sessions: leftSessions.length,
        totalMl: Math.round(
          leftSessions.reduce((sum, p) => sum + (p.volumeMl || 0), 0)
        ),
      },
      right: {
        sessions: rightSessions.length,
        totalMl: Math.round(
          rightSessions.reduce((sum, p) => sum + (p.volumeMl || 0), 0)
        ),
      },
      both: {
        sessions: bothSessions.length,
        totalMl: Math.round(
          bothSessions.reduce((sum, p) => sum + (p.volumeMl || 0), 0)
        ),
      },
    },
  };
}

export function aggregateGrowth(
  growth: StoredGrowthEntry[],
  startDate: Date,
  endDate: Date,
  babyBirthDate?: Date,
  babyGender?: Gender
): GrowthReportStats {
  const filtered = filterByDateRange(
    growth,
    startDate,
    endDate,
    (e) => new Date(e.measuredAt)
  ).sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
  );

  const measurements: GrowthMeasurementPoint[] = filtered.map((g) => {
    const measurementDate = new Date(g.measuredAt);
    const ageMonths = babyBirthDate
      ? calculateAgeInMonths(babyBirthDate, measurementDate)
      : 0;

    const point: GrowthMeasurementPoint = {
      date: measurementDate,
      ageMonths,
    };

    if (g.weightKg != null) {
      point.weight = g.weightKg;
      if (babyGender && ageMonths >= 0 && ageMonths <= 24) {
        const result = calculatePercentileFromMeasurement(
          babyGender,
          ageMonths,
          g.weightKg,
          "weight"
        );
        if (result) point.weightPercentile = Math.round(result.percentile);
      }
    }

    if (g.heightCm != null) {
      point.height = g.heightCm;
      if (babyGender && ageMonths >= 0 && ageMonths <= 24) {
        const result = calculatePercentileFromMeasurement(
          babyGender,
          ageMonths,
          g.heightCm,
          "height"
        );
        if (result) point.heightPercentile = Math.round(result.percentile);
      }
    }

    if (g.headCircumferenceCm != null) {
      point.headCircumference = g.headCircumferenceCm;
      if (babyGender && ageMonths >= 0 && ageMonths <= 24) {
        const result = calculatePercentileFromMeasurement(
          babyGender,
          ageMonths,
          g.headCircumferenceCm,
          "head"
        );
        if (result) point.headPercentile = Math.round(result.percentile);
      }
    }

    return point;
  });

  const result: GrowthReportStats = { measurements };

  const withWeight = measurements.filter((m) => m.weight != null);
  const withHeight = measurements.filter((m) => m.height != null);
  const withHead = measurements.filter((m) => m.headCircumference != null);

  if (withWeight.length > 0) {
    const latest = withWeight[withWeight.length - 1];
    result.latestWeight = {
      value: latest.weight!,
      percentile: latest.weightPercentile,
      date: latest.date,
    };

    if (withWeight.length >= 2) {
      const first = withWeight[0];
      result.weightGain = {
        startValue: first.weight!,
        endValue: latest.weight!,
        change: Math.round((latest.weight! - first.weight!) * 100) / 100,
      };
    }
  }

  if (withHeight.length > 0) {
    const latest = withHeight[withHeight.length - 1];
    result.latestHeight = {
      value: latest.height!,
      percentile: latest.heightPercentile,
      date: latest.date,
    };

    if (withHeight.length >= 2) {
      const first = withHeight[0];
      result.heightGain = {
        startValue: first.height!,
        endValue: latest.height!,
        change: Math.round((latest.height! - first.height!) * 10) / 10,
      };
    }
  }

  if (withHead.length > 0) {
    const latest = withHead[withHead.length - 1];
    result.latestHeadCircumference = {
      value: latest.headCircumference!,
      percentile: latest.headPercentile,
      date: latest.date,
    };
  }

  return result;
}

export function aggregateTummyTime(
  tummyTimes: StoredTummyTimeEntry[],
  startDate: Date,
  endDate: Date,
  dailyGoalMinutes?: number
): TummyTimeReportStats {
  const filtered = filterByDateRange(
    tummyTimes,
    startDate,
    endDate,
    (e) => new Date(e.startedAt)
  );

  const totalDays = getDaysBetween(startDate, endDate);

  const totalMinutes = filtered.reduce(
    (sum, t) => sum + (t.durationSeconds || 0) / 60,
    0
  );

  const durations = filtered
    .map((t) => (t.durationSeconds || 0) / 60)
    .filter((d) => d > 0);

  const entriesByDay = new Map<string, number>();
  filtered.forEach((t) => {
    const day = new Date(t.startedAt).toISOString().split("T")[0];
    const minutes = (t.durationSeconds || 0) / 60;
    entriesByDay.set(day, (entriesByDay.get(day) || 0) + minutes);
  });

  let daysGoalMet = 0;
  if (dailyGoalMinutes) {
    entriesByDay.forEach((minutes) => {
      if (minutes >= dailyGoalMinutes) {
        daysGoalMet++;
      }
    });
  }

  return {
    totalSessions: filtered.length,
    totalMinutes: Math.round(totalMinutes),
    avgMinutesPerSession:
      filtered.length > 0 ? Math.round(totalMinutes / filtered.length) : 0,
    avgSessionsPerDay:
      totalDays > 0 ? Math.round((filtered.length / totalDays) * 10) / 10 : 0,
    longestSessionMinutes: durations.length > 0 ? Math.round(Math.max(...durations)) : 0,
    dailyGoalMinutes,
    daysGoalMet,
    totalDays,
  };
}
