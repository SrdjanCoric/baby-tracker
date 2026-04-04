import { describe, it, expect } from "vitest";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { WakeWindowConfig } from "@/types/wake-windows";
import {
  computeSmartSleepPrediction,
  computePredictionWithTiming,
  getPerSlotAverages,
  isSmartSleepEligible,
  getAgeDays,
  countConsecutiveDays,
  getCircadianMaturity,
  getSlotWeight,
  getSDConfidence,
} from "./smart-sleep";

function makeSleep(
  overrides: Partial<StoredSleepEntry> & { startedAt: string; endedAt: string; type: "nap" | "night" }
): StoredSleepEntry {
  return {
    id: `sleep-${Math.random().toString(36).slice(2, 9)}`,
    babyId: "baby-1",
    createdAt: overrides.startedAt,
    updatedAt: overrides.startedAt,
    durationSeconds: Math.round(
      (new Date(overrides.endedAt).getTime() - new Date(overrides.startedAt).getTime()) / 1000
    ),
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<WakeWindowConfig>): WakeWindowConfig {
  return {
    napCount: 3,
    slots: [
      { slotIndex: 0, label: "nap1", durationMinutes: 120 },
      { slotIndex: 1, label: "nap2", durationMinutes: 140 },
      { slotIndex: 2, label: "nap3", durationMinutes: 160 },
      { slotIndex: 3, label: "bedtime", durationMinutes: 180 },
    ],
    source: "smart",
    dayStartHour: 6,
    dayEndHour: 19,
    ...overrides,
  };
}

function generateWeekOfSleepData(options: {
  baseDate: Date;
  morningWakeHour: number;
  napTimesAfterWake: number[];
  napDurationMinutes: number;
  days: number;
}): StoredSleepEntry[] {
  const entries: StoredSleepEntry[] = [];
  const { baseDate, morningWakeHour, napTimesAfterWake, napDurationMinutes, days } = options;

  for (let d = 0; d < days; d++) {
    const day = new Date(baseDate);
    day.setDate(day.getDate() - d);

    const nightStart = new Date(day);
    nightStart.setDate(nightStart.getDate() - 1);
    nightStart.setHours(19, 30, 0, 0);

    const nightEnd = new Date(day);
    nightEnd.setHours(morningWakeHour, 0, 0, 0);

    entries.push(makeSleep({
      type: "night",
      startedAt: nightStart.toISOString(),
      endedAt: nightEnd.toISOString(),
    }));

    for (const minutesAfterWake of napTimesAfterWake) {
      const napStart = new Date(nightEnd.getTime() + minutesAfterWake * 60 * 1000);
      const napEnd = new Date(napStart.getTime() + napDurationMinutes * 60 * 1000);

      entries.push(makeSleep({
        type: "nap",
        startedAt: napStart.toISOString(),
        endedAt: napEnd.toISOString(),
      }));
    }
  }

  return entries;
}

const BABY_4_MONTHS = "2025-12-03";
const BABY_3_WEEKS = "2026-03-13";

describe("isSmartSleepEligible", () => {
  it("returns true for baby >= 8 weeks old", () => {
    const now = new Date("2026-04-03");
    expect(isSmartSleepEligible(BABY_4_MONTHS, now)).toBe(true);
  });

  it("returns false for baby under 8 weeks", () => {
    const now = new Date("2026-04-03");
    expect(isSmartSleepEligible(BABY_3_WEEKS, now)).toBe(false);
  });

  it("returns true at exactly 56 days", () => {
    const birthDate = "2026-02-06";
    const now = new Date("2026-04-03");
    expect(getAgeDays(birthDate, now)).toBe(56);
    expect(isSmartSleepEligible(birthDate, now)).toBe(true);
  });

  it("returns false at 55 days", () => {
    const birthDate = "2026-02-07";
    const now = new Date("2026-04-03");
    expect(getAgeDays(birthDate, now)).toBe(55);
    expect(isSmartSleepEligible(birthDate, now)).toBe(false);
  });
});

describe("computeSmartSleepPrediction", () => {
  it("returns isEligible false for baby under 8 weeks", () => {
    const now = new Date("2026-04-03");
    const result = computeSmartSleepPrediction([], BABY_3_WEEKS, 0, null, now);
    expect(result.isEligible).toBe(false);
    expect(result.confidence).toBe("age_based");
  });

  it("returns personalized prediction with sufficient data", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig();
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.isEligible).toBe(true);
    expect(result.confidence).toBe("personalized");
    expect(result.slotType).toBe("nap");
    expect(result.slotIndex).toBe(0);
    expect(result.centerMinutes).toBe(120);
  });

  it("falls back to age_based when fewer than 3 data points for slot", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      days: 2,
    });

    const config = makeConfig();
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.isEligible).toBe(true);
    expect(result.confidence).toBe("age_based");
  });

  it("computes per-slot variation correctly", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");

    const entries: StoredSleepEntry[] = [];
    for (let d = 0; d < 5; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);

      const nightStart = new Date(day);
      nightStart.setDate(nightStart.getDate() - 1);
      nightStart.setHours(19, 30, 0, 0);

      const nightEnd = new Date(day);
      nightEnd.setHours(7, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: nightStart.toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      const nap1Start = new Date(nightEnd.getTime() + 90 * 60 * 1000);
      const nap1End = new Date(nap1Start.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: nap1Start.toISOString(),
        endedAt: nap1End.toISOString(),
      }));

      const nap2Start = new Date(nap1End.getTime() + 150 * 60 * 1000);
      const nap2End = new Date(nap2Start.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: nap2Start.toISOString(),
        endedAt: nap2End.toISOString(),
      }));
    }

    const config = makeConfig({ napCount: 2 });

    const slot0 = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);
    expect(slot0.confidence).toBe("personalized");
    expect(slot0.centerMinutes).toBe(90);

    const slot1 = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 1, config, now);
    expect(slot1.confidence).toBe("personalized");
    expect(slot1.centerMinutes).toBe(150);
  });

  it("identifies bedtime slot correctly", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300],
      napDurationMinutes: 60,
      days: 5,
    });

    const config = makeConfig({ napCount: 2 });
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 2, config, now);

    expect(result.isEligible).toBe(true);
    expect(result.slotType).toBe("bedtime");
  });

  it("uses nap continuation to group consecutive short sleeps", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries: StoredSleepEntry[] = [];

    for (let d = 0; d < 5; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);

      const nightEnd = new Date(day);
      nightEnd.setHours(7, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: new Date(nightEnd.getTime() - 10 * 60 * 60 * 1000).toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      const nap1Start = new Date(nightEnd.getTime() + 120 * 60 * 1000);
      const nap1End = new Date(nap1Start.getTime() + 20 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: nap1Start.toISOString(),
        endedAt: nap1End.toISOString(),
      }));

      const nap1bStart = new Date(nap1End.getTime() + 10 * 60 * 1000);
      const nap1bEnd = new Date(nap1bStart.getTime() + 30 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: nap1bStart.toISOString(),
        endedAt: nap1bEnd.toISOString(),
      }));

      const nap2Start = new Date(nap1bEnd.getTime() + 150 * 60 * 1000);
      const nap2End = new Date(nap2Start.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: nap2Start.toISOString(),
        endedAt: nap2End.toISOString(),
      }));
    }

    const config = makeConfig({ napCount: 2 });

    const slot0 = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);
    expect(slot0.confidence).toBe("personalized");
    expect(slot0.centerMinutes).toBe(120);

    const slot1 = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 1, config, now);
    expect(slot1.confidence).toBe("personalized");
    expect(slot1.centerMinutes).toBe(150);
  });
});

