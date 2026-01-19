import { describe, it, expect } from "vitest";
import { getLastFeedingType, feedingTypeToTab } from "./feeding";
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
});
