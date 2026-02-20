import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: "test-project-id",
        },
      },
    },
  },
}));

vi.mock("@/constants/notifications", () => ({
  NOTIFICATION_CHANNELS: {
    FEEDING_REMINDERS: "feeding-reminders",
    TIMER_ALERTS: "timer-alerts",
    HOUSEHOLD_ACTIVITY: "household-activity",
    ACTIVE_TIMERS: "active-timers",
  },
}));

vi.mock("@/utils/notification-routes", () => ({
  getNavigationRoute: vi.fn(),
}));

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "undetermined" }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: "undetermined" }),
  getExpoPushTokenAsync: vi.fn(),
  getDevicePushTokenAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn().mockResolvedValue([]),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  addPushTokenListener: vi.fn(),
  AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

import { NotificationService } from "./notification-service";
import * as Notifications from "expo-notifications";

const mocks = Notifications as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotificationService", () => {
  describe("isAvailable", () => {
    it("should return true when module is loaded", () => {
      expect(NotificationService.isAvailable()).toBe(true);
    });
  });

  describe("setupNotificationHandler", () => {
    it("should set notification handler", () => {
      NotificationService.setupNotificationHandler();

      expect(mocks.setNotificationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          handleNotification: expect.any(Function),
        })
      );
    });

    it("should configure handler to show alerts and play sound", async () => {
      NotificationService.setupNotificationHandler();

      const handler = mocks.setNotificationHandler.mock.calls[0][0];
      const result = await handler.handleNotification();

      expect(result.shouldShowAlert).toBe(true);
      expect(result.shouldPlaySound).toBe(true);
      expect(result.shouldSetBadge).toBe(false);
    });
  });

  describe("getPermissionStatus", () => {
    it("should return permission status", async () => {
      mocks.getPermissionsAsync.mockResolvedValue({ status: "granted" });

      const result = await NotificationService.getPermissionStatus();

      expect(result).toBe("granted");
    });
  });

  describe("requestPermissions", () => {
    it("should return true when granted", async () => {
      mocks.requestPermissionsAsync.mockResolvedValue({ status: "granted" });

      const result = await NotificationService.requestPermissions();

      expect(result).toBe(true);
    });

    it("should return false when denied", async () => {
      mocks.requestPermissionsAsync.mockResolvedValue({ status: "denied" });

      const result = await NotificationService.requestPermissions();

      expect(result).toBe(false);
    });
  });

  describe("getExpoPushToken", () => {
    it("should return token when permissions granted", async () => {
      mocks.getPermissionsAsync.mockResolvedValue({ status: "granted" });
      mocks.getExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[xxx]" });

      const result = await NotificationService.getExpoPushToken();

      expect(result).toBe("ExponentPushToken[xxx]");
      expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "test-project-id" });
    });

    it("should return null when permissions not granted", async () => {
      mocks.getPermissionsAsync.mockResolvedValue({ status: "denied" });

      const result = await NotificationService.getExpoPushToken();

      expect(result).toBeNull();
    });

    it("should return null when getExpoPushTokenAsync throws", async () => {
      mocks.getPermissionsAsync.mockResolvedValue({ status: "granted" });
      mocks.getExpoPushTokenAsync.mockRejectedValue(new Error("Failed"));

      const result = await NotificationService.getExpoPushToken();

      expect(result).toBeNull();
    });
  });

  describe("getScheduledNotificationCount", () => {
    it("should return count of scheduled notifications", async () => {
      mocks.getAllScheduledNotificationsAsync.mockResolvedValue([{}, {}, {}]);

      const result = await NotificationService.getScheduledNotificationCount();

      expect(result).toBe(3);
    });
  });

  describe("canScheduleNotification", () => {
    it("should return true when under iOS limit", async () => {
      mocks.getAllScheduledNotificationsAsync.mockResolvedValue(new Array(10));

      const result = await NotificationService.canScheduleNotification();

      expect(result).toBe(true);
    });

    it("should return false when at iOS limit", async () => {
      mocks.getAllScheduledNotificationsAsync.mockResolvedValue(new Array(64));

      const result = await NotificationService.canScheduleNotification();

      expect(result).toBe(false);
    });
  });

  describe("scheduleNotification", () => {
    it("should schedule and return notification id", async () => {
      mocks.getAllScheduledNotificationsAsync.mockResolvedValue([]);
      mocks.scheduleNotificationAsync.mockResolvedValue("notif-123");

      const content = { title: "Test", body: "Body", data: { type: "feeding_reminder" as const } };
      const triggerTime = new Date("2024-01-01T12:00:00Z");

      const result = await NotificationService.scheduleNotification(content, triggerTime);

      expect(result).toBe("notif-123");
      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({ title: "Test", body: "Body" }),
          trigger: expect.objectContaining({ date: triggerTime }),
        })
      );
    });

    it("should return null when iOS limit reached", async () => {
      mocks.getAllScheduledNotificationsAsync.mockResolvedValue(new Array(64));

      const content = { title: "Test", body: "Body" };
      const result = await NotificationService.scheduleNotification(content, new Date());

      expect(result).toBeNull();
      expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe("cancelNotification", () => {
    it("should cancel a scheduled notification", async () => {
      await NotificationService.cancelNotification("notif-123");

      expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-123");
    });
  });

  describe("cancelAllNotifications", () => {
    it("should cancel all scheduled notifications", async () => {
      await NotificationService.cancelAllNotifications();

      expect(mocks.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe("getAllScheduledNotifications", () => {
    it("should return all scheduled notifications", async () => {
      const notifications = [
        { identifier: "1", content: { title: "A", body: null, data: {} }, trigger: null },
      ];
      mocks.getAllScheduledNotificationsAsync.mockResolvedValue(notifications);

      const result = await NotificationService.getAllScheduledNotifications();

      expect(result).toEqual(notifications);
    });
  });
});
