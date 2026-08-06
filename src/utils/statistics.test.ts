import { describe, it, expect } from "vitest";
import {
  filterEntriesByDateRange,
  calculateFeedingStats,
  calculateSleepStats,
  calculateDiaperStats,
  calculatePumpingStats,
  calculateTummyTimeStats,
  calculateWeeklyBreakdown,
  calculateDailyBreakdown,
  calculateExtendedFeedingStats,
  calculateExtendedSleepStats,
  calculateExtendedDiaperStats,
  calculateRolling7DayAverage,
  getDateRangeForPeriod,
  type DateRange,
} from "./statistics";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";

describe("getDateRangeForPeriod", () => {
  it("returns today's date range for today period", () => {
    const now = new Date(2024, 0, 15, 14, 30);
    const range = getDateRangeForPeriod("today", now);

    expect(range.start.getFullYear()).toBe(2024);
    expect(range.start.getMonth()).toBe(0);
    expect(range.start.getDate()).toBe(15);
    expect(range.start.getHours()).toBe(0);
    expect(range.start.getMinutes()).toBe(0);

    expect(range.end.getFullYear()).toBe(2024);
    expect(range.end.getMonth()).toBe(0);
    expect(range.end.getDate()).toBe(15);
    expect(range.end.getHours()).toBe(23);
    expect(range.end.getMinutes()).toBe(59);
  });

  it("returns last 7 days for 7days period", () => {
    const now = new Date(2024, 0, 15, 14, 30);
    const range = getDateRangeForPeriod("7days", now);

    expect(range.start.getFullYear()).toBe(2024);
    expect(range.start.getMonth()).toBe(0);
    expect(range.start.getDate()).toBe(9);
    expect(range.start.getHours()).toBe(0);

    expect(range.end.getFullYear()).toBe(2024);
    expect(range.end.getMonth()).toBe(0);
    expect(range.end.getDate()).toBe(15);
    expect(range.end.getHours()).toBe(23);
  });

  it("returns last 30 days for 30days period", () => {
    const now = new Date(2024, 0, 30, 14, 30);
    const range = getDateRangeForPeriod("30days", now);

    expect(range.start.getFullYear()).toBe(2024);
    expect(range.start.getMonth()).toBe(0);
    expect(range.start.getDate()).toBe(1);
    expect(range.start.getHours()).toBe(0);

    expect(range.end.getFullYear()).toBe(2024);
    expect(range.end.getMonth()).toBe(0);
    expect(range.end.getDate()).toBe(30);
    expect(range.end.getHours()).toBe(23);
  });
});

describe("filterEntriesByDateRange", () => {
  const mockEntries = [
    { startedAt: "2024-01-15T10:00:00Z" },
    { startedAt: "2024-01-14T12:00:00Z" },
    { startedAt: "2024-01-13T08:00:00Z" },
    { startedAt: "2024-01-10T15:00:00Z" },
  ];

  it("filters entries within date range", () => {
    const range: DateRange = {
      start: new Date("2024-01-13T00:00:00Z"),
      end: new Date("2024-01-15T23:59:59Z"),
    };

    const filtered = filterEntriesByDateRange(
      mockEntries,
      range,
      (entry) => entry.startedAt
    );

    expect(filtered).toHaveLength(3);
  });

  it("returns empty array when no entries match", () => {
    const range: DateRange = {
      start: new Date("2024-02-01T00:00:00Z"),
      end: new Date("2024-02-07T23:59:59Z"),
    };

    const filtered = filterEntriesByDateRange(
      mockEntries,
      range,
      (entry) => entry.startedAt
    );

    expect(filtered).toHaveLength(0);
  });

  it("handles different date field extractors", () => {
    const entriesWithChangedAt = [
      { changedAt: "2024-01-15T10:00:00Z" },
      { changedAt: "2024-01-14T12:00:00Z" },
    ];

    const range: DateRange = {
      start: new Date("2024-01-15T00:00:00Z"),
      end: new Date("2024-01-15T23:59:59Z"),
    };

    const filtered = filterEntriesByDateRange(
      entriesWithChangedAt,
      range,
      (entry) => entry.changedAt
    );

    expect(filtered).toHaveLength(1);
  });
});

