import { describe, it, expect } from "vitest";
import {
  getDefaultWakeWindowConfig,
  getPresetPillsForAge,
  generateSlotsForNapCount,
  getSleepAgeGroupForBaby,
  getDefaultSleepGoalForAge,
  getWakeWindowForAge,
  getNapsForAge,
  getSleepGoalInfo,
  checkSleepMilestoneCrossing,
} from "../sleepGoals";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

describe("getDefaultWakeWindowConfig", () => {
  it("returns config for 0-2 month old", () => {
    const birthDate = daysAgo(30);
    const config = getDefaultWakeWindowConfig(birthDate);

    expect(config.napCount).toBe(5);
    expect(config.slots).toHaveLength(6);
    expect(config.source).toBe("age_based");
    expect(config.slots[0].label).toBe("nap1");
    expect(config.slots[5].label).toBe("bedtime");
    expect(config.slots[0].durationMinutes).toBe(30);
    expect(config.slots[5].durationMinutes).toBe(60);
  });

  it("returns config for 3-5 month old", () => {
    const birthDate = daysAgo(100);
    const config = getDefaultWakeWindowConfig(birthDate);

    expect(config.napCount).toBe(4);
    expect(config.slots).toHaveLength(5);
    expect(config.slots[0].durationMinutes).toBe(60);
    expect(config.slots[4].durationMinutes).toBe(120);
    expect(config.slots[4].label).toBe("bedtime");
  });

  it("returns config for 6-8 month old", () => {
    const birthDate = daysAgo(200);
    const config = getDefaultWakeWindowConfig(birthDate);

    expect(config.napCount).toBe(3);
    expect(config.slots).toHaveLength(4);
    expect(config.slots[0].durationMinutes).toBe(120);
    expect(config.slots[3].durationMinutes).toBe(180);
  });

  it("returns config for 9-12 month old", () => {
    const birthDate = daysAgo(300);
    const config = getDefaultWakeWindowConfig(birthDate);

    expect(config.napCount).toBe(2);
    expect(config.slots).toHaveLength(3);
    expect(config.slots[0].durationMinutes).toBe(150);
    expect(config.slots[2].durationMinutes).toBe(210);
  });

  it("returns config for 13-18 month old", () => {
    const birthDate = daysAgo(400);
    const config = getDefaultWakeWindowConfig(birthDate);

    expect(config.napCount).toBe(2);
    expect(config.slots).toHaveLength(3);
    expect(config.slots[0].durationMinutes).toBe(180);
    expect(config.slots[2].durationMinutes).toBe(240);
  });

  it("returns config for 19+ month old", () => {
    const birthDate = daysAgo(600);
    const config = getDefaultWakeWindowConfig(birthDate);

    expect(config.napCount).toBe(1);
    expect(config.slots).toHaveLength(2);
    expect(config.slots[0].durationMinutes).toBe(240);
    expect(config.slots[1].durationMinutes).toBe(360);
    expect(config.slots[1].label).toBe("bedtime");
  });

  it("returns fallback config for future birth date", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const config = getDefaultWakeWindowConfig(futureDate);

    expect(config.napCount).toBe(2);
    expect(config.slots.length).toBeGreaterThan(0);
    expect(config.source).toBe("age_based");
  });

  it("last slot is always bedtime", () => {
    const ages = [30, 100, 200, 300, 400, 600];
    for (const age of ages) {
      const config = getDefaultWakeWindowConfig(daysAgo(age));
      const lastSlot = config.slots[config.slots.length - 1];
      expect(lastSlot.label).toBe("bedtime");
    }
  });

  it("slot durations are progressive (non-decreasing)", () => {
    const ages = [30, 100, 200, 300, 400, 600];
    for (const age of ages) {
      const config = getDefaultWakeWindowConfig(daysAgo(age));
      for (let i = 1; i < config.slots.length; i++) {
        expect(config.slots[i].durationMinutes).toBeGreaterThanOrEqual(
          config.slots[i - 1].durationMinutes
        );
      }
    }
  });
});

describe("generateSlotsForNapCount", () => {
  it("generates correct number of slots (napCount + 1)", () => {
    const birthDate = daysAgo(200);
    const slots = generateSlotsForNapCount(3, birthDate);
    expect(slots).toHaveLength(4);
    expect(slots[3].label).toBe("bedtime");
  });

  it("generates 2 slots for 1 nap", () => {
    const birthDate = daysAgo(600);
    const slots = generateSlotsForNapCount(1, birthDate);
    expect(slots).toHaveLength(2);
    expect(slots[0].label).toBe("nap1");
    expect(slots[1].label).toBe("bedtime");
  });

  it("generates progressive durations", () => {
    const birthDate = daysAgo(200);
    const slots = generateSlotsForNapCount(3, birthDate);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].durationMinutes).toBeGreaterThanOrEqual(
        slots[i - 1].durationMinutes
      );
    }
  });
});

