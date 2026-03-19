import { describe, it, expect } from "vitest";
import {
  validateSleepType,
  validateSleepDuration,
  validateSleepStartTime,
  validateSleepEndTime,
  validateSleep,
  validateManualSleep,
  calculateSleepDuration,
  determineSleepType,
  validateSleepStartTimeNotInFuture,
  validateManualSleepDuration,
} from "./sleep";

describe("validateSleepType", () => {
  it("returns true for valid sleep types", () => {
    expect(validateSleepType("nap")).toBe(true);
    expect(validateSleepType("night")).toBe(true);
  });

  it("returns false for invalid sleep types", () => {
    expect(validateSleepType("invalid")).toBe(false);
    expect(validateSleepType("")).toBe(false);
    expect(validateSleepType("NAP")).toBe(false);
    expect(validateSleepType("NIGHT")).toBe(false);
  });
});

describe("validateSleepStartTime", () => {
  it("returns null for valid start time", () => {
    expect(validateSleepStartTime(new Date())).toBeNull();
  });

  it("returns error for undefined start time", () => {
    expect(validateSleepStartTime(undefined)).toBe("validation.startTimeRequired");
  });
});

describe("validateSleepEndTime", () => {
  it("returns null for undefined end time", () => {
    const start = new Date(2024, 5, 15, 10, 0);
    expect(validateSleepEndTime(start, undefined)).toBeNull();
  });

  it("returns null for valid end time", () => {
    const start = new Date(2024, 5, 15, 10, 0);
    const end = new Date(2024, 5, 15, 12, 30);
    expect(validateSleepEndTime(start, end)).toBeNull();
  });

  it("returns error when end is before start", () => {
    const start = new Date(2024, 5, 15, 10, 30);
    const end = new Date(2024, 5, 15, 10, 0);
    expect(validateSleepEndTime(start, end)).toBe("validation.endTimeBeforeStart");
  });
});

describe("validateSleepDuration", () => {
  it("returns null for undefined duration", () => {
    expect(validateSleepDuration(undefined)).toBeNull();
  });

  it("returns null for valid duration", () => {
    expect(validateSleepDuration(0)).toBeNull();
    expect(validateSleepDuration(60)).toBeNull();
    expect(validateSleepDuration(3600)).toBeNull();
    expect(validateSleepDuration(43200)).toBeNull();
  });

  it("returns error for negative duration", () => {
    expect(validateSleepDuration(-1)).toBe("validation.durationNegative");
  });

  it("returns error for duration over 24 hours", () => {
    expect(validateSleepDuration(86401)).toBe("validation.durationTooLong24h");
  });
});

describe("validateSleepStartTimeNotInFuture", () => {
  it("returns null for past time", () => {
    const pastTime = new Date(Date.now() - 60000);
    expect(validateSleepStartTimeNotInFuture(pastTime)).toBeNull();
  });

  it("returns null for current time with tolerance", () => {
    const now = new Date();
    expect(validateSleepStartTimeNotInFuture(now)).toBeNull();
  });

  it("returns null for time within 10 second tolerance", () => {
    const slightlyFuture = new Date(Date.now() + 5000);
    expect(validateSleepStartTimeNotInFuture(slightlyFuture)).toBeNull();
  });

  it("returns error for future time beyond tolerance", () => {
    const futureTime = new Date(Date.now() + 60000);
    expect(validateSleepStartTimeNotInFuture(futureTime)).toBe("validation.startTimeNotInFuture");
  });
});

describe("validateManualSleepDuration", () => {
  it("returns error for undefined duration", () => {
    expect(validateManualSleepDuration(undefined)).toBe("validation.durationRequired");
  });

  it("returns error for duration less than 1 minute", () => {
    expect(validateManualSleepDuration(30)).toBe("validation.durationMinimum1m");
    expect(validateManualSleepDuration(59)).toBe("validation.durationMinimum1m");
  });

  it("returns null for valid duration", () => {
    expect(validateManualSleepDuration(60)).toBeNull();
    expect(validateManualSleepDuration(3600)).toBeNull();
    expect(validateManualSleepDuration(43200)).toBeNull();
  });

  it("returns error for duration over 24 hours", () => {
    expect(validateManualSleepDuration(86401)).toBe("validation.durationTooLong24h");
  });
});

describe("calculateSleepDuration", () => {
  it("calculates duration in seconds", () => {
    const start = new Date(2024, 5, 15, 10, 0);
    const end = new Date(2024, 5, 15, 12, 30);
    expect(calculateSleepDuration(start, end)).toBe(9000);
  });

  it("returns 0 for same start and end time", () => {
    const time = new Date(2024, 5, 15, 10, 0);
    expect(calculateSleepDuration(time, time)).toBe(0);
  });

  it("returns 0 if end is before start (edge case)", () => {
    const start = new Date(2024, 5, 15, 12, 0);
    const end = new Date(2024, 5, 15, 10, 0);
    expect(calculateSleepDuration(start, end)).toBe(0);
  });
});

