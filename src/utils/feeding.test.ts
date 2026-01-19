import { describe, it, expect } from "vitest";
import { getLastFeedingType, feedingTypeToTab, formatDualSideDuration } from "./feeding";
import type { FeedingType } from "@/constants/activities";

describe("feeding utils", () => {
  describe("feedingTypeToTab", () => {
    it("should return 'breast' for 'breast' feeding type", () => {
      expect(feedingTypeToTab("breast")).toBe("breast");
    });

    it("should return 'bottle' for 'bottle' feeding type", () => {
      expect(feedingTypeToTab("bottle")).toBe("bottle");
    });

    it("should return 'solids' for 'solid' feeding type", () => {
      expect(feedingTypeToTab("solid")).toBe("solids");
    });
  });

  describe("getLastFeedingType", () => {
    it("should return null for empty array", () => {
      expect(getLastFeedingType([])).toBeNull();
    });

    it("should return the type of the most recent feeding", () => {
      const feedings = [
        { type: "breast" as FeedingType, startedAt: "2024-01-01T10:00:00Z" },
        { type: "bottle" as FeedingType, startedAt: "2024-01-01T12:00:00Z" },
        { type: "solid" as FeedingType, startedAt: "2024-01-01T08:00:00Z" },
      ];
      expect(getLastFeedingType(feedings)).toBe("bottle");
    });

    it("should handle Date objects", () => {
      const feedings = [
        { type: "breast" as FeedingType, startedAt: new Date("2024-01-01T10:00:00Z") },
        { type: "solid" as FeedingType, startedAt: new Date("2024-01-01T14:00:00Z") },
      ];
      expect(getLastFeedingType(feedings)).toBe("solid");
    });

    it("should handle a single feeding", () => {
      const feedings = [
        { type: "breast" as FeedingType, startedAt: "2024-01-01T10:00:00Z" },
      ];
      expect(getLastFeedingType(feedings)).toBe("breast");
    });

    it("should correctly identify the most recent when times are close", () => {
      const feedings = [
        { type: "breast" as FeedingType, startedAt: "2024-01-01T10:00:00Z" },
        { type: "bottle" as FeedingType, startedAt: "2024-01-01T10:00:01Z" },
      ];
      expect(getLastFeedingType(feedings)).toBe("bottle");
    });

    it("should handle mixed string and Date startedAt values", () => {
      const feedings = [
        { type: "breast" as FeedingType, startedAt: "2024-01-01T10:00:00Z" },
        { type: "bottle" as FeedingType, startedAt: new Date("2024-01-01T11:00:00Z") },
      ];
      expect(getLastFeedingType(feedings)).toBe("bottle");
    });
  });

  describe("formatDualSideDuration", () => {
    it("should format both sides when both have duration", () => {
      expect(formatDualSideDuration(480, 720)).toBe("L: 8m, R: 12m");
    });

    it("should format only left side when right is 0", () => {
      expect(formatDualSideDuration(600, 0)).toBe("L: 10m");
    });

    it("should format only left side when right is undefined", () => {
      expect(formatDualSideDuration(600, undefined)).toBe("L: 10m");
    });

    it("should format only right side when left is 0", () => {
      expect(formatDualSideDuration(0, 900)).toBe("R: 15m");
    });

    it("should format only right side when left is undefined", () => {
      expect(formatDualSideDuration(undefined, 900)).toBe("R: 15m");
    });

    it("should return empty string when both are 0", () => {
      expect(formatDualSideDuration(0, 0)).toBe("");
    });

    it("should return empty string when both are undefined", () => {
      expect(formatDualSideDuration(undefined, undefined)).toBe("");
    });

    it("should handle seconds under a minute correctly", () => {
      expect(formatDualSideDuration(45, 30)).toBe("L: 0m, R: 0m");
    });

    it("should handle exactly one minute", () => {
      expect(formatDualSideDuration(60, 60)).toBe("L: 1m, R: 1m");
    });

    it("should handle large durations over an hour", () => {
      expect(formatDualSideDuration(3600, 1800)).toBe("L: 60m, R: 30m");
    });

    it("should round down partial minutes", () => {
      expect(formatDualSideDuration(125, 185)).toBe("L: 2m, R: 3m");
    });
  });
});
