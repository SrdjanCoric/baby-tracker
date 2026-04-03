import { describe, it, expect } from "vitest";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { WakeWindowConfig } from "@/types/wake-windows";
import {
  computeSmartSleepPrediction,
  computePredictionWithTiming,
  getPerSlotAverages,
  isSmartSleepEligible,
  getAgeDays,
  detectNapTransition,
  MIN_AGE_DAYS,
  MIN_DATA_POINTS_PER_SLOT,
  RANGE_HALF_WIDTH_MINUTES,
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
    napContinuationMinutes: 15,
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

    const config = makeConfig({ napCount: 2, napContinuationMinutes: 15 });

    const slot0 = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 0, config, now);
    expect(slot0.confidence).toBe("personalized");
    expect(slot0.centerMinutes).toBe(120);

    const slot1 = computeSmartSleepPrediction(entries, BABY_4_MONTHS, 1, config, now);
    expect(slot1.confidence).toBe("personalized");
    expect(slot1.centerMinutes).toBe(150);
  });
});

describe("computePredictionWithTiming", () => {
  it("computes range start/end based on last wake time", () => {
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

    const expectedCenter = lastWakeMs + 120 * 60 * 1000;
    expect(result.rangeStartMs).toBe(expectedCenter - RANGE_HALF_WIDTH_MINUTES * 60 * 1000);
    expect(result.rangeEndMs).toBe(expectedCenter + RANGE_HALF_WIDTH_MINUTES * 60 * 1000);
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
    const averages = getPerSlotAverages(entries, BABY_4_MONTHS, config, now);

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
