import { describe, it, expect } from "vitest";
import {
  calculateZScore,
  calculatePercentile,
  calculatePercentileFromMeasurement,
  getPercentileValue,
  getLMSForAge,
  interpolateLMS,
} from "./percentile-calculator";

describe("PercentileCalculator", () => {
  describe("calculateZScore", () => {
    it("should calculate Z-score using LMS method when L is not 0", () => {
      // For weight, L is typically non-zero
      // Using known WHO values for 3-month-old boy: L=0.1738, M=6.3762, S=0.11727
      // For a measurement of 6.3762 kg (exactly at median), Z should be 0
      const zScore = calculateZScore(6.3762, 0.1738, 6.3762, 0.11727);
      expect(zScore).toBeCloseTo(0, 2);
    });

    it("should calculate Z-score when L is 0 (using log formula)", () => {
      // When L = 0, formula is Z = ln(X/M) / S
      // For a measurement equal to median, Z should be 0
      const zScore = calculateZScore(70, 0, 70, 0.03);
      expect(zScore).toBeCloseTo(0, 2);
    });

    it("should return positive Z-score for measurement above median", () => {
      // 3-month-old boy with weight above median
      const zScore = calculateZScore(7.5, 0.1738, 6.3762, 0.11727);
      expect(zScore).toBeGreaterThan(0);
    });

    it("should return negative Z-score for measurement below median", () => {
      // 3-month-old boy with weight below median
      const zScore = calculateZScore(5.5, 0.1738, 6.3762, 0.11727);
      expect(zScore).toBeLessThan(0);
    });

    it("should calculate Z-score correctly for height (L=1)", () => {
      // For height, L is typically 1
      // 6-month-old boy median height: 67.6236 cm
      const zScore = calculateZScore(67.6236, 1, 67.6236, 0.03165);
      expect(zScore).toBeCloseTo(0, 2);
    });

    it("should return null for zero or negative measurement", () => {
      expect(calculateZScore(0, 0.1738, 6.3762, 0.11727)).toBeNull();
      expect(calculateZScore(-1, 0.1738, 6.3762, 0.11727)).toBeNull();
    });

    it("should return null for zero or negative M or S", () => {
      expect(calculateZScore(6.0, 0.1738, 0, 0.11727)).toBeNull();
      expect(calculateZScore(6.0, 0.1738, 6.3762, 0)).toBeNull();
    });
  });

  describe("calculatePercentile", () => {
    it("should return 50 for Z-score of 0", () => {
      const percentile = calculatePercentile(0);
      expect(percentile).toBeCloseTo(50, 0);
    });

    it("should return approximately 84.1 for Z-score of 1", () => {
      const percentile = calculatePercentile(1);
      expect(percentile).toBeCloseTo(84.1, 0);
    });

    it("should return approximately 15.9 for Z-score of -1", () => {
      const percentile = calculatePercentile(-1);
      expect(percentile).toBeCloseTo(15.9, 0);
    });

    it("should return approximately 97.7 for Z-score of 2", () => {
      const percentile = calculatePercentile(2);
      expect(percentile).toBeCloseTo(97.7, 0);
    });

    it("should return approximately 2.3 for Z-score of -2", () => {
      const percentile = calculatePercentile(-2);
      expect(percentile).toBeCloseTo(2.3, 0);
    });

    it("should handle extreme Z-scores (> 3)", () => {
      const percentile = calculatePercentile(3);
      expect(percentile).toBeGreaterThan(99);
      expect(percentile).toBeLessThan(100);
    });

    it("should handle extreme Z-scores (< -3)", () => {
      const percentile = calculatePercentile(-3);
      expect(percentile).toBeLessThan(1);
      expect(percentile).toBeGreaterThan(0);
    });
  });

  describe("calculatePercentileFromMeasurement", () => {
    it("should calculate weight percentile for boy at 50th percentile", () => {
      // 3-month-old boy, median weight is 6.3762 kg
      const result = calculatePercentileFromMeasurement(
        "male",
        3,
        6.3762,
        "weight"
      );
      expect(result!.percentile).toBeCloseTo(50, 0);
    });

    it("should calculate weight percentile for girl at 50th percentile", () => {
      // 3-month-old girl, median weight is 5.8458 kg
      const result = calculatePercentileFromMeasurement(
        "female",
        3,
        5.8458,
        "weight"
      );
      expect(result!.percentile).toBeCloseTo(50, 0);
    });

    it("should calculate height percentile correctly", () => {
      // 6-month-old boy, median height is 67.6236 cm
      const result = calculatePercentileFromMeasurement(
        "male",
        6,
        67.6236,
        "height"
      );
      expect(result!.percentile).toBeCloseTo(50, 0);
    });

    it("should calculate head circumference percentile correctly", () => {
      // 6-month-old girl, median head circumference is 42.1995 cm
      const result = calculatePercentileFromMeasurement(
        "female",
        6,
        42.1995,
        "head"
      );
      expect(result!.percentile).toBeCloseTo(50, 0);
    });

    it("should handle measurement at low percentile (around 3rd)", () => {
      // A significantly lower weight should give low percentile
      const result = calculatePercentileFromMeasurement(
        "male",
        3,
        5.0,
        "weight"
      );
      expect(result!.percentile).toBeLessThan(10);
    });

    it("should handle measurement at high percentile (around 97th)", () => {
      // A significantly higher weight should give high percentile
      const result = calculatePercentileFromMeasurement(
        "male",
        3,
        8.0,
        "weight"
      );
      expect(result!.percentile).toBeGreaterThan(90);
    });

    it("should return Z-score along with percentile", () => {
      const result = calculatePercentileFromMeasurement(
        "male",
        3,
        6.3762,
        "weight"
      );
      expect(result!.zScore).toBeCloseTo(0, 1);
    });

    it("should interpolate between age data points", () => {
      // 3.5 months - should interpolate between 3 and 4 months
      const result = calculatePercentileFromMeasurement(
        "male",
        3.5,
        6.7,
        "weight"
      );
      expect(result!.percentile).toBeDefined();
      expect(result!.percentile).toBeGreaterThan(0);
      expect(result!.percentile).toBeLessThan(100);
    });

    it("should handle decimal ages correctly", () => {
      // 2.5 months
      const result = calculatePercentileFromMeasurement(
        "female",
        2.5,
        5.5,
        "weight"
      );
      expect(result!.percentile).toBeDefined();
      expect(result!.ageMonths).toBe(2.5);
    });

    it("should handle age 0 (newborn)", () => {
      // Newborn boy, median weight is 3.3464 kg
      const result = calculatePercentileFromMeasurement(
        "male",
        0,
        3.3464,
        "weight"
      );
      expect(result!.percentile).toBeCloseTo(50, 0);
    });

    it("should handle age 24 months", () => {
      // 24-month-old girl, median weight is 11.4775 kg
      const result = calculatePercentileFromMeasurement(
        "female",
        24,
        11.4775,
        "weight"
      );
      expect(result!.percentile).toBeCloseTo(50, 0);
    });

    it("should return null for age below 0", () => {
      const result = calculatePercentileFromMeasurement(
        "male",
        -1,
        3.3,
        "weight"
      );
      expect(result).toBeNull();
    });

    it("should return null for age above 24", () => {
      const result = calculatePercentileFromMeasurement(
        "male",
        30,
        12.0,
        "weight"
      );
      expect(result).toBeNull();
    });
  });

  describe("getPercentileValue", () => {
    it("should return median value for 50th percentile", () => {
      // 3-month-old boy, 50th percentile weight should be ~6.38 kg
      const value = getPercentileValue("male", 3, 50, "weight");
      expect(value).toBeCloseTo(6.38, 1);
    });

    it("should return lower value for 3rd percentile", () => {
      const value3rd = getPercentileValue("male", 3, 3, "weight");
      const value50th = getPercentileValue("male", 3, 50, "weight");
      expect(value3rd).toBeLessThan(value50th!);
    });

    it("should return higher value for 97th percentile", () => {
      const value97th = getPercentileValue("male", 3, 97, "weight");
      const value50th = getPercentileValue("male", 3, 50, "weight");
      expect(value97th).toBeGreaterThan(value50th!);
    });

    it("should return correct values for standard percentiles", () => {
      // Test all standard percentile lines at 6 months for boy weight
      const p3 = getPercentileValue("male", 6, 3, "weight");
      const p15 = getPercentileValue("male", 6, 15, "weight");
      const p50 = getPercentileValue("male", 6, 50, "weight");
      const p85 = getPercentileValue("male", 6, 85, "weight");
      const p97 = getPercentileValue("male", 6, 97, "weight");

      expect(p3).toBeLessThan(p15!);
      expect(p15).toBeLessThan(p50!);
      expect(p50).toBeLessThan(p85!);
      expect(p85).toBeLessThan(p97!);
    });

    it("should work for height measurements", () => {
      // 12-month-old girl, 50th percentile height should be ~74 cm
      const value = getPercentileValue("female", 12, 50, "height");
      expect(value).toBeCloseTo(74, 0);
    });

    it("should work for head circumference measurements", () => {
      // 6-month-old boy, 50th percentile head should be ~43.3 cm
      const value = getPercentileValue("male", 6, 50, "head");
      expect(value).toBeCloseTo(43.3, 1);
    });

    it("should handle interpolation between ages", () => {
      const value = getPercentileValue("male", 3.5, 50, "weight");
      const value3 = getPercentileValue("male", 3, 50, "weight");
      const value4 = getPercentileValue("male", 4, 50, "weight");

      expect(value).toBeGreaterThan(value3!);
      expect(value).toBeLessThan(value4!);
    });
  });

  describe("getLMSForAge", () => {
    it("should return exact LMS values for whole month ages", () => {
      const lms = getLMSForAge("male", 3, "weight");
      expect(lms).not.toBeNull();
      expect(lms!.L).toBeCloseTo(0.1738, 4);
      expect(lms!.M).toBeCloseTo(6.3762, 4);
      expect(lms!.S).toBeCloseTo(0.11727, 5);
    });

    it("should return LMS values for girls", () => {
      const lms = getLMSForAge("female", 6, "height");
      expect(lms).not.toBeNull();
      expect(lms!.M).toBeCloseTo(65.7311, 4);
    });

    it("should interpolate LMS for decimal ages", () => {
      const lms3 = getLMSForAge("male", 3, "weight");
      const lms4 = getLMSForAge("male", 4, "weight");
      const lms3_5 = getLMSForAge("male", 3.5, "weight");

      expect(lms3_5!.M).toBeGreaterThan(lms3!.M);
      expect(lms3_5!.M).toBeLessThan(lms4!.M);
    });

    it("should return null for age below 0", () => {
      expect(getLMSForAge("male", -1, "weight")).toBeNull();
    });

    it("should return null for age above 24", () => {
      expect(getLMSForAge("male", 25, "weight")).toBeNull();
    });
  });

  describe("interpolateLMS", () => {
    it("should return first point when ratio is 0", () => {
      const result = interpolateLMS(
        { L: 0.2, M: 5.0, S: 0.12 },
        { L: 0.1, M: 6.0, S: 0.11 },
        0
      );
      expect(result.L).toBe(0.2);
      expect(result.M).toBe(5.0);
      expect(result.S).toBe(0.12);
    });

    it("should return second point when ratio is 1", () => {
      const result = interpolateLMS(
        { L: 0.2, M: 5.0, S: 0.12 },
        { L: 0.1, M: 6.0, S: 0.11 },
        1
      );
      expect(result.L).toBe(0.1);
      expect(result.M).toBe(6.0);
      expect(result.S).toBe(0.11);
    });

    it("should linearly interpolate when ratio is 0.5", () => {
      const result = interpolateLMS(
        { L: 0.2, M: 5.0, S: 0.12 },
        { L: 0.1, M: 6.0, S: 0.10 },
        0.5
      );
      expect(result.L).toBeCloseTo(0.15, 5);
      expect(result.M).toBeCloseTo(5.5, 5);
      expect(result.S).toBeCloseTo(0.11, 5);
    });
  });

  describe("edge cases", () => {
    it("should handle very small measurements", () => {
      const result = calculatePercentileFromMeasurement(
        "male",
        0,
        2.0,
        "weight"
      );
      expect(result!.percentile).toBeLessThan(1);
      expect(result!.percentile).toBeGreaterThan(0);
    });

    it("should handle very large measurements", () => {
      const result = calculatePercentileFromMeasurement(
        "male",
        12,
        15.0,
        "weight"
      );
      expect(result!.percentile).toBeGreaterThan(99);
      expect(result!.percentile).toBeLessThan(100);
    });

    it("should be consistent - round trip from measurement to percentile and back", () => {
      const originalMeasurement = 7.0;
      const result = calculatePercentileFromMeasurement(
        "male",
        6,
        originalMeasurement,
        "weight"
      );
      const reconstructed = getPercentileValue(
        "male",
        6,
        result!.percentile,
        "weight"
      );
      expect(reconstructed).toBeCloseTo(originalMeasurement, 1);
    });
  });
});
