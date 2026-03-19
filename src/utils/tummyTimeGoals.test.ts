import { describe, it, expect } from "vitest";
import {
  getAgeGroupForBaby,
  getDefaultGoalForAge,
  getAgeGroupLabel,
  isBabySixMonthsOrOlder,
  checkMilestoneCrossing,
  getGoalInfo,
  AGE_GROUPS,
} from "./tummyTimeGoals";

describe("getAgeGroupForBaby", () => {
  it("should return null for future birth date", () => {
    const futureBirthDate = new Date(Date.now() + 86400000);
    const now = new Date();
    expect(getAgeGroupForBaby(futureBirthDate, now)).toBeNull();
  });

  it("should return 0-2 weeks group for newborn", () => {
    const now = new Date("2024-06-15");
    const birthDate = new Date("2024-06-10"); // 5 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("0-2 weeks");
    expect(result?.defaultGoalSeconds).toBe(2 * 60);
  });

  it("should return 0-2 weeks group for 14 days old", () => {
    const now = new Date("2024-06-26");
    const birthDate = new Date("2024-06-12"); // 14 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("0-2 weeks");
  });

  it("should return 2-4 weeks group for 15 days old", () => {
    const now = new Date("2024-06-27");
    const birthDate = new Date("2024-06-12"); // 15 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("2-4 weeks");
    expect(result?.defaultGoalSeconds).toBe(5 * 60);
  });

  it("should return 2-4 weeks group for 28 days old", () => {
    const now = new Date("2024-07-10");
    const birthDate = new Date("2024-06-12"); // 28 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("2-4 weeks");
  });

  it("should return 1-2 months group for 29 days old", () => {
    const now = new Date("2024-07-11");
    const birthDate = new Date("2024-06-12"); // 29 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("1-2 months");
    expect(result?.defaultGoalSeconds).toBe(10 * 60);
  });

  it("should return 1-2 months group for 60 days old", () => {
    const now = new Date("2024-08-11");
    const birthDate = new Date("2024-06-12"); // 60 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("1-2 months");
  });

  it("should return 2-3 months group for 61 days old", () => {
    const now = new Date("2024-08-12");
    const birthDate = new Date("2024-06-12"); // 61 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("2-3 months");
    expect(result?.defaultGoalSeconds).toBe(20 * 60);
  });

  it("should return 2-3 months group for 90 days old", () => {
    const now = new Date("2024-09-10");
    const birthDate = new Date("2024-06-12"); // 90 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("2-3 months");
  });

  it("should return 3-4 months group for 91 days old", () => {
    const now = new Date("2024-09-11");
    const birthDate = new Date("2024-06-12"); // 91 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("3-4 months");
    expect(result?.defaultGoalSeconds).toBe(30 * 60);
  });

  it("should return 3-4 months group for 120 days old", () => {
    const now = new Date("2024-10-10");
    const birthDate = new Date("2024-06-12"); // 120 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("3-4 months");
  });

  it("should return 4-6 months group for 121 days old", () => {
    const now = new Date("2024-10-11");
    const birthDate = new Date("2024-06-12"); // 121 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("4-6 months");
    expect(result?.defaultGoalSeconds).toBe(45 * 60);
  });

  it("should return 4-6 months group for 180 days old", () => {
    const now = new Date("2024-12-09");
    const birthDate = new Date("2024-06-12"); // 180 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("4-6 months");
  });

  it("should return 6+ months group for 181 days old", () => {
    const now = new Date("2024-12-10");
    const birthDate = new Date("2024-06-12"); // 181 days old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("6+ months");
    expect(result?.defaultGoalSeconds).toBe(60 * 60);
  });

  it("should return 6+ months group for 1 year old", () => {
    const now = new Date("2025-06-12");
    const birthDate = new Date("2024-06-12"); // 1 year old
    const result = getAgeGroupForBaby(birthDate, now);
    expect(result?.label).toBe("6+ months");
  });
});

