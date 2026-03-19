import { describe, it, expect } from "vitest";
import {
  validatePumpingSide,
  validatePumpingVolume,
  validatePumpingDuration,
  validatePumping,
  validateManualPumping,
  validateStartTimeNotInFuture,
} from "./pumping";

describe("validatePumpingSide", () => {
  it("returns true for valid sides", () => {
    expect(validatePumpingSide("left")).toBe(true);
    expect(validatePumpingSide("right")).toBe(true);
    expect(validatePumpingSide("both")).toBe(true);
  });

  it("returns false for invalid sides", () => {
    expect(validatePumpingSide("invalid")).toBe(false);
    expect(validatePumpingSide("")).toBe(false);
    expect(validatePumpingSide("LEFT")).toBe(false);
  });
});

describe("validatePumpingVolume", () => {
  it("returns null for undefined volume (optional for timer)", () => {
    expect(validatePumpingVolume(undefined)).toBeNull();
  });

  it("returns null for valid volumes", () => {
    expect(validatePumpingVolume(1)).toBeNull();
    expect(validatePumpingVolume(60)).toBeNull();
    expect(validatePumpingVolume(300)).toBeNull();
    expect(validatePumpingVolume(500)).toBeNull();
  });

  it("returns error for non-positive volume", () => {
    expect(validatePumpingVolume(0)).toBe("validation.volumePositive");
    expect(validatePumpingVolume(-1)).toBe("validation.volumePositive");
  });

  it("returns error for volume over 500ml", () => {
    expect(validatePumpingVolume(501)).toBe("validation.volumeTooLarge500ml");
    expect(validatePumpingVolume(1000)).toBe("validation.volumeTooLarge500ml");
  });
});

describe("validatePumpingDuration", () => {
  it("returns null for undefined duration", () => {
    expect(validatePumpingDuration(undefined)).toBeNull();
  });

  it("returns null for valid duration", () => {
    expect(validatePumpingDuration(0)).toBeNull();
    expect(validatePumpingDuration(300)).toBeNull();
    expect(validatePumpingDuration(1800)).toBeNull();
    expect(validatePumpingDuration(3600)).toBeNull();
  });

  it("returns error for negative duration", () => {
    expect(validatePumpingDuration(-1)).toBe("validation.durationNegative");
  });

  it("returns error for duration over 1 hour", () => {
    expect(validatePumpingDuration(3601)).toBe("validation.durationTooLong1h");
    expect(validatePumpingDuration(7200)).toBe("validation.durationTooLong1h");
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
    expect(validateStartTimeNotInFuture(futureTime)).toBe("validation.startTimeNotInFuture");
  });

  it("allows small tolerance for near-future times", () => {
    const nearFuture = new Date(Date.now() + 5000);
    expect(validateStartTimeNotInFuture(nearFuture)).toBeNull();
  });
});

describe("validatePumping", () => {
  it("returns valid for correct pumping entry with timer (no volume)", () => {
    const result = validatePumping({
      babyId: "baby-1",
      side: "left",
      startedAt: new Date(),
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid for complete pumping entry", () => {
    const result = validatePumping({
      babyId: "baby-1",
      side: "both",
      startedAt: new Date(),
      endedAt: new Date(),
      durationSeconds: 900,
      volumeMl: 120,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for missing start time", () => {
    const result = validatePumping({
      babyId: "baby-1",
      side: "left",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBe("validation.startTimeRequired");
  });

  it("returns error for missing side", () => {
    const result = validatePumping({
      babyId: "baby-1",
      startedAt: new Date(),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.side).toBe("validation.sideRequired");
  });

  it("returns error for invalid side", () => {
    const result = validatePumping({
      babyId: "baby-1",
      side: "invalid" as "left",
      startedAt: new Date(),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.side).toBe("validation.invalidSide");
  });

  it("returns error when end time is before start time", () => {
    const start = new Date(2024, 5, 15, 10, 30);
    const end = new Date(2024, 5, 15, 10, 0);
    const result = validatePumping({
      babyId: "baby-1",
      side: "left",
      startedAt: start,
      endedAt: end,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.endedAt).toBe("validation.endTimeBeforeStart");
  });

  it("returns error for negative duration", () => {
    const result = validatePumping({
      babyId: "baby-1",
      side: "left",
      startedAt: new Date(),
      durationSeconds: -100,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBeDefined();
  });

  it("returns error for invalid volume", () => {
    const result = validatePumping({
      babyId: "baby-1",
      side: "left",
      startedAt: new Date(),
      volumeMl: 600,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.volumeMl).toBeDefined();
  });
});

describe("validateManualPumping", () => {
  it("returns valid for correct manual pumping entry", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualPumping({
      babyId: "baby-1",
      side: "left",
      startedAt: pastTime,
      durationSeconds: 900,
      volumeMl: 120,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for future start time", () => {
    const futureTime = new Date(Date.now() + 3600000);
    const result = validateManualPumping({
      babyId: "baby-1",
      side: "left",
      startedAt: futureTime,
      durationSeconds: 900,
      volumeMl: 120,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBe("validation.startTimeNotInFuture");
  });

  it("returns error for missing volume in manual entry", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualPumping({
      babyId: "baby-1",
      side: "left",
      startedAt: pastTime,
      durationSeconds: 900,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.volumeMl).toBe("validation.volumeRequired");
  });

  it("returns error for missing duration in manual entry", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualPumping({
      babyId: "baby-1",
      side: "left",
      startedAt: pastTime,
      volumeMl: 120,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBe("validation.durationRequired");
  });

  it("returns error for duration less than 1 minute", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualPumping({
      babyId: "baby-1",
      side: "left",
      startedAt: pastTime,
      durationSeconds: 30,
      volumeMl: 120,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBe("validation.durationMinimum1m");
  });

  it("returns error for missing side", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualPumping({
      babyId: "baby-1",
      startedAt: pastTime,
      durationSeconds: 900,
      volumeMl: 120,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.side).toBe("validation.sideRequired");
  });

  it("returns error for zero volume", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualPumping({
      babyId: "baby-1",
      side: "left",
      startedAt: pastTime,
      durationSeconds: 900,
      volumeMl: 0,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.volumeMl).toBe("validation.volumePositive");
  });

  it("returns multiple errors when multiple fields invalid", () => {
    const futureTime = new Date(Date.now() + 3600000);
    const result = validateManualPumping({
      babyId: "baby-1",
      startedAt: futureTime,
    });
    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(3);
  });
});
