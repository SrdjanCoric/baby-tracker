import { describe, it, expect } from "vitest";
import {
  buildDayViewData,
  buildWeekViewData,
  calculateSleepSummary,
  buildDailySleepBars,
  getHoursForAxis,
  getEvenHoursForAxis,
  getNowPosition,
  getNowFraction,
  formatWeekRange,
  formatDateLabel,
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

  it("returns translated 'today' label for today's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const result = buildDayViewData([], new Date(2025, 2, 5), pxPerHour, now, 6, "en", "Today", "Yesterday");
    expect(result.dateLabel).toBe("Today");
  });

  it("returns translated 'yesterday' label for yesterday's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const result = buildDayViewData([], new Date(2025, 2, 4), pxPerHour, now, 6, "en", "Today", "Yesterday");
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

  it("uses clamped duration for blocks that extend beyond the day window", () => {
    const date = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 4, 0),
      endedAt: localISO(2025, 3, 5, 8, 0),
      type: "night",
      durationSeconds: 4 * 3600,
    });

    const result = buildDayViewData([sleep], date, pxPerHour);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].durationSeconds).toBe(2 * 3600);
  });

  it("includes overnight sleep in totalSleepSeconds for the next calendar day", () => {
    const today = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 4, 23, 33),
      endedAt: localISO(2025, 3, 5, 1, 33),
      type: "night",
      durationSeconds: 2 * 3600,
    });

    const result = buildDayViewData([sleep], today, pxPerHour);
    expect(result.blocks).toHaveLength(0);
    expect(result.totalSleepSeconds).toBe(93 * 60);
  });

  it("totalSleepSeconds matches block sum for same-day sleep", () => {
    const date = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 12, 0),
      endedAt: localISO(2025, 3, 5, 13, 0),
      type: "nap",
      durationSeconds: 3600,
    });

    const result = buildDayViewData([sleep], date, pxPerHour);
    expect(result.totalSleepSeconds).toBe(3600);
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
    const result = buildWeekViewData([], weekEnd, new Date(), 6, "en");
    const expectedDay = weekEnd.toLocaleDateString("en", { weekday: "short" });
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

  it("uses locale for day labels", () => {
    const weekEnd = new Date(2025, 2, 5);
    const result = buildWeekViewData([], weekEnd, new Date(), 6, "es");
    expect(result[6].dayLabel).toBe(
      weekEnd.toLocaleDateString("es", { weekday: "short" })
    );
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

  it("groups night entries spanning midnight into the same sleep night", () => {
    const now = new Date(2025, 2, 6, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 20, 0),
        endedAt: localISO(2025, 3, 5, 23, 30),
        type: "night",
        durationSeconds: 3.5 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 6, 1, 0),
        endedAt: localISO(2025, 3, 6, 5, 30),
        type: "night",
        durationSeconds: 4.5 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now, 6, 19);
    expect(result.avgBedtime).not.toBeNull();
    expect(result.avgBedtime!.getHours()).toBe(20);
    expect(result.avgBedtime!.getMinutes()).toBe(0);
    expect(result.avgWakeTime).not.toBeNull();
    expect(result.avgWakeTime!.getHours()).toBe(5);
    expect(result.avgWakeTime!.getMinutes()).toBe(30);
    expect(result.nightWakingsPerNight).toBe(1);
  });

  it("averages bedtimes across multiple nights correctly", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 19, 30),
        endedAt: localISO(2025, 3, 6, 6, 0),
        type: "night",
        durationSeconds: 10.5 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 6, 20, 30),
        endedAt: localISO(2025, 3, 7, 7, 0),
        type: "night",
        durationSeconds: 10.5 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now, 6, 19);
    expect(result.avgBedtime!.getHours()).toBe(20);
    expect(result.avgBedtime!.getMinutes()).toBe(0);
    expect(result.avgWakeTime!.getHours()).toBe(6);
    expect(result.avgWakeTime!.getMinutes()).toBe(30);
  });

  it("averages bedtimes across midnight correctly", () => {
    const now = new Date(2025, 2, 8, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 6, 23, 0),
        endedAt: localISO(2025, 3, 7, 7, 0),
        type: "night",
        durationSeconds: 8 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 8, 1, 0),
        endedAt: localISO(2025, 3, 8, 6, 0),
        type: "night",
        durationSeconds: 5 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now, 6, 19);
    expect(result.avgBedtime!.getHours()).toBe(0);
    expect(result.avgBedtime!.getMinutes()).toBe(0);
    expect(result.avgWakeTime!.getHours()).toBe(6);
    expect(result.avgWakeTime!.getMinutes()).toBe(30);
  });

  it("groups entries only after midnight using dayEndHour boundary", () => {
    const now = new Date(2025, 2, 6, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 6, 2, 0),
        endedAt: localISO(2025, 3, 6, 5, 0),
        type: "night",
        durationSeconds: 3 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now, 6, 19);
    expect(result.avgBedtime!.getHours()).toBe(2);
    expect(result.avgWakeTime!.getHours()).toBe(5);
  });

  it("averages correctly when all sleeps fall on the same day", () => {
    const now = new Date(2025, 2, 5, 22, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 10, 0),
        endedAt: localISO(2025, 3, 5, 11, 0),
        type: "nap",
        durationSeconds: 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 5, 14, 0),
        endedAt: localISO(2025, 3, 5, 15, 30),
        type: "nap",
        durationSeconds: 5400,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 5, 20, 0),
        endedAt: localISO(2025, 3, 5, 21, 0),
        type: "night",
        durationSeconds: 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.avgTotalSleepSeconds).toBe(3600 + 5400 + 3600);
    expect(result.avgNapsPerDay).toBe(2);
    expect(result.avgNapDurationSeconds).toBe(4500);
  });

  it("handles very long sleep sessions (24+ hours) split across days", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 20, 0),
        endedAt: localISO(2025, 3, 7, 6, 0),
        type: "night",
        durationSeconds: 34 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.longestStretchSeconds).toBe(34 * 3600);
    const day5Seconds = 4 * 3600;
    const day6Seconds = 24 * 3600;
    const day7Seconds = 6 * 3600;
    expect(result.avgTotalSleepSeconds).toBe(
      Math.round((day5Seconds + day6Seconds + day7Seconds) / 3)
    );
  });

  it("splits overnight sleep at midnight between two days", () => {
    const now = new Date(2025, 2, 6, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 23, 50),
        endedAt: localISO(2025, 3, 6, 1, 50),
        type: "night",
        durationSeconds: 2 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    const daysArr = [
      { date: "2025-03-05", expectedSeconds: 10 * 60 },
      { date: "2025-03-06", expectedSeconds: 110 * 60 },
    ];
    const totalExpected = daysArr[0].expectedSeconds + daysArr[1].expectedSeconds;
    expect(result.avgTotalSleepSeconds).toBe(Math.round(totalExpected / 2));
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

describe("formatDateLabel", () => {
  it("returns the provided today label for today's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const label = formatDateLabel(new Date(2025, 2, 5), now, "en", "Today", "Yesterday");
    expect(label).toBe("Today");
  });

  it("returns the provided yesterday label for yesterday's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const label = formatDateLabel(new Date(2025, 2, 4), now, "en", "Today", "Yesterday");
    expect(label).toBe("Yesterday");
  });

  it("returns translated labels when provided", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const label = formatDateLabel(new Date(2025, 2, 5), now, "sr", "Danas", "Juče");
    expect(label).toBe("Danas");
  });

  it("returns formatted date for older dates", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const label = formatDateLabel(new Date(2025, 2, 1), now, "en");
    expect(label).toContain("Mar");
    expect(label).toContain("1");
  });

  it("uses provided locale for formatting older dates", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const labelEn = formatDateLabel(new Date(2025, 2, 1), now, "en");
    const labelEs = formatDateLabel(new Date(2025, 2, 1), now, "es");
    expect(labelEn).not.toBe(labelEs);
  });
});

