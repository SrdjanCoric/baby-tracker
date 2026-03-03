import { describe, it, expect } from "vitest";
import {
  buildDayViewData,
  buildWeekViewData,
  calculateSleepSummary,
  getHoursForAxis,
  getEvenHoursForAxis,
  getNowPosition,
  getNowFraction,
  formatWeekRange,
} from "./sleep-patterns";
import type { StoredSleepEntry } from "@/services/sleep-storage";

function makeSleep(
  overrides: Partial<StoredSleepEntry> & { startedAt: string; type: "nap" | "night" }
): StoredSleepEntry {
  return {
    id: Math.random().toString(36).slice(2),
    babyId: "baby1",
    createdAt: overrides.startedAt,
    updatedAt: overrides.startedAt,
    ...overrides,
  };
}

function localISO(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute, 0).toISOString();
}

describe("buildDayViewData", () => {
  const pxPerHour = 60;

  it("positions a mid-day nap correctly", () => {
    const date = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 12, 0),
      endedAt: localISO(2025, 3, 5, 13, 0),
      type: "nap",
      durationSeconds: 3600,
    });

    const result = buildDayViewData([sleep], date, pxPerHour);

    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0];
    expect(block.type).toBe("nap");
    expect(block.durationSeconds).toBe(3600);
    expect(block.heightPx).toBeCloseTo(60, 0);
    expect(block.topPx).toBeCloseTo(6 * 60, 0);
  });

  it("clips sleep that starts before 6AM window", () => {
    const date = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 4, 0),
      endedAt: localISO(2025, 3, 5, 8, 0),
      type: "night",
      durationSeconds: 4 * 3600,
    });

    const result = buildDayViewData([sleep], date, pxPerHour);
    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0];
    expect(block.topPx).toBe(0);
    expect(block.heightPx).toBeCloseTo(2 * 60, 0);
  });

  it("handles in-progress sleep (no endedAt)", () => {
    const date = new Date(2025, 2, 5);
    const now = new Date(2025, 2, 5, 14, 0, 0);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 13, 0),
      type: "nap",
    });

    const result = buildDayViewData([sleep], date, pxPerHour, now);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].heightPx).toBeCloseTo(60, 0);
  });

  it("excludes sleeps outside the day window", () => {
    const date = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 4, 10, 0),
      endedAt: localISO(2025, 3, 4, 11, 0),
      type: "nap",
      durationSeconds: 3600,
    });

    const result = buildDayViewData([sleep], date, pxPerHour);
    expect(result.blocks).toHaveLength(0);
  });

  it("returns 'Today' for today's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const result = buildDayViewData([], new Date(2025, 2, 5), pxPerHour, now);
    expect(result.dateLabel).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const result = buildDayViewData([], new Date(2025, 2, 4), pxPerHour, now);
    expect(result.dateLabel).toBe("Yesterday");
  });

  it("enforces minimum block height", () => {
    const date = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 12, 0),
      endedAt: localISO(2025, 3, 5, 12, 0),
      type: "nap",
      durationSeconds: 30,
    });

    const result = buildDayViewData([sleep], date, pxPerHour);
    expect(result.blocks[0].heightPx).toBeGreaterThanOrEqual(4);
  });

  it("returns empty blocks for empty sleeps array", () => {
    const result = buildDayViewData([], new Date(2025, 2, 5), pxPerHour);
    expect(result.blocks).toHaveLength(0);
  });

  it("positions a sleep at top when dayStartHour matches sleep start", () => {
    const date = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 7, 0),
      endedAt: localISO(2025, 3, 5, 8, 0),
      type: "nap",
      durationSeconds: 3600,
    });

    const result = buildDayViewData([sleep], date, pxPerHour, new Date(2025, 2, 5, 18, 0, 0), 7);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].topPx).toBeCloseTo(0, 0);
    expect(result.blocks[0].heightPx).toBeCloseTo(60, 0);
  });

  it("excludes sleep before custom dayStartHour window", () => {
    const date = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 6, 0),
      endedAt: localISO(2025, 3, 5, 6, 30),
      type: "nap",
      durationSeconds: 1800,
    });

    const result = buildDayViewData([sleep], date, pxPerHour, new Date(2025, 2, 5, 18, 0, 0), 7);

    expect(result.blocks).toHaveLength(0);
  });
});

