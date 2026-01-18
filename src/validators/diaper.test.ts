import { describe, it, expect } from "vitest";
import {
  validateDiaperType,
  validateStoolColor,
  validateDiaperEntry,
  validateManualDiaper,
  validateChangeTimeNotInFuture,
} from "./diaper";
import type { DiaperType, StoolColor } from "@/constants/activities";

describe("validateDiaperType", () => {
  it("returns true for valid diaper types", () => {
    expect(validateDiaperType("wet")).toBe(true);
    expect(validateDiaperType("dirty")).toBe(true);
    expect(validateDiaperType("mixed")).toBe(true);
  });

  it("returns false for invalid diaper types", () => {
    expect(validateDiaperType("invalid")).toBe(false);
    expect(validateDiaperType("")).toBe(false);
    expect(validateDiaperType("WET")).toBe(false);
    expect(validateDiaperType("DIRTY")).toBe(false);
  });
});

describe("validateStoolColor", () => {
  it("returns null for valid stool colors", () => {
    expect(validateStoolColor("yellow")).toBeNull();
    expect(validateStoolColor("brown")).toBeNull();
    expect(validateStoolColor("green")).toBeNull();
    expect(validateStoolColor("orange")).toBeNull();
    expect(validateStoolColor("black")).toBeNull();
    expect(validateStoolColor("white")).toBeNull();
    expect(validateStoolColor("red")).toBeNull();
  });

  it("returns error for invalid stool color", () => {
    expect(validateStoolColor("purple" as StoolColor)).toBe("Invalid stool color");
    expect(validateStoolColor("" as StoolColor)).toBe("Invalid stool color");
  });

  it("returns null for undefined stool color", () => {
    expect(validateStoolColor(undefined)).toBeNull();
  });
});

describe("validateChangeTimeNotInFuture", () => {
  it("returns null for past time", () => {
    const pastTime = new Date(Date.now() - 60000);
    expect(validateChangeTimeNotInFuture(pastTime)).toBeNull();
  });

  it("returns null for current time with tolerance", () => {
    const now = new Date();
    expect(validateChangeTimeNotInFuture(now)).toBeNull();
  });

  it("returns null for time within 10 second tolerance", () => {
    const slightlyFuture = new Date(Date.now() + 5000);
    expect(validateChangeTimeNotInFuture(slightlyFuture)).toBeNull();
  });

  it("returns error for future time beyond tolerance", () => {
    const futureTime = new Date(Date.now() + 60000);
    expect(validateChangeTimeNotInFuture(futureTime)).toBe("Change time cannot be in the future");
  });
});

describe("validateDiaperEntry", () => {
  it("returns valid for wet diaper", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      type: "wet",
      changedAt: new Date(),
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid for dirty diaper with stool color", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      type: "dirty",
      stoolColor: "brown",
      changedAt: new Date(),
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid for mixed diaper with stool color", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      type: "mixed",
      stoolColor: "yellow",
      changedAt: new Date(),
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for invalid diaper type", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      type: "invalid" as DiaperType,
      changedAt: new Date(),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBe("Invalid diaper type");
  });

  it("returns error for missing diaper type", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      changedAt: new Date(),
    } as { babyId: string; type: DiaperType; changedAt: Date });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBe("Diaper type is required");
  });

  it("returns error when stool color is provided for wet diaper", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      type: "wet",
      stoolColor: "brown",
      changedAt: new Date(),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.stoolColor).toBe("Stool color is only applicable for dirty or mixed diapers");
  });

  it("returns error for invalid stool color on dirty diaper", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      type: "dirty",
      stoolColor: "purple" as StoolColor,
      changedAt: new Date(),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.stoolColor).toBe("Invalid stool color");
  });

  it("returns error for missing changedAt", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      type: "wet",
    } as { babyId: string; type: DiaperType; changedAt: Date });
    expect(result.isValid).toBe(false);
    expect(result.errors.changedAt).toBe("Change time is required");
  });

  it("returns valid for dirty diaper without stool color (optional)", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      type: "dirty",
      changedAt: new Date(),
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns valid with optional notes", () => {
    const result = validateDiaperEntry({
      babyId: "baby-123",
      type: "wet",
      changedAt: new Date(),
      notes: "First diaper of the day",
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});

describe("validateManualDiaper", () => {
  it("returns valid for manual entry with past time", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualDiaper({
      babyId: "baby-123",
      type: "wet",
      changedAt: pastTime,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns error for future change time", () => {
    const futureTime = new Date(Date.now() + 60000);
    const result = validateManualDiaper({
      babyId: "baby-123",
      type: "wet",
      changedAt: futureTime,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.changedAt).toBe("Change time cannot be in the future");
  });

  it("returns error for invalid diaper type in manual entry", () => {
    const result = validateManualDiaper({
      babyId: "baby-123",
      type: "invalid" as DiaperType,
      changedAt: new Date(Date.now() - 3600000),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.type).toBe("Invalid diaper type");
  });

  it("returns multiple errors for multiple issues", () => {
    const futureTime = new Date(Date.now() + 60000);
    const result = validateManualDiaper({
      babyId: "baby-123",
      type: "wet",
      stoolColor: "brown",
      changedAt: futureTime,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.changedAt).toBeDefined();
    expect(result.errors.stoolColor).toBeDefined();
  });

  it("returns valid for manual dirty diaper with stool color", () => {
    const pastTime = new Date(Date.now() - 3600000);
    const result = validateManualDiaper({
      babyId: "baby-123",
      type: "dirty",
      stoolColor: "green",
      changedAt: pastTime,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
