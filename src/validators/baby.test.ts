import { describe, it, expect } from "vitest";
import {
  validateBabyName,
  validateBirthDate,
  validateBabyProfile,
  validateNewBabyProfile,
  calculateBabyAge,
  calculateBabyAgeInWeeks,
  calculateBabyAgeInDays
} from "./baby";

describe("validateBabyName", () => {
  it("returns null for valid name", () => {
    expect(validateBabyName("Emma")).toBeNull();
    expect(validateBabyName("John Doe")).toBeNull();
    expect(validateBabyName("A")).toBeNull();
  });

  it("returns error for empty name", () => {
    expect(validateBabyName("")).toBe("validation.nameRequired");
    expect(validateBabyName("   ")).toBe("validation.nameRequired");
  });

  it("returns error for name over 100 characters", () => {
    const longName = "A".repeat(101);
    expect(validateBabyName(longName)).toBe("validation.nameMaxLength");
  });

  it("trims whitespace before validation", () => {
    expect(validateBabyName("  Emma  ")).toBeNull();
  });
});

describe("validateBirthDate", () => {
  const now = new Date(2024, 5, 15);

  it("returns null for valid birth date", () => {
    const validDate = new Date(2024, 3, 10);
    expect(validateBirthDate(validDate, now)).toBeNull();
  });

  it("returns null for undefined birth date", () => {
    expect(validateBirthDate(undefined, now)).toBeNull();
  });

  it("returns error for future date", () => {
    const futureDate = new Date(2024, 7, 1);
    expect(validateBirthDate(futureDate, now)).toBe("validation.birthDateFuture");
  });

  it("returns error for date more than 5 years ago", () => {
    const oldDate = new Date(2018, 0, 1);
    expect(validateBirthDate(oldDate, now)).toBe("validation.birthDateTooFar");
  });

  it("accepts date exactly 5 years ago", () => {
    const fiveYearsAgo = new Date(2019, 5, 15);
    expect(validateBirthDate(fiveYearsAgo, now)).toBeNull();
  });
});

describe("validateNewBabyProfile", () => {
  const now = new Date(2024, 5, 15);

  it("accepts a complete profile born today", () => {
    const result = validateNewBabyProfile({
      name: " Emma ",
      birthDate: now,
      gender: "female",
    }, now);

    expect(result).toEqual({
      isValid: true,
      errors: {},
      data: {
        name: "Emma",
        birthDate: now,
        gender: "female",
        photoUri: undefined,
      },
    });
  });

  it("rejects an invalid birth date", () => {
    const result = validateNewBabyProfile({
      name: "Emma",
      birthDate: new Date(Number.NaN),
      gender: "female",
    }, now);

    expect(result.errors.birthDate).toBe("validation.birthDateInvalid");
  });

  it("rejects a creation draft without a birth date or gender", () => {
    const result = validateNewBabyProfile({ name: "Emma" }, now);

    expect(result).toEqual({
      isValid: false,
      errors: {
        birthDate: "validation.birthDateRequired",
        gender: "validation.genderRequired",
      },
    });
  });
});

describe("validateBabyProfile", () => {
  const now = new Date(2024, 5, 15);

  it("returns valid for complete profile", () => {
    const result = validateBabyProfile({
      name: "Emma",
      birthDate: new Date(2024, 3, 10)
    }, now);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns errors for invalid profile", () => {
    const result = validateBabyProfile({
      name: "",
      birthDate: new Date(2025, 0, 1)
    }, now);
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.birthDate).toBeDefined();
  });

  it("returns error only for invalid fields", () => {
    const result = validateBabyProfile({
      name: "Emma",
      birthDate: new Date(2025, 0, 1)
    }, now);
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeUndefined();
    expect(result.errors.birthDate).toBeDefined();
  });
});

describe("calculateBabyAge", () => {
  it("returns days for newborn under 2 weeks", () => {
    const now = new Date(2024, 5, 20);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAge(birthDate, now)).toBe("5 days old");
  });

  it("returns singular 'day' for 1 day old", () => {
    const now = new Date(2024, 5, 16);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAge(birthDate, now)).toBe("1 day old");
  });

  it("returns weeks for baby 2-8 weeks old", () => {
    const now = new Date(2024, 6, 13);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAge(birthDate, now)).toBe("4 weeks old");
  });

  it("returns days for baby under 2 weeks", () => {
    const now = new Date(2024, 5, 22);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAge(birthDate, now)).toBe("7 days old");
  });

  it("returns weeks for baby exactly 2 weeks old", () => {
    const now = new Date(2024, 5, 29);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAge(birthDate, now)).toBe("2 weeks old");
  });

  it("returns months for baby 2-24 months old", () => {
    const now = new Date(2024, 11, 15);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAge(birthDate, now)).toBe("6 months old");
  });

  it("returns weeks for baby under 8 weeks", () => {
    const now = new Date(2024, 6, 15);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAge(birthDate, now)).toBe("4 weeks old");
  });

  it("returns months for baby 8+ weeks old", () => {
    const now = new Date(2024, 7, 15);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAge(birthDate, now)).toBe("2 months old");
  });

  it("returns years for baby 2+ years old", () => {
    const now = new Date(2027, 5, 30);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAge(birthDate, now)).toBe("3 years old");
  });

  it("returns years and months for baby over 2 years", () => {
    const now = new Date(2027, 9, 15);
    const birthDate = new Date(2024, 5, 15);
    const result = calculateBabyAge(birthDate, now);
    expect(result).toMatch(/3y \d+m old/);
  });

  it("returns 'Not born yet' for future birth date", () => {
    const now = new Date(2024, 5, 15);
    const birthDate = new Date(2024, 7, 1);
    expect(calculateBabyAge(birthDate, now)).toBe("Not born yet");
  });
});

describe("calculateBabyAgeInWeeks", () => {
  it("returns 0 for same day", () => {
    const date = new Date(2024, 5, 15);
    expect(calculateBabyAgeInWeeks(date, date)).toBe(0);
  });

  it("returns correct weeks", () => {
    const now = new Date(2024, 6, 13);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAgeInWeeks(birthDate, now)).toBe(4);
  });

  it("returns 0 for future date", () => {
    const now = new Date(2024, 5, 15);
    const future = new Date(2024, 7, 1);
    expect(calculateBabyAgeInWeeks(future, now)).toBe(0);
  });
});

describe("calculateBabyAgeInDays", () => {
  it("returns 0 for same day", () => {
    const date = new Date(2024, 5, 15);
    expect(calculateBabyAgeInDays(date, date)).toBe(0);
  });

  it("returns correct days", () => {
    const now = new Date(2024, 5, 25);
    const birthDate = new Date(2024, 5, 15);
    expect(calculateBabyAgeInDays(birthDate, now)).toBe(10);
  });

  it("returns 0 for future date", () => {
    const now = new Date(2024, 5, 15);
    const future = new Date(2024, 7, 1);
    expect(calculateBabyAgeInDays(future, now)).toBe(0);
  });
});
