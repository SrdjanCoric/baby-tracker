import { describe, it, expect } from "vitest";
import {
  isValidUnitSystem,
  getWeightUnit,
  getHeightUnit,
  getVolumeUnit,
  DEFAULT_UNIT_SYSTEM,
} from "./units";

describe("units utilities", () => {
  describe("isValidUnitSystem", () => {
    it("should return true for 'metric'", () => {
      expect(isValidUnitSystem("metric")).toBe(true);
    });

    it("should return true for 'imperial'", () => {
      expect(isValidUnitSystem("imperial")).toBe(true);
    });

    it("should return false for invalid values", () => {
      expect(isValidUnitSystem("invalid")).toBe(false);
      expect(isValidUnitSystem("")).toBe(false);
      expect(isValidUnitSystem(null)).toBe(false);
      expect(isValidUnitSystem(undefined)).toBe(false);
      expect(isValidUnitSystem(123)).toBe(false);
      expect(isValidUnitSystem({})).toBe(false);
    });
  });

  describe("DEFAULT_UNIT_SYSTEM", () => {
    it("should be 'metric'", () => {
      expect(DEFAULT_UNIT_SYSTEM).toBe("metric");
    });
  });

  describe("getWeightUnit", () => {
    it("should return 'kg' for metric", () => {
      expect(getWeightUnit("metric")).toBe("kg");
    });

    it("should return 'lbs' for imperial", () => {
      expect(getWeightUnit("imperial")).toBe("lbs");
    });
  });

  describe("getHeightUnit", () => {
    it("should return 'cm' for metric", () => {
      expect(getHeightUnit("metric")).toBe("cm");
    });

    it("should return 'in' for imperial", () => {
      expect(getHeightUnit("imperial")).toBe("in");
    });
  });

  describe("getVolumeUnit", () => {
    it("should return 'ml' for metric", () => {
      expect(getVolumeUnit("metric")).toBe("ml");
    });

    it("should return 'oz' for imperial", () => {
      expect(getVolumeUnit("imperial")).toBe("oz");
    });
  });
});
