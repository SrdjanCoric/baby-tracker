import { describe, it, expect } from "vitest";
import {
  validateTummyTimeStartTime,
  validateTummyTimeEndTime,
  validateTummyTimeDuration,
  validateTummyTimeStartTimeNotInFuture,
  validateManualTummyTimeDuration,
  calculateTummyTimeDuration,
  validateTummyTime,
  validateManualTummyTime,
  validateManualTummyTimeTimes,
  validateDailyGoal,
  calculateDailyProgress,
  calculateTodaysTotalSeconds,
} from "./tummyTime";
import type { TummyTimeEntry } from "./tummyTime";

describe("validateTummyTimeStartTime", () => {
  it("returns null for valid start time", () => {
    expect(validateTummyTimeStartTime(new Date())).toBeNull();
  });

  it("returns error for undefined start time", () => {
    expect(validateTummyTimeStartTime(undefined)).toBe("validation.startTimeRequired");
  });
});

describe("validateTummyTimeEndTime", () => {
  it("returns null for undefined end time", () => {
    const start = new Date(2024, 5, 15, 10, 0);
    expect(validateTummyTimeEndTime(start, undefined)).toBeNull();
  });

  it("returns null for valid end time", () => {
    const start = new Date(2024, 5, 15, 10, 0);
    const end = new Date(2024, 5, 15, 10, 15);
    expect(validateTummyTimeEndTime(start, end)).toBeNull();
  });

  it("returns error when end is before start", () => {
    const start = new Date(2024, 5, 15, 10, 30);
    const end = new Date(2024, 5, 15, 10, 0);
    expect(validateTummyTimeEndTime(start, end)).toBe("validation.endTimeBeforeStart");
  });
});

describe("validateTummyTimeDuration", () => {
  it("returns null for undefined duration", () => {
    expect(validateTummyTimeDuration(undefined)).toBeNull();
  });

  it("returns null for valid duration", () => {
    expect(validateTummyTimeDuration(0)).toBeNull();
    expect(validateTummyTimeDuration(60)).toBeNull();
    expect(validateTummyTimeDuration(300)).toBeNull();
    expect(validateTummyTimeDuration(1800)).toBeNull();
  });

  it("returns error for negative duration", () => {
    expect(validateTummyTimeDuration(-1)).toBe("validation.durationNegative");
  });

  it("returns error for duration over 2 hours", () => {
    expect(validateTummyTimeDuration(7201)).toBe("validation.durationTooLong2h");
  });
});

describe("validateTummyTimeStartTimeNotInFuture", () => {
  it("returns null for past time", () => {
    const pastTime = new Date(Date.now() - 60000);
    expect(validateTummyTimeStartTimeNotInFuture(pastTime)).toBeNull();
  });

  it("returns null for current time with tolerance", () => {
    const now = new Date();
    expect(validateTummyTimeStartTimeNotInFuture(now)).toBeNull();
  });

  it("returns null for time within 10 second tolerance", () => {
    const slightlyFuture = new Date(Date.now() + 5000);
    expect(validateTummyTimeStartTimeNotInFuture(slightlyFuture)).toBeNull();
  });

  it("returns error for future time beyond tolerance", () => {
    const futureTime = new Date(Date.now() + 60000);
    expect(validateTummyTimeStartTimeNotInFuture(futureTime)).toBe("validation.startTimeNotInFuture");
  });
});

describe("validateManualTummyTimeDuration", () => {
  it("returns error for undefined duration", () => {
    expect(validateManualTummyTimeDuration(undefined)).toBe("validation.durationRequired");
  });

  it("returns error for duration less than 1 minute", () => {
    expect(validateManualTummyTimeDuration(30)).toBe("validation.durationMinimum1m");
    expect(validateManualTummyTimeDuration(59)).toBe("validation.durationMinimum1m");
  });

  it("returns null for valid duration", () => {
    expect(validateManualTummyTimeDuration(60)).toBeNull();
    expect(validateManualTummyTimeDuration(300)).toBeNull();
    expect(validateManualTummyTimeDuration(1800)).toBeNull();
  });

  it("returns error for duration over 2 hours", () => {
    expect(validateManualTummyTimeDuration(7201)).toBe("validation.durationTooLong2h");
  });
});

