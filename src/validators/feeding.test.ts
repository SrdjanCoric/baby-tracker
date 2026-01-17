import { describe, it, expect } from "vitest";
import {
  validateFeedingType,
  validateBreastSide,
  validateStartTime,
  validateEndTime,
  validateFeedingDuration,
  validateBottleAmount,
  validateBreastfeeding,
  validateBottleFeeding,
  calculateFeedingDuration
} from "./feeding";

describe("validateFeedingType", () => {
  it("returns true for valid feeding types", () => {
    expect(validateFeedingType("breast")).toBe(true);
    expect(validateFeedingType("bottle")).toBe(true);
    expect(validateFeedingType("solid")).toBe(true);
  });

  it("returns false for invalid feeding types", () => {
    expect(validateFeedingType("invalid")).toBe(false);
    expect(validateFeedingType("")).toBe(false);
    expect(validateFeedingType("BREAST")).toBe(false);
  });
});

describe("validateBreastSide", () => {
  it("returns true for valid sides", () => {
    expect(validateBreastSide("left")).toBe(true);
    expect(validateBreastSide("right")).toBe(true);
    expect(validateBreastSide("both")).toBe(true);
  });

  it("returns false for invalid sides", () => {
    expect(validateBreastSide("invalid")).toBe(false);
    expect(validateBreastSide("")).toBe(false);
    expect(validateBreastSide("LEFT")).toBe(false);
  });
});

describe("validateStartTime", () => {
  it("returns null for valid start time", () => {
    expect(validateStartTime(new Date())).toBeNull();
  });

  it("returns error for undefined start time", () => {
    expect(validateStartTime(undefined)).toBe("Start time is required");
  });
});

describe("validateEndTime", () => {
  it("returns null for undefined end time", () => {
    const start = new Date(2024, 5, 15, 10, 0);
    expect(validateEndTime(start, undefined)).toBeNull();
  });

  it("returns null for valid end time", () => {
    const start = new Date(2024, 5, 15, 10, 0);
    const end = new Date(2024, 5, 15, 10, 30);
    expect(validateEndTime(start, end)).toBeNull();
  });

  it("returns error when end is before start", () => {
    const start = new Date(2024, 5, 15, 10, 30);
    const end = new Date(2024, 5, 15, 10, 0);
    expect(validateEndTime(start, end)).toBe("End time cannot be before start time");
  });
});

describe("validateFeedingDuration", () => {
  it("returns null for undefined duration", () => {
    expect(validateFeedingDuration(undefined)).toBeNull();
  });

  it("returns null for valid duration", () => {
    expect(validateFeedingDuration(0)).toBeNull();
    expect(validateFeedingDuration(600)).toBeNull();
    expect(validateFeedingDuration(7200)).toBeNull();
  });

  it("returns error for negative duration", () => {
    expect(validateFeedingDuration(-1)).toBe("Duration cannot be negative");
  });

  it("returns error for duration over 2 hours", () => {
    expect(validateFeedingDuration(7201)).toBe("Duration seems too long (over 2 hours)");
  });
});

describe("validateBottleAmount", () => {
  it("returns null for non-bottle feeding", () => {
    expect(validateBottleAmount(undefined, "breast")).toBeNull();
    expect(validateBottleAmount(undefined, "solid")).toBeNull();
  });

  it("returns error for bottle feeding without amount", () => {
    expect(validateBottleAmount(undefined, "bottle")).toBe("Amount is required for bottle feeding");
    expect(validateBottleAmount(0, "bottle")).toBe("Amount is required for bottle feeding");
  });

  it("returns null for valid bottle amount", () => {
    expect(validateBottleAmount(60, "bottle")).toBeNull();
    expect(validateBottleAmount(120, "bottle")).toBeNull();
    expect(validateBottleAmount(500, "bottle")).toBeNull();
  });

  it("returns error for amount over 500ml", () => {
    expect(validateBottleAmount(501, "bottle")).toBe("Amount seems too large (over 500ml)");
  });
});

describe("validateBreastfeeding", () => {
  it("returns valid for correct breastfeeding entry", () => {
    const result = validateBreastfeeding({
      type: "breast",
      startedAt: new Date(),
      side: "left"
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for wrong feeding type", () => {
    const result = validateBreastfeeding({
      type: "bottle",
      startedAt: new Date()
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBeDefined();
  });

  it("returns error for missing start time", () => {
    const result = validateBreastfeeding({
      type: "breast"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBeDefined();
  });

  it("returns error for invalid side", () => {
    const result = validateBreastfeeding({
      type: "breast",
      startedAt: new Date(),
      side: "invalid" as "left"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.side).toBeDefined();
  });

  it("returns error for invalid end time", () => {
    const start = new Date(2024, 5, 15, 10, 30);
    const end = new Date(2024, 5, 15, 10, 0);
    const result = validateBreastfeeding({
      type: "breast",
      startedAt: start,
      endedAt: end
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.endedAt).toBeDefined();
  });
});

describe("validateBottleFeeding", () => {
  it("returns valid for correct bottle feeding entry", () => {
    const result = validateBottleFeeding({
      type: "bottle",
      startedAt: new Date(),
      amountMl: 120
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for wrong feeding type", () => {
    const result = validateBottleFeeding({
      type: "breast",
      startedAt: new Date(),
      amountMl: 120
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBeDefined();
  });

  it("returns error for missing amount", () => {
    const result = validateBottleFeeding({
      type: "bottle",
      startedAt: new Date()
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.amountMl).toBeDefined();
  });
});

describe("calculateFeedingDuration", () => {
  it("calculates correct duration", () => {
    const start = new Date(2024, 5, 15, 10, 0, 0);
    const end = new Date(2024, 5, 15, 10, 15, 30);
    expect(calculateFeedingDuration(start, end)).toBe(930);
  });

  it("returns 0 for same time", () => {
    const time = new Date(2024, 5, 15, 10, 0);
    expect(calculateFeedingDuration(time, time)).toBe(0);
  });

  it("returns 0 for negative duration", () => {
    const start = new Date(2024, 5, 15, 10, 30);
    const end = new Date(2024, 5, 15, 10, 0);
    expect(calculateFeedingDuration(start, end)).toBe(0);
  });
});