describe("formatWeekRange", () => {
  it("formats week range with start and end dates", () => {
    const result = formatWeekRange(new Date(2025, 2, 5));
    expect(result).toContain("–");
  });

  it("includes month and day for both start and end", () => {
    const result = formatWeekRange(new Date(2025, 2, 12), "en");
    expect(result).toMatch(/\w+ \d+/);
    expect(result).toContain("–");
  });

  it("uses provided locale for date formatting", () => {
    const resultEn = formatWeekRange(new Date(2025, 2, 12), "en");
    const resultEs = formatWeekRange(new Date(2025, 2, 12), "es");
    expect(resultEn).not.toBe(resultEs);
  });
});

describe("buildDailySleepBars", () => {
  it("returns correct number of bars for 7 days", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const bars = buildDailySleepBars([], 7, now);
    expect(bars).toHaveLength(7);
  });

  it("returns correct number of bars for 14 days", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const bars = buildDailySleepBars([], 14, now);
    expect(bars).toHaveLength(14);
  });

  it("aggregates night and nap hours per day", () => {
    const now = new Date(2025, 2, 7, 18, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 7, 10, 0),
        endedAt: localISO(2025, 3, 7, 11, 0),
        type: "nap",
        durationSeconds: 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 7, 14, 0),
        endedAt: localISO(2025, 3, 7, 15, 0),
        type: "nap",
        durationSeconds: 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 7, 2, 0),
        endedAt: localISO(2025, 3, 7, 5, 0),
        type: "night",
        durationSeconds: 3 * 3600,
      }),
    ];

    const bars = buildDailySleepBars(sleeps, 7, now);
    const todayBar = bars[bars.length - 1];
    expect(todayBar.napHours).toBe(2);
    expect(todayBar.nightHours).toBe(3);
  });

  it("returns zero hours for days without sleep data", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const bars = buildDailySleepBars([], 7, now);
    bars.forEach((bar) => {
      expect(bar.nightHours).toBe(0);
      expect(bar.napHours).toBe(0);
    });
  });

  it("uses day number as label", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const bars = buildDailySleepBars([], 7, now);
    expect(bars[bars.length - 1].label).toBe("7");
  });

  it("includes dateKey in YYYY-MM-DD format", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const bars = buildDailySleepBars([], 7, now);
    expect(bars[bars.length - 1].dateKey).toBe("2025-03-07");
    for (const bar of bars) {
      expect(bar.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("excludes in-progress sleeps without endedAt", () => {
    const now = new Date(2025, 2, 7, 14, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 7, 10, 0),
        type: "nap",
      }),
    ];

    const bars = buildDailySleepBars(sleeps, 7, now);
    const todayBar = bars[bars.length - 1];
    expect(todayBar.napHours).toBe(0);
  });

  it("splits overnight sleep across two days at midnight", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 6, 22, 0),
        endedAt: localISO(2025, 3, 7, 6, 0),
        type: "night",
        durationSeconds: 8 * 3600,
      }),
    ];

    const bars = buildDailySleepBars(sleeps, 7, now);
    const mar6Bar = bars.find((b) => b.label === "6");
    const mar7Bar = bars.find((b) => b.label === "7");
    expect(mar6Bar).toBeDefined();
    expect(mar7Bar).toBeDefined();
    expect(mar6Bar!.nightHours).toBe(2);
    expect(mar7Bar!.nightHours).toBe(6);
  });
});