describe("computePredictionWithTiming", () => {
  it("computes range start/end based on last wake time with dynamic half-width", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig();
    const lastWakeMs = new Date("2026-04-03T07:00:00.000Z").getTime();
    const result = computePredictionWithTiming(entries, BABY_4_MONTHS, 0, config, lastWakeMs, now);

    expect(result.isEligible).toBe(true);
    expect(result.confidence).toBe("personalized");
    expect(result.halfWidthMinutes).toBeDefined();

    const halfWidth = result.halfWidthMinutes!;
    const centerMs = lastWakeMs + result.centerMinutes * 60 * 1000;
    expect(result.rangeStartMs).toBe(centerMs - halfWidth * 60 * 1000);
    expect(result.rangeEndMs).toBe(centerMs + halfWidth * 60 * 1000);
  });

  it("returns zero range when lastWakeTimeMs is 0", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120],
      napDurationMinutes: 60,
      days: 5,
    });

    const config = makeConfig();
    const result = computePredictionWithTiming(entries, BABY_4_MONTHS, 0, config, 0, now);

    expect(result.rangeStartMs).toBe(0);
    expect(result.rangeEndMs).toBe(0);
  });

  it("returns zero range for ineligible baby", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const result = computePredictionWithTiming([], BABY_3_WEEKS, 0, null, Date.now(), now);

    expect(result.isEligible).toBe(false);
    expect(result.rangeStartMs).toBe(0);
    expect(result.rangeEndMs).toBe(0);
  });
});

