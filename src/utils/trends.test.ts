import { describe, it, expect } from "vitest";
import {
  calculateTrend,
  formatTrendPercentage,
  getTrendDirection,
  calculateWeekOverWeekTrend,
  isSignificantChange,
} from "./trends";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";

describe("calculateTrend", () => {
  it("returns increase when current is greater than previous", () => {
    const result = calculateTrend(100, 80);
    expect(result.direction).toBe("increase");
    expect(result.absoluteChange).toBe(20);
    expect(result.percentageChange).toBe(25);
  });

  it("returns decrease when current is less than previous", () => {
    const result = calculateTrend(60, 80);
    expect(result.direction).toBe("decrease");
    expect(result.absoluteChange).toBe(-20);
    expect(result.percentageChange).toBe(-25);
  });

  it("returns stable when current equals previous", () => {
    const result = calculateTrend(100, 100);
    expect(result.direction).toBe("stable");
    expect(result.absoluteChange).toBe(0);
    expect(result.percentageChange).toBe(0);
  });

  it("handles zero previous value (no prior data)", () => {
    const result = calculateTrend(100, 0);
    expect(result.direction).toBe("increase");
    expect(result.absoluteChange).toBe(100);
    expect(result.percentageChange).toBe(100);
  });

  it("handles zero current value", () => {
    const result = calculateTrend(0, 100);
    expect(result.direction).toBe("decrease");
    expect(result.absoluteChange).toBe(-100);
    expect(result.percentageChange).toBe(-100);
  });

  it("handles both values being zero", () => {
    const result = calculateTrend(0, 0);
    expect(result.direction).toBe("stable");
    expect(result.absoluteChange).toBe(0);
    expect(result.percentageChange).toBe(0);
  });

  it("rounds percentage to nearest integer", () => {
    const result = calculateTrend(103, 100);
    expect(result.percentageChange).toBe(3);
  });
});

describe("getTrendDirection", () => {
  it("returns increase for positive change", () => {
    expect(getTrendDirection(10)).toBe("increase");
  });

  it("returns decrease for negative change", () => {
    expect(getTrendDirection(-10)).toBe("decrease");
  });

  it("returns stable for zero change", () => {
    expect(getTrendDirection(0)).toBe("stable");
  });

  it("returns stable for small positive change (threshold)", () => {
    expect(getTrendDirection(0.5, 1)).toBe("stable");
  });

  it("returns stable for small negative change (threshold)", () => {
    expect(getTrendDirection(-0.5, 1)).toBe("stable");
  });

  it("returns increase when above threshold", () => {
    expect(getTrendDirection(1.5, 1)).toBe("increase");
  });
});

describe("formatTrendPercentage", () => {
  it("formats positive percentage with plus sign", () => {
    expect(formatTrendPercentage(25)).toBe("+25%");
  });

  it("formats negative percentage", () => {
    expect(formatTrendPercentage(-25)).toBe("-25%");
  });

  it("formats zero percentage", () => {
    expect(formatTrendPercentage(0)).toBe("0%");
  });

  it("rounds to nearest integer", () => {
    expect(formatTrendPercentage(25.7)).toBe("+26%");
    expect(formatTrendPercentage(-25.3)).toBe("-25%");
  });
});

describe("isSignificantChange", () => {
  it("returns true for change >= 20%", () => {
    expect(isSignificantChange(20)).toBe(true);
    expect(isSignificantChange(50)).toBe(true);
    expect(isSignificantChange(-20)).toBe(true);
    expect(isSignificantChange(-50)).toBe(true);
  });

  it("returns false for change < 20%", () => {
    expect(isSignificantChange(15)).toBe(false);
    expect(isSignificantChange(-15)).toBe(false);
    expect(isSignificantChange(0)).toBe(false);
  });

  it("accepts custom threshold", () => {
    expect(isSignificantChange(10, 10)).toBe(true);
    expect(isSignificantChange(5, 10)).toBe(false);
  });
});

