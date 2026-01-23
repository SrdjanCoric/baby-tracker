import { describe, it, expect } from "vitest";
import {
  aggregateMetadata,
  aggregateSummary,
  aggregateFeeding,
  aggregateSleep,
  aggregateDiapers,
  aggregatePumping,
  aggregateGrowth,
  aggregateTummyTime,
  type RawReportData,
} from "./report-aggregator";
import type { ReportOptions } from "@/types/report";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredGrowthEntry } from "@/services/growth-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";

const createMockFeeding = (
  overrides: Partial<StoredFeedingEntry> = {}
): StoredFeedingEntry => ({
  id: "feeding-1",
  babyId: "baby-1",
  type: "breast",
  startedAt: "2024-01-15T10:00:00Z",
  endedAt: "2024-01-15T10:15:00Z",
  durationSeconds: 900,
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2024-01-15T10:15:00Z",
  ...overrides,
});

const createMockSleep = (
  overrides: Partial<StoredSleepEntry> = {}
): StoredSleepEntry => ({
  id: "sleep-1",
  babyId: "baby-1",
  type: "nap",
  startedAt: "2024-01-15T13:00:00Z",
  endedAt: "2024-01-15T14:30:00Z",
  durationSeconds: 5400,
  createdAt: "2024-01-15T13:00:00Z",
  updatedAt: "2024-01-15T14:30:00Z",
  ...overrides,
});

const createMockDiaper = (
  overrides: Partial<StoredDiaperEntry> = {}
): StoredDiaperEntry => ({
  id: "diaper-1",
  babyId: "baby-1",
  type: "wet",
  changedAt: "2024-01-15T08:00:00Z",
  createdAt: "2024-01-15T08:00:00Z",
  updatedAt: "2024-01-15T08:00:00Z",
  ...overrides,
});

const createMockPumping = (
  overrides: Partial<StoredPumpingEntry> = {}
): StoredPumpingEntry => ({
  id: "pumping-1",
  babyId: "baby-1",
  side: "left",
  startedAt: "2024-01-15T07:00:00Z",
  endedAt: "2024-01-15T07:20:00Z",
  durationSeconds: 1200,
  volumeMl: 120,
  createdAt: "2024-01-15T07:00:00Z",
  updatedAt: "2024-01-15T07:20:00Z",
  ...overrides,
});

const createMockGrowth = (
  overrides: Partial<StoredGrowthEntry> = {}
): StoredGrowthEntry => ({
  id: "growth-1",
  babyId: "baby-1",
  measuredAt: "2024-01-15T09:00:00Z",
  weightKg: 5.5,
  heightCm: 55,
  headCircumferenceCm: 38,
  createdAt: "2024-01-15T09:00:00Z",
  updatedAt: "2024-01-15T09:00:00Z",
  ...overrides,
});

const createMockTummyTime = (
  overrides: Partial<StoredTummyTimeEntry> = {}
): StoredTummyTimeEntry => ({
  id: "tummy-1",
  babyId: "baby-1",
  startedAt: "2024-01-15T11:00:00Z",
  endedAt: "2024-01-15T11:10:00Z",
  durationSeconds: 600,
  createdAt: "2024-01-15T11:00:00Z",
  updatedAt: "2024-01-15T11:10:00Z",
  ...overrides,
});

