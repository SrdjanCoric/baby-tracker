import { describe, it, expect } from "vitest";
import {
  getSleepAgeGroupForBaby,
  getDefaultSleepGoalForAge,
  getWakeWindowForAge,
  getNapsForAge,
  getSleepGoalInfo,
  checkSleepMilestoneCrossing,
  SLEEP_AGE_GROUPS,
} from "./sleepGoals";

describe("getSleepAgeGroupForBaby", () => {
  it("should return null for future birth date", () => {
    const futureBirthDate = new Date(Date.now() + 86400000);
    const now = new Date();
    expect(getSleepAgeGroupForBaby(futureBirthDate, now)).toBeNull();
  });

  it("should return the youngest group for a newborn", () => {
    const birthDate = new Date("2024-06-10");
    const result = getSleepAgeGroupForBaby(birthDate, new Date("2024-06-15"));
    expect(result?.label).toBe("0-3 months");
  });

  it("should return 19+ months group for a 2 year old", () => {
    const birthDate = new Date("2024-06-11");
    const now = new Date("2026-06-11");
    const result = getSleepAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("19+ months");
  });
});

describe("getDefaultSleepGoalForAge", () => {
  it("should return the 15 hour product target for 0-3 months", () => {
    const now = new Date("2024-06-15");
    const birthDate = new Date("2024-06-10");
    const result = getDefaultSleepGoalForAge(birthDate, now);
    expect(result.minHours).toBe(14);
    expect(result.maxHours).toBe(17);
    expect(result.targetMinutes).toBe(15 * 60);
  });

  it("should return the 14 hour product target for 3-5 months", () => {
    const now = new Date("2024-10-01");
    const birthDate = new Date("2024-06-10"); // ~113 days
    const result = getDefaultSleepGoalForAge(birthDate, now);
    expect(result.minHours).toBe(12);
    expect(result.maxHours).toBe(16);
    expect(result.targetMinutes).toBe(14 * 60);
  });

  it("should return the 13.5 hour product target for 6-8 months", () => {
    const now = new Date("2024-12-15");
    const birthDate = new Date("2024-06-10"); // ~188 days
    const result = getDefaultSleepGoalForAge(birthDate, now);
    expect(result.minHours).toBe(12);
    expect(result.maxHours).toBe(16);
    expect(result.targetMinutes).toBe(13.5 * 60);
  });

  it("should return the 13 hour product target for 9-12 months", () => {
    const now = new Date("2025-03-15");
    const birthDate = new Date("2024-06-10"); // ~278 days
    const result = getDefaultSleepGoalForAge(birthDate, now);
    expect(result.minHours).toBe(12);
    expect(result.maxHours).toBe(16);
    expect(result.targetMinutes).toBe(13 * 60);
  });

  it("should return the 12.5 hour product target for 13-18 months", () => {
    const now = new Date("2025-08-15");
    const birthDate = new Date("2024-06-10"); // ~431 days
    const result = getDefaultSleepGoalForAge(birthDate, now);
    expect(result.minHours).toBe(11);
    expect(result.maxHours).toBe(14);
    expect(result.targetMinutes).toBe(12.5 * 60);
  });

  it("should return the 11.5 hour product target for 19+ months", () => {
    const now = new Date("2026-03-15");
    const birthDate = new Date("2024-06-10"); // ~643 days
    const result = getDefaultSleepGoalForAge(birthDate, now);
    expect(result.minHours).toBe(11);
    expect(result.maxHours).toBe(14);
    expect(result.targetMinutes).toBe(11.5 * 60);
  });
});

