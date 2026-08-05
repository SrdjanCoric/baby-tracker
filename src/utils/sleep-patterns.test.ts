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
  sleepDayKey,
  classifySleepType,
  classifySleepByTimeRange,
  splitSleepAtDayBoundary,
  getSleepDate,
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

describe("sleepDayKey", () => {
  it("returns same date when hour >= dayStartHour", () => {
    const date = new Date(2025, 2, 5, 12, 0, 0);
    expect(sleepDayKey(date, 6)).toBe("2025-03-05");
  });

  it("returns previous date when hour < dayStartHour", () => {
    const date = new Date(2025, 2, 5, 3, 0, 0);
    expect(sleepDayKey(date, 6)).toBe("2025-03-04");
  });

  it("returns same date when hour equals dayStartHour", () => {
    const date = new Date(2025, 2, 5, 7, 0, 0);
    expect(sleepDayKey(date, 7)).toBe("2025-03-05");
  });

  it("handles midnight correctly", () => {
    const date = new Date(2025, 2, 5, 0, 0, 0);
    expect(sleepDayKey(date, 6)).toBe("2025-03-04");
  });
});

describe("classifySleepType", () => {
  it("returns nap during day hours", () => {
    expect(classifySleepType(10, 6, 19)).toBe("nap");
    expect(classifySleepType(6, 6, 19)).toBe("nap");
    expect(classifySleepType(18, 6, 19)).toBe("nap");
  });

  it("returns night during night hours", () => {
    expect(classifySleepType(19, 6, 19)).toBe("night");
    expect(classifySleepType(23, 6, 19)).toBe("night");
    expect(classifySleepType(3, 6, 19)).toBe("night");
    expect(classifySleepType(5, 6, 19)).toBe("night");
  });

  it("handles boundary at dayStartHour", () => {
    expect(classifySleepType(7, 7, 19)).toBe("nap");
    expect(classifySleepType(6, 7, 19)).toBe("night");
  });

  it("handles boundary at dayEndHour", () => {
    expect(classifySleepType(19, 6, 19)).toBe("night");
    expect(classifySleepType(18, 6, 19)).toBe("nap");
  });
});