describe("calculateTummyTimeDuration", () => {
  it("calculates duration in seconds", () => {
    const start = new Date(2024, 5, 15, 10, 0);
    const end = new Date(2024, 5, 15, 10, 15);
    expect(calculateTummyTimeDuration(start, end)).toBe(900);
  });

  it("returns 0 for same start and end time", () => {
    const time = new Date(2024, 5, 15, 10, 0);
    expect(calculateTummyTimeDuration(time, time)).toBe(0);
  });

  it("returns 0 if end is before start (edge case)", () => {
    const start = new Date(2024, 5, 15, 12, 0);
    const end = new Date(2024, 5, 15, 10, 0);
    expect(calculateTummyTimeDuration(start, end)).toBe(0);
  });
});

describe("validateDailyGoal", () => {
  it("returns null for valid goal", () => {
    expect(validateDailyGoal(300)).toBeNull();
    expect(validateDailyGoal(1800)).toBeNull();
    expect(validateDailyGoal(3600)).toBeNull();
  });

  it("returns error for zero goal", () => {
    expect(validateDailyGoal(0)).toBe("validation.dailyGoalMinimum");
  });

  it("returns error for negative goal", () => {
    expect(validateDailyGoal(-100)).toBe("validation.dailyGoalMinimum");
  });

  it("returns error for goal less than 1 minute", () => {
    expect(validateDailyGoal(30)).toBe("validation.dailyGoalMinimum");
  });

  it("returns error for goal over 2 hours", () => {
    expect(validateDailyGoal(7201)).toBe("validation.dailyGoalMaximum");
  });
});

describe("calculateDailyProgress", () => {
  it("calculates 0% for no progress", () => {
    expect(calculateDailyProgress(0, 1800)).toBe(0);
  });

  it("calculates 50% for half progress", () => {
    expect(calculateDailyProgress(900, 1800)).toBe(50);
  });

  it("calculates 100% for full progress", () => {
    expect(calculateDailyProgress(1800, 1800)).toBe(100);
  });

  it("caps at 100% for over-completion", () => {
    expect(calculateDailyProgress(3600, 1800)).toBe(100);
  });

  it("handles edge case of zero goal", () => {
    expect(calculateDailyProgress(300, 0)).toBe(100);
  });

  it("rounds to nearest integer", () => {
    expect(calculateDailyProgress(1000, 1800)).toBe(56);
  });
});

describe("calculateTodaysTotalSeconds", () => {
  it("returns 0 for empty entries", () => {
    expect(calculateTodaysTotalSeconds([])).toBe(0);
  });

  it("calculates total for single entry", () => {
    const today = new Date();
    const entries: TummyTimeEntry[] = [
      {
        babyId: "baby-123",
        startedAt: today,
        durationSeconds: 300,
      },
    ];
    expect(calculateTodaysTotalSeconds(entries)).toBe(300);
  });

  it("calculates total for multiple entries today", () => {
    const today = new Date();
    const entries: TummyTimeEntry[] = [
      { babyId: "baby-123", startedAt: today, durationSeconds: 300 },
      { babyId: "baby-123", startedAt: today, durationSeconds: 600 },
    ];
    expect(calculateTodaysTotalSeconds(entries)).toBe(900);
  });

  it("excludes entries from other days", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const entries: TummyTimeEntry[] = [
      { babyId: "baby-123", startedAt: today, durationSeconds: 300 },
      { babyId: "baby-123", startedAt: yesterday, durationSeconds: 600 },
    ];
    expect(calculateTodaysTotalSeconds(entries)).toBe(300);
  });

  it("handles entries without duration", () => {
    const today = new Date();
    const entries: TummyTimeEntry[] = [
      { babyId: "baby-123", startedAt: today, durationSeconds: 300 },
      { babyId: "baby-123", startedAt: today },
    ];
    expect(calculateTodaysTotalSeconds(entries)).toBe(300);
  });
});

