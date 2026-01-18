import { describe, it, expect } from "vitest";
import {
  validateFeedingType,
  validateBreastSide,
  validateStartTime,
  validateEndTime,
  validateFeedingDuration,
  validateBottleAmount,
  validateBottleContentType,
  validateBreastfeeding,
  validateBottleFeeding,
  calculateFeedingDuration,
  validateStartTimeNotInFuture,
  validateManualFeedingDuration,
  validateManualBreastfeeding,
  validateManualBottleFeeding,
  validateFoodType,
  validateSolidAmount,
  validateSolidFeeding,
  validateSolidReaction
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

describe("validateBottleContentType", () => {
  it("returns null for non-bottle feeding", () => {
    expect(validateBottleContentType(undefined, "breast")).toBeNull();
    expect(validateBottleContentType(undefined, "solid")).toBeNull();
  });

  it("returns error for bottle feeding without content type", () => {
    expect(validateBottleContentType(undefined, "bottle")).toBe("Content type is required for bottle feeding");
  });

  it("returns null for valid content types", () => {
    expect(validateBottleContentType("formula", "bottle")).toBeNull();
    expect(validateBottleContentType("breastMilk", "bottle")).toBeNull();
  });

  it("returns error for invalid content type", () => {
    expect(validateBottleContentType("water" as "formula", "bottle")).toBe("Invalid content type");
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
      amountMl: 120,
      contentType: "formula"
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for wrong feeding type", () => {
    const result = validateBottleFeeding({
      type: "breast",
      startedAt: new Date(),
      amountMl: 120,
      contentType: "formula"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBeDefined();
  });

  it("returns error for missing amount", () => {
    const result = validateBottleFeeding({
      type: "bottle",
      startedAt: new Date(),
      contentType: "formula"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.amountMl).toBeDefined();
  });

  it("returns error for missing content type", () => {
    const result = validateBottleFeeding({
      type: "bottle",
      startedAt: new Date(),
      amountMl: 120
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.contentType).toBeDefined();
  });

  it("returns valid for breast milk content type", () => {
    const result = validateBottleFeeding({
      type: "bottle",
      startedAt: new Date(),
      amountMl: 90,
      contentType: "breastMilk"
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
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

describe("validateStartTimeNotInFuture", () => {
  it("returns null for past time", () => {
    const pastTime = new Date(Date.now() - 60000);
    expect(validateStartTimeNotInFuture(pastTime)).toBeNull();
  });

  it("returns null for current time", () => {
    const now = new Date();
    expect(validateStartTimeNotInFuture(now)).toBeNull();
  });

  it("returns error for future time", () => {
    const futureTime = new Date(Date.now() + 60000);
    expect(validateStartTimeNotInFuture(futureTime)).toBe("Start time cannot be in the future");
  });

  it("allows small tolerance for near-future times", () => {
    const nearFuture = new Date(Date.now() + 5000);
    expect(validateStartTimeNotInFuture(nearFuture)).toBeNull();
  });
});

describe("validateManualFeedingDuration", () => {
  it("returns error for duration less than 1 minute", () => {
    expect(validateManualFeedingDuration(30)).toBe("Duration must be at least 1 minute");
    expect(validateManualFeedingDuration(59)).toBe("Duration must be at least 1 minute");
  });

  it("returns null for duration of exactly 1 minute", () => {
    expect(validateManualFeedingDuration(60)).toBeNull();
  });

  it("returns null for valid duration", () => {
    expect(validateManualFeedingDuration(300)).toBeNull();
    expect(validateManualFeedingDuration(1800)).toBeNull();
    expect(validateManualFeedingDuration(7200)).toBeNull();
  });

  it("returns error for duration over 2 hours", () => {
    expect(validateManualFeedingDuration(7201)).toBe("Duration seems too long (over 2 hours)");
  });

  it("returns error for undefined duration", () => {
    expect(validateManualFeedingDuration(undefined)).toBe("Duration is required for manual entry");
  });
});

describe("validateManualBreastfeeding", () => {
  it("returns valid for correct manual breastfeeding entry", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualBreastfeeding({
      type: "breast",
      startedAt: pastTime,
      durationSeconds: 600,
      side: "left"
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for future start time", () => {
    const futureTime = new Date(Date.now() + 3600000);
    const result = validateManualBreastfeeding({
      type: "breast",
      startedAt: futureTime,
      durationSeconds: 600,
      side: "left"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBe("Start time cannot be in the future");
  });

  it("returns error for missing duration", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualBreastfeeding({
      type: "breast",
      startedAt: pastTime,
      side: "left"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBe("Duration is required for manual entry");
  });

  it("returns error for duration too short", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualBreastfeeding({
      type: "breast",
      startedAt: pastTime,
      durationSeconds: 30,
      side: "left"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBe("Duration must be at least 1 minute");
  });

  it("returns error for wrong feeding type", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualBreastfeeding({
      type: "bottle",
      startedAt: pastTime,
      durationSeconds: 600
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBeDefined();
  });

  it("returns error for missing side", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualBreastfeeding({
      type: "breast",
      startedAt: pastTime,
      durationSeconds: 600
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.side).toBe("Side is required for breastfeeding");
  });
});

describe("validateManualBottleFeeding", () => {
  it("returns valid for correct manual bottle feeding entry", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualBottleFeeding({
      type: "bottle",
      startedAt: pastTime,
      amountMl: 120,
      contentType: "formula"
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for future start time", () => {
    const futureTime = new Date(Date.now() + 3600000);
    const result = validateManualBottleFeeding({
      type: "bottle",
      startedAt: futureTime,
      amountMl: 120,
      contentType: "formula"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBe("Start time cannot be in the future");
  });

  it("returns error for missing amount", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualBottleFeeding({
      type: "bottle",
      startedAt: pastTime,
      contentType: "formula"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.amountMl).toBeDefined();
  });

  it("returns error for missing content type", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualBottleFeeding({
      type: "bottle",
      startedAt: pastTime,
      amountMl: 120
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.contentType).toBeDefined();
  });
});

describe("validateFoodType", () => {
  it("returns null for valid food type string", () => {
    expect(validateFoodType("banana")).toBeNull();
    expect(validateFoodType("avocado puree")).toBeNull();
    expect(validateFoodType("sweet potato")).toBeNull();
  });

  it("returns error for empty food type", () => {
    expect(validateFoodType("")).toBe("Food type is required");
    expect(validateFoodType("   ")).toBe("Food type is required");
  });

  it("returns error for undefined food type", () => {
    expect(validateFoodType(undefined)).toBe("Food type is required");
  });

  it("returns error for food type that is too long", () => {
    const longFood = "a".repeat(101);
    expect(validateFoodType(longFood)).toBe("Food type is too long (max 100 characters)");
  });

  it("returns null for food type at max length", () => {
    const maxFood = "a".repeat(100);
    expect(validateFoodType(maxFood)).toBeNull();
  });
});

describe("validateSolidAmount", () => {
  it("returns null for valid amounts", () => {
    expect(validateSolidAmount("aLittle")).toBeNull();
    expect(validateSolidAmount("some")).toBeNull();
    expect(validateSolidAmount("aLot")).toBeNull();
  });

  it("returns error for invalid amount", () => {
    expect(validateSolidAmount("invalid" as "aLittle")).toBe("Invalid amount");
    expect(validateSolidAmount("" as "aLittle")).toBe("Invalid amount");
  });

  it("returns null for undefined amount (optional)", () => {
    expect(validateSolidAmount(undefined)).toBeNull();
  });
});

describe("validateSolidReaction", () => {
  it("returns null for valid reactions", () => {
    expect(validateSolidReaction("loved")).toBeNull();
    expect(validateSolidReaction("meh")).toBeNull();
    expect(validateSolidReaction("refused")).toBeNull();
  });

  it("returns error for invalid reaction", () => {
    expect(validateSolidReaction("invalid" as "loved")).toBe("Invalid reaction");
    expect(validateSolidReaction("" as "loved")).toBe("Invalid reaction");
  });

  it("returns null for undefined reaction (optional)", () => {
    expect(validateSolidReaction(undefined)).toBeNull();
  });
});

describe("validateSolidFeeding", () => {
  it("returns valid for correct solid feeding entry", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateSolidFeeding({
      type: "solid",
      startedAt: pastTime,
      foodType: "banana"
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid with amount specified", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateSolidFeeding({
      type: "solid",
      startedAt: pastTime,
      foodType: "avocado",
      amount: "some"
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid with reaction specified", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateSolidFeeding({
      type: "solid",
      startedAt: pastTime,
      foodType: "banana",
      reaction: "loved"
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for invalid reaction", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateSolidFeeding({
      type: "solid",
      startedAt: pastTime,
      foodType: "banana",
      reaction: "invalid" as "loved"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.reaction).toBe("Invalid reaction");
  });

  it("returns error for wrong feeding type", () => {
    const result = validateSolidFeeding({
      type: "bottle",
      startedAt: new Date(),
      foodType: "banana"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBe("Invalid feeding type for solid food");
  });

  it("returns error for missing food type", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateSolidFeeding({
      type: "solid",
      startedAt: pastTime
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.foodType).toBe("Food type is required");
  });

  it("returns error for empty food type", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateSolidFeeding({
      type: "solid",
      startedAt: pastTime,
      foodType: ""
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.foodType).toBe("Food type is required");
  });

  it("returns error for future start time", () => {
    const futureTime = new Date(Date.now() + 3600000);
    const result = validateSolidFeeding({
      type: "solid",
      startedAt: futureTime,
      foodType: "banana"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBe("Start time cannot be in the future");
  });

  it("returns error for missing start time", () => {
    const result = validateSolidFeeding({
      type: "solid",
      foodType: "banana"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBe("Start time is required");
  });

  it("returns error for invalid amount", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateSolidFeeding({
      type: "solid",
      startedAt: pastTime,
      foodType: "banana",
      amount: "invalid" as "aLittle"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.amount).toBe("Invalid amount");
  });

  it("returns multiple errors when multiple fields invalid", () => {
    const futureTime = new Date(Date.now() + 3600000);
    const result = validateSolidFeeding({
      type: "breast",
      startedAt: futureTime,
      foodType: ""
    });
    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(2);
  });
});