describe("getDefaultGoalForAge", () => {
  it("should return 2 min for 0-2 weeks", () => {
    const now = new Date("2024-06-15");
    const birthDate = new Date("2024-06-10");
    expect(getDefaultGoalForAge(birthDate, now)).toBe(2 * 60);
  });

  it("should return 5 min for 2-4 weeks", () => {
    const now = new Date("2024-06-28");
    const birthDate = new Date("2024-06-10"); // 18 days
    expect(getDefaultGoalForAge(birthDate, now)).toBe(5 * 60);
  });

  it("should return 10 min for 1-2 months", () => {
    const now = new Date("2024-07-15");
    const birthDate = new Date("2024-06-10"); // ~35 days
    expect(getDefaultGoalForAge(birthDate, now)).toBe(10 * 60);
  });

  it("should return 20 min for 2-3 months", () => {
    const now = new Date("2024-08-20");
    const birthDate = new Date("2024-06-10"); // ~71 days
    expect(getDefaultGoalForAge(birthDate, now)).toBe(20 * 60);
  });

  it("should return 30 min for 3-4 months", () => {
    const now = new Date("2024-10-01");
    const birthDate = new Date("2024-06-10"); // ~113 days
    expect(getDefaultGoalForAge(birthDate, now)).toBe(30 * 60);
  });

  it("should return 45 min for 4-6 months", () => {
    const now = new Date("2024-11-10");
    const birthDate = new Date("2024-06-10"); // ~153 days
    expect(getDefaultGoalForAge(birthDate, now)).toBe(45 * 60);
  });

  it("should return 60 min for 6+ months", () => {
    const now = new Date("2025-01-10");
    const birthDate = new Date("2024-06-10"); // ~214 days
    expect(getDefaultGoalForAge(birthDate, now)).toBe(60 * 60);
  });
});

describe("getAgeGroupLabel", () => {
  it("should return correct label for each age group", () => {
    const birthDate = new Date("2024-06-10");

    expect(getAgeGroupLabel(birthDate, new Date("2024-06-15"))).toBe("0-2 weeks");
    expect(getAgeGroupLabel(birthDate, new Date("2024-06-28"))).toBe("2-4 weeks");
    expect(getAgeGroupLabel(birthDate, new Date("2024-07-15"))).toBe("1-2 months");
    expect(getAgeGroupLabel(birthDate, new Date("2024-08-20"))).toBe("2-3 months");
    expect(getAgeGroupLabel(birthDate, new Date("2024-10-01"))).toBe("3-4 months");
    expect(getAgeGroupLabel(birthDate, new Date("2024-11-10"))).toBe("4-6 months");
    expect(getAgeGroupLabel(birthDate, new Date("2025-01-10"))).toBe("6+ months");
  });

  it("should return Unknown for future birth date", () => {
    const futureBirthDate = new Date(Date.now() + 86400000);
    expect(getAgeGroupLabel(futureBirthDate, new Date())).toBe("Unknown");
  });
});

describe("isBabySixMonthsOrOlder", () => {
  it("should return false for baby under 6 months", () => {
    const now = new Date("2024-12-09");
    const birthDate = new Date("2024-06-12"); // 180 days
    expect(isBabySixMonthsOrOlder(birthDate, now)).toBe(false);
  });

  it("should return true for baby exactly 6 months", () => {
    const now = new Date("2024-12-10");
    const birthDate = new Date("2024-06-12"); // 181 days
    expect(isBabySixMonthsOrOlder(birthDate, now)).toBe(true);
  });

  it("should return true for baby over 6 months", () => {
    const now = new Date("2025-06-12");
    const birthDate = new Date("2024-06-12"); // 1 year
    expect(isBabySixMonthsOrOlder(birthDate, now)).toBe(true);
  });

  it("should return false for newborn", () => {
    const now = new Date("2024-06-15");
    const birthDate = new Date("2024-06-10");
    expect(isBabySixMonthsOrOlder(birthDate, now)).toBe(false);
  });
});

