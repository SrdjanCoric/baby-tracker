import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isUnderTwoYears,
  getGrowthTrendArrow,
  formatWeightChange,
  formatPercentile,
} from "./growth-helpers";

describe("growth-helpers", () => {
  describe("isUnderTwoYears", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return true when birthDate is undefined", () => {
      expect(isUnderTwoYears(undefined)).toBe(true);
    });

    it("should return true for baby born 6 months ago", () => {
      vi.setSystemTime(new Date("2024-06-15"));
      expect(isUnderTwoYears("2024-01-01")).toBe(true);
    });

    it("should return true for baby born 23 months ago", () => {
      vi.setSystemTime(new Date("2024-12-15"));
      expect(isUnderTwoYears("2023-01-15")).toBe(true);
    });

    it("should return false for baby born exactly 24 months ago", () => {
      vi.setSystemTime(new Date("2024-06-01"));
      expect(isUnderTwoYears("2022-06-01")).toBe(false);
    });

    it("should return false for baby born more than 24 months ago", () => {
      vi.setSystemTime(new Date("2024-06-01"));
      expect(isUnderTwoYears("2021-01-01")).toBe(false);
    });
  });

  describe("getGrowthTrendArrow", () => {
    it("should return right arrow for undefined change", () => {
      expect(getGrowthTrendArrow(undefined)).toBe("→");
    });

    it("should return right arrow for zero change", () => {
      expect(getGrowthTrendArrow(0)).toBe("→");
    });

    it("should return up-right arrow for positive change", () => {
      expect(getGrowthTrendArrow(100)).toBe("↗");
    });

    it("should return down-right arrow for negative change", () => {
      expect(getGrowthTrendArrow(-50)).toBe("↘");
    });
  });

  describe("formatWeightChange", () => {
    it("should return 'stable' for zero change", () => {
      expect(formatWeightChange(0)).toBe("stable");
    });

    it("should return positive value with plus sign", () => {
      expect(formatWeightChange(125)).toBe("+125g");
    });

    it("should return negative value with minus sign", () => {
      expect(formatWeightChange(-50)).toBe("-50g");
    });
  });

  describe("formatPercentile", () => {
    it.each([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 50, 97])(
      "uses language-neutral P notation for percentile %i",
      (percentile) => {
        expect(formatPercentile(percentile)).toBe(`P${percentile}`);
      }
    );
  });
});