describe("getWakeWindowForAge", () => {
  it("should return 30-90 min for 0-3 months", () => {
    const now = new Date("2024-06-15");
    const birthDate = new Date("2024-06-10");
    const result = getWakeWindowForAge(birthDate, now);
    expect(result.minMinutes).toBe(30);
    expect(result.maxMinutes).toBe(90);
    expect(result.targetMinutes).toBe(60); // midpoint
  });

  it("should return 60-120 min for 3-5 months", () => {
    const now = new Date("2024-10-01");
    const birthDate = new Date("2024-06-10");
    const result = getWakeWindowForAge(birthDate, now);
    expect(result.minMinutes).toBe(60);
    expect(result.maxMinutes).toBe(120);
    expect(result.targetMinutes).toBe(90);
  });

  it("should return 120-180 min for 6-8 months", () => {
    const now = new Date("2024-12-15");
    const birthDate = new Date("2024-06-10");
    const result = getWakeWindowForAge(birthDate, now);
    expect(result.minMinutes).toBe(120);
    expect(result.maxMinutes).toBe(180);
    expect(result.targetMinutes).toBe(150);
  });

  it("should return 150-210 min for 9-12 months", () => {
    const now = new Date("2025-03-15");
    const birthDate = new Date("2024-06-10");
    const result = getWakeWindowForAge(birthDate, now);
    expect(result.minMinutes).toBe(150);
    expect(result.maxMinutes).toBe(210);
    expect(result.targetMinutes).toBe(180);
  });

  it("should return 180-240 min for 13-18 months", () => {
    const now = new Date("2025-08-15");
    const birthDate = new Date("2024-06-10");
    const result = getWakeWindowForAge(birthDate, now);
    expect(result.minMinutes).toBe(180);
    expect(result.maxMinutes).toBe(240);
    expect(result.targetMinutes).toBe(210);
  });

  it("should return 240-360 min for 19+ months", () => {
    const now = new Date("2026-03-15");
    const birthDate = new Date("2024-06-10");
    const result = getWakeWindowForAge(birthDate, now);
    expect(result.minMinutes).toBe(240);
    expect(result.maxMinutes).toBe(360);
    expect(result.targetMinutes).toBe(300);
  });
});

describe("getNapsForAge", () => {
  it("should return 4-5 naps for 0-2 months", () => {
    const now = new Date("2024-06-15");
    const birthDate = new Date("2024-06-10");
    const result = getNapsForAge(birthDate, now);
    expect(result.minNaps).toBe(4);
    expect(result.maxNaps).toBe(5);
  });

  it("should return 3-4 naps for 3-5 months", () => {
    const now = new Date("2024-10-01");
    const birthDate = new Date("2024-06-10");
    const result = getNapsForAge(birthDate, now);
    expect(result.minNaps).toBe(3);
    expect(result.maxNaps).toBe(4);
  });

  it("should return 2-3 naps for 6-8 months", () => {
    const now = new Date("2024-12-15");
    const birthDate = new Date("2024-06-10");
    const result = getNapsForAge(birthDate, now);
    expect(result.minNaps).toBe(2);
    expect(result.maxNaps).toBe(3);
  });

  it("should return 2 naps for 9-12 months", () => {
    const now = new Date("2025-03-15");
    const birthDate = new Date("2024-06-10");
    const result = getNapsForAge(birthDate, now);
    expect(result.minNaps).toBe(2);
    expect(result.maxNaps).toBe(2);
  });

  it("should return 1-2 naps for 13-18 months", () => {
    const now = new Date("2025-08-15");
    const birthDate = new Date("2024-06-10");
    const result = getNapsForAge(birthDate, now);
    expect(result.minNaps).toBe(1);
    expect(result.maxNaps).toBe(2);
  });

  it("should return 0-1 naps for 19+ months", () => {
    const now = new Date("2026-03-15");
    const birthDate = new Date("2024-06-10");
    const result = getNapsForAge(birthDate, now);
    expect(result.minNaps).toBe(0);
    expect(result.maxNaps).toBe(1);
  });
});

describe("checkSleepMilestoneCrossing", () => {
  it("should return null when baby has not crossed milestone", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-06-15"); // 5 days
    const now = new Date("2024-06-20"); // 10 days
    expect(checkSleepMilestoneCrossing(birthDate, lastChecked, now)).toBeNull();
  });

  it("should detect crossing from 0-3 months to 3-5 months", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-09-07"); // 89 days
    const now = new Date("2024-09-10"); // 92 days

    const result = checkSleepMilestoneCrossing(birthDate, lastChecked, now);
    expect(result).not.toBeNull();
    expect(result?.previousGroup.label).toBe("0-3 months");
    expect(result?.newGroup.label).toBe("3-5 months");
    expect(result?.shouldSuggestGoalUpdate).toBe(true);
  });

  it("should detect crossing from 3-5 months to 6-8 months", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-12-09");
    const now = new Date("2024-12-10");

    const result = checkSleepMilestoneCrossing(birthDate, lastChecked, now);
    expect(result).not.toBeNull();
    expect(result?.previousGroup.label).toBe("3-5 months");
    expect(result?.newGroup.label).toBe("6-8 months");
    expect(result?.shouldSuggestGoalUpdate).toBe(true);
  });

  it("should return null for future birth date", () => {
    const futureBirthDate = new Date(Date.now() + 86400000);
    const lastChecked = new Date();
    const now = new Date();
    expect(checkSleepMilestoneCrossing(futureBirthDate, lastChecked, now)).toBeNull();
  });
});