describe("validateTummyTime", () => {
  it("returns valid for correct entry", () => {
    const result = validateTummyTime({
      babyId: "baby-123",
      startedAt: new Date(),
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for missing start time", () => {
    const result = validateTummyTime({
      babyId: "baby-123",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBeDefined();
  });

  it("returns error for invalid end time", () => {
    const start = new Date(2024, 5, 15, 14, 30);
    const end = new Date(2024, 5, 15, 14, 0);
    const result = validateTummyTime({
      babyId: "baby-123",
      startedAt: start,
      endedAt: end,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.endedAt).toBeDefined();
  });

  it("returns error for invalid duration", () => {
    const result = validateTummyTime({
      babyId: "baby-123",
      startedAt: new Date(),
      durationSeconds: -100,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBeDefined();
  });

  it("returns valid with optional fields", () => {
    const result = validateTummyTime({
      babyId: "baby-123",
      startedAt: new Date(),
      endedAt: new Date(Date.now() + 600000),
      durationSeconds: 600,
      notes: "Baby enjoyed it",
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});

describe("validateManualTummyTime", () => {
  it("returns valid for correct manual entry", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualTummyTime({
      babyId: "baby-123",
      startedAt: pastTime,
      durationSeconds: 300,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for missing start time", () => {
    const result = validateManualTummyTime({
      babyId: "baby-123",
      durationSeconds: 300,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBeDefined();
  });

  it("returns error for future start time", () => {
    const futureTime = new Date(Date.now() + 60000);
    const result = validateManualTummyTime({
      babyId: "baby-123",
      startedAt: futureTime,
      durationSeconds: 300,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBe("validation.startTimeNotInFuture");
  });

  it("returns error for missing duration", () => {
    const result = validateManualTummyTime({
      babyId: "baby-123",
      startedAt: new Date(Date.now() - 3600000),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBeDefined();
  });

  it("returns error for duration less than 1 minute", () => {
    const result = validateManualTummyTime({
      babyId: "baby-123",
      startedAt: new Date(Date.now() - 3600000),
      durationSeconds: 30,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBe("validation.durationMinimum1m");
  });

  it("returns error for duration over 2 hours", () => {
    const result = validateManualTummyTime({
      babyId: "baby-123",
      startedAt: new Date(Date.now() - 10000000),
      durationSeconds: 7201,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBe("validation.durationTooLong2h");
  });

  it("returns multiple errors for multiple issues", () => {
    const futureTime = new Date(Date.now() + 60000);
    const result = validateManualTummyTime({
      babyId: "baby-123",
      startedAt: futureTime,
      durationSeconds: 30,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.startedAt).toBeDefined();
    expect(result.errors.durationSeconds).toBeDefined();
  });
});

describe("validateManualTummyTimeTimes", () => {
  const baseEntry = {
    babyId: "baby-123",
    startedAt: new Date("2026-08-05T10:00:00.000Z"),
  };

  it("validates the duration derived from the entered start and end times", () => {
    expect(
      validateManualTummyTimeTimes({
        ...baseEntry,
        endedAt: new Date("2026-08-05T10:00:59.000Z"),
      })
    ).toEqual({
      isValid: false,
      errors: { durationSeconds: "validation.durationMinimum1m" },
    });
    expect(
      validateManualTummyTimeTimes({
        ...baseEntry,
        endedAt: new Date("2026-08-05T12:00:01.000Z"),
      })
    ).toEqual({
      isValid: false,
      errors: { durationSeconds: "validation.durationTooLong2h" },
    });
    expect(
      validateManualTummyTimeTimes({
        ...baseEntry,
        endedAt: new Date("2026-08-05T12:00:00.000Z"),
      })
    ).toEqual({ isValid: true, errors: {} });
  });

  it("rejects a future end time", () => {
    const result = validateManualTummyTimeTimes({
      ...baseEntry,
      startedAt: new Date(Date.now() - 30_000),
      endedAt: new Date(Date.now() + 30_000),
    });
    expect(result).toEqual({
      isValid: false,
      errors: { endedAt: "validation.endTimeNotInFuture" },
    });
  });
});
