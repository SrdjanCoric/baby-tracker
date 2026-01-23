/**
 * Timeline utility functions for calculating daily summaries and formatting
 */

import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredGrowthEntry } from "@/services/growth-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import type { ActivityType } from "@/constants/activities";

export interface DailySummary {
  date: Date;
  feedingCount: number;
  feedingTotalMl: number;
  nursingMinutes: number;
  nursingCount: number;
  bottleCount: number;
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
  data: TimelineDataByDate
): DailySummary {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // Filter entries for the target date
  const dayFeedings = data.feedings.filter((f) =>
    isSameDay(new Date(f.startedAt), targetDate)
  );
  const daySleeps = data.sleeps.filter((s) =>
    isSameDay(new Date(s.startedAt), targetDate)
  );
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

  // Calculate feeding metrics
  const nursingFeedings = dayFeedings.filter((f) => f.type === "breast");
  const bottleFeedings = dayFeedings.filter((f) => f.type === "bottle");
  const solidFeedings = dayFeedings.filter((f) => f.type === "solid");

  const nursingMinutes = nursingFeedings.reduce(
    (sum, f) => sum + Math.round((f.durationSeconds || 0) / 60),
    0
  );
  const feedingTotalMl = bottleFeedings.reduce(
    (sum, f) => sum + (f.amountMl || 0),
    0
  );

  // Calculate sleep metrics
  const naps = daySleeps.filter((s) => s.type === "nap");
  const nightSleeps = daySleeps.filter((s) => s.type === "night");
  const sleepMinutes = daySleeps.reduce(
    (sum, s) => sum + Math.round((s.durationSeconds || 0) / 60),
    0
  );

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
    feedingCount: dayFeedings.length,
    feedingTotalMl,
    nursingMinutes,
    nursingCount: nursingFeedings.length,
    bottleCount: bottleFeedings.length,
    solidCount: solidFeedings.length,
    sleepMinutes,
    napCount: naps.length,
    nightSleepCount: nightSleeps.length,
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
    if (summary.bottleCount > 0) {
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
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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
