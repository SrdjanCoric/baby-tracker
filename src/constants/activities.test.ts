import { describe, it, expect } from "vitest";
import {
  STOOL_COLORS,
  ACTIVITY_CONFIG,
  ACTIVITIES_WITH_SIDE_SELECTION,
  isTimerActivity,
  supportsSideSelection,
  getActivityConfig,
  getOppositeSide,
  isValidActivityType,
  isValidStoolColor,
  type ActivityType,
} from "./activities";

describe("STOOL_COLORS", () => {
  it("contains expected colors", () => {
    expect(STOOL_COLORS).toContain("yellow");
    expect(STOOL_COLORS).toContain("brown");
    expect(STOOL_COLORS).toContain("green");
    expect(STOOL_COLORS).toContain("black");
    expect(STOOL_COLORS).toContain("white");
    expect(STOOL_COLORS).toContain("red");
    expect(STOOL_COLORS).toContain("orange");
  });

  it("has exactly 7 colors", () => {
    expect(STOOL_COLORS.length).toBe(7);
  });
});

describe("ACTIVITY_CONFIG", () => {
  const activityTypes: ActivityType[] = ["feeding", "sleep", "diaper", "pumping", "growth", "tummyTime"];

  it("has configuration for all activity types", () => {
    activityTypes.forEach(type => {
      expect(ACTIVITY_CONFIG[type]).toBeDefined();
    });
  });

  it("each config has required properties", () => {
    activityTypes.forEach(type => {
      const config = ACTIVITY_CONFIG[type];
      expect(config.icon).toBeDefined();
      expect(config.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(config.mutedBg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(config.mutedBgDark).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it("feeding has warm sage color", () => {
    expect(ACTIVITY_CONFIG.feeding.accentColor).toBe("#8CB369");
  });

  it("sleep has dusty mauve color", () => {
    expect(ACTIVITY_CONFIG.sleep.accentColor).toBe("#9E8DA9");
  });
});

describe("isTimerActivity", () => {
  it("returns true for timer activities", () => {
    expect(isTimerActivity("feeding")).toBe(true);
    expect(isTimerActivity("sleep")).toBe(true);
    expect(isTimerActivity("pumping")).toBe(true);
    expect(isTimerActivity("tummyTime")).toBe(true);
  });

  it("returns false for non-timer activities", () => {
    expect(isTimerActivity("diaper")).toBe(false);
    expect(isTimerActivity("growth")).toBe(false);
  });
});

describe("supportsSideSelection", () => {
  it("returns true for feeding and pumping", () => {
    expect(supportsSideSelection("feeding")).toBe(true);
    expect(supportsSideSelection("pumping")).toBe(true);
  });

  it("returns false for sleep and tummyTime", () => {
    expect(supportsSideSelection("sleep")).toBe(false);
    expect(supportsSideSelection("tummyTime")).toBe(false);
  });
});

describe("getActivityConfig", () => {
  it("returns correct config for each activity", () => {
    expect(getActivityConfig("feeding").icon).toBe("🤱");
    expect(getActivityConfig("sleep").icon).toBe("😴");
    expect(getActivityConfig("diaper").icon).toBe("🚼");
    expect(getActivityConfig("pumping").icon).toBe("🫙");
    expect(getActivityConfig("growth").icon).toBe("📏");
    expect(getActivityConfig("tummyTime").icon).toBe("💪");
  });
});

describe("getOppositeSide", () => {
  it("returns right for left", () => {
    expect(getOppositeSide("left")).toBe("right");
  });

  it("returns left for right", () => {
    expect(getOppositeSide("right")).toBe("left");
  });

  it("returns both for both", () => {
    expect(getOppositeSide("both")).toBe("both");
  });
});

describe("isValidActivityType", () => {
  it("returns true for valid activity types", () => {
    expect(isValidActivityType("feeding")).toBe(true);
    expect(isValidActivityType("sleep")).toBe(true);
    expect(isValidActivityType("diaper")).toBe(true);
    expect(isValidActivityType("pumping")).toBe(true);
    expect(isValidActivityType("growth")).toBe(true);
    expect(isValidActivityType("tummyTime")).toBe(true);
  });

  it("returns false for invalid activity types", () => {
    expect(isValidActivityType("invalid")).toBe(false);
    expect(isValidActivityType("")).toBe(false);
    expect(isValidActivityType("FEEDING")).toBe(false);
  });
});

describe("isValidStoolColor", () => {
  it("returns true for valid stool colors", () => {
    STOOL_COLORS.forEach(color => {
      expect(isValidStoolColor(color)).toBe(true);
    });
  });

  it("returns false for invalid stool colors", () => {
    expect(isValidStoolColor("purple")).toBe(false);
    expect(isValidStoolColor("")).toBe(false);
    expect(isValidStoolColor("YELLOW")).toBe(false);
  });
});

describe("ACTIVITIES_WITH_SIDE_SELECTION", () => {
  it("contains feeding and pumping", () => {
    expect(ACTIVITIES_WITH_SIDE_SELECTION).toContain("feeding");
    expect(ACTIVITIES_WITH_SIDE_SELECTION).toContain("pumping");
  });

  it("does not contain sleep or tummyTime", () => {
    expect(ACTIVITIES_WITH_SIDE_SELECTION).not.toContain("sleep");
    expect(ACTIVITIES_WITH_SIDE_SELECTION).not.toContain("tummyTime");
  });
});