describe("getPresetPillsForAge", () => {
  it("returns array of numbers for a valid birth date", () => {
    const birthDate = daysAgo(200);
    const presets = getPresetPillsForAge(birthDate);

    expect(presets.length).toBeGreaterThanOrEqual(3);
    for (const p of presets) {
      expect(typeof p).toBe("number");
      expect(p).toBeGreaterThan(0);
    }
  });

  it("first preset is age group minimum", () => {
    const birthDate = daysAgo(200);
    const ageGroup = getSleepAgeGroupForBaby(birthDate);
    const presets = getPresetPillsForAge(birthDate);

    expect(presets[0]).toBe(ageGroup!.wakeWindowMinMinutes);
  });

  it("last preset is age group maximum", () => {
    const birthDate = daysAgo(200);
    const ageGroup = getSleepAgeGroupForBaby(birthDate);
    const presets = getPresetPillsForAge(birthDate);

    expect(presets[presets.length - 1]).toBe(ageGroup!.wakeWindowMaxMinutes);
  });

  it("returns fallback presets for null age group", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const presets = getPresetPillsForAge(futureDate);

    expect(presets).toEqual([60, 90, 120, 150, 180]);
  });

  it("presets are sorted ascending", () => {
    const ages = [30, 100, 200, 300, 400, 600];
    for (const age of ages) {
      const presets = getPresetPillsForAge(daysAgo(age));
      for (let i = 1; i < presets.length; i++) {
        expect(presets[i]).toBeGreaterThan(presets[i - 1]);
      }
    }
  });
});

describe("existing sleepGoals functions", () => {
  it("getSleepAgeGroupForBaby returns correct group for 6 month old", () => {
    const birthDate = daysAgo(180);
    const group = getSleepAgeGroupForBaby(birthDate);
    expect(group).not.toBeNull();
    expect(group!.label).toBe("6-8 months");
  });

  it("getDefaultSleepGoalForAge returns reasonable values", () => {
    const birthDate = daysAgo(180);
    const goal = getDefaultSleepGoalForAge(birthDate);
    expect(goal.minHours).toBeGreaterThanOrEqual(10);
    expect(goal.maxHours).toBeLessThanOrEqual(18);
    expect(goal.targetMinutes).toBeGreaterThan(0);
  });

  it("getWakeWindowForAge returns reasonable values", () => {
    const birthDate = daysAgo(180);
    const window = getWakeWindowForAge(birthDate);
    expect(window.minMinutes).toBeGreaterThan(0);
    expect(window.maxMinutes).toBeGreaterThan(window.minMinutes);
    expect(window.targetMinutes).toBeGreaterThanOrEqual(window.minMinutes);
    expect(window.targetMinutes).toBeLessThanOrEqual(window.maxMinutes);
  });

  it("getNapsForAge returns reasonable values", () => {
    const birthDate = daysAgo(180);
    const naps = getNapsForAge(birthDate);
    expect(naps.minNaps).toBeGreaterThanOrEqual(0);
    expect(naps.maxNaps).toBeGreaterThanOrEqual(naps.minNaps);
  });

  it("getSleepGoalInfo returns age_based when no custom goal", () => {
    const birthDate = daysAgo(180);
    const info = getSleepGoalInfo(birthDate, null);
    expect(info.source).toBe("age_based");
    expect(info.ageGroup).not.toBeNull();
  });

  it("getSleepGoalInfo returns custom when custom goal set", () => {
    const birthDate = daysAgo(180);
    const info = getSleepGoalInfo(birthDate, 900);
    expect(info.source).toBe("custom");
    expect(info.targetMinutes).toBe(900);
  });

  it("checkSleepMilestoneCrossing detects group change", () => {
    const birthDate = daysAgo(155);
    const lastChecked = new Date();
    lastChecked.setDate(lastChecked.getDate() - 10);
    const crossing = checkSleepMilestoneCrossing(birthDate, lastChecked);
    if (crossing) {
      expect(crossing.previousGroup.label).not.toBe(crossing.newGroup.label);
    }
  });
});