describe("determineSleepType", () => {
  it("determines night sleep for evening start times", () => {
    const eveningStart = new Date(2024, 5, 15, 20, 0);
    expect(determineSleepType(eveningStart)).toBe("night");
  });

  it("determines night sleep for late night start times", () => {
    const lateNightStart = new Date(2024, 5, 15, 23, 30);
    expect(determineSleepType(lateNightStart)).toBe("night");
  });

  it("determines nap for morning start times", () => {
    const morningStart = new Date(2024, 5, 15, 9, 0);
    expect(determineSleepType(morningStart)).toBe("nap");
  });

  it("determines nap for afternoon start times", () => {
    const afternoonStart = new Date(2024, 5, 15, 14, 0);
    expect(determineSleepType(afternoonStart)).toBe("nap");
  });

  it("determines night sleep for very early morning (before 6am)", () => {
    const earlyMorning = new Date(2024, 5, 15, 3, 0);
    expect(determineSleepType(earlyMorning)).toBe("night");
  });

  it("determines nap for start time at 6am boundary", () => {
    const sixAm = new Date(2024, 5, 15, 6, 0);
    expect(determineSleepType(sixAm)).toBe("nap");
  });

  it("determines night sleep for start time at 7pm boundary", () => {
    const sevenPm = new Date(2024, 5, 15, 19, 0);
    expect(determineSleepType(sevenPm)).toBe("night");
  });

  it("uses custom day start hour", () => {
    const sixThirtyAm = new Date(2024, 5, 15, 6, 30);
    expect(determineSleepType(sixThirtyAm)).toBe("nap");
    expect(determineSleepType(sixThirtyAm, 7)).toBe("night");
  });

  it("uses custom day end hour", () => {
    const sevenThirtyPm = new Date(2024, 5, 15, 19, 30);
    expect(determineSleepType(sevenThirtyPm)).toBe("night");
    expect(determineSleepType(sevenThirtyPm, undefined, 20)).toBe("nap");
  });

  it("uses both custom boundaries", () => {
    expect(determineSleepType(new Date(2024, 5, 15, 6, 30), 7, 20)).toBe("night");
    expect(determineSleepType(new Date(2024, 5, 15, 7, 0), 7, 20)).toBe("nap");
    expect(determineSleepType(new Date(2024, 5, 15, 19, 30), 7, 20)).toBe("nap");
    expect(determineSleepType(new Date(2024, 5, 15, 20, 0), 7, 20)).toBe("night");
  });
});

describe("validateSleep", () => {
  it("returns valid for correct nap entry", () => {
    const result = validateSleep({
      babyId: "baby-123",
      type: "nap",
      startedAt: new Date()
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid for correct night sleep entry", () => {
    const result = validateSleep({
      babyId: "baby-123",
      type: "night",
      startedAt: new Date()
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for invalid sleep type", () => {
    const result = validateSleep({
      babyId: "baby-123",
      type: "invalid" as "nap",
      startedAt: new Date()
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBeDefined();
  });

  it("returns error for missing start time", () => {
    const result = validateSleep({
      babyId: "baby-123",
      type: "nap"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBeDefined();
  });

  it("returns error for invalid end time", () => {
    const start = new Date(2024, 5, 15, 14, 30);
    const end = new Date(2024, 5, 15, 14, 0);
    const result = validateSleep({
      babyId: "baby-123",
      type: "nap",
      startedAt: start,
      endedAt: end
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.endedAt).toBeDefined();
  });

  it("returns error for invalid duration", () => {
    const result = validateSleep({
      babyId: "baby-123",
      type: "nap",
      startedAt: new Date(),
      durationSeconds: -100
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBeDefined();
  });

  it("returns valid with optional fields", () => {
    const result = validateSleep({
      babyId: "baby-123",
      type: "nap",
      startedAt: new Date(),
      endedAt: new Date(Date.now() + 3600000),
      durationSeconds: 3600,
      notes: "Baby slept well"
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});

describe("validateManualSleep", () => {
  it("returns valid for correct manual nap entry", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualSleep({
      babyId: "baby-123",
      type: "nap",
      startedAt: pastTime,
      durationSeconds: 1800
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid for correct manual night sleep entry", () => {
    const pastTime = new Date(Date.now() - 28800000);
    const result = validateManualSleep({
      babyId: "baby-123",
      type: "night",
      startedAt: pastTime,
      durationSeconds: 28800
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for invalid sleep type", () => {
    const result = validateManualSleep({
      babyId: "baby-123",
      type: "invalid" as "nap",
      startedAt: new Date(Date.now() - 3600000),
      durationSeconds: 1800
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBeDefined();
  });

  it("returns error for missing start time", () => {
    const result = validateManualSleep({
      babyId: "baby-123",
      type: "nap",
      durationSeconds: 1800
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBeDefined();
  });

  it("returns error for future start time", () => {
    const futureTime = new Date(Date.now() + 60000);
    const result = validateManualSleep({
      babyId: "baby-123",
      type: "nap",
      startedAt: futureTime,
      durationSeconds: 1800
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBe("validation.startTimeNotInFuture");
  });

  it("returns error for missing duration", () => {
    const result = validateManualSleep({
      babyId: "baby-123",
      type: "nap",
      startedAt: new Date(Date.now() - 3600000)
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBeDefined();
  });

  it("returns error for duration less than 1 minute", () => {
    const result = validateManualSleep({
      babyId: "baby-123",
      type: "nap",
      startedAt: new Date(Date.now() - 3600000),
      durationSeconds: 30
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBe("validation.durationMinimum1m");
  });

  it("returns error for duration over 24 hours", () => {
    const result = validateManualSleep({
      babyId: "baby-123",
      type: "nap",
      startedAt: new Date(Date.now() - 100000000),
      durationSeconds: 86401
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBe("validation.durationTooLong24h");
  });

  it("returns multiple errors for multiple issues", () => {
    const futureTime = new Date(Date.now() + 60000);
    const result = validateManualSleep({
      babyId: "baby-123",
      type: "invalid" as "nap",
      startedAt: futureTime,
      durationSeconds: 30
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBeDefined();
    expect(result.errors.startedAt).toBeDefined();
    expect(result.errors.durationSeconds).toBeDefined();
  });
});