describe("bedtimeStdDevMinutes", () => {
  it("returns null when fewer than 2 bedtimes", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 6, 21, 0),
        endedAt: localISO(2025, 3, 7, 7, 0),
        type: "night",
        durationSeconds: 10 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.bedtimeStdDevMinutes).toBeNull();
  });

  it("returns 0 when all bedtimes are the same", () => {
    const now = new Date(2025, 2, 8, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 6, 21, 0),
        endedAt: localISO(2025, 3, 7, 7, 0),
        type: "night",
        durationSeconds: 10 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 7, 21, 0),
        endedAt: localISO(2025, 3, 8, 7, 0),
        type: "night",
        durationSeconds: 10 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.bedtimeStdDevMinutes).toBe(0);
  });

  it("returns correct std dev for varying bedtimes", () => {
    const now = new Date(2025, 2, 9, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 7, 20, 0),
        endedAt: localISO(2025, 3, 8, 6, 0),
        type: "night",
        durationSeconds: 10 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 8, 22, 0),
        endedAt: localISO(2025, 3, 9, 6, 0),
        type: "night",
        durationSeconds: 8 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    expect(result.bedtimeStdDevMinutes).not.toBeNull();
    expect(result.bedtimeStdDevMinutes).toBe(60);
  });

  it("handles bedtimes crossing midnight correctly", () => {
    const now = new Date(2025, 2, 9, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 7, 23, 30),
        endedAt: localISO(2025, 3, 8, 7, 0),
        type: "night",
        durationSeconds: 7.5 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 9, 0, 30),
        endedAt: localISO(2025, 3, 9, 7, 0),
        type: "night",
        durationSeconds: 6.5 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now, 6, 19);
    expect(result.bedtimeStdDevMinutes).not.toBeNull();
    expect(result.bedtimeStdDevMinutes).toBe(30);
  });

  it("returns null for empty sleeps", () => {
    const result = calculateSleepSummary([]);
    expect(result.bedtimeStdDevMinutes).toBeNull();
  });
});