describe("calculateFeedingStats", () => {
  const mockBreastFeeding: StoredFeedingEntry = {
    id: "1",
    babyId: "baby1",
    type: "breast",
    side: "left",
    startedAt: "2024-01-15T08:00:00Z",
    endedAt: "2024-01-15T08:20:00Z",
    durationSeconds: 1200,
    createdAt: "2024-01-15T08:00:00Z",
    updatedAt: "2024-01-15T08:20:00Z",
  };

  const mockBottleFeeding: StoredFeedingEntry = {
    id: "2",
    babyId: "baby1",
    type: "bottle",
    contentType: "formula",
    amountMl: 120,
    startedAt: "2024-01-15T12:00:00Z",
    durationSeconds: 600,
    createdAt: "2024-01-15T12:00:00Z",
    updatedAt: "2024-01-15T12:10:00Z",
  };

  const mockSolidFeeding: StoredFeedingEntry = {
    id: "3",
    babyId: "baby1",
    type: "solid",
    foodType: "banana",
    reaction: "loved",
    startedAt: "2024-01-15T18:00:00Z",
    createdAt: "2024-01-15T18:00:00Z",
    updatedAt: "2024-01-15T18:00:00Z",
  };

  it("calculates total feeding count", () => {
    const stats = calculateFeedingStats([mockBreastFeeding, mockBottleFeeding, mockSolidFeeding]);
    expect(stats.totalCount).toBe(3);
  });

  it("calculates total feeding duration", () => {
    const stats = calculateFeedingStats([mockBreastFeeding, mockBottleFeeding]);
    expect(stats.totalDurationSeconds).toBe(1800);
  });

  it("calculates count by type", () => {
    const stats = calculateFeedingStats([mockBreastFeeding, mockBottleFeeding, mockSolidFeeding]);
    expect(stats.breastCount).toBe(1);
    expect(stats.bottleCount).toBe(1);
    expect(stats.solidsCount).toBe(1);
  });

  it("calculates total bottle volume", () => {
    const secondBottle: StoredFeedingEntry = {
      ...mockBottleFeeding,
      id: "4",
      amountMl: 90,
    };
    const stats = calculateFeedingStats([mockBottleFeeding, secondBottle]);
    expect(stats.totalBottleVolumeMl).toBe(210);
  });

  it("handles empty array", () => {
    const stats = calculateFeedingStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.totalDurationSeconds).toBe(0);
    expect(stats.breastCount).toBe(0);
    expect(stats.bottleCount).toBe(0);
    expect(stats.solidsCount).toBe(0);
    expect(stats.totalBottleVolumeMl).toBe(0);
  });

  it("ignores undefined durations", () => {
    const feedingWithoutDuration: StoredFeedingEntry = {
      ...mockSolidFeeding,
      durationSeconds: undefined,
    };
    const stats = calculateFeedingStats([mockBreastFeeding, feedingWithoutDuration]);
    expect(stats.totalDurationSeconds).toBe(1200);
  });
});

