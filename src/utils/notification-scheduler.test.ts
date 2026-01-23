import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  calculateNextFeedingReminder,
  shouldSendTimerAlert,
  isInQuietHours,
  getDelayedNotificationTime,
  getTimerAlertThreshold,
  parseTimeString,
  formatTimeString,
} from "./notification-scheduler";
import type { NotificationSettings } from "@/types/notifications";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/constants/notifications";

describe("NotificationScheduler", () => {
  const mockSettings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    feedingReminders: {
      enabled: true,
      intervalHours: 3,
    },
    timerAlerts: {
      enabled: true,
      thresholds: {
        breastfeeding: 60,
        pumping: 45,
        tummyTime: 30,
        nap: 180,
        nightSleep: 720,
      },
    },
    quietHours: {
      enabled: true,
      startTime: "22:00",
      endTime: "07:00",
    },
  };

  describe("calculateNextFeedingReminder", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should calculate reminder based on last feeding time and interval", () => {
      const now = new Date("2024-01-15T10:00:00");
      vi.setSystemTime(now);

      const lastFeedingTime = new Date("2024-01-15T09:00:00");
      const intervalHours = 3;
      const settings = { ...mockSettings, quietHours: { ...mockSettings.quietHours, enabled: false } };

      const result = calculateNextFeedingReminder(lastFeedingTime, intervalHours, settings);

      expect(result).not.toBeNull();
      expect(result?.getTime()).toBe(new Date("2024-01-15T12:00:00").getTime());
    });

    it("should return null if no previous feeding exists", () => {
      const result = calculateNextFeedingReminder(null, 3, mockSettings);

      expect(result).toBeNull();
    });

    it("should not schedule if next reminder is in the past", () => {
      const now = new Date("2024-01-15T15:00:00");
      vi.setSystemTime(now);

      const lastFeedingTime = new Date("2024-01-15T09:00:00");
      const intervalHours = 3;
      const settings = { ...mockSettings, quietHours: { ...mockSettings.quietHours, enabled: false } };

      const result = calculateNextFeedingReminder(lastFeedingTime, intervalHours, settings);

      // Reminder would be at 12:00, but it's now 15:00
      expect(result).toBeNull();
    });

    it("should respect quiet hours - delay to after quiet hours end", () => {
      const now = new Date("2024-01-15T20:00:00");
      vi.setSystemTime(now);

      const lastFeedingTime = new Date("2024-01-15T20:00:00");
      const intervalHours = 3;

      // Reminder would be at 23:00, but quiet hours start at 22:00
      const result = calculateNextFeedingReminder(lastFeedingTime, intervalHours, mockSettings);

      // Should be delayed to 07:00 next day
      expect(result).not.toBeNull();
      expect(result?.getHours()).toBe(7);
      expect(result?.getMinutes()).toBe(0);
    });

    it("should handle timezone changes correctly", () => {
      const now = new Date("2024-01-15T10:00:00Z");
      vi.setSystemTime(now);

      const lastFeedingTime = new Date("2024-01-15T09:00:00Z");
      const intervalHours = 3;
      const settings = { ...mockSettings, quietHours: { ...mockSettings.quietHours, enabled: false } };

      const result = calculateNextFeedingReminder(lastFeedingTime, intervalHours, settings);

      expect(result).not.toBeNull();
      // 3 hours after 09:00 is 12:00
      const expectedTime = new Date("2024-01-15T12:00:00Z");
      expect(result?.getTime()).toBe(expectedTime.getTime());
    });

    it("should handle different intervals correctly", () => {
      const now = new Date("2024-01-15T10:00:00");
      vi.setSystemTime(now);

      const lastFeedingTime = new Date("2024-01-15T09:00:00");
      const settings = { ...mockSettings, quietHours: { ...mockSettings.quietHours, enabled: false } };

      // Test 2 hour interval
      const result2h = calculateNextFeedingReminder(lastFeedingTime, 2, settings);
      expect(result2h?.getTime()).toBe(new Date("2024-01-15T11:00:00").getTime());

      // Test 2.5 hour interval
      const result2_5h = calculateNextFeedingReminder(lastFeedingTime, 2.5, settings);
      expect(result2_5h?.getTime()).toBe(new Date("2024-01-15T11:30:00").getTime());
    });
  });

  describe("shouldSendTimerAlert", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Set time outside quiet hours (10am) to ensure tests aren't affected by quiet hours
      vi.setSystemTime(new Date("2024-01-15T10:00:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return true when timer exceeds threshold", () => {
      const result = shouldSendTimerAlert("breastfeeding", 61, mockSettings);

      expect(result).toBe(true);
    });

    it("should return false when timer is under threshold", () => {
      const result = shouldSendTimerAlert("breastfeeding", 59, mockSettings);

      expect(result).toBe(false);
    });

    it("should return false when timer equals threshold exactly", () => {
      const result = shouldSendTimerAlert("breastfeeding", 60, mockSettings);

      expect(result).toBe(false);
    });

    it("should use activity-specific thresholds", () => {
      // Breastfeeding threshold is 60
      expect(shouldSendTimerAlert("breastfeeding", 61, mockSettings)).toBe(true);
      expect(shouldSendTimerAlert("breastfeeding", 45, mockSettings)).toBe(false);

      // Pumping threshold is 45
      expect(shouldSendTimerAlert("pumping", 46, mockSettings)).toBe(true);
      expect(shouldSendTimerAlert("pumping", 44, mockSettings)).toBe(false);

      // Tummy time threshold is 30
      expect(shouldSendTimerAlert("tummyTime", 31, mockSettings)).toBe(true);
      expect(shouldSendTimerAlert("tummyTime", 29, mockSettings)).toBe(false);

      // Nap threshold is 180 (3 hours)
      expect(shouldSendTimerAlert("nap", 181, mockSettings)).toBe(true);
      expect(shouldSendTimerAlert("nap", 179, mockSettings)).toBe(false);

      // Night sleep threshold is 720 (12 hours)
      expect(shouldSendTimerAlert("nightSleep", 721, mockSettings)).toBe(true);
      expect(shouldSendTimerAlert("nightSleep", 719, mockSettings)).toBe(false);
    });

    it("should respect user-customized thresholds", () => {
      const customSettings: NotificationSettings = {
        ...mockSettings,
        timerAlerts: {
          enabled: true,
          thresholds: {
            breastfeeding: 30, // Custom: 30 minutes instead of 60
            pumping: 45,
            tummyTime: 30,
            nap: 180,
            nightSleep: 720,
          },
        },
      };

      expect(shouldSendTimerAlert("breastfeeding", 31, customSettings)).toBe(true);
      expect(shouldSendTimerAlert("breastfeeding", 29, customSettings)).toBe(false);
    });

    it("should not alert when timer alerts are disabled", () => {
      const disabledSettings: NotificationSettings = {
        ...mockSettings,
        timerAlerts: {
          ...mockSettings.timerAlerts,
          enabled: false,
        },
      };

      expect(shouldSendTimerAlert("breastfeeding", 120, disabledSettings)).toBe(false);
    });

    it("should not alert during quiet hours", () => {
      vi.setSystemTime(new Date("2024-01-15T23:00:00")); // During quiet hours

      const result = shouldSendTimerAlert("breastfeeding", 120, mockSettings);

      expect(result).toBe(false);
    });
  });

  describe("isInQuietHours", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return true during quiet hours", () => {
      vi.setSystemTime(new Date("2024-01-15T23:00:00")); // 11 PM

      const result = isInQuietHours(new Date(), mockSettings.quietHours);

      expect(result).toBe(true);
    });

    it("should return false outside quiet hours", () => {
      vi.setSystemTime(new Date("2024-01-15T10:00:00")); // 10 AM

      const result = isInQuietHours(new Date(), mockSettings.quietHours);

      expect(result).toBe(false);
    });

    it("should handle overnight quiet hours (10pm-7am)", () => {
      // Test at 11pm (should be in quiet hours)
      vi.setSystemTime(new Date("2024-01-15T23:00:00"));
      expect(isInQuietHours(new Date(), mockSettings.quietHours)).toBe(true);

      // Test at 6am (should be in quiet hours)
      vi.setSystemTime(new Date("2024-01-16T06:00:00"));
      expect(isInQuietHours(new Date(), mockSettings.quietHours)).toBe(true);

      // Test at 7am (should be outside quiet hours - end time)
      vi.setSystemTime(new Date("2024-01-16T07:00:00"));
      expect(isInQuietHours(new Date(), mockSettings.quietHours)).toBe(false);

      // Test at 10pm (should be in quiet hours - start time)
      vi.setSystemTime(new Date("2024-01-15T22:00:00"));
      expect(isInQuietHours(new Date(), mockSettings.quietHours)).toBe(true);
    });

    it("should handle same-day quiet hours (1pm-3pm)", () => {
      const sameDayQuietHours = {
        enabled: true,
        startTime: "13:00",
        endTime: "15:00",
      };

      // Test at 2pm (should be in quiet hours)
      vi.setSystemTime(new Date("2024-01-15T14:00:00"));
      expect(isInQuietHours(new Date(), sameDayQuietHours)).toBe(true);

      // Test at 12pm (should be outside quiet hours)
      vi.setSystemTime(new Date("2024-01-15T12:00:00"));
      expect(isInQuietHours(new Date(), sameDayQuietHours)).toBe(false);

      // Test at 4pm (should be outside quiet hours)
      vi.setSystemTime(new Date("2024-01-15T16:00:00"));
      expect(isInQuietHours(new Date(), sameDayQuietHours)).toBe(false);
    });

    it("should return false when quiet hours disabled", () => {
      const disabledQuietHours = {
        ...mockSettings.quietHours,
        enabled: false,
      };

      vi.setSystemTime(new Date("2024-01-15T23:00:00")); // Would be in quiet hours if enabled

      const result = isInQuietHours(new Date(), disabledQuietHours);

      expect(result).toBe(false);
    });
  });

  describe("getDelayedNotificationTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return original time if outside quiet hours", () => {
      vi.setSystemTime(new Date("2024-01-15T10:00:00"));

      const originalTime = new Date("2024-01-15T12:00:00");
      const result = getDelayedNotificationTime(originalTime, mockSettings.quietHours);

      expect(result.getTime()).toBe(originalTime.getTime());
    });

    it("should return quiet hours end time if during quiet hours", () => {
      vi.setSystemTime(new Date("2024-01-15T23:00:00"));

      const originalTime = new Date("2024-01-15T23:30:00");
      const result = getDelayedNotificationTime(originalTime, mockSettings.quietHours);

      // Should be delayed to 7am next day
      expect(result.getHours()).toBe(7);
      expect(result.getMinutes()).toBe(0);
    });

    it("should handle next-day quiet hours end", () => {
      vi.setSystemTime(new Date("2024-01-15T23:00:00"));

      const originalTime = new Date("2024-01-16T02:00:00"); // 2am next day
      const result = getDelayedNotificationTime(originalTime, mockSettings.quietHours);

      // Should be delayed to 7am same day
      expect(result.getDate()).toBe(16);
      expect(result.getHours()).toBe(7);
      expect(result.getMinutes()).toBe(0);
    });

    it("should not delay if quiet hours disabled", () => {
      const disabledQuietHours = {
        ...mockSettings.quietHours,
        enabled: false,
      };

      vi.setSystemTime(new Date("2024-01-15T23:00:00"));

      const originalTime = new Date("2024-01-15T23:30:00");
      const result = getDelayedNotificationTime(originalTime, disabledQuietHours);

      expect(result.getTime()).toBe(originalTime.getTime());
    });
  });

  describe("getTimerAlertThreshold", () => {
    it("should return correct threshold for breastfeeding", () => {
      const result = getTimerAlertThreshold("breastfeeding", mockSettings);
      expect(result).toBe(60);
    });

    it("should return correct threshold for pumping", () => {
      const result = getTimerAlertThreshold("pumping", mockSettings);
      expect(result).toBe(45);
    });

    it("should return correct threshold for tummy time", () => {
      const result = getTimerAlertThreshold("tummyTime", mockSettings);
      expect(result).toBe(30);
    });

    it("should return correct threshold for nap", () => {
      const result = getTimerAlertThreshold("nap", mockSettings);
      expect(result).toBe(180);
    });

    it("should return correct threshold for night sleep", () => {
      const result = getTimerAlertThreshold("nightSleep", mockSettings);
      expect(result).toBe(720);
    });

    it("should return custom threshold when user has customized", () => {
      const customSettings: NotificationSettings = {
        ...mockSettings,
        timerAlerts: {
          enabled: true,
          thresholds: {
            ...mockSettings.timerAlerts.thresholds,
            breastfeeding: 45,
          },
        },
      };

      const result = getTimerAlertThreshold("breastfeeding", customSettings);
      expect(result).toBe(45);
    });
  });

  describe("parseTimeString", () => {
    it("should parse valid time string", () => {
      const result = parseTimeString("14:30");
      expect(result).toEqual({ hours: 14, minutes: 30 });
    });

    it("should parse midnight", () => {
      const result = parseTimeString("00:00");
      expect(result).toEqual({ hours: 0, minutes: 0 });
    });

    it("should parse end of day", () => {
      const result = parseTimeString("23:59");
      expect(result).toEqual({ hours: 23, minutes: 59 });
    });

    it("should return null for invalid format", () => {
      expect(parseTimeString("invalid")).toBeNull();
      expect(parseTimeString("25:00")).toBeNull();
      expect(parseTimeString("12:60")).toBeNull();
      expect(parseTimeString("1:30")).toBeNull(); // Missing leading zero
    });
  });

  describe("formatTimeString", () => {
    it("should format hours and minutes correctly", () => {
      expect(formatTimeString(14, 30)).toBe("14:30");
      expect(formatTimeString(9, 5)).toBe("09:05");
      expect(formatTimeString(0, 0)).toBe("00:00");
      expect(formatTimeString(23, 59)).toBe("23:59");
    });
  });
});
