import { describe, it, expect } from "vitest";
import { calculateDailySummary, type TimelineDataByDate } from "./timeline";
import { buildDayViewData } from "./sleep-patterns";
import type { StoredSleepEntry } from "@/services/sleep-storage";

function localISO(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute, 0).toISOString();
}

function makeSleep(
  id: string,
  startedAt: string,
  endedAt: string,
  type: "nap" | "night" = "nap"
): StoredSleepEntry {
  return {
    id,
    babyId: "baby1",
    type,
    startedAt,
    endedAt,
    durationSeconds: Math.floor(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
    ),
    createdAt: startedAt,
    updatedAt: endedAt,
  };
}

function dataWith(sleeps: StoredSleepEntry[]): TimelineDataByDate {
  return { feedings: [], sleeps, diapers: [], pumpings: [], growths: [], tummyTimes: [] };
}

const DAY = new Date(2026, 6, 15);

function dayViewMinutes(
  sleeps: StoredSleepEntry[],
  date: Date = DAY,
  dayStartHour = 6,
  dayEndHour = 19
): number {
  const view = buildDayViewData(sleeps, date, 60, new Date(), dayStartHour, "en", dayEndHour);
  return Math.round(view.totalSleepSeconds / 60);
}

describe("calculateDailySummary sleep totals", () => {
  it("counts overlapping sleeps once, matching the day view total", () => {
    const sleeps = [
      makeSleep("a", localISO(2026, 7, 15, 10, 0), localISO(2026, 7, 15, 11, 30)),
      makeSleep("b", localISO(2026, 7, 15, 10, 5), localISO(2026, 7, 15, 11, 35)),
    ];

    const summary = calculateDailySummary(DAY, dataWith(sleeps));

    expect(summary.sleepMinutes).toBe(95);
    expect(summary.sleepMinutes).toBe(dayViewMinutes(sleeps));
    expect(summary.napCount).toBe(1);
    expect(summary.nightSleepCount).toBe(0);
  });

  it("counts a duplicated entry once", () => {
    const start = localISO(2026, 7, 15, 13, 0);
    const end = localISO(2026, 7, 15, 14, 0);
    const sleeps = [makeSleep("a", start, end), makeSleep("b", start, end)];

    const summary = calculateDailySummary(DAY, dataWith(sleeps));

    expect(summary.sleepMinutes).toBe(60);
    expect(summary.sleepMinutes).toBe(dayViewMinutes(sleeps));
    expect(summary.napCount).toBe(1);
  });

  it("keeps non-overlapping sleeps separate", () => {
    const sleeps = [
      makeSleep("a", localISO(2026, 7, 15, 9, 0), localISO(2026, 7, 15, 10, 0)),
      makeSleep("b", localISO(2026, 7, 15, 13, 0), localISO(2026, 7, 15, 14, 30)),
    ];

    const summary = calculateDailySummary(DAY, dataWith(sleeps));

    expect(summary.sleepMinutes).toBe(150);
    expect(summary.sleepMinutes).toBe(dayViewMinutes(sleeps));
    expect(summary.napCount).toBe(2);
  });

  it("keeps adjacent entries that split a night as separate sleeps", () => {
    const sleeps = [
      makeSleep("a", localISO(2026, 7, 15, 20, 0), localISO(2026, 7, 15, 23, 0), "night"),
      makeSleep("b", localISO(2026, 7, 15, 23, 0), localISO(2026, 7, 16, 2, 0), "night"),
    ];

    const summary = calculateDailySummary(DAY, dataWith(sleeps));

    expect(summary.sleepMinutes).toBe(360);
    expect(summary.sleepMinutes).toBe(dayViewMinutes(sleeps));
    expect(summary.nightSleepCount).toBe(2);
    expect(summary.napCount).toBe(0);
  });

  it("attributes only the current-day portion of a sleep crossing the day start", () => {
    const sleeps = [
      makeSleep("a", localISO(2026, 7, 15, 22, 0), localISO(2026, 7, 16, 7, 0), "night"),
    ];

    const summary = calculateDailySummary(DAY, dataWith(sleeps));

    expect(summary.sleepMinutes).toBe(480);
    expect(summary.sleepMinutes).toBe(dayViewMinutes(sleeps));
  });
});

describe("calculateDailySummary day boundary", () => {
  it("classifies an evening sleep by the configured dayEndHour", () => {
    const sleeps = [
      makeSleep("a", localISO(2026, 7, 15, 18, 0), localISO(2026, 7, 15, 18, 45), "nap"),
    ];

    const defaultBoundary = calculateDailySummary(DAY, dataWith(sleeps), 6, 19);
    const earlyBoundary = calculateDailySummary(DAY, dataWith(sleeps), 6, 17);

    expect(defaultBoundary.napCount).toBe(1);
    expect(defaultBoundary.nightSleepCount).toBe(0);
    expect(earlyBoundary.napCount).toBe(0);
    expect(earlyBoundary.nightSleepCount).toBe(1);
    expect(earlyBoundary.sleepMinutes).toBe(45);
    expect(earlyBoundary.sleepMinutes).toBe(dayViewMinutes(sleeps, DAY, 6, 17));
  });
});