describe("calculateSleepStats", () => {
  const mockNap: StoredSleepEntry = {
    id: "1",
    babyId: "baby1",
    type: "nap",
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: "2024-01-15T11:00:00Z",
    durationSeconds: 3600,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T11:00:00Z",
  };

  const mockNightSleep: StoredSleepEntry = {
    id: "2",
    babyId: "baby1",
    type: "night",
    startedAt: "2024-01-15T21:00:00Z",
    endedAt: "2024-01-16T06:00:00Z",
    durationSeconds: 32400,
    createdAt: "2024-01-15T21:00:00Z",
    updatedAt: "2024-01-16T06:00:00Z",
  };

  it("calculates total sleep duration", () => {
    const stats = calculateSleepStats([mockNap, mockNightSleep]);
    expect(stats.totalDurationSeconds).toBe(36000);
  });

  it("counts naps", () => {
    const secondNap: StoredSleepEntry = {
      ...mockNap,
      id: "3",
      startedAt: "2024-01-15T12:00:00Z",
      endedAt: "2024-01-15T13:00:00Z",
    };
    const stats = calculateSleepStats([mockNap, secondNap, mockNightSleep]);
    expect(stats.napCount).toBe(2);
  });

  it("counts night sleep sessions", () => {
    const stats = calculateSleepStats([mockNap, mockNightSleep]);
    expect(stats.nightCount).toBe(1);
  });

  it("uses interval union for overlapping sleep totals", () => {
    const overlappingNap: StoredSleepEntry = {
      ...mockNap,
      id: "3",
      startedAt: "2024-01-15T10:30:00Z",
      endedAt: "2024-01-15T11:30:00Z",
      durationSeconds: 3600,
    };

    const stats = calculateSleepStats([mockNap, overlappingNap]);

    expect(stats.totalDurationSeconds).toBe(90 * 60);
    expect(stats.napCount).toBe(1);
  });

  it("calculates average nap duration", () => {
    const shortNap: StoredSleepEntry = {
      ...mockNap,
      id: "3",
      startedAt: "2024-01-15T12:00:00Z",
      endedAt: "2024-01-15T12:30:00Z",
      durationSeconds: 1800,
    };
    const stats = calculateSleepStats([mockNap, shortNap]);
    expect(stats.averageNapDurationSeconds).toBe(2700);
  });

  it("handles empty array", () => {
    const stats = calculateSleepStats([]);
    expect(stats.totalDurationSeconds).toBe(0);
    expect(stats.napCount).toBe(0);
    expect(stats.nightCount).toBe(0);
    expect(stats.averageNapDurationSeconds).toBe(0);
  });
});

describe("calculateDiaperStats", () => {
  const mockWetDiaper: StoredDiaperEntry = {
    id: "1",
    babyId: "baby1",
    type: "wet",
    changedAt: "2024-01-15T08:00:00Z",
    createdAt: "2024-01-15T08:00:00Z",
    updatedAt: "2024-01-15T08:00:00Z",
  };

  const mockDirtyDiaper: StoredDiaperEntry = {
    id: "2",
    babyId: "baby1",
    type: "dirty",
    stoolColor: "yellow",
    changedAt: "2024-01-15T10:00:00Z",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  };

  const mockMixedDiaper: StoredDiaperEntry = {
    id: "3",
    babyId: "baby1",
    type: "mixed",
    stoolColor: "brown",
    changedAt: "2024-01-15T14:00:00Z",
    createdAt: "2024-01-15T14:00:00Z",
    updatedAt: "2024-01-15T14:00:00Z",
  };

  it("calculates total diaper count", () => {
    const stats = calculateDiaperStats([mockWetDiaper, mockDirtyDiaper, mockMixedDiaper]);
    expect(stats.totalCount).toBe(3);
  });

  it("counts wet diapers", () => {
    const stats = calculateDiaperStats([mockWetDiaper, mockDirtyDiaper, mockMixedDiaper]);
    expect(stats.wetCount).toBe(1);
  });

  it("counts dirty diapers", () => {
    const stats = calculateDiaperStats([mockWetDiaper, mockDirtyDiaper, mockMixedDiaper]);
    expect(stats.dirtyCount).toBe(1);
  });

  it("counts mixed diapers", () => {
    const stats = calculateDiaperStats([mockWetDiaper, mockDirtyDiaper, mockMixedDiaper]);
    expect(stats.mixedCount).toBe(1);
  });

  it("handles empty array", () => {
    const stats = calculateDiaperStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.wetCount).toBe(0);
    expect(stats.dirtyCount).toBe(0);
    expect(stats.mixedCount).toBe(0);
  });
});