describe("getPerSlotAverages", () => {
  it("returns averages for all slots with data", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300],
      napDurationMinutes: 60,
      days: 5,
    });

    const config = makeConfig({ napCount: 2 });
    const averages = getPerSlotAverages(entries, BABY_4_MONTHS, config, now);

    expect(averages.has(0)).toBe(true);
    expect(averages.has(1)).toBe(true);
    expect(averages.get(0)!.avg).toBe(120);
    expect(averages.get(0)!.count).toBe(5);
    expect(averages.get(1)!.avg).toBe(120);
  });

  it("returns empty map when no sleep data", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const config = makeConfig();
    const averages = getPerSlotAverages([], BABY_4_MONTHS, config, now);

    expect(averages.size).toBe(0);
  });
});

function generateDaysWithNapCount(options: {
  baseDate: Date;
  morningWakeHour: number;
  napTimesAfterWake: number[];
  napDurationMinutes: number;
  dayOffsets: number[];
}): StoredSleepEntry[] {
  const entries: StoredSleepEntry[] = [];
  const { baseDate, morningWakeHour, napTimesAfterWake, napDurationMinutes, dayOffsets } = options;

  for (const offset of dayOffsets) {
    const day = new Date(baseDate);
    day.setDate(day.getDate() - offset);

    const nightStart = new Date(day);
    nightStart.setDate(nightStart.getDate() - 1);
    nightStart.setHours(19, 30, 0, 0);

    const nightEnd = new Date(day);
    nightEnd.setHours(morningWakeHour, 0, 0, 0);

    entries.push(makeSleep({
      type: "night",
      startedAt: nightStart.toISOString(),
      endedAt: nightEnd.toISOString(),
    }));

    for (const minutesAfterWake of napTimesAfterWake) {
      const napStart = new Date(nightEnd.getTime() + minutesAfterWake * 60 * 1000);
      const napEnd = new Date(napStart.getTime() + napDurationMinutes * 60 * 1000);

      entries.push(makeSleep({
        type: "nap",
        startedAt: napStart.toISOString(),
        endedAt: napEnd.toISOString(),
      }));
    }
  }

  return entries;
}

describe("detectNapTransition", () => {
  it("detects transition with mixed 2/3 nap days", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");

    const threeNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      dayOffsets: [0, 1, 2, 3],
    });

    const twoNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300],
      napDurationMinutes: 60,
      dayOffsets: [4, 5, 6],
    });

    const entries = [...threeNapDays, ...twoNapDays];
    const config = makeConfig({ napCount: 3 });

    const prediction = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);
    expect(prediction.isTransitioning).toBe(true);
    expect(prediction.transitionNapCount).toBe(2);
  });

  it("returns no transition when all days have same nap count", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig();
    const prediction = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);
    expect(prediction.isTransitioning).toBeUndefined();
  });

  it("returns no transition when only 1 anomalous day", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");

    const threeNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      dayOffsets: [0, 1, 2, 3, 4, 5],
    });

    const twoNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300],
      napDurationMinutes: 60,
      dayOffsets: [6],
    });

    const entries = [...threeNapDays, ...twoNapDays];
    const config = makeConfig({ napCount: 3 });
    const prediction = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);
    expect(prediction.isTransitioning).toBeUndefined();
  });

  it("requires 3+ days of alternate nap count to detect transition", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");

    const threeNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      dayOffsets: [0, 1, 2, 3, 4],
    });

    const twoNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300],
      napDurationMinutes: 60,
      dayOffsets: [5, 6],
    });

    const entries = [...threeNapDays, ...twoNapDays];
    const config = makeConfig({ napCount: 3 });
    const prediction = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);
    expect(prediction.isTransitioning).toBeUndefined();
  });
});

describe("transition-aware prediction", () => {
  it("filters averages to matching nap-count days during transition", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");

    const threeNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [90, 240, 400],
      napDurationMinutes: 60,
      dayOffsets: [0, 1, 2, 3],
    });

    const twoNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300],
      napDurationMinutes: 60,
      dayOffsets: [4, 5, 6],
    });

    const entries = [...threeNapDays, ...twoNapDays];
    const config = makeConfig({ napCount: 3 });

    const predictionLower = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now, 1);
    expect(predictionLower.isTransitioning).toBe(true);
    expect(predictionLower.centerMinutes).toBe(120);

    const predictionHigher = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now, 3);
    expect(predictionHigher.isTransitioning).toBe(true);
    expect(predictionHigher.centerMinutes).toBe(90);
  });

  it("does not set transition fields when nap counts are consistent", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig();
    const prediction = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now, 1);
    expect(prediction.isTransitioning).toBeUndefined();
    expect(prediction.transitionNapCount).toBeUndefined();
    expect(prediction.confidence).toBe("personalized");
  });
});

