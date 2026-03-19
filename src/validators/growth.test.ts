import { describe, it, expect } from "vitest";
import {
  validateWeightKg,
  validateHeightCm,
  validateHeadCircumferenceCm,
  validateMeasurementDate,
  validateMeasurementDateNotInFuture,
  validateGrowthMeasurement,
  validateAtLeastOneMeasurement,
} from "./growth";

describe("validateWeightKg", () => {
  it("returns null for undefined (optional field)", () => {
    expect(validateWeightKg(undefined)).toBeNull();
  });

  it("returns null for valid weights", () => {
    expect(validateWeightKg(3)).toBeNull();
    expect(validateWeightKg(5.5)).toBeNull();
    expect(validateWeightKg(10)).toBeNull();
    expect(validateWeightKg(20)).toBeNull();
  });

  it("returns error for non-positive weight", () => {
    expect(validateWeightKg(0)).toBe("validation.weightPositive");
    expect(validateWeightKg(-1)).toBe("validation.weightPositive");
  });

  it("returns error for weight below minimum (0.5 kg)", () => {
    expect(validateWeightKg(0.3)).toBe("validation.weightTooLow");
  });

  it("returns error for weight above maximum (30 kg)", () => {
    expect(validateWeightKg(31)).toBe("validation.weightTooHigh");
    expect(validateWeightKg(50)).toBe("validation.weightTooHigh");
  });
});

describe("validateHeightCm", () => {
  it("returns null for undefined (optional field)", () => {
    expect(validateHeightCm(undefined)).toBeNull();
  });

  it("returns null for valid heights", () => {
    expect(validateHeightCm(50)).toBeNull();
    expect(validateHeightCm(60)).toBeNull();
    expect(validateHeightCm(100)).toBeNull();
  });

  it("returns error for non-positive height", () => {
    expect(validateHeightCm(0)).toBe("validation.heightPositive");
    expect(validateHeightCm(-1)).toBe("validation.heightPositive");
  });

  it("returns error for height below minimum (20 cm)", () => {
    expect(validateHeightCm(15)).toBe("validation.heightTooLow");
  });

  it("returns error for height above maximum (150 cm)", () => {
    expect(validateHeightCm(151)).toBe("validation.heightTooHigh");
    expect(validateHeightCm(200)).toBe("validation.heightTooHigh");
  });
});

describe("validateHeadCircumferenceCm", () => {
  it("returns null for undefined (optional field)", () => {
    expect(validateHeadCircumferenceCm(undefined)).toBeNull();
  });

  it("returns null for valid head circumferences", () => {
    expect(validateHeadCircumferenceCm(35)).toBeNull();
    expect(validateHeadCircumferenceCm(40)).toBeNull();
    expect(validateHeadCircumferenceCm(50)).toBeNull();
  });

  it("returns error for non-positive value", () => {
    expect(validateHeadCircumferenceCm(0)).toBe("validation.headCircumferencePositive");
    expect(validateHeadCircumferenceCm(-1)).toBe("validation.headCircumferencePositive");
  });

  it("returns error for value below minimum (20 cm)", () => {
    expect(validateHeadCircumferenceCm(15)).toBe("validation.headCircumferenceTooLow");
  });

  it("returns error for value above maximum (60 cm)", () => {
    expect(validateHeadCircumferenceCm(61)).toBe("validation.headCircumferenceTooHigh");
    expect(validateHeadCircumferenceCm(70)).toBe("validation.headCircumferenceTooHigh");
  });
});

describe("validateMeasurementDate", () => {
  it("returns error for undefined date", () => {
    expect(validateMeasurementDate(undefined)).toBe("validation.measurementDateRequired");
  });

  it("returns null for valid date", () => {
    expect(validateMeasurementDate(new Date())).toBeNull();
    expect(validateMeasurementDate(new Date(2024, 5, 15))).toBeNull();
  });
});

describe("validateMeasurementDateNotInFuture", () => {
  it("returns null for past date", () => {
    const pastDate = new Date(Date.now() - 86400000); // Yesterday
    expect(validateMeasurementDateNotInFuture(pastDate)).toBeNull();
  });

  it("returns null for today", () => {
    const today = new Date();
    expect(validateMeasurementDateNotInFuture(today)).toBeNull();
  });

  it("returns error for future date", () => {
    const futureDate = new Date(Date.now() + 86400000); // Tomorrow
    expect(validateMeasurementDateNotInFuture(futureDate)).toBe("validation.measurementDateNotInFuture");
  });

  it("allows small tolerance for near-future times", () => {
    const nearFuture = new Date(Date.now() + 5000); // 5 seconds in future
    expect(validateMeasurementDateNotInFuture(nearFuture)).toBeNull();
  });
});

describe("validateAtLeastOneMeasurement", () => {
  it("returns error when no measurements provided", () => {
    expect(validateAtLeastOneMeasurement(undefined, undefined, undefined)).toBe(
      "validation.atLeastOneMeasurement"
    );
  });

  it("returns null when weight is provided", () => {
    expect(validateAtLeastOneMeasurement(5, undefined, undefined)).toBeNull();
  });

  it("returns null when height is provided", () => {
    expect(validateAtLeastOneMeasurement(undefined, 50, undefined)).toBeNull();
  });

  it("returns null when head circumference is provided", () => {
    expect(validateAtLeastOneMeasurement(undefined, undefined, 35)).toBeNull();
  });

  it("returns null when all measurements are provided", () => {
    expect(validateAtLeastOneMeasurement(5, 50, 35)).toBeNull();
  });
});

describe("validateGrowthMeasurement", () => {
  it("returns valid for entry with only weight", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: new Date(),
      weightKg: 5,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid for entry with only height", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: new Date(),
      heightCm: 50,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid for entry with only head circumference", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: new Date(),
      headCircumferenceCm: 35,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid for complete measurement entry", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: new Date(),
      weightKg: 5.5,
      heightCm: 55,
      headCircumferenceCm: 38,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for missing measurement date", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      weightKg: 5,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.measuredAt).toBe("validation.measurementDateRequired");
  });

  it("returns error for future measurement date", () => {
    const futureDate = new Date(Date.now() + 86400000);
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: futureDate,
      weightKg: 5,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.measuredAt).toBe("validation.measurementDateNotInFuture");
  });

  it("returns error when no measurements provided", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: new Date(),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.measurements).toBe("validation.atLeastOneMeasurement");
  });

  it("returns error for invalid weight", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: new Date(),
      weightKg: 0,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.weightKg).toBe("validation.weightPositive");
  });

  it("returns error for invalid height", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: new Date(),
      heightCm: 10,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.heightCm).toBe("validation.heightTooLow");
  });

  it("returns error for invalid head circumference", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: new Date(),
      headCircumferenceCm: 70,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.headCircumferenceCm).toBe("validation.headCircumferenceTooHigh");
  });

  it("returns multiple errors when multiple fields invalid", () => {
    const futureDate = new Date(Date.now() + 86400000);
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: futureDate,
      weightKg: -1,
      heightCm: 10,
    });
    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(3);
  });

  it("allows notes field", () => {
    const result = validateGrowthMeasurement({
      babyId: "baby-1",
      measuredAt: new Date(),
      weightKg: 5,
      notes: "Doctor's visit",
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