describe("calculatePumpingStats", () => {
  const mockPumping: StoredPumpingEntry = {
    id: "1",
    babyId: "baby1",
    side: "left",
    startedAt: "2024-01-15T08:00:00Z",
    endedAt: "2024-01-15T08:20:00Z",
    durationSeconds: 1200,
    volumeMl: 120,
    createdAt: "2024-01-15T08:00:00Z",
    updatedAt: "2024-01-15T08:20:00Z",
  };

  it("calculates total pumping count", () => {
    const secondPumping: StoredPumpingEntry = { ...mockPumping, id: "2" };
    const stats = calculatePumpingStats([mockPumping, secondPumping]);
    expect(stats.totalCount).toBe(2);
  });

  it("calculates total volume", () => {
    const secondPumping: StoredPumpingEntry = { ...mockPumping, id: "2", volumeMl: 90 };
    const stats = calculatePumpingStats([mockPumping, secondPumping]);
    expect(stats.totalVolumeMl).toBe(210);
  });

  it("calculates total duration", () => {
    const secondPumping: StoredPumpingEntry = { ...mockPumping, id: "2", durationSeconds: 900 };
    const stats = calculatePumpingStats([mockPumping, secondPumping]);
    expect(stats.totalDurationSeconds).toBe(2100);
  });

  it("includes a resumed pause span without splitting the pumping session", () => {
    const resumedSession: StoredPumpingEntry = {
      ...mockPumping,
      endedAt: "2024-01-15T08:30:00Z",
      durationSeconds: 1800,
    };

    expect(calculatePumpingStats([resumedSession])).toMatchObject({
      totalCount: 1,
      totalDurationSeconds: 1800,
    });
  });

  it("handles empty array", () => {
    const stats = calculatePumpingStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.totalVolumeMl).toBe(0);
    expect(stats.totalDurationSeconds).toBe(0);
  });

  it("handles undefined volume", () => {
    const pumpingWithoutVolume: StoredPumpingEntry = { ...mockPumping, volumeMl: undefined };
    const stats = calculatePumpingStats([mockPumping, pumpingWithoutVolume]);
    expect(stats.totalVolumeMl).toBe(120);
  });
});

describe("calculateTummyTimeStats", () => {
  const mockTummyTime: StoredTummyTimeEntry = {
    id: "1",
    babyId: "baby1",
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: "2024-01-15T10:05:00Z",
    durationSeconds: 300,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:05:00Z",
  };

  it("calculates total session count", () => {
    const secondSession: StoredTummyTimeEntry = { ...mockTummyTime, id: "2" };
    const stats = calculateTummyTimeStats([mockTummyTime, secondSession]);
    expect(stats.sessionCount).toBe(2);
  });

  it("calculates total duration", () => {
    const secondSession: StoredTummyTimeEntry = { ...mockTummyTime, id: "2", durationSeconds: 600 };
    const stats = calculateTummyTimeStats([mockTummyTime, secondSession]);
    expect(stats.totalDurationSeconds).toBe(900);
  });

  it("includes a resumed pause span without splitting the tummy-time session", () => {
    const resumedSession: StoredTummyTimeEntry = {
      ...mockTummyTime,
      endedAt: "2024-01-15T10:15:00Z",
      durationSeconds: 900,
    };

    expect(calculateTummyTimeStats([resumedSession])).toMatchObject({
      sessionCount: 1,
      totalDurationSeconds: 900,
    });
  });

  it("calculates average session duration", () => {
    const secondSession: StoredTummyTimeEntry = { ...mockTummyTime, id: "2", durationSeconds: 600 };
    const stats = calculateTummyTimeStats([mockTummyTime, secondSession]);
    expect(stats.averageDurationSeconds).toBe(450);
  });

  it("handles empty array", () => {
    const stats = calculateTummyTimeStats([]);
    expect(stats.sessionCount).toBe(0);
    expect(stats.totalDurationSeconds).toBe(0);
    expect(stats.averageDurationSeconds).toBe(0);
  });
});

describe("calculateWeeklyBreakdown", () => {
  it("creates entries for all 7 days", () => {
    const referenceDate = new Date("2024-01-15T12:00:00Z");
    const breakdown = calculateWeeklyBreakdown(
      [],
      (entry: { date: string }) => entry.date,
      referenceDate
    );
    expect(breakdown.size).toBe(7);
  });

  it("groups entries by day", () => {
    const entries = [
      { date: "2024-01-15T10:00:00Z" },
      { date: "2024-01-15T14:00:00Z" },
      { date: "2024-01-14T08:00:00Z" },
    ];
    const referenceDate = new Date("2024-01-15T12:00:00Z");
    const breakdown = calculateWeeklyBreakdown(
      entries,
      (entry) => entry.date,
      referenceDate
    );

    expect(breakdown.get("2024-01-15")?.length).toBe(2);
    expect(breakdown.get("2024-01-14")?.length).toBe(1);
  });

  it("ignores entries outside the 7-day window", () => {
    const entries = [
      { date: "2024-01-15T10:00:00Z" },
      { date: "2024-01-01T08:00:00Z" },
    ];
    const referenceDate = new Date("2024-01-15T12:00:00Z");
    const breakdown = calculateWeeklyBreakdown(
      entries,
      (entry) => entry.date,
      referenceDate
    );

    expect(breakdown.get("2024-01-15")?.length).toBe(1);
    expect(breakdown.get("2024-01-01")).toBeUndefined();
  });
});

