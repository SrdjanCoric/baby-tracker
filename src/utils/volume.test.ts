import { describe, it, expect } from "vitest";
import {
  mlToOz,
  ozToMl,
  formatVolume,
  isValidFeedingVolume,
  parseVolume
} from "./volume";

describe("mlToOz", () => {
  it("converts 0 ml to 0 oz", () => {
    expect(mlToOz(0)).toBe(0);
  });

  it("converts 30 ml to approximately 1 oz", () => {
    expect(mlToOz(30)).toBeCloseTo(1.0, 0);
  });

  it("converts 60 ml to approximately 2 oz", () => {
    expect(mlToOz(60)).toBeCloseTo(2.0, 0);
  });

  it("converts 120 ml to approximately 4 oz", () => {
    expect(mlToOz(120)).toBeCloseTo(4.1, 0);
  });

  it("handles decimal places parameter", () => {
    expect(mlToOz(30, 2)).toBeCloseTo(1.01, 1);
  });

  it("returns 0 for negative values", () => {
    expect(mlToOz(-50)).toBe(0);
  });
});

describe("ozToMl", () => {
  it("converts 0 oz to 0 ml", () => {
    expect(ozToMl(0)).toBe(0);
  });

  it("converts 1 oz to approximately 30 ml", () => {
    expect(ozToMl(1)).toBeCloseTo(30, 0);
  });

  it("converts 2 oz to approximately 59 ml", () => {
    expect(ozToMl(2)).toBeCloseTo(59, 0);
  });

  it("converts 4 oz to approximately 118 ml", () => {
    expect(ozToMl(4)).toBeCloseTo(118, 0);
  });

  it("handles decimal places parameter", () => {
    expect(ozToMl(1, 2)).toBeCloseTo(29.57, 1);
  });

  it("returns 0 for negative values", () => {
    expect(ozToMl(-2)).toBe(0);
  });
});

describe("formatVolume", () => {
  it("formats in oz by default", () => {
    expect(formatVolume(60)).toBe("2 oz");
  });

  it("formats in ml when specified", () => {
    expect(formatVolume(60, "ml")).toBe("60 ml");
  });

  it("rounds ml to nearest integer", () => {
    expect(formatVolume(59.7, "ml")).toBe("60 ml");
  });

  it("handles zero volume", () => {
    expect(formatVolume(0)).toBe("0 oz");
    expect(formatVolume(0, "ml")).toBe("0 ml");
  });
});

describe("isValidFeedingVolume", () => {
  it("returns true for valid volumes", () => {
    expect(isValidFeedingVolume(0)).toBe(true);
    expect(isValidFeedingVolume(60)).toBe(true);
    expect(isValidFeedingVolume(120)).toBe(true);
    expect(isValidFeedingVolume(500)).toBe(true);
  });

  it("returns false for negative volumes", () => {
    expect(isValidFeedingVolume(-1)).toBe(false);
    expect(isValidFeedingVolume(-100)).toBe(false);
  });

  it("returns false for volumes over 500ml", () => {
    expect(isValidFeedingVolume(501)).toBe(false);
    expect(isValidFeedingVolume(1000)).toBe(false);
  });
});

describe("parseVolume", () => {
  it("parses ml values", () => {
    expect(parseVolume("60", "ml")).toBe(60);
    expect(parseVolume("120", "ml")).toBe(120);
  });

  it("parses oz values and converts to ml", () => {
    const result = parseVolume("2", "oz");
    expect(result).toBeCloseTo(59, 0);
  });

  it("returns null for invalid input", () => {
    expect(parseVolume("abc", "ml")).toBeNull();
    expect(parseVolume("", "ml")).toBeNull();
  });

  it("returns null for negative values", () => {
    expect(parseVolume("-10", "ml")).toBeNull();
  });

  it("handles decimal values", () => {
    expect(parseVolume("1.5", "oz")).toBeCloseTo(44, 0);
  });
});