describe("checkMilestoneCrossing", () => {
  it("should return null when baby has not crossed milestone", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-06-15"); // 5 days
    const now = new Date("2024-06-20"); // 10 days
    expect(checkMilestoneCrossing(birthDate, lastChecked, now)).toBeNull();
  });

  it("should detect crossing from 0-2 weeks to 2-4 weeks", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-06-23"); // 13 days
    const now = new Date("2024-06-26"); // 16 days

    const result = checkMilestoneCrossing(birthDate, lastChecked, now);
    expect(result).not.toBeNull();
    expect(result?.previousGroup.label).toBe("0-2 weeks");
    expect(result?.newGroup.label).toBe("2-4 weeks");
    expect(result?.shouldSuggestGoalUpdate).toBe(true);
  });

  it("should detect crossing from 2-4 weeks to 1-2 months", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-07-07"); // 27 days
    const now = new Date("2024-07-10"); // 30 days

    const result = checkMilestoneCrossing(birthDate, lastChecked, now);
    expect(result).not.toBeNull();
    expect(result?.previousGroup.label).toBe("2-4 weeks");
    expect(result?.newGroup.label).toBe("1-2 months");
    expect(result?.shouldSuggestGoalUpdate).toBe(true);
  });

  it("should detect crossing from 1-2 months to 2-3 months", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-08-08"); // 59 days
    const now = new Date("2024-08-11"); // 62 days

    const result = checkMilestoneCrossing(birthDate, lastChecked, now);
    expect(result).not.toBeNull();
    expect(result?.previousGroup.label).toBe("1-2 months");
    expect(result?.newGroup.label).toBe("2-3 months");
    expect(result?.shouldSuggestGoalUpdate).toBe(true);
  });

  it("should detect crossing from 2-3 months to 3-4 months", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-09-08"); // 90 days
    const now = new Date("2024-09-10"); // 92 days

    const result = checkMilestoneCrossing(birthDate, lastChecked, now);
    expect(result).not.toBeNull();
    expect(result?.previousGroup.label).toBe("2-3 months");
    expect(result?.newGroup.label).toBe("3-4 months");
    expect(result?.shouldSuggestGoalUpdate).toBe(true);
  });

  it("should detect crossing from 3-4 months to 4-6 months", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-10-08"); // 120 days
    const now = new Date("2024-10-10"); // 122 days

    const result = checkMilestoneCrossing(birthDate, lastChecked, now);
    expect(result).not.toBeNull();
    expect(result?.previousGroup.label).toBe("3-4 months");
    expect(result?.newGroup.label).toBe("4-6 months");
    expect(result?.shouldSuggestGoalUpdate).toBe(true);
  });

  it("should detect crossing from 4-6 months to 6+ months", () => {
    const birthDate = new Date("2024-06-10");
    const lastChecked = new Date("2024-12-07"); // 180 days
    const now = new Date("2024-12-09"); // 182 days

    const result = checkMilestoneCrossing(birthDate, lastChecked, now);
    expect(result).not.toBeNull();
    expect(result?.previousGroup.label).toBe("4-6 months");
    expect(result?.newGroup.label).toBe("6+ months");
    expect(result?.shouldSuggestGoalUpdate).toBe(true);
  });

  it("should return null for future birth date", () => {
    const futureBirthDate = new Date(Date.now() + 86400000);
    const lastChecked = new Date();
    const now = new Date();
    expect(checkMilestoneCrossing(futureBirthDate, lastChecked, now)).toBeNull();
  });
});

describe("getGoalInfo", () => {
  it("should return age-based goal when no custom goal", () => {
    const birthDate = new Date("2024-06-10");
    const now = new Date("2024-06-15"); // 5 days old

    const result = getGoalInfo(birthDate, null, now);
    expect(result.goalSeconds).toBe(2 * 60);
    expect(result.source).toBe("age_based");
    expect(result.ageGroup?.label).toBe("0-2 weeks");
  });

  it("should return custom goal when set", () => {
    const birthDate = new Date("2024-06-10");
    const now = new Date("2024-06-15");
    const customGoal = 20 * 60; // 20 min

    const result = getGoalInfo(birthDate, customGoal, now);
    expect(result.goalSeconds).toBe(20 * 60);
    expect(result.source).toBe("custom");
    expect(result.ageGroup?.label).toBe("0-2 weeks");
  });

  it("should return default 10 min when no birthdate", () => {
    const result = getGoalInfo(undefined, null, new Date());
    expect(result.goalSeconds).toBe(10 * 60);
    expect(result.source).toBe("age_based");
    expect(result.ageGroup).toBeNull();
  });

  it("should use custom goal even when birthdate undefined", () => {
    const customGoal = 45 * 60;
    const result = getGoalInfo(undefined, customGoal, new Date());
    expect(result.goalSeconds).toBe(45 * 60);
    expect(result.source).toBe("custom");
    expect(result.ageGroup).toBeNull();
  });

  it("should ignore zero or negative custom goal", () => {
    const birthDate = new Date("2024-06-10");
    const now = new Date("2024-06-15");

    const result1 = getGoalInfo(birthDate, 0, now);
    expect(result1.source).toBe("age_based");

    const result2 = getGoalInfo(birthDate, -100, now);
    expect(result2.source).toBe("age_based");
  });
});

describe("AGE_GROUPS constant", () => {
  it("should have 7 age groups", () => {
    expect(AGE_GROUPS).toHaveLength(7);
  });

  it("should have non-overlapping ranges", () => {
    for (let i = 1; i < AGE_GROUPS.length; i++) {
      expect(AGE_GROUPS[i].minAgeDays).toBe(AGE_GROUPS[i - 1].maxAgeDays + 1);
    }
  });

  it("should start from 0 days", () => {
    expect(AGE_GROUPS[0].minAgeDays).toBe(0);
  });

  it("should end with Infinity", () => {
    expect(AGE_GROUPS[AGE_GROUPS.length - 1].maxAgeDays).toBe(Infinity);
  });

  it("should have increasing goal values up to 60 min", () => {
    const goals = AGE_GROUPS.map(g => g.defaultGoalSeconds);
    expect(goals).toEqual([2 * 60, 5 * 60, 10 * 60, 20 * 60, 30 * 60, 45 * 60, 60 * 60]);
  });
});