describe("calculateDailyBreakdown", () => {
  it("creates entries for specified number of days", () => {
    const referenceDate = new Date("2024-01-15T12:00:00Z");
    const breakdown = calculateDailyBreakdown(
      [],
      (entry: { date: string }) => entry.date,
      30,
      referenceDate
    );
    expect(breakdown.size).toBe(30);
  });

  it("groups entries by day within window", () => {
    const entries = [
      { date: "2024-01-15T10:00:00Z" },
      { date: "2024-01-15T14:00:00Z" },
      { date: "2024-01-01T08:00:00Z" },
    ];
    const referenceDate = new Date("2024-01-15T12:00:00Z");
    const breakdown = calculateDailyBreakdown(entries, (e) => e.date, 30, referenceDate);

    expect(breakdown.get("2024-01-15")?.length).toBe(2);
    expect(breakdown.get("2024-01-01")?.length).toBe(1);
  });

  it("ignores entries outside window", () => {
    const entries = [{ date: "2023-12-01T08:00:00Z" }];
    const referenceDate = new Date("2024-01-15T12:00:00Z");
    const breakdown = calculateDailyBreakdown(entries, (e) => e.date, 30, referenceDate);

    expect(breakdown.get("2023-12-01")).toBeUndefined();
  });

  it("with 7 days matches calculateWeeklyBreakdown behavior", () => {
    const entries = [
      { date: "2024-01-15T10:00:00Z" },
      { date: "2024-01-14T08:00:00Z" },
    ];
    const referenceDate = new Date("2024-01-15T12:00:00Z");
    const daily = calculateDailyBreakdown(entries, (e) => e.date, 7, referenceDate);
    const weekly = calculateWeeklyBreakdown(entries, (e) => e.date, referenceDate);

    expect(daily.size).toBe(weekly.size);
    expect(daily.get("2024-01-15")?.length).toBe(weekly.get("2024-01-15")?.length);
    expect(daily.get("2024-01-14")?.length).toBe(weekly.get("2024-01-14")?.length);
  });
});

describe("calculateExtendedFeedingStats", () => {
  const makeFeeding = (overrides: Partial<StoredFeedingEntry> & { id: string; startedAt: string }): StoredFeedingEntry => ({
    babyId: "baby1",
    type: "breast",
    createdAt: overrides.startedAt,
    updatedAt: overrides.startedAt,
    ...overrides,
  });

  it("calculates avg time between sessions", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", endedAt: "2024-01-15T08:15:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T11:00:00Z", endedAt: "2024-01-15T11:15:00Z" }),
      makeFeeding({ id: "3", startedAt: "2024-01-15T14:00:00Z", endedAt: "2024-01-15T14:15:00Z" }),
    ];
    const stats = calculateExtendedFeedingStats(feedings);
    // Gap 1: 11:00 - 08:15 = 9900s, Gap 2: 14:00 - 11:15 = 9900s, avg = 9900s
    expect(stats.avgTimeBetweenSessionsSeconds).toBe(9900);
  });

  it("groups feedings within 1hr into same session for avg gap", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", endedAt: "2024-01-15T08:15:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T08:30:00Z", endedAt: "2024-01-15T08:45:00Z" }),
      makeFeeding({ id: "3", startedAt: "2024-01-15T12:00:00Z", endedAt: "2024-01-15T12:15:00Z" }),
    ];
    const stats = calculateExtendedFeedingStats(feedings);
    // Session 1: 08:00-08:45, Session 2: 12:00-12:15
    // Gap: 12:00 - 08:45 = 3h 15m = 11700s
    expect(stats.avgTimeBetweenSessionsSeconds).toBe(11700);
  });

  it("returns 0 for single feeding", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z" }),
    ];
    const stats = calculateExtendedFeedingStats(feedings);
    expect(stats.avgTimeBetweenSessionsSeconds).toBe(0);
  });

  it("returns 0 for empty array", () => {
    const stats = calculateExtendedFeedingStats([]);
    expect(stats.avgTimeBetweenSessionsSeconds).toBe(0);
    expect(stats.leftRightBalancePercent).toBeNull();
  });

  it("calculates L/R breast balance", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", leftDurationSeconds: 600, rightDurationSeconds: 400 }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T12:00:00Z", leftDurationSeconds: 500, rightDurationSeconds: 500 }),
    ];
    const stats = calculateExtendedFeedingStats(feedings);
    expect(stats.leftDurationSeconds).toBe(1100);
    expect(stats.rightDurationSeconds).toBe(900);
    expect(stats.leftRightBalancePercent).toEqual({ left: 55, right: 45 });
  });

  it("returns null balance when no L/R data", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", type: "bottle", amountMl: 120 }),
    ];
    const stats = calculateExtendedFeedingStats(feedings);
    expect(stats.leftRightBalancePercent).toBeNull();
  });

  it("calculates bottle volume by content type", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", type: "bottle", contentType: "formula", amountMl: 120 }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T12:00:00Z", type: "bottle", contentType: "breastMilk", amountMl: 90 }),
      makeFeeding({ id: "3", startedAt: "2024-01-15T16:00:00Z", type: "bottle", contentType: "formula", amountMl: 150 }),
    ];
    const stats = calculateExtendedFeedingStats(feedings);
    expect(stats.bottleFormulaVolumeMl).toBe(270);
    expect(stats.bottleBreastMilkVolumeMl).toBe(90);
  });
});