describe("calculateWeekOverWeekTrend", () => {
  const createMockSleepEntries = (dates: string[], duration: number): StoredSleepEntry[] => {
    return dates.map((date, index) => ({
      id: `sleep-${index}`,
      babyId: "baby1",
      type: "nap" as const,
      startedAt: date,
      endedAt: date,
      durationSeconds: duration,
      createdAt: date,
      updatedAt: date,
    }));
  };

  const createMockFeedingEntries = (dates: string[]): StoredFeedingEntry[] => {
    return dates.map((date, index) => ({
      id: `feeding-${index}`,
      babyId: "baby1",
      type: "breast" as const,
      side: "left" as const,
      startedAt: date,
      durationSeconds: 600,
      createdAt: date,
      updatedAt: date,
    }));
  };

  const createMockDiaperEntries = (dates: string[]): StoredDiaperEntry[] => {
    return dates.map((date, index) => ({
      id: `diaper-${index}`,
      babyId: "baby1",
      type: "wet" as const,
      changedAt: date,
      createdAt: date,
      updatedAt: date,
    }));
  };

  it("calculates sleep duration trend correctly", () => {
    const referenceDate = new Date("2024-01-15T12:00:00Z");

    // This week (Jan 9-15): 3 entries × 3600s = 10800s total
    const thisWeekDates = [
      "2024-01-15T10:00:00Z",
      "2024-01-14T10:00:00Z",
      "2024-01-13T10:00:00Z",
    ];
    // Last week (Jan 2-8): 2 entries × 3600s = 7200s total
    const lastWeekDates = [
      "2024-01-08T10:00:00Z",
      "2024-01-07T10:00:00Z",
    ];

    const allEntries = [
      ...createMockSleepEntries(thisWeekDates, 3600),
      ...createMockSleepEntries(lastWeekDates, 3600),
    ];

    const trend = calculateWeekOverWeekTrend(
      allEntries,
      (entry) => entry.startedAt,
      (entries) => entries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0),
      referenceDate
    );

    expect(trend.currentValue).toBe(10800);
    expect(trend.previousValue).toBe(7200);
    expect(trend.direction).toBe("increase");
    expect(trend.absoluteChange).toBe(3600);
    expect(trend.percentageChange).toBe(50);
  });

  it("calculates feeding count trend correctly", () => {
    const referenceDate = new Date("2024-01-15T12:00:00Z");

    // This week: 5 feedings
    const thisWeekDates = [
      "2024-01-15T08:00:00Z",
      "2024-01-15T12:00:00Z",
      "2024-01-14T08:00:00Z",
      "2024-01-13T08:00:00Z",
      "2024-01-12T08:00:00Z",
    ];
    // Last week: 8 feedings
    const lastWeekDates = [
      "2024-01-08T08:00:00Z",
      "2024-01-08T12:00:00Z",
      "2024-01-07T08:00:00Z",
      "2024-01-07T12:00:00Z",
      "2024-01-06T08:00:00Z",
      "2024-01-06T12:00:00Z",
      "2024-01-05T08:00:00Z",
      "2024-01-04T08:00:00Z",
    ];

    const allEntries = [
      ...createMockFeedingEntries(thisWeekDates),
      ...createMockFeedingEntries(lastWeekDates),
    ];

    const trend = calculateWeekOverWeekTrend(
      allEntries,
      (entry) => entry.startedAt,
      (entries) => entries.length,
      referenceDate
    );

    expect(trend.currentValue).toBe(5);
    expect(trend.previousValue).toBe(8);
    expect(trend.direction).toBe("decrease");
    expect(trend.absoluteChange).toBe(-3);
    expect(Math.round(trend.percentageChange)).toBe(-37); // -3/8 = -37.5%
  });

  it("calculates diaper count trend correctly", () => {
    const referenceDate = new Date("2024-01-15T12:00:00Z");

    // This week: 6 diapers, Last week: 6 diapers (stable)
    const thisWeekDates = [
      "2024-01-15T08:00:00Z",
      "2024-01-15T12:00:00Z",
      "2024-01-14T08:00:00Z",
      "2024-01-14T12:00:00Z",
      "2024-01-13T08:00:00Z",
      "2024-01-12T08:00:00Z",
    ];
    const lastWeekDates = [
      "2024-01-08T08:00:00Z",
      "2024-01-08T12:00:00Z",
      "2024-01-07T08:00:00Z",
      "2024-01-07T12:00:00Z",
      "2024-01-06T08:00:00Z",
      "2024-01-05T08:00:00Z",
    ];

    const allEntries = [
      ...createMockDiaperEntries(thisWeekDates),
      ...createMockDiaperEntries(lastWeekDates),
    ];

    const trend = calculateWeekOverWeekTrend(
      allEntries,
      (entry) => entry.changedAt,
      (entries) => entries.length,
      referenceDate
    );

    expect(trend.currentValue).toBe(6);
    expect(trend.previousValue).toBe(6);
    expect(trend.direction).toBe("stable");
    expect(trend.percentageChange).toBe(0);
  });

  it("handles no data in current week", () => {
    const referenceDate = new Date("2024-01-15T12:00:00Z");

    // Only last week data
    const lastWeekDates = [
      "2024-01-08T08:00:00Z",
      "2024-01-07T08:00:00Z",
    ];

    const allEntries = createMockFeedingEntries(lastWeekDates);

    const trend = calculateWeekOverWeekTrend(
      allEntries,
      (entry) => entry.startedAt,
      (entries) => entries.length,
      referenceDate
    );

    expect(trend.currentValue).toBe(0);
    expect(trend.previousValue).toBe(2);
    expect(trend.direction).toBe("decrease");
    expect(trend.percentageChange).toBe(-100);
  });

  it("handles no data in previous week", () => {
    const referenceDate = new Date("2024-01-15T12:00:00Z");

    // Only this week data
    const thisWeekDates = [
      "2024-01-15T08:00:00Z",
      "2024-01-14T08:00:00Z",
    ];

    const allEntries = createMockFeedingEntries(thisWeekDates);

    const trend = calculateWeekOverWeekTrend(
      allEntries,
      (entry) => entry.startedAt,
      (entries) => entries.length,
      referenceDate
    );

    expect(trend.currentValue).toBe(2);
    expect(trend.previousValue).toBe(0);
    expect(trend.direction).toBe("increase");
    expect(trend.percentageChange).toBe(100);
  });

  it("handles empty data", () => {
    const referenceDate = new Date("2024-01-15T12:00:00Z");

    const trend = calculateWeekOverWeekTrend(
      [],
      (entry: StoredFeedingEntry) => entry.startedAt,
      (entries) => entries.length,
      referenceDate
    );

    expect(trend.currentValue).toBe(0);
    expect(trend.previousValue).toBe(0);
    expect(trend.direction).toBe("stable");
    expect(trend.percentageChange).toBe(0);
  });
});