describe("EWMA algorithm", () => {
  it("returns standardDeviation and halfWidthMinutes for personalized predictions", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig();
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.confidence).toBe("personalized");
    expect(result.standardDeviation).toBeDefined();
    expect(result.halfWidthMinutes).toBeDefined();
    expect(result.halfWidthMinutes).toBeGreaterThanOrEqual(10);
    expect(result.halfWidthMinutes).toBeLessThanOrEqual(25);
  });

  it("does not return SD/halfWidth for age_based fallback", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120],
      napDurationMinutes: 60,
      days: 2,
    });

    const config = makeConfig();
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.confidence).toBe("age_based");
    expect(result.standardDeviation).toBeUndefined();
    expect(result.halfWidthMinutes).toBeUndefined();
  });

  it("produces tight half-width (10min) for consistent data", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig();
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.halfWidthMinutes).toBe(10);
    expect(result.standardDeviation).toBe(0);
  });

  it("produces wider half-width for variable data", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries: StoredSleepEntry[] = [];

    const wakeWindows = [100, 130, 110, 140, 120, 135, 105];

    for (let d = 0; d < 7; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);

      const nightStart = new Date(day);
      nightStart.setDate(nightStart.getDate() - 1);
      nightStart.setHours(19, 30, 0, 0);

      const nightEnd = new Date(day);
      nightEnd.setHours(7, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: nightStart.toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      const napStart = new Date(nightEnd.getTime() + wakeWindows[d] * 60 * 1000);
      const napEnd = new Date(napStart.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: napStart.toISOString(),
        endedAt: napEnd.toISOString(),
      }));
    }

    const config = makeConfig({ napCount: 1 });
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.confidence).toBe("personalized");
    expect(result.halfWidthMinutes!).toBeGreaterThan(10);
    expect(result.standardDeviation!).toBeGreaterThan(0);
  });

  it("clamps half-width to maximum 25 minutes", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries: StoredSleepEntry[] = [];

    const wakeWindows = [80, 160, 90, 170, 100, 150, 110];

    for (let d = 0; d < 7; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);

      const nightStart = new Date(day);
      nightStart.setDate(nightStart.getDate() - 1);
      nightStart.setHours(19, 30, 0, 0);

      const nightEnd = new Date(day);
      nightEnd.setHours(7, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: nightStart.toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      const napStart = new Date(nightEnd.getTime() + wakeWindows[d] * 60 * 1000);
      const napEnd = new Date(napStart.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: napStart.toISOString(),
        endedAt: napEnd.toISOString(),
      }));
    }

    const config = makeConfig({ napCount: 1 });
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.halfWidthMinutes).toBe(25);
  });

  it("weights recent data more heavily (outlier resistance)", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries: StoredSleepEntry[] = [];

    for (let d = 0; d < 7; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);

      const nightStart = new Date(day);
      nightStart.setDate(nightStart.getDate() - 1);
      nightStart.setHours(19, 30, 0, 0);

      const nightEnd = new Date(day);
      nightEnd.setHours(7, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: nightStart.toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      const wakeWindow = d === 6 ? 180 : 120;
      const napStart = new Date(nightEnd.getTime() + wakeWindow * 60 * 1000);
      const napEnd = new Date(napStart.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: napStart.toISOString(),
        endedAt: napEnd.toISOString(),
      }));
    }

    const config = makeConfig({ napCount: 1 });
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.centerMinutes).toBeGreaterThan(120);
    expect(result.centerMinutes).toBeLessThan(150);
  });

  it("uses 14-day lookback window", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120],
      napDurationMinutes: 60,
      days: 14,
    });

    const config = makeConfig({ napCount: 1 });
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.confidence).toBe("personalized");

    const averages = getPerSlotAverages(entries, BABY_4_MONTHS, config, now);
    expect(averages.get(0)!.count).toBe(14);
  });

  it("uses higher alpha for fewer data points, weighting recent data strongly", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries: StoredSleepEntry[] = [];

    const wakeWindows = [100, 110, 120, 130, 140];

    for (let d = 0; d < 5; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);

      const nightEnd = new Date(day);
      nightEnd.setHours(7, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: new Date(nightEnd.getTime() - 10 * 60 * 60 * 1000).toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      const napStart = new Date(nightEnd.getTime() + wakeWindows[d] * 60 * 1000);
      const napEnd = new Date(napStart.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: napStart.toISOString(),
        endedAt: napEnd.toISOString(),
      }));
    }

    const config = makeConfig({ napCount: 1 });
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);

    expect(result.confidence).toBe("personalized");
    expect(result.centerMinutes).toBeLessThan(120);
    expect(result.centerMinutes).toBeGreaterThan(100);
  });

  it("computePredictionWithTiming uses dynamic half-width from EWMA", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries = generateWeekOfSleepData({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300, 480],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig();
    const lastWakeMs = new Date("2026-04-03T07:00:00.000Z").getTime();
    const result = computePredictionWithTiming(entries, BABY_4_MONTHS, 0, config, lastWakeMs, now);

    const centerMs = lastWakeMs + result.centerMinutes * 60 * 1000;
    const halfWidthMs = result.halfWidthMinutes! * 60 * 1000;
    expect(result.rangeStartMs).toBe(centerMs - halfWidthMs);
    expect(result.rangeEndMs).toBe(centerMs + halfWidthMs);
    expect(result.halfWidthMinutes).toBe(10);
  });
});