describe("aggregateMetadata", () => {
  it("calculates total days between dates", () => {
    const options: ReportOptions = {
      sections: ["summary"],
      startDate: new Date("2024-01-01T00:00:00Z"),
      endDate: new Date("2024-01-10T23:59:59Z"),
      babyId: "baby-1",
      babyName: "Test Baby",
      includeCharts: true,
    };

    const metadata = aggregateMetadata(options);

    expect(metadata.babyName).toBe("Test Baby");
    expect(metadata.totalDays).toBe(10);
    expect(metadata.generatedAt).toBeInstanceOf(Date);
  });

  it("calculates baby age in months when birth date provided", () => {
    const options: ReportOptions = {
      sections: ["summary"],
      startDate: new Date("2024-01-01T00:00:00Z"),
      endDate: new Date("2024-01-31T23:59:59Z"),
      babyId: "baby-1",
      babyName: "Test Baby",
      babyBirthDate: new Date("2023-07-01T00:00:00Z"),
      includeCharts: true,
    };

    const metadata = aggregateMetadata(options);

    expect(metadata.babyAgeMonths).toBeDefined();
    expect(metadata.babyAgeMonths).toBeGreaterThan(6);
  });

  it("returns undefined age when no birth date", () => {
    const options: ReportOptions = {
      sections: ["summary"],
      startDate: new Date("2024-01-01T00:00:00Z"),
      endDate: new Date("2024-01-31T23:59:59Z"),
      babyId: "baby-1",
      babyName: "Test Baby",
      includeCharts: true,
    };

    const metadata = aggregateMetadata(options);

    expect(metadata.babyAgeMonths).toBeUndefined();
  });
});

