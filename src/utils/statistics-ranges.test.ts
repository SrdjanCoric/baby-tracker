import { describe, expect, it } from "vitest";
import {
  getAllHistoryRange,
  getCalendarStatisticsRange,
  getSleepDayRange,
  getSleepSummaryRange,
  getSleepWeekRange,
  pointInActivityRange,
  sleepOverlapsActivityRange,
} from "./statistics-ranges";

describe("statistics activity ranges", () => {
  it("builds half-open UTC ranges for every statistics control", () => {
    const referenceDate = new Date(2026, 6, 14, 12, 0, 0);
    const day = new Date(2026, 5, 2, 0, 0, 0);
    const weekEnd = new Date(2026, 5, 14, 0, 0, 0);

    expect(getCalendarStatisticsRange("today", referenceDate)).toEqual({
      start: new Date(2026, 6, 14, 0, 0, 0, 0).toISOString(),
      end: new Date(2026, 6, 15, 0, 0, 0, 0).toISOString(),
    });
    expect(getCalendarStatisticsRange("7days", referenceDate)).toEqual({
      start: new Date(2026, 6, 8, 0, 0, 0, 0).toISOString(),
      end: new Date(2026, 6, 15, 0, 0, 0, 0).toISOString(),
    });
    expect(getSleepDayRange(day, 6)).toEqual({
      start: new Date(2026, 5, 2, 6, 0, 0, 0).toISOString(),
      end: new Date(2026, 5, 3, 6, 0, 0, 0).toISOString(),
    });
    expect(getSleepWeekRange(weekEnd, 6)).toEqual({
      start: new Date(2026, 5, 8, 6, 0, 0, 0).toISOString(),
      end: new Date(2026, 5, 15, 6, 0, 0, 0).toISOString(),
    });
    expect(getSleepSummaryRange(14, referenceDate)).toEqual({
      start: new Date(2026, 5, 30, 0, 0, 0, 0).toISOString(),
      end: new Date(2026, 6, 15, 0, 0, 0, 0).toISOString(),
    });
    const allHistory = getAllHistoryRange();
    expect(allHistory).toEqual({
      start: "0001-01-01T00:00:00.000Z",
      end: "9999-12-31T23:59:59.999Z",
    });
    expect(pointInActivityRange("2030-01-01T00:00:00.000Z", allHistory)).toBe(true);
  });

  it("detects cached point activities and sleep overlap at half-open boundaries", () => {
    const range = {
      start: "2026-07-14T06:00:00.000Z",
      end: "2026-07-15T06:00:00.000Z",
    };

    expect(pointInActivityRange("2026-07-14T06:00:00.000Z", range)).toBe(true);
    expect(pointInActivityRange("2026-07-15T06:00:00.000Z", range)).toBe(false);
    expect(sleepOverlapsActivityRange({
      startedAt: "2026-07-13T22:00:00.000Z",
      endedAt: "2026-07-14T07:00:00.000Z",
    }, range)).toBe(true);
    expect(sleepOverlapsActivityRange({
      startedAt: "2026-07-13T22:00:00.000Z",
      endedAt: range.start,
    }, range)).toBe(false);
  });
});