describe("countConsecutiveDays", () => {
  function makeSequence(dateKey: string): { dateKey: string; morningWakeMs: number; slots: [] } {
    return { dateKey, morningWakeMs: 0, slots: [] };
  }

  it("returns 0 for empty sequences", () => {
    expect(countConsecutiveDays([], new Date("2025-03-15T10:00:00"))).toBe(0);
  });

  it("counts consecutive days backwards from today", () => {
    const sequences = [
      makeSequence("2025-03-15"),
      makeSequence("2025-03-14"),
      makeSequence("2025-03-13"),
    ];
    expect(countConsecutiveDays(sequences, new Date("2025-03-15T10:00:00"))).toBe(3);
  });

  it("stops counting at a gap", () => {
    const sequences = [
      makeSequence("2025-03-15"),
      makeSequence("2025-03-14"),
      makeSequence("2025-03-12"),
    ];
    expect(countConsecutiveDays(sequences, new Date("2025-03-15T10:00:00"))).toBe(2);
  });

  it("skips today if no data for today and starts from yesterday", () => {
    const sequences = [
      makeSequence("2025-03-14"),
      makeSequence("2025-03-13"),
    ];
    expect(countConsecutiveDays(sequences, new Date("2025-03-15T10:00:00"))).toBe(2);
  });

  it("returns 1 for a single day matching today", () => {
    const sequences = [makeSequence("2025-03-15")];
    expect(countConsecutiveDays(sequences, new Date("2025-03-15T10:00:00"))).toBe(1);
  });
});

