import { describe, it, expect } from "vitest";
import {
  filterEntriesByDateRange,
  calculateFeedingStats,
  calculateSleepStats,
  calculateDiaperStats,
  calculatePumpingStats,
  calculateTummyTimeStats,
  calculateWeeklyBreakdown,
  getDateRangeForPeriod,
  type DateRange,
} from "./statistics";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";

describe("getDateRangeForPeriod", () => {
  it("returns today's date range for daily period", () => {
    const now = new Date(2024, 0, 15, 14, 30);
    const range = getDateRangeForPeriod("daily", now);

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

  it("returns last 7 days for weekly period", () => {
    const now = new Date(2024, 0, 15, 14, 30);
    const range = getDateRangeForPeriod("weekly", now);

    expect(range.start.getFullYear()).toBe(2024);
    expect(range.start.getMonth()).toBe(0);
    expect(range.start.getDate()).toBe(9);
    expect(range.start.getHours()).toBe(0);

    expect(range.end.getFullYear()).toBe(2024);
    expect(range.end.getMonth()).toBe(0);
    expect(range.end.getDate()).toBe(15);
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
    const secondNap: StoredSleepEntry = { ...mockNap, id: "3" };
    const stats = calculateSleepStats([mockNap, secondNap, mockNightSleep]);
    expect(stats.napCount).toBe(2);
  });

  it("counts night sleep sessions", () => {
    const stats = calculateSleepStats([mockNap, mockNightSleep]);
    expect(stats.nightCount).toBe(1);
  });

  it("calculates average nap duration", () => {
    const shortNap: StoredSleepEntry = { ...mockNap, id: "3", durationSeconds: 1800 };
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
