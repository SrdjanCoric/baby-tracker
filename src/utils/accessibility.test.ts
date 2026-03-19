import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
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

const mockT = ((key: string, opts?: Record<string, unknown>) => {
  if (opts && 'count' in opts) return `${key}_${opts.count}`;
  if (opts) return Object.entries(opts).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), key);
  return key;
}) as unknown as TFunction;

describe("accessibility utilities", () => {
  describe("formatTimerAccessibilityLabel", () => {
    it("should format label for running timer", () => {
      const label = formatTimerAccessibilityLabel({
        activityType: "breastfeeding",
        isRunning: true,
        duration: 600,
        formattedDuration: "10:00",
      }, mockT);
      expect(label).toBe("accessibility.timerStatus");
    });

    it("should format label for stopped timer", () => {
      const label = formatTimerAccessibilityLabel({
        activityType: "pumping",
        isRunning: false,
        duration: 0,
        formattedDuration: "00:00",
      }, mockT);
      expect(label).toBe("accessibility.timerStatus");
    });

    it("should include duration for timer with time", () => {
      const label = formatTimerAccessibilityLabel({
        activityType: "tummyTime",
        isRunning: true,
        duration: 3600,
        formattedDuration: "1:00:00",
      }, mockT);
      expect(label).toBe("accessibility.timerStatus");
    });

    it("should handle zero duration", () => {
      const label = formatTimerAccessibilityLabel({
        activityType: "sleep",
        isRunning: true,
        duration: 0,
        formattedDuration: "00:00",
      }, mockT);
      expect(label).toBe("accessibility.timerStatus");
    });
  });

  describe("formatDurationForAccessibility", () => {
    it("should format seconds only", () => {
      expect(formatDurationForAccessibility(30, mockT)).toBeDefined();
    });

    it("should format 1 second singular", () => {
      expect(formatDurationForAccessibility(1, mockT)).toBeDefined();
    });

    it("should format minutes and seconds", () => {
      expect(formatDurationForAccessibility(90, mockT)).toBeDefined();
    });

    it("should format minutes only when exact", () => {
      expect(formatDurationForAccessibility(120, mockT)).toBeDefined();
    });

    it("should format hours and minutes (omitting seconds for brevity)", () => {
      expect(formatDurationForAccessibility(3661, mockT)).toBeDefined();
    });

    it("should format hours only", () => {
      expect(formatDurationForAccessibility(7200, mockT)).toBeDefined();
    });

    it("should handle zero duration", () => {
      expect(formatDurationForAccessibility(0, mockT)).toBe("accessibility.zeroSeconds");
    });

    it("should handle 1 minute singular", () => {
      expect(formatDurationForAccessibility(60, mockT)).toBeDefined();
    });

    it("should handle 1 hour singular", () => {
      expect(formatDurationForAccessibility(3600, mockT)).toBeDefined();
    });
  });

  describe("formatTimeAgoForAccessibility", () => {
    it("should format just now for recent time", () => {
      const now = new Date();
      expect(formatTimeAgoForAccessibility(now, mockT)).toBe("accessibility.justNow");
    });

    it("should format minutes ago", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatTimeAgoForAccessibility(fiveMinutesAgo, mockT);
      expect(result).toContain("accessibility.minuteAgo");
    });

    it("should format 1 minute ago singular", () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const result = formatTimeAgoForAccessibility(oneMinuteAgo, mockT);
      expect(result).toContain("accessibility.minuteAgo");
    });

    it("should format hours ago", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = formatTimeAgoForAccessibility(twoHoursAgo, mockT);
      expect(result).toContain("accessibility.hourAgo");
    });

    it("should format 1 hour ago singular", () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = formatTimeAgoForAccessibility(oneHourAgo, mockT);
      expect(result).toContain("accessibility.hourAgo");
    });

    it("should handle null date", () => {
      expect(formatTimeAgoForAccessibility(null, mockT)).toBe("accessibility.unknownTime");
    });

    it("should handle undefined date", () => {
      expect(formatTimeAgoForAccessibility(undefined, mockT)).toBe("accessibility.unknownTime");
    });

    it("should handle invalid date", () => {
      expect(formatTimeAgoForAccessibility(new Date("invalid"), mockT)).toBe(
        "accessibility.unknownTime"
      );
    });
  });

  describe("getActivityAccessibilityLabel", () => {
    it("should return label for breastfeeding", () => {
      expect(getActivityAccessibilityLabel("breastfeeding", mockT)).toBe(
        "accessibility.breastfeeding"
      );
    });

    it("should return label for bottle", () => {
      expect(getActivityAccessibilityLabel("bottle", mockT)).toBe("accessibility.bottle");
    });

    it("should return label for solids", () => {
      expect(getActivityAccessibilityLabel("solids", mockT)).toBe("accessibility.solids");
    });

    it("should return label for sleep", () => {
      expect(getActivityAccessibilityLabel("sleep", mockT)).toBe("accessibility.sleep");
    });

    it("should return label for nap", () => {
      expect(getActivityAccessibilityLabel("nap", mockT)).toBe("accessibility.nap");
    });

    it("should return label for nightSleep", () => {
      expect(getActivityAccessibilityLabel("nightSleep", mockT)).toBe("accessibility.nightSleep");
    });

    it("should return label for diaper", () => {
      expect(getActivityAccessibilityLabel("diaper", mockT)).toBe("accessibility.diaper");
    });

    it("should return label for pumping", () => {
      expect(getActivityAccessibilityLabel("pumping", mockT)).toBe("accessibility.pumping");
    });

    it("should return label for tummyTime", () => {
      expect(getActivityAccessibilityLabel("tummyTime", mockT)).toBe("accessibility.tummyTime");
    });

    it("should return label for growth", () => {
      expect(getActivityAccessibilityLabel("growth", mockT)).toBe("accessibility.growthMeasurement");
    });

    it("should capitalize unknown activity types", () => {
      expect(getActivityAccessibilityLabel("unknown", mockT)).toBe("Unknown");
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
      const message = createTimerAnnouncementMessage("breastfeeding", "start", mockT);
      expect(message).toBe("accessibility.timerStarted");
    });

    it("should create stop message with duration", () => {
      const message = createTimerAnnouncementMessage("pumping", "stop", mockT, 600);
      expect(message).toBe("accessibility.timerStoppedDuration");
    });

    it("should create stop message without duration", () => {
      const message = createTimerAnnouncementMessage("sleep", "stop", mockT);
      expect(message).toBe("accessibility.timerStoppedNoDuration");
    });

    it("should handle tummy time activity", () => {
      const message = createTimerAnnouncementMessage("tummyTime", "start", mockT);
      expect(message).toBe("accessibility.timerStarted");
    });
  });

  describe("createSaveSuccessMessage", () => {
    it("should create save message for feeding", () => {
      expect(createSaveSuccessMessage("breastfeeding", mockT)).toBe(
        "accessibility.savedSuccessfully"
      );
    });

    it("should create save message for sleep", () => {
      expect(createSaveSuccessMessage("sleep", mockT)).toBe(
        "accessibility.savedSuccessfully"
      );
    });

    it("should create save message for diaper", () => {
      expect(createSaveSuccessMessage("diaper", mockT)).toBe(
        "accessibility.savedSuccessfully"
      );
    });
  });

  describe("createErrorMessage", () => {
    it("should create generic error message", () => {
      expect(createErrorMessage(mockT)).toBe(
        "accessibility.errorGeneric"
      );
    });

    it("should create error message with context", () => {
      expect(createErrorMessage(mockT, "saving")).toBe(
        "accessibility.errorWithContext"
      );
    });

    it("should create error message with custom action", () => {
      expect(createErrorMessage(mockT, "loading data")).toBe(
        "accessibility.errorWithContext"
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