describe("getSleepGoalInfo", () => {
  it("should return age-based goal when no custom goal", () => {
    const birthDate = new Date("2024-06-10");
    const now = new Date("2024-06-15"); // 5 days old

    const result = getSleepGoalInfo(birthDate, null, now);
    expect(result.targetMinutes).toBe(15 * 60);
    expect(result.source).toBe("age_based");
    expect(result.ageGroup?.label).toBe("0-3 months");
  });

  it("should return custom goal when set", () => {
    const birthDate = new Date("2024-06-10");
    const now = new Date("2024-06-15");
    const customGoal = 14 * 60; // 14 hours in minutes

    const result = getSleepGoalInfo(birthDate, customGoal, now);
    expect(result.targetMinutes).toBe(14 * 60);
    expect(result.source).toBe("custom");
    expect(result.ageGroup?.label).toBe("0-3 months");
  });

  it("should return default 14 hours when no birthdate", () => {
    const result = getSleepGoalInfo(undefined, null, new Date());
    expect(result.targetMinutes).toBe(14 * 60);
    expect(result.minHours).toBe(12);
    expect(result.maxHours).toBe(16);
    expect(result.source).toBe("age_based");
    expect(result.ageGroup).toBeNull();
  });

  it("should use custom goal even when birthdate undefined", () => {
    const customGoal = 12 * 60;
    const result = getSleepGoalInfo(undefined, customGoal, new Date());
    expect(result.targetMinutes).toBe(12 * 60);
    expect(result.source).toBe("custom");
    expect(result.ageGroup).toBeNull();
  });

  it("should ignore zero or negative custom goal", () => {
    const birthDate = new Date("2024-06-10");
    const now = new Date("2024-06-15");

    const result1 = getSleepGoalInfo(birthDate, 0, now);
    expect(result1.source).toBe("age_based");

    const result2 = getSleepGoalInfo(birthDate, -100, now);
    expect(result2.source).toBe("age_based");
  });
});

describe("SLEEP_AGE_GROUPS constant", () => {
  it("should have 6 age groups", () => {
    expect(SLEEP_AGE_GROUPS).toHaveLength(6);
  });

  it("should start each band on its calendar-month boundary", () => {
    expect(SLEEP_AGE_GROUPS.map((group) => group.minAgeMonths)).toEqual([
      0, 3, 6, 9, 13, 19,
    ]);
  });

  it("should have non-increasing product targets as baby ages", () => {
    const targets = SLEEP_AGE_GROUPS.map((group) => group.targetMinutes);
    for (let i = 1; i < targets.length; i++) {
      expect(targets[i]).toBeLessThanOrEqual(targets[i - 1]);
    }
  });

  it("should have increasing wake windows as baby ages", () => {
    const avgWakeMinutes = SLEEP_AGE_GROUPS.map(
      g => (g.wakeWindowMinMinutes + g.wakeWindowMaxMinutes) / 2
    );
    for (let i = 1; i < avgWakeMinutes.length; i++) {
      expect(avgWakeMinutes[i]).toBeGreaterThanOrEqual(avgWakeMinutes[i - 1]);
    }
  });

  it("should have decreasing naps as baby ages", () => {
    const avgNaps = SLEEP_AGE_GROUPS.map(g => (g.napsMin + g.napsMax) / 2);
    for (let i = 1; i < avgNaps.length; i++) {
      expect(avgNaps[i]).toBeLessThanOrEqual(avgNaps[i - 1]);
    }
  });
});
