import { describe, it, expect } from "vitest";
import {
  kgToLbs,
  lbsToKg,
  cmToInches,
  inchesToCm,
  formatWeight,
  formatHeight,
  isValidWeight,
  isValidHeight,
  isValidHeadCircumference,
  parseWeight,
  parseHeight,
} from "./growth";

describe("kgToLbs", () => {
  it("converts kg to lbs correctly", () => {
    expect(kgToLbs(1)).toBeCloseTo(2.2, 1);
    expect(kgToLbs(5)).toBeCloseTo(11.0, 1);
    expect(kgToLbs(10)).toBeCloseTo(22.0, 1);
  });

  it("returns 0 for negative values", () => {
    expect(kgToLbs(-1)).toBe(0);
  });

  it("respects decimal places parameter", () => {
    expect(kgToLbs(3.5, 2)).toBeCloseTo(7.72, 2);
  });
});

describe("lbsToKg", () => {
  it("converts lbs to kg correctly", () => {
    expect(lbsToKg(2.2)).toBeCloseTo(1, 1);
    expect(lbsToKg(11)).toBeCloseTo(5, 1);
    expect(lbsToKg(22)).toBeCloseTo(10, 1);
  });

  it("returns 0 for negative values", () => {
    expect(lbsToKg(-1)).toBe(0);
  });

  it("respects decimal places parameter", () => {
    expect(lbsToKg(7.7, 2)).toBeCloseTo(3.49, 2);
  });
});

describe("cmToInches", () => {
  it("converts cm to inches correctly", () => {
    expect(cmToInches(2.54)).toBeCloseTo(1, 1);
    expect(cmToInches(50)).toBeCloseTo(19.7, 1);
    expect(cmToInches(100)).toBeCloseTo(39.4, 1);
  });

  it("returns 0 for negative values", () => {
    expect(cmToInches(-1)).toBe(0);
  });

  it("respects decimal places parameter", () => {
    expect(cmToInches(50, 2)).toBeCloseTo(19.69, 2);
  });
});

describe("inchesToCm", () => {
  it("converts inches to cm correctly", () => {
    expect(inchesToCm(1)).toBeCloseTo(2.54, 1);
    expect(inchesToCm(20)).toBeCloseTo(50.8, 1);
    expect(inchesToCm(39.37)).toBeCloseTo(100, 0);
  });

  it("returns 0 for negative values", () => {
    expect(inchesToCm(-1)).toBe(0);
  });

  it("respects decimal places parameter", () => {
    expect(inchesToCm(20, 2)).toBeCloseTo(50.8, 2);
  });
});

describe("formatWeight", () => {
  it("formats weight in kg", () => {
    expect(formatWeight(5.5, "kg")).toBe("5.5 kg");
    expect(formatWeight(10, "kg")).toBe("10 kg");
  });

  it("formats weight in lbs", () => {
    expect(formatWeight(5, "lbs")).toBe("11 lbs");
    expect(formatWeight(10, "lbs")).toBe("22 lbs");
  });

  it("defaults to kg", () => {
    expect(formatWeight(5)).toBe("5 kg");
  });
});

describe("formatHeight", () => {
  it("formats height in cm", () => {
    expect(formatHeight(50, "cm")).toBe("50 cm");
    expect(formatHeight(75.5, "cm")).toBe("75.5 cm");
  });

  it("formats height in inches", () => {
    expect(formatHeight(50, "in")).toBe("19.7 in");
    expect(formatHeight(100, "in")).toBe("39.4 in");
  });

  it("defaults to cm", () => {
    expect(formatHeight(50)).toBe("50 cm");
  });
});

describe("isValidWeight", () => {
  it("returns true for valid baby weights", () => {
    expect(isValidWeight(3)).toBe(true);
    expect(isValidWeight(5)).toBe(true);
    expect(isValidWeight(10)).toBe(true);
    expect(isValidWeight(20)).toBe(true);
  });

  it("returns false for weights below minimum", () => {
    expect(isValidWeight(0)).toBe(false);
    expect(isValidWeight(-1)).toBe(false);
    expect(isValidWeight(0.4)).toBe(false);
  });

  it("returns false for weights above maximum", () => {
    expect(isValidWeight(31)).toBe(false);
    expect(isValidWeight(50)).toBe(false);
  });

  it("accepts valid edge cases", () => {
    expect(isValidWeight(0.5)).toBe(true);
    expect(isValidWeight(30)).toBe(true);
  });
});

describe("isValidHeight", () => {
  it("returns true for valid baby heights", () => {
    expect(isValidHeight(50)).toBe(true);
    expect(isValidHeight(60)).toBe(true);
    expect(isValidHeight(100)).toBe(true);
  });

  it("returns false for heights below minimum", () => {
    expect(isValidHeight(0)).toBe(false);
    expect(isValidHeight(-1)).toBe(false);
    expect(isValidHeight(19)).toBe(false);
  });

  it("returns false for heights above maximum", () => {
    expect(isValidHeight(151)).toBe(false);
    expect(isValidHeight(200)).toBe(false);
  });

  it("accepts valid edge cases", () => {
    expect(isValidHeight(20)).toBe(true);
    expect(isValidHeight(150)).toBe(true);
  });
});

describe("isValidHeadCircumference", () => {
  it("returns true for valid head circumferences", () => {
    expect(isValidHeadCircumference(35)).toBe(true);
    expect(isValidHeadCircumference(40)).toBe(true);
    expect(isValidHeadCircumference(50)).toBe(true);
  });

  it("returns false for values below minimum", () => {
    expect(isValidHeadCircumference(0)).toBe(false);
    expect(isValidHeadCircumference(-1)).toBe(false);
    expect(isValidHeadCircumference(19)).toBe(false);
  });

  it("returns false for values above maximum", () => {
    expect(isValidHeadCircumference(61)).toBe(false);
    expect(isValidHeadCircumference(70)).toBe(false);
  });

  it("accepts valid edge cases", () => {
    expect(isValidHeadCircumference(20)).toBe(true);
    expect(isValidHeadCircumference(60)).toBe(true);
  });
});

describe("parseWeight", () => {
  it("parses weight in kg", () => {
    expect(parseWeight("5", "kg")).toBe(5);
    expect(parseWeight("5.5", "kg")).toBe(5.5);
    expect(parseWeight("10.25", "kg")).toBe(10.25);
  });

  it("parses weight in lbs and converts to kg", () => {
    const result = parseWeight("11", "lbs");
    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(5, 1);
  });

  it("returns null for invalid input", () => {
    expect(parseWeight("", "kg")).toBeNull();
    expect(parseWeight("abc", "kg")).toBeNull();
    expect(parseWeight("-5", "kg")).toBeNull();
  });
});

describe("parseHeight", () => {
  it("parses height in cm", () => {
    expect(parseHeight("50", "cm")).toBe(50);
    expect(parseHeight("75.5", "cm")).toBe(75.5);
  });

  it("parses height in inches and converts to cm", () => {
    const result = parseHeight("20", "in");
    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(50.8, 1);
  });

  it("returns null for invalid input", () => {
    expect(parseHeight("", "cm")).toBeNull();
    expect(parseHeight("abc", "cm")).toBeNull();
    expect(parseHeight("-50", "cm")).toBeNull();
  });
});
