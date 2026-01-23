/**
 * Tests for notification sanitizer utilities
 */

import { describe, it, expect } from "vitest";
import {
  stripUnsafeContent,
  truncateString,
  sanitizeTitle,
  sanitizeBody,
  sanitizeData,
  sanitizeNotificationContent,
  applyPrivacySettings,
  createSafeNotificationContent,
  generateInAppReminderContent,
} from "./notification-sanitizer";
import type { NotificationContent, NotificationPrivacySettings } from "@/types/notifications";

describe("notification-sanitizer", () => {
  describe("stripUnsafeContent", () => {
    it("should return empty string for non-string input", () => {
      expect(stripUnsafeContent(null as unknown as string)).toBe("");
      expect(stripUnsafeContent(undefined as unknown as string)).toBe("");
      expect(stripUnsafeContent(123 as unknown as string)).toBe("");
    });

    it("should remove script tags", () => {
      const input = "Hello <script>alert('xss')</script> World";
      expect(stripUnsafeContent(input)).toBe("Hello  World");
    });

    it("should remove HTML tags", () => {
      const input = "Hello <b>World</b>";
      expect(stripUnsafeContent(input)).toBe("Hello World");
    });

    it("should remove javascript: URLs", () => {
      const input = "Click javascript:alert('xss')";
      expect(stripUnsafeContent(input)).toBe("Click alert('xss')");
    });

    it("should remove data: URLs", () => {
      const input = "Image data:image/png;base64,xxx";
      expect(stripUnsafeContent(input)).toBe("Image image/png;base64,xxx");
    });

    it("should remove event handlers", () => {
      const input = "onclick=alert() text";
      expect(stripUnsafeContent(input)).toBe("alert() text");
    });

    it("should remove null bytes and control characters", () => {
      const input = "Hello\x00World\x1F";
      expect(stripUnsafeContent(input)).toBe("HelloWorld");
    });

    it("should preserve newlines and tabs", () => {
      const input = "Hello\nWorld\tTest";
      expect(stripUnsafeContent(input)).toBe("Hello\nWorld\tTest");
    });

    it("should trim whitespace", () => {
      const input = "  Hello World  ";
      expect(stripUnsafeContent(input)).toBe("Hello World");
    });

    it("should handle normal text without modification", () => {
      const input = "Time to feed your baby";
      expect(stripUnsafeContent(input)).toBe("Time to feed your baby");
    });
  });

  describe("truncateString", () => {
    it("should return empty string for non-string input", () => {
      expect(truncateString(null as unknown as string, 10)).toBe("");
      expect(truncateString(undefined as unknown as string, 10)).toBe("");
    });

    it("should not truncate strings shorter than max length", () => {
      expect(truncateString("Hello", 10)).toBe("Hello");
    });

    it("should not truncate strings equal to max length", () => {
      expect(truncateString("Hello", 5)).toBe("Hello");
    });

    it("should truncate strings longer than max length with ellipsis", () => {
      expect(truncateString("Hello World", 8)).toBe("Hello...");
    });

    it("should handle very short max length", () => {
      expect(truncateString("Hello", 4)).toBe("H...");
    });
  });

  describe("sanitizeTitle", () => {
    it("should sanitize and truncate title", () => {
      const longTitle = "A".repeat(150);
      const result = sanitizeTitle(longTitle);
      expect(result.length).toBe(100);
      expect(result.endsWith("...")).toBe(true);
    });

    it("should remove unsafe content from title", () => {
      const input = "Hello <script>evil</script>";
      expect(sanitizeTitle(input)).toBe("Hello");
    });
  });

  describe("sanitizeBody", () => {
    it("should sanitize and truncate body", () => {
      const longBody = "B".repeat(300);
      const result = sanitizeBody(longBody);
      expect(result.length).toBe(256);
      expect(result.endsWith("...")).toBe(true);
    });

    it("should remove unsafe content from body", () => {
      const input = "Message with <b>HTML</b>";
      expect(sanitizeBody(input)).toBe("Message with HTML");
    });
  });

  describe("sanitizeData", () => {
    it("should return undefined for undefined input", () => {
      expect(sanitizeData(undefined)).toBeUndefined();
    });

    it("should return undefined for null input", () => {
      expect(sanitizeData(null as unknown as undefined)).toBeUndefined();
    });

    it("should preserve valid notification type", () => {
      const data = { type: "feeding_reminder" as const };
      expect(sanitizeData(data)).toEqual({ type: "feeding_reminder" });
    });

    it("should sanitize activityType", () => {
      const data = {
        type: "timer_alert" as const,
        activityType: "breastfeeding<script>",
      };
      expect(sanitizeData(data)?.activityType).toBe("breastfeeding");
    });

    it("should only allow valid UUID format for babyId", () => {
      const validId = "123e4567-e89b-12d3-a456-426614174000";
      const invalidId = "not-a-uuid";

      expect(sanitizeData({ type: "feeding_reminder" as const, babyId: validId })?.babyId).toBe(validId);
      expect(sanitizeData({ type: "feeding_reminder" as const, babyId: invalidId })?.babyId).toBeUndefined();
    });

    it("should only allow safe route patterns", () => {
      const validRoute = "/feeding/index";
      const invalidRoute = "/route?param=<script>";

      expect(sanitizeData({ type: "feeding_reminder" as const, route: validRoute })?.route).toBe(validRoute);
      expect(sanitizeData({ type: "feeding_reminder" as const, route: invalidRoute })?.route).toBeUndefined();
    });

    it("should truncate long activityType", () => {
      const longActivity = "a".repeat(100);
      const result = sanitizeData({ type: "timer_alert" as const, activityType: longActivity });
      expect(result?.activityType?.length).toBe(50);
    });
  });

  describe("sanitizeNotificationContent", () => {
    it("should sanitize all parts of notification content", () => {
      const content: NotificationContent = {
        title: "Hello <script>evil</script>",
        body: "Body <b>with</b> HTML",
        data: {
          type: "feeding_reminder",
          babyId: "123e4567-e89b-12d3-a456-426614174000",
          activityType: "test<script>",
        },
      };

      const result = sanitizeNotificationContent(content);

      expect(result.title).toBe("Hello");
      expect(result.body).toBe("Body with HTML");
      expect(result.data?.activityType).toBe("test");
    });
  });

  describe("applyPrivacySettings", () => {
    const baseContent: NotificationContent = {
      title: "Feeding Reminder",
      body: "Time to feed Emma",
      data: { type: "feeding_reminder" },
    };

    it("should replace baby name when showBabyName is false", () => {
      const privacy: NotificationPrivacySettings = {
        showBabyName: false,
        showActivityDetails: true,
      };

      const result = applyPrivacySettings(baseContent, privacy, "Emma");

      expect(result.body).toBe("Time to feed your baby");
    });

    it("should keep baby name when showBabyName is true", () => {
      const privacy: NotificationPrivacySettings = {
        showBabyName: true,
        showActivityDetails: true,
      };

      const result = applyPrivacySettings(baseContent, privacy, "Emma");

      expect(result.body).toBe("Time to feed Emma");
    });

    it("should use generic body when showActivityDetails is false for feeding reminder", () => {
      const privacy: NotificationPrivacySettings = {
        showBabyName: true,
        showActivityDetails: false,
      };

      const result = applyPrivacySettings(baseContent, privacy, "Emma");

      expect(result.body).toBe("Tap for details");
    });

    it("should use generic body when showActivityDetails is false for timer alert", () => {
      const content: NotificationContent = {
        title: "Timer Alert",
        body: "Still breastfeeding Emma?",
        data: { type: "timer_alert" },
      };

      const privacy: NotificationPrivacySettings = {
        showBabyName: true,
        showActivityDetails: false,
      };

      const result = applyPrivacySettings(content, privacy, "Emma");

      expect(result.body).toBe("Tap to check timer");
    });

    it("should handle case-insensitive baby name replacement", () => {
      const content: NotificationContent = {
        title: "EMMA Feeding",
        body: "Time to feed emma",
        data: { type: "feeding_reminder" },
      };

      const privacy: NotificationPrivacySettings = {
        showBabyName: false,
        showActivityDetails: true,
      };

      const result = applyPrivacySettings(content, privacy, "Emma");

      expect(result.title).toBe("your baby Feeding");
      expect(result.body).toBe("Time to feed your baby");
    });

    it("should handle missing baby name gracefully", () => {
      const privacy: NotificationPrivacySettings = {
        showBabyName: false,
        showActivityDetails: true,
      };

      const result = applyPrivacySettings(baseContent, privacy, undefined);

      expect(result.body).toBe("Time to feed Emma");
    });
  });

  describe("createSafeNotificationContent", () => {
    it("should both sanitize and apply privacy settings", () => {
      const content: NotificationContent = {
        title: "Reminder <script>xss</script>",
        body: "Feed Emma now",
        data: { type: "feeding_reminder" },
      };

      const privacy: NotificationPrivacySettings = {
        showBabyName: false,
        showActivityDetails: true,
      };

      const result = createSafeNotificationContent(content, privacy, "Emma");

      expect(result.title).toBe("Reminder");
      expect(result.body).toBe("Feed your baby now");
    });
  });

  describe("generateInAppReminderContent", () => {
    describe("feeding reminders", () => {
      it("should generate basic feeding reminder", () => {
        const privacy: NotificationPrivacySettings = {
          showBabyName: false,
          showActivityDetails: false,
        };

        const result = generateInAppReminderContent("feeding", privacy);

        expect(result.title).toBe("Feeding Reminder");
        expect(result.body).toBe("Time to feed");
      });

      it("should include baby name when privacy allows", () => {
        const privacy: NotificationPrivacySettings = {
          showBabyName: true,
          showActivityDetails: false,
        };

        const result = generateInAppReminderContent("feeding", privacy, { babyName: "Emma" });

        expect(result.body).toBe("Time to feed Emma");
      });

      it("should include interval when privacy allows", () => {
        const privacy: NotificationPrivacySettings = {
          showBabyName: false,
          showActivityDetails: true,
        };

        const result = generateInAppReminderContent("feeding", privacy, { intervalHours: 3 });

        expect(result.body).toBe("Time to feed (3h since last feeding)");
      });

      it("should include both baby name and interval when allowed", () => {
        const privacy: NotificationPrivacySettings = {
          showBabyName: true,
          showActivityDetails: true,
        };

        const result = generateInAppReminderContent("feeding", privacy, {
          babyName: "Emma",
          intervalHours: 2.5,
        });

        expect(result.body).toBe("Time to feed Emma (2.5h since last feeding)");
      });
    });

    describe("timer reminders", () => {
      it("should generate basic timer reminder", () => {
        const privacy: NotificationPrivacySettings = {
          showBabyName: false,
          showActivityDetails: false,
        };

        const result = generateInAppReminderContent("timer", privacy);

        expect(result.title).toBe("Timer Alert");
        expect(result.body).toBe("Check your active timer");
      });

      it("should include activity type when privacy allows", () => {
        const privacy: NotificationPrivacySettings = {
          showBabyName: false,
          showActivityDetails: true,
        };

        const result = generateInAppReminderContent("timer", privacy, { activityType: "breastfeeding" });

        expect(result.body).toBe("Still doing breastfeeding? Tap to check");
      });

      it("should use friendly labels for activity types", () => {
        const privacy: NotificationPrivacySettings = {
          showBabyName: false,
          showActivityDetails: true,
        };

        expect(generateInAppReminderContent("timer", privacy, { activityType: "tummyTime" }).body)
          .toBe("Still doing tummy time? Tap to check");

        expect(generateInAppReminderContent("timer", privacy, { activityType: "nightSleep" }).body)
          .toBe("Still doing sleep? Tap to check");
      });
    });
  });
});