describe("bedtime slot uses actual night sleep", () => {
  it("computes bedtime wake window from last nap end to night sleep start", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries: StoredSleepEntry[] = [];

    for (let d = 0; d < 5; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);

      const nightEnd = new Date(day);
      nightEnd.setHours(7, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: new Date(nightEnd.getTime() - 10 * 60 * 60 * 1000).toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      const napStart = new Date(nightEnd.getTime() + 120 * 60 * 1000);
      const napEnd = new Date(napStart.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: napStart.toISOString(),
        endedAt: napEnd.toISOString(),
      }));

      const nightStart = new Date(day);
      nightStart.setHours(19, 30, 0, 0);
      entries.push(makeSleep({
        type: "night",
        startedAt: nightStart.toISOString(),
        endedAt: new Date(nightStart.getTime() + 11 * 60 * 60 * 1000).toISOString(),
      }));
    }

    const config = makeConfig({ napCount: 1 });
    const result = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 1, config, now);

    expect(result.confidence).toBe("personalized");
    expect(result.slotType).toBe("bedtime");
    expect(result.centerMinutes).toBe(570);
  });

  it("excludes bedtime slot for days without following night sleep", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries: StoredSleepEntry[] = [];

    for (let d = 0; d < 5; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);

      const nightEnd = new Date(day);
      nightEnd.setHours(7, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: new Date(nightEnd.getTime() - 10 * 60 * 60 * 1000).toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      const napStart = new Date(nightEnd.getTime() + 120 * 60 * 1000);
      const napEnd = new Date(napStart.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: napStart.toISOString(),
        endedAt: napEnd.toISOString(),
      }));

      if (d >= 2) {
        const nightStart = new Date(day);
        nightStart.setHours(19, 30, 0, 0);
        entries.push(makeSleep({
          type: "night",
          startedAt: nightStart.toISOString(),
          endedAt: new Date(nightStart.getTime() + 11 * 60 * 60 * 1000).toISOString(),
        }));
      }
    }

    const config = makeConfig({ napCount: 1 });
    const averages = getPerSlotAverages(entries, BABY_4_MONTHS, config, now);
    const bedtimeSlot = averages.get(1);

    expect(bedtimeSlot).toBeDefined();
    expect(bedtimeSlot!.count).toBeLessThan(5);
  });

  it("uses hardcoded 20min nap continuation threshold", () => {
    const now = new Date("2026-04-03T12:00:00.000Z");
    const entries: StoredSleepEntry[] = [];

    for (let d = 0; d < 5; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);

      const nightEnd = new Date(day);
      nightEnd.setHours(7, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: new Date(nightEnd.getTime() - 10 * 60 * 60 * 1000).toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      const nap1Start = new Date(nightEnd.getTime() + 120 * 60 * 1000);
      const nap1End = new Date(nap1Start.getTime() + 20 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: nap1Start.toISOString(),
        endedAt: nap1End.toISOString(),
      }));

      const nap1bStart = new Date(nap1End.getTime() + 15 * 60 * 1000);
      const nap1bEnd = new Date(nap1bStart.getTime() + 30 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: nap1bStart.toISOString(),
        endedAt: nap1bEnd.toISOString(),
      }));

      const nap2Start = new Date(nap1bEnd.getTime() + 150 * 60 * 1000);
      const nap2End = new Date(nap2Start.getTime() + 60 * 60 * 1000);
      entries.push(makeSleep({
        type: "nap",
        startedAt: nap2Start.toISOString(),
        endedAt: nap2End.toISOString(),
      }));
    }

    const config = makeConfig({ napCount: 2 });

    const slot0 = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);
    expect(slot0.confidence).toBe("personalized");
    expect(slot0.centerMinutes).toBe(120);

    const slot1 = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 1, config, now);
    expect(slot1.confidence).toBe("personalized");
    expect(slot1.centerMinutes).toBe(150);
  });
});

