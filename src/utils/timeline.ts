/**
 * Timeline utility functions for calculating daily summaries and formatting
 */

import type { StoredFeedingEntry } from "@/services/feeding-storage";
import { countFeedingSessions } from "@/utils/feeding-sessions";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredGrowthEntry } from "@/services/growth-storage";
import { formatDurationShort } from "@/utils/time";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import type { ActivityType } from "@/constants/activities";
import { classifySleepByTimeRange, localDateKey, splitSleepAtDayBoundary } from "@/utils/sleep-patterns";
import { unionCompletedSleepIntervals } from "@/utils/sleep-intervals";

export interface DailySummary {
  date: Date;
  feedingCount: number;
  feedingTotalMl: number;
  nursingMinutes: number;
  nursingCount: number;
  bottleCount: number;
  bottleBreastMilkMl: number;
  bottleBreastMilkCount: number;
  bottleFormulaMl: number;
  bottleFormulaCount: number;
  solidCount: number;
  sleepMinutes: number;
  napCount: number;
  nightSleepCount: number;
  diaperCount: {
    wet: number;
    dirty: number;
    mixed: number;
    dry: number;
    total: number;
  };
  pumpingCount: number;
  pumpingTotalMl: number;
  growthCount: number;
  tummyTimeMinutes: number;
  tummyTimeCount: number;
}

export interface TimelineDataByDate {
  feedings: StoredFeedingEntry[];
  sleeps: StoredSleepEntry[];
  diapers: StoredDiaperEntry[];
  pumpings: StoredPumpingEntry[];
  growths: StoredGrowthEntry[];
  tummyTimes: StoredTummyTimeEntry[];
}