describe("aggregateSummary", () => {
  it("aggregates all data types", () => {
    const data: RawReportData = {
      feedings: [createMockFeeding()],
      sleeps: [createMockSleep({ durationSeconds: 3600 })],
      diapers: [createMockDiaper()],
      pumpings: [createMockPumping({ volumeMl: 100 })],
      growth: [createMockGrowth()],
      tummyTimes: [createMockTummyTime({ durationSeconds: 600 })],
    };

    const summary = aggregateSummary(
      data,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(summary.totalFeedings).toBe(1);
    expect(summary.totalSleepMinutes).toBe(60);
    expect(summary.totalDiapers).toBe(1);
    expect(summary.totalPumpingMl).toBe(100);
    expect(summary.totalTummyTimeMinutes).toBe(10);
    expect(summary.growthMeasurements).toBe(1);
  });

  it("filters entries by date range", () => {
    const data: RawReportData = {
      feedings: [
        createMockFeeding({ startedAt: "2024-01-15T10:00:00Z" }),
        createMockFeeding({ id: "f2", startedAt: "2024-02-15T10:00:00Z" }),
      ],
      sleeps: [],
      diapers: [],
      pumpings: [],
      growth: [],
      tummyTimes: [],
    };

    const summary = aggregateSummary(
      data,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(summary.totalFeedings).toBe(1);
  });

  it("handles empty data", () => {
    const data: RawReportData = {
      feedings: [],
      sleeps: [],
      diapers: [],
      pumpings: [],
      growth: [],
      tummyTimes: [],
    };

    const summary = aggregateSummary(
      data,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(summary.totalFeedings).toBe(0);
    expect(summary.totalSleepMinutes).toBe(0);
    expect(summary.totalDiapers).toBe(0);
  });
});

describe("aggregateFeeding", () => {
  it("counts feedings by type", () => {
    const feedings = [
      createMockFeeding({ type: "breast" }),
      createMockFeeding({ id: "f2", type: "breast" }),
      createMockFeeding({ id: "f3", type: "bottle", amountMl: 100, contentType: "formula" }),
      createMockFeeding({ id: "f4", type: "solid", foodType: "banana" }),
    ];

    const stats = aggregateFeeding(
      feedings,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.total).toBe(4);
    expect(stats.byType.breast).toBe(2);
    expect(stats.byType.bottle).toBe(1);
    expect(stats.byType.solid).toBe(1);
  });

  it("calculates breastfeeding statistics", () => {
    const feedings = [
      createMockFeeding({
        type: "breast",
        durationSeconds: 600,
        leftDurationSeconds: 300,
        rightDurationSeconds: 300,
      }),
      createMockFeeding({
        id: "f2",
        type: "breast",
        durationSeconds: 900,
        leftDurationSeconds: 600,
        rightDurationSeconds: 300,
      }),
    ];

    const stats = aggregateFeeding(
      feedings,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.breastfeeding.totalSessions).toBe(2);
    expect(stats.breastfeeding.totalMinutes).toBe(25);
    expect(stats.breastfeeding.avgDurationMinutes).toBe(13);
    expect(stats.breastfeeding.leftMinutes).toBe(15);
    expect(stats.breastfeeding.rightMinutes).toBe(10);
  });

  it("calculates bottle statistics", () => {
    const feedings = [
      createMockFeeding({
        type: "bottle",
        amountMl: 120,
        contentType: "formula",
      }),
      createMockFeeding({
        id: "f2",
        type: "bottle",
        amountMl: 100,
        contentType: "breastMilk",
      }),
      createMockFeeding({
        id: "f3",
        type: "bottle",
        amountMl: 80,
        contentType: "formula",
      }),
    ];

    const stats = aggregateFeeding(
      feedings,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.bottle.totalSessions).toBe(3);
    expect(stats.bottle.totalMl).toBe(300);
    expect(stats.bottle.avgMl).toBe(100);
    expect(stats.bottle.byContentType.formula).toBe(2);
    expect(stats.bottle.byContentType.breastMilk).toBe(1);
  });

  it("tracks unique solid foods", () => {
    const feedings = [
      createMockFeeding({ type: "solid", foodType: "banana" }),
      createMockFeeding({ id: "f2", type: "solid", foodType: "avocado" }),
      createMockFeeding({ id: "f3", type: "solid", foodType: "banana" }),
    ];

    const stats = aggregateFeeding(
      feedings,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.solid.totalSessions).toBe(3);
    expect(stats.solid.uniqueFoods).toHaveLength(2);
    expect(stats.solid.uniqueFoods).toContain("banana");
    expect(stats.solid.uniqueFoods).toContain("avocado");
  });

  it("calculates average per day", () => {
    const feedings = [
      createMockFeeding({ startedAt: "2024-01-15T10:00:00Z" }),
      createMockFeeding({ id: "f2", startedAt: "2024-01-15T14:00:00Z" }),
      createMockFeeding({ id: "f3", startedAt: "2024-01-16T10:00:00Z" }),
    ];

    const stats = aggregateFeeding(
      feedings,
      new Date("2024-01-15T00:00:00Z"),
      new Date("2024-01-16T23:59:59Z")
    );

    expect(stats.avgPerDay).toBe(1.5);
  });
});

describe("aggregateSleep", () => {
  it("calculates total sleep statistics", () => {
    const sleeps = [
      createMockSleep({ type: "nap", durationSeconds: 3600 }),
      createMockSleep({ id: "s2", type: "nap", durationSeconds: 5400 }),
      createMockSleep({ id: "s3", type: "night", durationSeconds: 28800 }),
    ];

    const stats = aggregateSleep(
      sleeps,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.totalSessions).toBe(3);
    expect(stats.totalMinutes).toBe(630);
    expect(stats.avgDurationMinutes).toBe(210);
  });

  it("breaks down by sleep type", () => {
    const sleeps = [
      createMockSleep({ type: "nap", durationSeconds: 3600 }),
      createMockSleep({ id: "s2", type: "nap", durationSeconds: 5400 }),
      createMockSleep({ id: "s3", type: "night", durationSeconds: 28800 }),
    ];

    const stats = aggregateSleep(
      sleeps,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.byType.nap.count).toBe(2);
    expect(stats.byType.nap.totalMinutes).toBe(150);
    expect(stats.byType.nap.avgMinutes).toBe(75);
    expect(stats.byType.night.count).toBe(1);
    expect(stats.byType.night.totalMinutes).toBe(480);
  });

  it("finds longest and shortest sleep", () => {
    const sleeps = [
      createMockSleep({ durationSeconds: 1800 }),
      createMockSleep({ id: "s2", durationSeconds: 5400 }),
      createMockSleep({ id: "s3", durationSeconds: 3600 }),
    ];

    const stats = aggregateSleep(
      sleeps,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.longestSleepMinutes).toBe(90);
    expect(stats.shortestSleepMinutes).toBe(30);
  });

  it("handles empty sleep data", () => {
    const stats = aggregateSleep(
      [],
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.totalSessions).toBe(0);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.longestSleepMinutes).toBe(0);
    expect(stats.shortestSleepMinutes).toBe(0);
  });
});

describe("aggregateDiapers", () => {
  it("counts diapers by type", () => {
    const diapers = [
      createMockDiaper({ type: "wet" }),
      createMockDiaper({ id: "d2", type: "wet" }),
      createMockDiaper({ id: "d3", type: "dirty", stoolColor: "yellow" }),
      createMockDiaper({ id: "d4", type: "mixed", stoolColor: "brown" }),
    ];

    const stats = aggregateDiapers(
      diapers,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.total).toBe(4);
    expect(stats.byType.wet).toBe(2);
    expect(stats.byType.dirty).toBe(1);
    expect(stats.byType.mixed).toBe(1);
  });

  it("tracks stool colors", () => {
    const diapers = [
      createMockDiaper({ type: "dirty", stoolColor: "yellow" }),
      createMockDiaper({ id: "d2", type: "dirty", stoolColor: "yellow" }),
      createMockDiaper({ id: "d3", type: "dirty", stoolColor: "brown" }),
    ];

    const stats = aggregateDiapers(
      diapers,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.stoolColors.yellow).toBe(2);
    expect(stats.stoolColors.brown).toBe(1);
  });

  it("calculates average per day", () => {
    const diapers = [
      createMockDiaper({ changedAt: "2024-01-15T08:00:00Z" }),
      createMockDiaper({ id: "d2", changedAt: "2024-01-15T12:00:00Z" }),
      createMockDiaper({ id: "d3", changedAt: "2024-01-15T16:00:00Z" }),
      createMockDiaper({ id: "d4", changedAt: "2024-01-16T08:00:00Z" }),
    ];

    const stats = aggregateDiapers(
      diapers,
      new Date("2024-01-15T00:00:00Z"),
      new Date("2024-01-16T23:59:59Z")
    );

    expect(stats.avgPerDay).toBe(2);
  });
});

describe("aggregatePumping", () => {
  it("calculates total volume and sessions", () => {
    const pumpings = [
      createMockPumping({ volumeMl: 100, durationSeconds: 1200 }),
      createMockPumping({ id: "p2", volumeMl: 120, durationSeconds: 900 }),
      createMockPumping({ id: "p3", volumeMl: 80, durationSeconds: 600 }),
    ];

    const stats = aggregatePumping(
      pumpings,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.totalSessions).toBe(3);
    expect(stats.totalMl).toBe(300);
    expect(stats.avgMlPerSession).toBe(100);
    expect(stats.totalMinutes).toBe(45);
    expect(stats.avgMinutesPerSession).toBe(15);
  });

  it("breaks down by side", () => {
    const pumpings = [
      createMockPumping({ side: "left", volumeMl: 100 }),
      createMockPumping({ id: "p2", side: "right", volumeMl: 120 }),
      createMockPumping({ id: "p3", side: "both", volumeMl: 200 }),
      createMockPumping({ id: "p4", side: "left", volumeMl: 80 }),
    ];

    const stats = aggregatePumping(
      pumpings,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.bySide.left.sessions).toBe(2);
    expect(stats.bySide.left.totalMl).toBe(180);
    expect(stats.bySide.right.sessions).toBe(1);
    expect(stats.bySide.right.totalMl).toBe(120);
    expect(stats.bySide.both.sessions).toBe(1);
    expect(stats.bySide.both.totalMl).toBe(200);
  });

  it("handles empty pumping data", () => {
    const stats = aggregatePumping(
      [],
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.totalSessions).toBe(0);
    expect(stats.totalMl).toBe(0);
    expect(stats.avgMlPerSession).toBe(0);
  });
});

describe("aggregateGrowth", () => {
  it("aggregates measurements with percentiles for female baby", () => {
    const growth = [
      createMockGrowth({
        measuredAt: "2024-01-15T09:00:00Z",
        weightKg: 5.5,
        heightCm: 55,
        headCircumferenceCm: 38,
      }),
    ];

    const birthDate = new Date("2023-11-15T00:00:00Z");

    const stats = aggregateGrowth(
      growth,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z"),
      birthDate,
      "female"
    );

    expect(stats.measurements).toHaveLength(1);
    expect(stats.measurements[0].weight).toBe(5.5);
    expect(stats.measurements[0].height).toBe(55);
    expect(stats.measurements[0].headCircumference).toBe(38);
    expect(stats.measurements[0].weightPercentile).toBeDefined();
    expect(stats.measurements[0].heightPercentile).toBeDefined();
    expect(stats.measurements[0].headPercentile).toBeDefined();
  });

  it("calculates weight and height gain", () => {
    const growth = [
      createMockGrowth({
        measuredAt: "2024-01-01T09:00:00Z",
        weightKg: 4.0,
        heightCm: 50,
      }),
      createMockGrowth({
        id: "g2",
        measuredAt: "2024-01-15T09:00:00Z",
        weightKg: 4.5,
        heightCm: 52,
      }),
    ];

    const stats = aggregateGrowth(
      growth,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.weightGain).toBeDefined();
    expect(stats.weightGain?.change).toBe(0.5);
    expect(stats.heightGain).toBeDefined();
    expect(stats.heightGain?.change).toBe(2);
  });

  it("returns latest measurements", () => {
    const growth = [
      createMockGrowth({
        measuredAt: "2024-01-01T09:00:00Z",
        weightKg: 4.0,
      }),
      createMockGrowth({
        id: "g2",
        measuredAt: "2024-01-15T09:00:00Z",
        weightKg: 4.5,
      }),
    ];

    const stats = aggregateGrowth(
      growth,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.latestWeight).toBeDefined();
    expect(stats.latestWeight?.value).toBe(4.5);
  });

  it("handles partial measurements", () => {
    const growth = [
      createMockGrowth({
        measuredAt: "2024-01-15T09:00:00Z",
        weightKg: 5.5,
        heightCm: undefined,
        headCircumferenceCm: undefined,
      }),
    ];

    const stats = aggregateGrowth(
      growth,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.latestWeight).toBeDefined();
    expect(stats.latestHeight).toBeUndefined();
    expect(stats.latestHeadCircumference).toBeUndefined();
  });

  it("handles empty growth data", () => {
    const stats = aggregateGrowth(
      [],
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.measurements).toHaveLength(0);
    expect(stats.latestWeight).toBeUndefined();
  });
});

describe("aggregateTummyTime", () => {
  it("calculates total sessions and minutes", () => {
    const tummyTimes = [
      createMockTummyTime({ durationSeconds: 600 }),
      createMockTummyTime({ id: "t2", durationSeconds: 900 }),
      createMockTummyTime({ id: "t3", durationSeconds: 300 }),
    ];

    const stats = aggregateTummyTime(
      tummyTimes,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.totalSessions).toBe(3);
    expect(stats.totalMinutes).toBe(30);
    expect(stats.avgMinutesPerSession).toBe(10);
  });

  it("finds longest session", () => {
    const tummyTimes = [
      createMockTummyTime({ durationSeconds: 600 }),
      createMockTummyTime({ id: "t2", durationSeconds: 1200 }),
      createMockTummyTime({ id: "t3", durationSeconds: 300 }),
    ];

    const stats = aggregateTummyTime(
      tummyTimes,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.longestSessionMinutes).toBe(20);
  });

  it("tracks goal achievement", () => {
    const tummyTimes = [
      createMockTummyTime({
        startedAt: "2024-01-15T10:00:00Z",
        durationSeconds: 1200,
      }),
      createMockTummyTime({
        id: "t2",
        startedAt: "2024-01-15T14:00:00Z",
        durationSeconds: 1200,
      }),
      createMockTummyTime({
        id: "t3",
        startedAt: "2024-01-16T10:00:00Z",
        durationSeconds: 600,
      }),
    ];

    const stats = aggregateTummyTime(
      tummyTimes,
      new Date("2024-01-15T00:00:00Z"),
      new Date("2024-01-16T23:59:59Z"),
      30
    );

    expect(stats.daysGoalMet).toBe(1);
    expect(stats.totalDays).toBe(2);
  });

  it("handles empty tummy time data", () => {
    const stats = aggregateTummyTime(
      [],
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T23:59:59Z")
    );

    expect(stats.totalSessions).toBe(0);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.longestSessionMinutes).toBe(0);
  });
});