describe("splitSleepAtDayBoundary", () => {
  it("returns empty for sleep without endedAt", () => {
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 10, 0),
      type: "nap",
    });
    expect(splitSleepAtDayBoundary(sleep, 6, 19)).toHaveLength(0);
  });

  it("returns single segment for same-day sleep", () => {
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 10, 0),
      endedAt: localISO(2025, 3, 5, 11, 0),
      type: "nap",
      durationSeconds: 3600,
    });
    const segs = splitSleepAtDayBoundary(sleep, 6, 19);
    expect(segs).toHaveLength(1);
    expect(segs[0].dateKey).toBe("2025-03-05");
    expect(segs[0].seconds).toBe(3600);
    expect(segs[0].type).toBe("nap");
  });

  it("splits at dayStartHour boundary", () => {
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 4, 0),
      endedAt: localISO(2025, 3, 5, 8, 0),
      type: "night",
      durationSeconds: 4 * 3600,
    });
    const segs = splitSleepAtDayBoundary(sleep, 6, 19);
    expect(segs).toHaveLength(2);
    expect(segs[0].dateKey).toBe("2025-03-04");
    expect(segs[0].seconds).toBe(2 * 3600);
    expect(segs[0].type).toBe("night");
    expect(segs[1].dateKey).toBe("2025-03-05");
    expect(segs[1].seconds).toBe(2 * 3600);
    expect(segs[1].type).toBe("nap");
  });

  it("auto-classifies type based on segment start hour", () => {
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 20, 0),
      endedAt: localISO(2025, 3, 6, 8, 0),
      type: "night",
      durationSeconds: 12 * 3600,
    });
    const segs = splitSleepAtDayBoundary(sleep, 7, 19);
    expect(segs).toHaveLength(2);
    expect(segs[0].type).toBe("night");
    expect(segs[1].type).toBe("nap");
  });

  it("handles overnight sleep staying in one segment when not crossing dayStartHour", () => {
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 4, 23, 0),
      endedAt: localISO(2025, 3, 5, 2, 0),
      type: "night",
      durationSeconds: 3 * 3600,
    });
    const segs = splitSleepAtDayBoundary(sleep, 6, 19);
    expect(segs).toHaveLength(1);
    expect(segs[0].dateKey).toBe("2025-03-04");
    expect(segs[0].seconds).toBe(3 * 3600);
    expect(segs[0].type).toBe("night");
  });

  it("splits sleep crossing dayStartHour=7", () => {
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 6, 0),
      endedAt: localISO(2025, 3, 5, 8, 0),
      type: "night",
      durationSeconds: 2 * 3600,
    });
    const segs = splitSleepAtDayBoundary(sleep, 7, 19);
    expect(segs).toHaveLength(2);
    expect(segs[0].dateKey).toBe("2025-03-04");
    expect(segs[0].seconds).toBe(3600);
    expect(segs[0].type).toBe("night");
    expect(segs[1].dateKey).toBe("2025-03-05");
    expect(segs[1].seconds).toBe(3600);
    expect(segs[1].type).toBe("nap");
  });
});

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

  it("returns formatted date label for today's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const result = buildDayViewData([], new Date(2025, 2, 5), pxPerHour, now, 6, "en");
    expect(result.dateLabel).toContain("Mar");
    expect(result.dateLabel).toContain("5");
  });

  it("returns formatted date label for yesterday's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const result = buildDayViewData([], new Date(2025, 2, 4), pxPerHour, now, 6, "en");
    expect(result.dateLabel).toContain("Mar");
    expect(result.dateLabel).toContain("4");
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

  it("attributes overnight sleep before dayStartHour to previous sleep day", () => {
    const today = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 4, 23, 33),
      endedAt: localISO(2025, 3, 5, 1, 33),
      type: "night",
      durationSeconds: 2 * 3600,
    });

    const result = buildDayViewData([sleep], today, pxPerHour);
    expect(result.blocks).toHaveLength(0);
    expect(result.totalSleepSeconds).toBe(0);
  });

  it("includes overnight sleep crossing dayStartHour in totalSleepSeconds", () => {
    const today = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 4, 23, 0),
      endedAt: localISO(2025, 3, 5, 8, 0),
      type: "night",
      durationSeconds: 9 * 3600,
    });

    const result = buildDayViewData([sleep], today, pxPerHour);
    expect(result.totalSleepSeconds).toBe(2 * 3600);
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

  it("counts partially overlapping sleeps once", () => {
    const date = new Date(2025, 2, 5);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 12, 0),
        endedAt: localISO(2025, 3, 5, 13, 0),
        type: "nap",
        durationSeconds: 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 5, 12, 30),
        endedAt: localISO(2025, 3, 5, 13, 30),
        type: "nap",
        durationSeconds: 3600,
      }),
    ];

    const result = buildDayViewData(sleeps, date, pxPerHour);

    expect(result.totalSleepSeconds).toBe(90 * 60);
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

  it("auto-classifies block type based on start hour", () => {
    const date = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 20, 0),
      endedAt: localISO(2025, 3, 5, 21, 0),
      type: "nap",
      durationSeconds: 3600,
    });

    const result = buildDayViewData([sleep], date, pxPerHour);
    expect(result.blocks[0].type).toBe("night");
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

  it("auto-classifies block type based on start hour", () => {
    const weekEnd = new Date(2025, 2, 5);
    const sleep = makeSleep({
      startedAt: localISO(2025, 3, 5, 21, 0),
      endedAt: localISO(2025, 3, 5, 22, 0),
      type: "nap",
      durationSeconds: 3600,
    });

    const now = new Date(2025, 2, 5, 23, 0, 0);
    const result = buildWeekViewData([sleep], weekEnd, now);
    const todayCol = result[6];
    expect(todayCol.blocks[0].type).toBe("night");
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
    const now = new Date(2025, 2, 6, 18, 0, 0);
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

  it("averages nap time over napping days instead of all days with sleep", () => {
    const now = new Date(2025, 2, 8, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 4, 20, 0),
        endedAt: localISO(2025, 3, 4, 23, 0),
        type: "night",
        durationSeconds: 3 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 5, 10, 0),
        endedAt: localISO(2025, 3, 5, 11, 0),
        type: "nap",
        durationSeconds: 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 6, 10, 0),
        endedAt: localISO(2025, 3, 6, 12, 0),
        type: "nap",
        durationSeconds: 2 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);

    expect(result.avgNapTimeSeconds).toBe(90 * 60);
    expect(result.nappingDays).toBe(2);
    expect(result.avgTotalSleepSeconds).toBe(2 * 3600);
  });

  it("returns zero nap time and napping days when the range has only night sleep", () => {
    const now = new Date(2025, 2, 8, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 6, 20, 0),
        endedAt: localISO(2025, 3, 6, 23, 0),
        type: "night",
        durationSeconds: 3 * 3600,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);

    expect(result.avgNapTimeSeconds).toBe(0);
    expect(result.nappingDays).toBe(0);
  });

  it("counts the sleep day receiving the nap segment across day start", () => {
    const now = new Date(2025, 2, 8, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 7, 5, 30),
        endedAt: localISO(2025, 3, 7, 7, 0),
        type: "night",
        durationSeconds: 90 * 60,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now, 6, 19);

    expect(result.avgNapTimeSeconds).toBe(60 * 60);
    expect(result.nappingDays).toBe(1);
  });

  it("handles days with no sleep data", () => {
    const now = new Date(2025, 2, 6, 12, 0, 0);
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

  it.each([7, 14, 30])(
    "uses the %i most recent completed sleep days for every average and bar",
    (days) => {
      const now = new Date(2026, 7, 1, 18, 0, 0);
      const completedSleeps = Array.from({ length: days }, (_, index) => {
        const date = new Date(2026, 6, 31 - index, 21, 0, 0);
        const end = new Date(date);
        end.setDate(end.getDate() + 1);
        end.setHours(7, 0, 0, 0);
        return makeSleep({
          startedAt: date.toISOString(),
          endedAt: end.toISOString(),
          type: "night",
          durationSeconds: 10 * 3600,
        });
      });
      const partialCurrentDay = makeSleep({
        startedAt: localISO(2026, 8, 1, 12, 0),
        endedAt: localISO(2026, 8, 1, 13, 0),
        type: "nap",
        durationSeconds: 3600,
      });

      const summary = calculateSleepSummary(
        [...completedSleeps, partialCurrentDay],
        days,
        now,
        9,
        21
      );
      const bars = buildDailySleepBars(
        [...completedSleeps, partialCurrentDay],
        days,
        now,
        9,
        21
      );

      expect(summary.avgTotalSleepSeconds).toBe(10 * 3600);
      expect(summary.avgNapsPerDay).toBe(0);
      expect(summary.avgNapDurationSeconds).toBe(0);
      expect(bars).toHaveLength(days);
      expect(bars[0].dateKey).toBe(
        days === 7 ? "2026-07-25" : days === 14 ? "2026-07-18" : "2026-07-02"
      );
      expect(bars.at(-1)?.dateKey).toBe("2026-07-31");
      expect(bars.some((bar) => bar.dateKey === "2026-08-01")).toBe(false);
    }
  );

  it("uses interval union for overlapping sleep averages", () => {
    const now = new Date(2025, 2, 6, 18, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 10, 0),
        endedAt: localISO(2025, 3, 5, 12, 0),
        type: "nap",
        durationSeconds: 2 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 5, 10, 30),
        endedAt: localISO(2025, 3, 5, 11, 0),
        type: "nap",
        durationSeconds: 30 * 60,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);

    expect(result.avgTotalSleepSeconds).toBe(2 * 3600);
    expect(result.longestStretchSeconds).toBe(2 * 3600);
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

  it("groups every fragment by its selected sleep-day key", () => {
    const now = new Date(2026, 7, 1, 18, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2026, 7, 31, 20, 35),
        endedAt: localISO(2026, 8, 1, 0, 20),
        type: "nap",
        durationSeconds: 3 * 3600 + 45 * 60,
      }),
      makeSleep({
        startedAt: localISO(2026, 8, 1, 2, 15),
        endedAt: localISO(2026, 8, 1, 6, 55),
        type: "nap",
        durationSeconds: 4 * 3600 + 40 * 60,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now, 9, 21);

    expect(result.bedtimeTrend).toHaveLength(1);
    expect(result.wakeTimeTrend).toHaveLength(1);
    expect(result.avgBedtime?.getHours()).toBe(20);
    expect(result.avgBedtime?.getMinutes()).toBe(35);
    expect(result.avgWakeTime?.getHours()).toBe(6);
    expect(result.avgWakeTime?.getMinutes()).toBe(55);
    expect(result.nightWakingsPerNight).toBe(1);
  });

  it("excludes the incomplete current night before day-start", () => {
    const now = new Date(2026, 7, 1, 8, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2026, 7, 30, 21, 0),
        endedAt: localISO(2026, 7, 31, 7, 0),
        type: "night",
        durationSeconds: 10 * 3600,
      }),
      makeSleep({
        startedAt: localISO(2026, 7, 31, 20, 35),
        endedAt: localISO(2026, 8, 1, 0, 20),
        type: "night",
        durationSeconds: 3 * 3600 + 45 * 60,
      }),
      makeSleep({
        startedAt: localISO(2026, 8, 1, 2, 15),
        endedAt: localISO(2026, 8, 1, 6, 55),
        type: "night",
        durationSeconds: 4 * 3600 + 40 * 60,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now, 9, 21);

    expect(result.bedtimeTrend).toHaveLength(1);
    expect(result.wakeTimeTrend).toHaveLength(1);
    expect(result.avgBedtime?.getHours()).toBe(21);
    expect(result.avgWakeTime?.getHours()).toBe(7);
  });

  it("assigns an oldest-boundary overlap to the selected window without an eighth night", () => {
    const now = new Date(2026, 7, 1, 18, 0, 0);
    const sleeps = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(2026, 6, 26 + index, 21, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      end.setHours(7, 0, 0, 0);
      return makeSleep({
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        type: "night",
        durationSeconds: 10 * 3600,
      });
    });
    sleeps.unshift(
      makeSleep({
        startedAt: localISO(2026, 7, 25, 7, 30),
        endedAt: localISO(2026, 7, 25, 9, 30),
        type: "night",
        durationSeconds: 2 * 3600,
      })
    );

    const result = calculateSleepSummary(sleeps, 7, now, 9, 21);

    expect(result.bedtimeTrend).toHaveLength(7);
    expect(result.bedtimeTrend[0].date).toEqual(
      new Date(2026, 6, 25, 12, 0, 0)
    );
  });

  it("counts the selected portion of a nap overlapping the oldest boundary", () => {
    const now = new Date(2026, 7, 1, 18, 0, 0);
    const sleep = makeSleep({
      startedAt: localISO(2026, 7, 25, 8, 30),
      endedAt: localISO(2026, 7, 25, 10, 0),
      type: "night",
      durationSeconds: 90 * 60,
    });

    const result = calculateSleepSummary([sleep], 7, now, 9, 21);

    expect(result.avgTotalSleepSeconds).toBe(60 * 60);
    expect(result.avgNapsPerDay).toBe(1);
    expect(result.avgNapDurationSeconds).toBe(60 * 60);
  });

  it("averages 21:00, 23:00, and 01:00 circularly to 23:00", () => {
    const now = new Date(2026, 7, 1, 18, 0, 0);
    const sleeps = [
      [28, 21],
      [29, 23],
      [31, 1],
    ].map(([day, hour]) => {
      const start = new Date(2026, 6, day, hour, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 4);
      return makeSleep({
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        type: "night",
        durationSeconds: 4 * 3600,
      });
    });

    const result = calculateSleepSummary(sleeps, 7, now, 9, 21);

    expect(result.avgBedtime?.getHours()).toBe(23);
    expect(result.avgBedtime?.getMinutes()).toBe(0);
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
    const now = new Date(2025, 2, 6, 12, 0, 0);
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
    const day5Seconds = 10 * 3600;
    const day6Seconds = 24 * 3600;
    expect(result.avgTotalSleepSeconds).toBe(
      Math.round((day5Seconds + day6Seconds) / 2)
    );
  });

  it("splits overnight sleep at dayStartHour between two sleep days", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 5, 23, 50),
        endedAt: localISO(2025, 3, 6, 8, 0),
        type: "night",
        durationSeconds: 8 * 3600 + 10 * 60,
      }),
    ];

    const result = calculateSleepSummary(sleeps, 7, now);
    const day5Seconds = 6 * 3600 + 10 * 60;
    const day6Seconds = 2 * 3600;
    const totalExpected = day5Seconds + day6Seconds;
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
  it("returns formatted date for today's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const label = formatDateLabel(new Date(2025, 2, 5), now, "en");
    expect(label).toContain("Mar");
    expect(label).toContain("5");
  });

  it("returns formatted date for yesterday's date", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const label = formatDateLabel(new Date(2025, 2, 4), now, "en");
    expect(label).toContain("Mar");
    expect(label).toContain("4");
  });

  it("returns formatted date for older dates", () => {
    const now = new Date(2025, 2, 5, 12, 0, 0);
    const label = formatDateLabel(new Date(2025, 2, 1), now, "en");
    expect(label).toContain("Mar");
    expect(label).toContain("1");
  });

  it("uses provided locale for formatting", () => {
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
    const now = new Date(2025, 2, 8, 18, 0, 0);
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
    const mar6Bar = bars[bars.length - 2];
    expect(mar6Bar.nightHours).toBe(3);
  });

  it("uses interval union for overlapping daily bars", () => {
    const now = new Date(2025, 2, 8, 18, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 7, 10, 0),
        endedAt: localISO(2025, 3, 7, 11, 0),
        type: "nap",
        durationSeconds: 3600,
      }),
      makeSleep({
        startedAt: localISO(2025, 3, 7, 10, 30),
        endedAt: localISO(2025, 3, 7, 11, 30),
        type: "nap",
        durationSeconds: 3600,
      }),
    ];

    const bars = buildDailySleepBars(sleeps, 7, now);

    expect(bars[bars.length - 1].napHours).toBe(1.5);
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
    expect(bars[bars.length - 1].label).toBe("6");
  });

  it("includes dateKey in YYYY-MM-DD format", () => {
    const now = new Date(2025, 2, 7, 12, 0, 0);
    const bars = buildDailySleepBars([], 7, now);
    expect(bars[bars.length - 1].dateKey).toBe("2025-03-06");
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

  it("splits overnight sleep at dayStartHour between two sleep days", () => {
    const now = new Date(2025, 2, 8, 12, 0, 0);
    const sleeps = [
      makeSleep({
        startedAt: localISO(2025, 3, 6, 22, 0),
        endedAt: localISO(2025, 3, 7, 8, 0),
        type: "night",
        durationSeconds: 10 * 3600,
      }),
    ];

    const bars = buildDailySleepBars(sleeps, 7, now);
    const mar6Bar = bars.find((b) => b.dateKey === "2025-03-06");
    const mar7Bar = bars.find((b) => b.dateKey === "2025-03-07");
    expect(mar6Bar).toBeDefined();
    expect(mar7Bar).toBeDefined();
    expect(mar6Bar!.nightHours).toBe(8);
    expect(mar7Bar!.napHours).toBe(2);
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

describe("classifySleepByTimeRange", () => {
  it("returns nap when entirely during day hours", () => {
    const start = new Date(2025, 2, 5, 10, 0, 0);
    const end = new Date(2025, 2, 5, 11, 0, 0);
    expect(classifySleepByTimeRange(start, end, 6, 19)).toBe("nap");
  });

  it("returns night when entirely during night hours", () => {
    const start = new Date(2025, 2, 5, 21, 0, 0);
    const end = new Date(2025, 2, 5, 23, 0, 0);
    expect(classifySleepByTimeRange(start, end, 6, 19)).toBe("night");
  });

  it("switches to night when crossing boundary with other side >30min and larger", () => {
    const start = new Date(2025, 2, 5, 18, 45, 0);
    const end = new Date(2025, 2, 5, 20, 45, 0);
    expect(classifySleepByTimeRange(start, end, 6, 19)).toBe("night");
  });

  it("keeps start type when other side <30min", () => {
    const start = new Date(2025, 2, 5, 18, 45, 0);
    const end = new Date(2025, 2, 5, 19, 20, 0);
    expect(classifySleepByTimeRange(start, end, 6, 19)).toBe("nap");
  });

  it("keeps start type when other side >30min but smaller than start side", () => {
    const start = new Date(2025, 2, 5, 17, 0, 0);
    const end = new Date(2025, 2, 5, 19, 45, 0);
    expect(classifySleepByTimeRange(start, end, 6, 19)).toBe("nap");
  });
});

describe("getSleepDate", () => {
  it("returns previous day when before dayStartHour", () => {
    const at2am = new Date(2025, 2, 7, 2, 0, 0);
    const result = getSleepDate(at2am, 6);
    expect(result.getDate()).toBe(6);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("returns same day when after dayStartHour", () => {
    const at7am = new Date(2025, 2, 7, 7, 0, 0);
    const result = getSleepDate(at7am, 6);
    expect(result.getDate()).toBe(7);
    expect(result.getHours()).toBe(0);
  });

  it("returns previous day at 5:59am", () => {
    const at559 = new Date(2025, 2, 7, 5, 59, 0);
    const result = getSleepDate(at559, 6);
    expect(result.getDate()).toBe(6);
  });

  it("returns same day at exactly 6:00am", () => {
    const at600 = new Date(2025, 2, 7, 6, 0, 0);
    const result = getSleepDate(at600, 6);
    expect(result.getDate()).toBe(7);
  });

  it("respects custom dayStartHour", () => {
    const at4am = new Date(2025, 2, 7, 4, 0, 0);
    expect(getSleepDate(at4am, 5).getDate()).toBe(6);
    expect(getSleepDate(at4am, 4).getDate()).toBe(7);
  });
});