describe("calculateExtendedSleepStats", () => {
  const makeSleep = (overrides: Partial<StoredSleepEntry> & { id: string; startedAt: string }): StoredSleepEntry => ({
    babyId: "baby1",
    type: "nap",
    createdAt: overrides.startedAt,
    updatedAt: overrides.startedAt,
    ...overrides,
  });

  it("finds longest stretch", () => {
    const sleeps = [
      makeSleep({ id: "1", startedAt: "2024-01-15T10:00:00Z", durationSeconds: 3600 }),
      makeSleep({ id: "2", startedAt: "2024-01-15T21:00:00Z", type: "night", durationSeconds: 18000 }),
      makeSleep({ id: "3", startedAt: "2024-01-15T14:00:00Z", durationSeconds: 5400 }),
    ];
    const stats = calculateExtendedSleepStats(sleeps);
    expect(stats.longestStretchSeconds).toBe(18000);
  });

  it("returns 0 for empty array", () => {
    const stats = calculateExtendedSleepStats([]);
    expect(stats.longestStretchSeconds).toBe(0);
  });

  it("handles sleeps with undefined duration", () => {
    const sleeps = [
      makeSleep({ id: "1", startedAt: "2024-01-15T10:00:00Z", durationSeconds: undefined }),
      makeSleep({ id: "2", startedAt: "2024-01-15T14:00:00Z", durationSeconds: 3600 }),
    ];
    const stats = calculateExtendedSleepStats(sleeps);
    expect(stats.longestStretchSeconds).toBe(3600);
  });
});

describe("calculateExtendedDiaperStats", () => {
  const makeDiaper = (overrides: Partial<StoredDiaperEntry> & { id: string; changedAt: string }): StoredDiaperEntry => ({
    babyId: "baby1",
    type: "wet",
    createdAt: overrides.changedAt,
    updatedAt: overrides.changedAt,
    ...overrides,
  });

  it("calculates stool color distribution", () => {
    const diapers = [
      makeDiaper({ id: "1", changedAt: "2024-01-15T08:00:00Z", type: "dirty", stoolColor: "yellow" }),
      makeDiaper({ id: "2", changedAt: "2024-01-15T10:00:00Z", type: "dirty", stoolColor: "yellow" }),
      makeDiaper({ id: "3", changedAt: "2024-01-15T12:00:00Z", type: "mixed", stoolColor: "brown" }),
      makeDiaper({ id: "4", changedAt: "2024-01-15T14:00:00Z", type: "wet" }),
    ];
    const stats = calculateExtendedDiaperStats(diapers);
    expect(stats.stoolColorDistribution).toEqual({ yellow: 2, brown: 1 });
  });

  it("ignores wet diapers for stool color", () => {
    const diapers = [
      makeDiaper({ id: "1", changedAt: "2024-01-15T08:00:00Z", type: "wet", stoolColor: "yellow" as never }),
    ];
    const stats = calculateExtendedDiaperStats(diapers);
    expect(stats.stoolColorDistribution).toEqual({});
  });

  it("returns empty distribution when no colors tracked", () => {
    const diapers = [
      makeDiaper({ id: "1", changedAt: "2024-01-15T08:00:00Z", type: "dirty" }),
    ];
    const stats = calculateExtendedDiaperStats(diapers);
    expect(stats.stoolColorDistribution).toEqual({});
  });

  it("returns empty distribution for empty array", () => {
    const stats = calculateExtendedDiaperStats([]);
    expect(stats.stoolColorDistribution).toEqual({});
    expect(stats.totalCount).toBe(0);
  });
});