describe("clock-time anchoring", () => {
  const BABY_6_MONTHS = "2025-10-03";
  const BABY_8_WEEKS = "2026-02-06";

  function generateClockConsistentData(options: {
    baseDate: Date;
    morningWakeHour: number;
    napStartHours: number[];
    napDurationMinutes: number;
    bedtimeHour?: number;
    days: number;
    variationMinutes?: number;
  }): StoredSleepEntry[] {
    const entries: StoredSleepEntry[] = [];
    const { baseDate, morningWakeHour, napStartHours, napDurationMinutes, bedtimeHour, days, variationMinutes = 0 } = options;

    for (let d = 0; d < days; d++) {
      const day = new Date(baseDate);
      day.setDate(day.getDate() - d);

      const nightStart = new Date(day);
      nightStart.setDate(nightStart.getDate() - 1);
      nightStart.setHours(bedtimeHour ?? 19, 30, 0, 0);

      const nightEnd = new Date(day);
      nightEnd.setHours(morningWakeHour, 0, 0, 0);

      entries.push(makeSleep({
        type: "night",
        startedAt: nightStart.toISOString(),
        endedAt: nightEnd.toISOString(),
      }));

      for (const napHour of napStartHours) {
        const variation = variationMinutes > 0
          ? (d % 3 - 1) * variationMinutes
          : 0;
        const napStart = new Date(day);
        napStart.setHours(Math.floor(napHour), (napHour % 1) * 60 + variation, 0, 0);
        const napEnd = new Date(napStart.getTime() + napDurationMinutes * 60 * 1000);

        entries.push(makeSleep({
          type: "nap",
          startedAt: napStart.toISOString(),
          endedAt: napEnd.toISOString(),
        }));
      }

      if (bedtimeHour) {
        const bedNightStart = new Date(day);
        bedNightStart.setHours(bedtimeHour, 30, 0, 0);
        entries.push(makeSleep({
          type: "night",
          startedAt: bedNightStart.toISOString(),
          endedAt: new Date(bedNightStart.getTime() + 11 * 60 * 60 * 1000).toISOString(),
        }));
      }
    }

    return entries;
  }

  describe("getCircadianMaturity", () => {
    it("returns ~0.27 at 8 weeks", () => {
      const maturity = getCircadianMaturity(8);
      expect(maturity).toBeCloseTo(0.27, 1);
    });

    it("returns 0.50 at 12 weeks", () => {
      const maturity = getCircadianMaturity(12);
      expect(maturity).toBeCloseTo(0.50, 2);
    });

    it("returns ~0.73 at 16 weeks", () => {
      const maturity = getCircadianMaturity(16);
      expect(maturity).toBeCloseTo(0.73, 1);
    });

    it("returns ~0.95 at 24 weeks", () => {
      const maturity = getCircadianMaturity(24);
      expect(maturity).toBeCloseTo(0.95, 1);
    });
  });

  describe("getSlotWeight", () => {
    it("returns 0.7 for nap1", () => {
      expect(getSlotWeight(0, "nap", 3)).toBe(0.7);
    });

    it("returns 0.6 for nap2", () => {
      expect(getSlotWeight(1, "nap", 3)).toBe(0.6);
    });

    it("returns 0.3 for nap3", () => {
      expect(getSlotWeight(2, "nap", 3)).toBe(0.3);
    });

    it("returns 0.8 for bedtime", () => {
      expect(getSlotWeight(3, "bedtime", 3)).toBe(0.8);
    });
  });

  describe("getSDConfidence", () => {
    it("returns 1.0 for SD of 0 (perfectly consistent)", () => {
      expect(getSDConfidence(0)).toBe(1);
    });

    it("returns 0.5 for SD of 30", () => {
      expect(getSDConfidence(30)).toBeCloseTo(0.5);
    });

    it("returns 0 for SD of 60 or more", () => {
      expect(getSDConfidence(60)).toBe(0);
      expect(getSDConfidence(90)).toBe(0);
    });
  });

  function localDate(hour: number, minute: number = 0): Date {
    const d = new Date("2026-04-03");
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  function localMs(hour: number, minute: number = 0): number {
    return localDate(hour, minute).getTime();
  }

  const BABY_13_MONTHS = "2025-03-03";

  it("applies asymmetric pull: stronger for late predictions", () => {
    const now = localDate(12);
    const entries = generateClockConsistentData({
      baseDate: now,
      morningWakeHour: 7,
      napStartHours: [10.5],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig({ napCount: 1 });

    const earlyWakeMs = localMs(6, 30);
    const earlyResult = computePredictionWithTiming(entries, BABY_13_MONTHS, 0, config, earlyWakeMs, now);

    const lateWakeMs = localMs(7, 30);
    const lateResult = computePredictionWithTiming(entries, BABY_13_MONTHS, 0, config, lateWakeMs, now);

    const basePrediction = computeSmartSleepPrediction(entries, BABY_13_MONTHS, 0, config, now);
    const earlyPull = Math.abs(earlyResult.centerMinutes - basePrediction.centerMinutes);
    const latePull = Math.abs(lateResult.centerMinutes - basePrediction.centerMinutes);

    expect(latePull).toBeGreaterThan(earlyPull);
  });

  it("requires 5+ data points per slot to activate clock-time", () => {
    const now = localDate(12);
    const entries = generateClockConsistentData({
      baseDate: now,
      morningWakeHour: 7,
      napStartHours: [10],
      napDurationMinutes: 60,
      days: 4,
    });

    const config = makeConfig({ napCount: 1 });
    const result = computeSmartSleepPrediction(entries, BABY_6_MONTHS, 0, config, now);

    expect(result.confidence).toBe("personalized");
    expect(result.clockAnchorMinutes).toBeUndefined();
  });

  it("activates clock-time with 5+ data points per slot", () => {
    const now = localDate(12);
    const entries = generateClockConsistentData({
      baseDate: now,
      morningWakeHour: 7,
      napStartHours: [10],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig({ napCount: 1 });
    const result = computeSmartSleepPrediction(entries, BABY_6_MONTHS, 0, config, now);

    expect(result.confidence).toBe("personalized");
    expect(result.clockAnchorMinutes).toBeDefined();
    expect(result.clockAnchorMinutes).toBeCloseTo(10 * 60, -1);
  });

  it("young baby (8 weeks) gets negligible clock adjustment", () => {
    const now = localDate(12);
    const entries = generateClockConsistentData({
      baseDate: now,
      morningWakeHour: 7,
      napStartHours: [9],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig({ napCount: 1 });
    const lastWakeMs = localMs(7, 20);

    const result = computePredictionWithTiming(entries, BABY_8_WEEKS, 0, config, lastWakeMs, now);
    const basePrediction = computeSmartSleepPrediction(entries, BABY_8_WEEKS, 0, config, now);

    const adjustment = Math.abs(result.centerMinutes - basePrediction.centerMinutes);
    expect(adjustment).toBeLessThanOrEqual(5);
  });

  it("older baby gets meaningful clock adjustment when waking late", () => {
    const now = localDate(12);
    const entries = generateClockConsistentData({
      baseDate: now,
      morningWakeHour: 7,
      napStartHours: [10.5],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig({ napCount: 1 });
    const lateWakeMs = localMs(7, 30);

    const basePrediction = computeSmartSleepPrediction(entries, BABY_13_MONTHS, 0, config, now);
    const result = computePredictionWithTiming(entries, BABY_13_MONTHS, 0, config, lateWakeMs, now);

    expect(result.centerMinutes).toBeLessThan(basePrediction.centerMinutes);
  });

  it("unusual wake dampener reduces clock pull for slot 0 with early wake > 45min", () => {
    const now = localDate(12);
    const entries = generateClockConsistentData({
      baseDate: now,
      morningWakeHour: 7,
      napStartHours: [10.5],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig({ napCount: 1 });

    const normalWakeMs = localMs(7, 30);
    const normalResult = computePredictionWithTiming(entries, BABY_13_MONTHS, 0, config, normalWakeMs, now);

    const earlyWakeMs = localMs(5, 30);
    const earlyResult = computePredictionWithTiming(entries, BABY_13_MONTHS, 0, config, earlyWakeMs, now);

    const basePrediction = computeSmartSleepPrediction(entries, BABY_13_MONTHS, 0, config, now);
    const normalPull = Math.abs(normalResult.centerMinutes - basePrediction.centerMinutes);
    const earlyPull = Math.abs(earlyResult.centerMinutes - basePrediction.centerMinutes);

    expect(earlyPull).toBeLessThan(normalPull);
  });

  it("auto-advance boosts clock weight to 0.9", () => {
    const now = localDate(12);
    const entries = generateClockConsistentData({
      baseDate: now,
      morningWakeHour: 7,
      napStartHours: [10.5],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig({ napCount: 1 });
    const lateWakeMs = localMs(7, 30);

    const normalResult = computePredictionWithTiming(entries, BABY_13_MONTHS, 0, config, lateWakeMs, now);
    const boostedResult = computePredictionWithTiming(entries, BABY_13_MONTHS, 0, config, lateWakeMs, now, undefined, true);

    const basePrediction = computeSmartSleepPrediction(entries, BABY_13_MONTHS, 0, config, now);
    const normalPull = Math.abs(normalResult.centerMinutes - basePrediction.centerMinutes);
    const boostedPull = Math.abs(boostedResult.centerMinutes - basePrediction.centerMinutes);

    expect(boostedPull).toBeGreaterThan(normalPull);
  });

  it("clamps final prediction to wake window bounds", () => {
    const now = localDate(12);
    const entries = generateClockConsistentData({
      baseDate: now,
      morningWakeHour: 7,
      napStartHours: [9],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig({ napCount: 1 });
    const veryLateWakeMs = localMs(10, 0);

    const result = computePredictionWithTiming(entries, BABY_6_MONTHS, 0, config, veryLateWakeMs, now);

    expect(result.centerMinutes).toBeGreaterThanOrEqual(120);
  });

  it("transition filtering applies to clock-time EWMA", () => {
    const now = localDate(12);

    const threeNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [90, 240, 400],
      napDurationMinutes: 60,
      dayOffsets: [0, 1, 2, 3],
    });

    const twoNapDays = generateDaysWithNapCount({
      baseDate: now,
      morningWakeHour: 7,
      napTimesAfterWake: [120, 300],
      napDurationMinutes: 60,
      dayOffsets: [4, 5, 6],
    });

    const entries = [...threeNapDays, ...twoNapDays];
    const config = makeConfig({ napCount: 3 });

    const predictionLower = computeSmartSleepPrediction(entries, BABY_6_MONTHS, 0, config, now, 1);
    expect(predictionLower.isTransitioning).toBe(true);
    expect(predictionLower.centerMinutes).toBe(120);

    const predictionHigher = computeSmartSleepPrediction(entries, BABY_6_MONTHS, 0, config, now, 3);
    expect(predictionHigher.isTransitioning).toBe(true);
    expect(predictionHigher.centerMinutes).toBe(90);
  });

  it("clock-time SD field is populated for personalized predictions with sufficient data", () => {
    const now = localDate(12);
    const entries = generateClockConsistentData({
      baseDate: now,
      morningWakeHour: 7,
      napStartHours: [9],
      napDurationMinutes: 60,
      days: 7,
    });

    const config = makeConfig({ napCount: 1 });
    const result = computeSmartSleepPrediction(entries, BABY_6_MONTHS, 0, config, now);

    expect(result.clockTimeSD).toBeDefined();
    expect(result.morningWakeEWMA).toBeDefined();
  });
});
