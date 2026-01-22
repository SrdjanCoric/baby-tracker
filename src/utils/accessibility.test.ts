import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatTimerAccessibilityLabel,
  formatDurationForAccessibility,
  formatTimeAgoForAccessibility,
  getActivityAccessibilityLabel,
  combineAccessibilityLabels,
  createTimerAnnouncementMessage,
  createSaveSuccessMessage,
  createErrorMessage,
  shouldAnnounce,
} from "./accessibility";

describe("accessibility utilities", () => {
  describe("formatTimerAccessibilityLabel", () => {
    it("should format label for running timer", () => {
      const label = formatTimerAccessibilityLabel({
        activityType: "breastfeeding",
        isRunning: true,
        duration: 600,
        formattedDuration: "10:00",
      });
      expect(label).toContain("Breastfeeding");
      expect(label).toContain("running");
      expect(label).toContain("10 minutes");
    });

    it("should format label for stopped timer", () => {
      const label = formatTimerAccessibilityLabel({
        activityType: "pumping",
        isRunning: false,
        duration: 0,
        formattedDuration: "00:00",
      });
      expect(label).toContain("Pumping");
      expect(label).toContain("stopped");
    });

    it("should include duration for timer with time", () => {
      const label = formatTimerAccessibilityLabel({
        activityType: "tummyTime",
        isRunning: true,
        duration: 3600,
        formattedDuration: "1:00:00",
      });
      expect(label).toContain("1 hour");
    });

    it("should handle zero duration", () => {
      const label = formatTimerAccessibilityLabel({
        activityType: "sleep",
        isRunning: true,
        duration: 0,
        formattedDuration: "00:00",
      });
      expect(label).toContain("Sleep");
      expect(label).toContain("0 seconds");
    });
  });

  describe("formatDurationForAccessibility", () => {
    it("should format seconds only", () => {
      expect(formatDurationForAccessibility(30)).toBe("30 seconds");
    });

    it("should format 1 second singular", () => {
      expect(formatDurationForAccessibility(1)).toBe("1 second");
    });

    it("should format minutes and seconds", () => {
      expect(formatDurationForAccessibility(90)).toBe("1 minute 30 seconds");
    });

    it("should format minutes only when exact", () => {
      expect(formatDurationForAccessibility(120)).toBe("2 minutes");
    });

    it("should format hours and minutes (omitting seconds for brevity)", () => {
      expect(formatDurationForAccessibility(3661)).toBe("1 hour 1 minute");
    });

    it("should format hours only", () => {
      expect(formatDurationForAccessibility(7200)).toBe("2 hours");
    });

    it("should handle zero duration", () => {
      expect(formatDurationForAccessibility(0)).toBe("0 seconds");
    });

    it("should handle 1 minute singular", () => {
      expect(formatDurationForAccessibility(60)).toBe("1 minute");
    });

    it("should handle 1 hour singular", () => {
      expect(formatDurationForAccessibility(3600)).toBe("1 hour");
    });
  });

  describe("formatTimeAgoForAccessibility", () => {
    it("should format just now for recent time", () => {
      const now = new Date();
      expect(formatTimeAgoForAccessibility(now)).toBe("just now");
    });

    it("should format minutes ago", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatTimeAgoForAccessibility(fiveMinutesAgo)).toBe(
        "5 minutes ago"
      );
    });

    it("should format 1 minute ago singular", () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      expect(formatTimeAgoForAccessibility(oneMinuteAgo)).toBe("1 minute ago");
    });

    it("should format hours ago", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatTimeAgoForAccessibility(twoHoursAgo)).toBe("2 hours ago");
    });

    it("should format 1 hour ago singular", () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      expect(formatTimeAgoForAccessibility(oneHourAgo)).toBe("1 hour ago");
    });

    it("should handle null date", () => {
      expect(formatTimeAgoForAccessibility(null)).toBe("unknown time");
    });

    it("should handle undefined date", () => {
      expect(formatTimeAgoForAccessibility(undefined)).toBe("unknown time");
    });

    it("should handle invalid date", () => {
      expect(formatTimeAgoForAccessibility(new Date("invalid"))).toBe(
        "unknown time"
      );
    });
  });

  describe("getActivityAccessibilityLabel", () => {
    it("should return label for breastfeeding", () => {
      expect(getActivityAccessibilityLabel("breastfeeding")).toBe(
        "Breastfeeding"
      );
    });

    it("should return label for bottle", () => {
      expect(getActivityAccessibilityLabel("bottle")).toBe("Bottle feeding");
    });

    it("should return label for solids", () => {
      expect(getActivityAccessibilityLabel("solids")).toBe("Solid food");
    });

    it("should return label for sleep", () => {
      expect(getActivityAccessibilityLabel("sleep")).toBe("Sleep");
    });

    it("should return label for nap", () => {
      expect(getActivityAccessibilityLabel("nap")).toBe("Nap");
    });

    it("should return label for nightSleep", () => {
      expect(getActivityAccessibilityLabel("nightSleep")).toBe("Night sleep");
    });

    it("should return label for diaper", () => {
      expect(getActivityAccessibilityLabel("diaper")).toBe("Diaper change");
    });

    it("should return label for pumping", () => {
      expect(getActivityAccessibilityLabel("pumping")).toBe("Pumping");
    });

    it("should return label for tummyTime", () => {
      expect(getActivityAccessibilityLabel("tummyTime")).toBe("Tummy time");
    });

    it("should return label for growth", () => {
      expect(getActivityAccessibilityLabel("growth")).toBe("Growth measurement");
    });

    it("should capitalize unknown activity types", () => {
      expect(getActivityAccessibilityLabel("unknown")).toBe("Unknown");
    });
  });

  describe("combineAccessibilityLabels", () => {
    it("should combine multiple labels with comma", () => {
      expect(combineAccessibilityLabels("Label 1", "Label 2")).toBe(
        "Label 1, Label 2"
      );
    });

    it("should filter out empty strings", () => {
      expect(combineAccessibilityLabels("Label 1", "", "Label 2")).toBe(
        "Label 1, Label 2"
      );
    });

    it("should filter out null/undefined", () => {
      expect(
        combineAccessibilityLabels(
          "Label 1",
          null as unknown as string,
          undefined as unknown as string,
          "Label 2"
        )
      ).toBe("Label 1, Label 2");
    });

    it("should return empty string for no labels", () => {
      expect(combineAccessibilityLabels()).toBe("");
    });

    it("should return single label without comma", () => {
      expect(combineAccessibilityLabels("Single")).toBe("Single");
    });

    it("should trim whitespace from labels", () => {
      expect(combineAccessibilityLabels("  Label 1  ", "  Label 2  ")).toBe(
        "Label 1, Label 2"
      );
    });
  });

  describe("createTimerAnnouncementMessage", () => {
    it("should create start message", () => {
      const message = createTimerAnnouncementMessage("breastfeeding", "start");
      expect(message).toBe("Breastfeeding timer started");
    });

    it("should create stop message with duration", () => {
      const message = createTimerAnnouncementMessage("pumping", "stop", 600);
      expect(message).toBe("Pumping timer stopped. Duration: 10 minutes");
    });

    it("should create stop message without duration", () => {
      const message = createTimerAnnouncementMessage("sleep", "stop");
      expect(message).toBe("Sleep timer stopped");
    });

    it("should handle tummy time activity", () => {
      const message = createTimerAnnouncementMessage("tummyTime", "start");
      expect(message).toBe("Tummy time timer started");
    });
  });

  describe("createSaveSuccessMessage", () => {
    it("should create save message for feeding", () => {
      expect(createSaveSuccessMessage("breastfeeding")).toBe(
        "Breastfeeding saved successfully"
      );
    });

    it("should create save message for sleep", () => {
      expect(createSaveSuccessMessage("sleep")).toBe(
        "Sleep saved successfully"
      );
    });

    it("should create save message for diaper", () => {
      expect(createSaveSuccessMessage("diaper")).toBe(
        "Diaper change saved successfully"
      );
    });
  });

  describe("createErrorMessage", () => {
    it("should create generic error message", () => {
      expect(createErrorMessage()).toBe(
        "An error occurred. Please try again."
      );
    });

    it("should create error message with context", () => {
      expect(createErrorMessage("saving")).toBe(
        "Error saving. Please try again."
      );
    });

    it("should create error message with custom action", () => {
      expect(createErrorMessage("loading data")).toBe(
        "Error loading data. Please try again."
      );
    });
  });

  describe("shouldAnnounce", () => {
    it("should return true for important changes", () => {
      expect(shouldAnnounce("timer_start")).toBe(true);
      expect(shouldAnnounce("timer_stop")).toBe(true);
      expect(shouldAnnounce("save_success")).toBe(true);
      expect(shouldAnnounce("error")).toBe(true);
    });

    it("should return false for minor updates", () => {
      expect(shouldAnnounce("timer_tick")).toBe(false);
      expect(shouldAnnounce("scroll")).toBe(false);
    });

    it("should return true for unknown event types by default", () => {
      expect(shouldAnnounce("unknown_event")).toBe(true);
    });
  });
});