function isSameDay(date1: Date, date2: Date): boolean {
  // Use local time for comparison, not UTC
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function calculateDailySummary(
  date: Date,
  data: TimelineDataByDate,
  dayStartHour: number = 6,
  dayEndHour: number = 19
): DailySummary {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const dayFeedings = data.feedings.filter((f) =>
    isSameDay(new Date(f.startedAt), targetDate)
  );
  const targetDayKey = localDateKey(targetDate);
  const dayDiapers = data.diapers.filter((d) =>
    isSameDay(new Date(d.changedAt), targetDate)
  );
  const dayPumpings = data.pumpings.filter((p) =>
    isSameDay(new Date(p.startedAt), targetDate)
  );
  const dayGrowths = data.growths.filter((g) =>
    isSameDay(new Date(g.measuredAt), targetDate)
  );
  const dayTummyTimes = data.tummyTimes.filter((t) =>
    isSameDay(new Date(t.startedAt), targetDate)
  );

  const nursingFeedings = dayFeedings.filter((f) => f.type === "breast");
  const bottleFeedings = dayFeedings.filter((f) => f.type === "bottle");
  const solidFeedings = dayFeedings.filter((f) => f.type === "solid");

  const bottleBreastMilkFeedings = bottleFeedings.filter((f) => f.contentType === "breastMilk");
  const bottleFormulaFeedings = bottleFeedings.filter((f) => f.contentType === "formula");

  const nursingMinutes = nursingFeedings.reduce(
    (sum, f) => sum + Math.round((f.durationSeconds || 0) / 60),
    0
  );
  const feedingTotalMl = bottleFeedings.reduce(
    (sum, f) => sum + (f.amountMl || 0),
    0
  );
  const bottleBreastMilkMl = bottleBreastMilkFeedings.reduce(
    (sum, f) => sum + (f.amountMl || 0),
    0
  );
  const bottleFormulaMl = bottleFormulaFeedings.reduce(
    (sum, f) => sum + (f.amountMl || 0),
    0
  );

  let sleepSeconds = 0;
  let napCount = 0;
  let nightSleepCount = 0;

  // Only sleeps touching the day before through the day after can put seconds in this day,
  // and any entry that would union with one of them overlaps the same window. Narrowing
  // first keeps the union off the whole loaded history on every recomputation.
  const windowStart = new Date(targetDate);
  windowStart.setDate(windowStart.getDate() - 1);
  windowStart.setHours(dayStartHour, 0, 0, 0);
  const windowEnd = new Date(targetDate);
  windowEnd.setDate(windowEnd.getDate() + 2);
  windowEnd.setHours(dayStartHour, 0, 0, 0);

  const windowSleeps = data.sleeps.filter((sleep) => {
    if (!sleep.endedAt) return false;
    return (
      new Date(sleep.endedAt).getTime() > windowStart.getTime() &&
      new Date(sleep.startedAt).getTime() < windowEnd.getTime()
    );
  });

  // Union next: overlapping and duplicate entries are permitted by design, and every
  // statistics surface reports the unioned intervals rather than the raw entries.
  for (const sleep of unionCompletedSleepIntervals(windowSleeps)) {
    const segments = splitSleepAtDayBoundary(sleep, dayStartHour, dayEndHour);
    const daySegments = segments.filter((seg) => seg.dateKey === targetDayKey);
    if (daySegments.length === 0) continue;

    // Seconds come from the day's segments, but the sleep is classified as a whole, the
    // way the statistics screens classify it — one sleep is one nap or one night, even
    // when it straddles the day/night boundary.
    sleepSeconds += daySegments.reduce((sum, seg) => sum + seg.seconds, 0);

    const type = classifySleepByTimeRange(
      new Date(sleep.startedAt),
      new Date(sleep.endedAt!),
      dayStartHour,
      dayEndHour
    );
    if (type === "nap") napCount++;
    else nightSleepCount++;
  }
  const sleepMinutes = Math.round(sleepSeconds / 60);

  // Calculate diaper counts
  const diaperCount = {
    wet: dayDiapers.filter((d) => d.type === "wet").length,
    dirty: dayDiapers.filter((d) => d.type === "dirty").length,
    mixed: dayDiapers.filter((d) => d.type === "mixed").length,
    dry: dayDiapers.filter((d) => d.type === "dry").length,
    total: dayDiapers.length,
  };

  // Calculate pumping metrics
  const pumpingTotalMl = dayPumpings.reduce(
    (sum, p) => sum + (p.volumeMl || 0),
    0
  );

  // Calculate tummy time
  const tummyTimeMinutes = dayTummyTimes.reduce(
    (sum, t) => sum + Math.round((t.durationSeconds || 0) / 60),
    0
  );

  return {
    date: targetDate,
    feedingCount: countFeedingSessions(dayFeedings),
    feedingTotalMl,
    nursingMinutes,
    nursingCount: nursingFeedings.length,
    bottleCount: bottleFeedings.length,
    bottleBreastMilkMl,
    bottleBreastMilkCount: bottleBreastMilkFeedings.length,
    bottleFormulaMl,
    bottleFormulaCount: bottleFormulaFeedings.length,
    solidCount: solidFeedings.length,
    sleepMinutes,
    napCount,
    nightSleepCount,
    diaperCount,
    pumpingCount: dayPumpings.length,
    pumpingTotalMl,
    growthCount: dayGrowths.length,
    tummyTimeMinutes,
    tummyTimeCount: dayTummyTimes.length,
  };
}

export function formatDailySummaryText(
  summary: DailySummary,
  filter: ActivityType | "all",
  t: (key: string, options?: Record<string, unknown>) => string
): string[] {
  const lines: string[] = [];

  if (filter === "all" || filter === "feeding") {
    if (summary.nursingCount > 0) {
      lines.push(
        `${t("feeding.breastfeeding")} ${summary.nursingMinutes}m · ${summary.nursingCount}×`
      );
    }
    if (summary.bottleBreastMilkCount > 0) {
      lines.push(
        `${t("feeding.bottleBreastMilk")} ${summary.bottleBreastMilkMl}ml · ${summary.bottleBreastMilkCount}×`
      );
    }
    if (summary.bottleFormulaCount > 0) {
      lines.push(
        `${t("feeding.bottleFormula")} ${summary.bottleFormulaMl}ml · ${summary.bottleFormulaCount}×`
      );
    }
    if (summary.bottleCount > 0 && summary.bottleBreastMilkCount === 0 && summary.bottleFormulaCount === 0) {
      lines.push(
        `${t("feeding.bottle")} ${summary.feedingTotalMl}ml · ${summary.bottleCount}×`
      );
    }
    if (summary.solidCount > 0) {
      lines.push(`${t("feeding.solid")} · ${summary.solidCount}×`);
    }
  }

  if (filter === "all" || filter === "sleep") {
    if (summary.napCount > 0 || summary.nightSleepCount > 0) {
      const hours = Math.floor(summary.sleepMinutes / 60);
      const mins = summary.sleepMinutes % 60;
      const timeStr = formatDurationShort(hours, mins, t);
      const totalCount = summary.napCount + summary.nightSleepCount;
      lines.push(`${t("sleep.title")} ${timeStr} · ${totalCount}×`);
    }
  }

  if (filter === "all" || filter === "diaper") {
    if (summary.diaperCount.total > 0) {
      const parts: string[] = [];
      if (summary.diaperCount.wet > 0) parts.push(`${summary.diaperCount.wet} ${t("diaper.wet").toLowerCase()}`);
      if (summary.diaperCount.dirty > 0) parts.push(`${summary.diaperCount.dirty} ${t("diaper.dirty").toLowerCase()}`);
      if (summary.diaperCount.mixed > 0) parts.push(`${summary.diaperCount.mixed} ${t("diaper.mixed").toLowerCase()}`);
      if (summary.diaperCount.dry > 0) parts.push(`${summary.diaperCount.dry} ${t("diaper.dry").toLowerCase()}`);
      lines.push(`${t("diaper.title")} · ${parts.join(", ")}`);
    }
  }

  if (filter === "all" || filter === "pumping") {
    if (summary.pumpingCount > 0) {
      lines.push(
        `${t("pumping.title")} ${summary.pumpingTotalMl}ml · ${summary.pumpingCount}×`
      );
    }
  }

  if (filter === "all" || filter === "growth") {
    if (summary.growthCount > 0) {
      lines.push(`${t("growth.title")} · ${summary.growthCount}×`);
    }
  }

  if (filter === "all" || filter === "tummyTime") {
    if (summary.tummyTimeCount > 0) {
      lines.push(
        `${t("tummyTime.title")} ${summary.tummyTimeMinutes}m · ${summary.tummyTimeCount}×`
      );
    }
  }

  return lines;
}

export function formatRelativeDate(date: Date, t: (key: string) => string): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor(
    (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return t("common.today");
  if (diffDays === 1) return t("common.yesterday");

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getDateParts(date: Date): { dayName: string; dayNumber: string; month: string } {
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  const dayNumber = date.getDate().toString();
  const month = date.toLocaleDateString("en-US", { month: "short" });

  return { dayName, dayNumber, month };
}