describe("buildWeekViewData", () => {
  it("returns 7 columns", () => {
    const result = buildWeekViewData([], new Date(2025, 2, 5));
    expect(result).toHaveLength(7);
  });

  it("marks today correctly", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const result = buildWeekViewData([], new Date(2025, 2, 5), now);
    const todayCol = result.find((c) => c.isToday);
    expect(todayCol).toBeDefined();
    expect(todayCol!.dateNum).toBe("5");
  });

  it("has correct day labels for last column", () => {
    const weekEnd = new Date(2025, 2, 5);
    const result = buildWeekViewData([], weekEnd);
    const expectedDay = weekEnd.toLocaleDateString("en-US", { weekday: "short" });
    expect(result[6].dayLabel).toBe(expectedDay);
  });

  it("places sleep blocks with correct fractions", () => {
    const weekEnd = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 12, 0),
      endedAt: localISO(2025, 3, 5, 14, 0),
      type: "nap",
      durationSeconds: 7200,
    });

    const now = new Date(2025, 2, 5, 18, 0, 0);
    const result = buildWeekViewData([sleep], weekEnd, now);

    const todayCol = result[6];
    expect(todayCol.blocks).toHaveLength(1);
    expect(todayCol.blocks[0].topFraction).toBeCloseTo(6 / 24, 2);
    expect(todayCol.blocks[0].heightFraction).toBeCloseTo(2 / 24, 2);
  });
});

describe("calculateSleepSummary", () => {
  it("returns empty summary for no sleeps", () => {
    const result = calculateSleepSummary([]);
    expect(result.avgBedtime).toBeNull();
    expect(result.avgWakeTime).toBeNull();
    expect(result.avgTotalSleepSeconds).toBe(0);
    expect(result.longestStretchSeconds).toBe(0);
    expect(result.bedtimeTrend).toHaveLength(0);
  });

  it("calculates avg bedtime and wake time", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 4, 21, 0),
        endedAt: localISO(2025, 3, 5, 7, 0),
        type: "night",
        durationSeconds: 10 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 3, 22, 0),
        endedAt: localISO(2025, 3, 4, 6, 0),
        type: "night",
        durationSeconds: 8 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.avgBedtime).not.toBeNull();
    expect(result.avgWakeTime).not.toBeNull();
    expect(result.longestStretchSeconds).toBe(10 * 3600);
  });

  it("calculates nap averages", () => {
    const now = new Date(2025, 2, 5, 18, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 10, 0),
        endedAt: localISO(2025, 3, 5, 11, 0),
        type: "nap",
        durationSeconds: 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 5, 14, 0),
        endedAt: localISO(2025, 3, 5, 15, 0),
        type: "nap",
        durationSeconds: 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.avgNapDurationSeconds).toBe(3600);
  });

  it("handles days with no sleep data", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 10, 0),
        endedAt: localISO(2025, 3, 5, 11, 0),
        type: "nap",
        durationSeconds: 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.avgTotalSleepSeconds).toBe(3600);
  });

  it("excludes in-progress sleeps without endedAt", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 10, 0),
        type: "nap",
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.avgTotalSleepSeconds).toBe(0);
  });

  it("calculates night wakings when multiple night sessions on same day", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 4, 21, 0),
        endedAt: localISO(2025, 3, 4, 23, 30),
        type: "night",
        durationSeconds: 2.5 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 4, 23, 45),
        endedAt: localISO(2025, 3, 5, 3, 0),
        type: "night",
        durationSeconds: 3.25 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.nightWakingsPerNight).toBeGreaterThan(0);
  });
});

describe("getHoursForAxis", () => {
  it("returns 24 hours starting from 6", () => {
    const hours = getHoursForAxis();
    expect(hours).toHaveLength(24);
    expect(hours[0]).toBe(6);
    expect(hours[hours.length - 1]).toBe(5);
  });

  it("returns 24 hours starting from custom dayStartHour", () => {
    const hours = getHoursForAxis(7);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toBe(7);
    expect(hours[hours.length - 1]).toBe(6);
  });
});

describe("getEvenHoursForAxis", () => {
  it("returns 12 hours at 2-hour intervals", () => {
    const hours = getEvenHoursForAxis();
    expect(hours).toHaveLength(12);
    expect(hours[0]).toBe(6);
    expect(hours[1]).toBe(8);
  });

  it("returns 12 hours starting from custom dayStartHour", () => {
    const hours = getEvenHoursForAxis(7);
    expect(hours).toHaveLength(12);
    expect(hours[0]).toBe(7);
    expect(hours[1]).toBe(9);
  });
});

describe("getNowPosition", () => {
  it("returns position for current time within window", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const pos = getNowPosition(60, now);
    expect(pos).not.toBeNull();
    expect(pos!).toBeCloseTo(6 * 60, 0);
  });

  it("returns null for time before window start", () => {
    const now = new Date(2025, 2, 5, 4, 0, 0);
    const pos = getNowPosition(60, now);
    expect(pos).toBeNull();
  });

  it("shifts position with custom dayStartHour", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const pos = getNowPosition(60, now, 7);
    expect(pos).not.toBeNull();
    expect(pos!).toBeCloseTo(5 * 60, 0);
  });
});

describe("getNowFraction", () => {
  it("returns fraction for current time within window", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const frac = getNowFraction(now);
    expect(frac).not.toBeNull();
    expect(frac!).toBeCloseTo(0.25, 2);
  });
});

describe("formatWeekRange", () => {
  it("formats week range with start and end dates", () => {
    const result = formatWeekRange(new Date(2025, 2, 5));
    expect(result).toContain("–");
  });
});