describe("calculateRolling7DayAverage", () => {
  it("calculates averages from 7 days ending yesterday", () => {
    const referenceDate = new Date("2024-01-15T14:00:00Z");
    const feedings: StoredFeedingEntry[] = [];
    // 7 feedings on Jan 14 (yesterday) - well-spaced so each is its own session
    for (let i = 0; i < 7; i++) {
      feedings.push({
        id: `f-${i}`,
        babyId: "baby1",
        type: "breast",
        startedAt: `2024-01-14T${String(i * 2 + 6).padStart(2, "0")}:00:00Z`,
        endedAt: `2024-01-14T${String(i * 2 + 6).padStart(2, "0")}:15:00Z`,
        createdAt: `2024-01-14T${String(i * 2 + 6).padStart(2, "0")}:00:00Z`,
        updatedAt: `2024-01-14T${String(i * 2 + 6).padStart(2, "0")}:00:00Z`,
      });
    }
    const sleeps: StoredSleepEntry[] = [{
      id: "s-1",
      babyId: "baby1",
      type: "night",
      startedAt: "2024-01-14T21:00:00Z",
      durationSeconds: 36000,
      createdAt: "2024-01-14T21:00:00Z",
      updatedAt: "2024-01-14T21:00:00Z",
    }];

    const avg = calculateRolling7DayAverage(feedings, sleeps, [], [], referenceDate);
    expect(avg.feedingsPerDay).toBe(1);
    expect(avg.sleepSecondsPerDay).toBe(Math.round(36000 / 7));
  });

  it("counts overlapping completed sleeps by their interval union", () => {
    const referenceDate = new Date("2024-01-15T14:00:00Z");
    const sleeps: StoredSleepEntry[] = [
      {
        id: "s-1",
        babyId: "baby1",
        type: "night",
        startedAt: "2024-01-14T20:00:00Z",
        endedAt: "2024-01-14T22:00:00Z",
        durationSeconds: 7200,
        createdAt: "2024-01-14T20:00:00Z",
        updatedAt: "2024-01-14T20:00:00Z",
      },
      {
        id: "s-2",
        babyId: "baby1",
        type: "night",
        startedAt: "2024-01-14T21:00:00Z",
        endedAt: "2024-01-14T23:00:00Z",
        durationSeconds: 7200,
        createdAt: "2024-01-14T21:00:00Z",
        updatedAt: "2024-01-14T21:00:00Z",
      },
    ];

    const avg = calculateRolling7DayAverage([], sleeps, [], [], referenceDate);

    expect(avg.sleepSecondsPerDay).toBe(Math.round((3 * 3600) / 7));
  });

  it("excludes today's data", () => {
    const referenceDate = new Date("2024-01-15T14:00:00Z");
    const feedings: StoredFeedingEntry[] = [{
      id: "f-today",
      babyId: "baby1",
      type: "breast",
      startedAt: "2024-01-15T08:00:00Z",
      createdAt: "2024-01-15T08:00:00Z",
      updatedAt: "2024-01-15T08:00:00Z",
    }];

    const avg = calculateRolling7DayAverage(feedings, [], [], [], referenceDate);
    expect(avg.feedingsPerDay).toBe(0);
  });
});
