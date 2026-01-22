jest.unmock("@/contexts/notification-context");

import React, { useEffect } from "react";
import { render, screen, waitFor, act } from "@testing-library/react-native";
import { Text, View } from "react-native";
import type { NotificationSettings, PermissionStatus, TimerThresholds } from "@/types/notifications";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/constants/notifications";

const mockGetSettings = jest.fn();
const mockSaveSettings = jest.fn();
const mockGetFeedingReminderNotificationId = jest.fn();
const mockSaveFeedingReminderNotificationId = jest.fn();
const mockClearFeedingReminderNotificationId = jest.fn();

jest.mock("@/services/notification-storage", () => ({
  NotificationStorageService: {
    getSettings: () => mockGetSettings(),
    saveSettings: (settings: NotificationSettings) => mockSaveSettings(settings),
    getFeedingReminderNotificationId: () => mockGetFeedingReminderNotificationId(),
    saveFeedingReminderNotificationId: (id: string) => mockSaveFeedingReminderNotificationId(id),
    clearFeedingReminderNotificationId: () => mockClearFeedingReminderNotificationId(),
    clearSettings: jest.fn(),
  },
}));

const mockSetupNotificationHandler = jest.fn();
const mockSetupAndroidChannels = jest.fn();
const mockGetPermissionStatus = jest.fn();
const mockRequestPermissions = jest.fn();
const mockScheduleNotification = jest.fn();
const mockCancelNotification = jest.fn();

jest.mock("@/services/notification-service", () => ({
  NotificationService: {
    setupNotificationHandler: () => mockSetupNotificationHandler(),
    setupAndroidChannels: () => mockSetupAndroidChannels(),
    getPermissionStatus: () => mockGetPermissionStatus(),
    requestPermissions: () => mockRequestPermissions(),
    scheduleNotification: (content: unknown, time: Date) => mockScheduleNotification(content, time),
    cancelNotification: (id: string) => mockCancelNotification(id),
    cancelAllNotifications: jest.fn(),
    getAllScheduledNotifications: jest.fn(),
    getNavigationRoute: jest.fn(),
  },
}));

jest.mock("@/utils/notification-scheduler", () => ({
  calculateNextFeedingReminder: jest.fn((lastTime: Date | null, interval: number) => {
    if (!lastTime) return null;
    return new Date(lastTime.getTime() + interval * 60 * 60 * 1000);
  }),
  shouldSendTimerAlert: jest.fn((activityType: string, duration: number, settings: NotificationSettings) => {
    if (!settings.timerAlerts.enabled) return false;
    const threshold = settings.timerAlerts.thresholds[activityType as keyof typeof settings.timerAlerts.thresholds];
    return duration > threshold;
  }),
}));

import { NotificationProvider, useNotifications } from "./notification-context";

function TestConsumer({ testID }: { testID: string }) {
  const notifications = useNotifications();
  return (
    <View testID={testID}>
      <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
      <Text testID="permission-status">{notifications.permissionStatus}</Text>
      <Text testID="feeding-enabled">
        {notifications.settings.feedingReminders.enabled ? "enabled" : "disabled"}
      </Text>
      <Text testID="feeding-interval">
        {notifications.settings.feedingReminders.intervalHours}
      </Text>
      <Text testID="timer-alerts-enabled">
        {notifications.settings.timerAlerts.enabled ? "enabled" : "disabled"}
      </Text>
      <Text testID="quiet-hours-enabled">
        {notifications.settings.quietHours.enabled ? "enabled" : "disabled"}
      </Text>
    </View>
  );
}

describe("NotificationContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettings.mockResolvedValue(DEFAULT_NOTIFICATION_SETTINGS);
    mockGetPermissionStatus.mockResolvedValue("undetermined");
    mockSetupAndroidChannels.mockResolvedValue(undefined);
    mockSaveSettings.mockResolvedValue(undefined);
    mockGetFeedingReminderNotificationId.mockResolvedValue(null);
    mockSaveFeedingReminderNotificationId.mockResolvedValue(undefined);
    mockClearFeedingReminderNotificationId.mockResolvedValue(undefined);
    mockRequestPermissions.mockResolvedValue(true);
    mockScheduleNotification.mockResolvedValue("test-notification-id");
    mockCancelNotification.mockResolvedValue(undefined);
  });

  describe("useNotifications hook", () => {
    it("should throw error when used outside NotificationProvider", () => {
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer testID="test" />);
      }).toThrow("useNotifications must be used within a NotificationProvider");

      consoleError.mockRestore();
    });
  });

  describe("NotificationProvider initialization", () => {
    it("should start in loading state", async () => {
      render(
        <NotificationProvider>
          <TestConsumer testID="test" />
        </NotificationProvider>
      );

      expect(screen.getByTestId("loading").props.children).toBe("loading");
    });

    it("should set isLoading to false after initialization", async () => {
      render(
        <NotificationProvider>
          <TestConsumer testID="test" />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });
    });

    it("should setup notification handler on mount", async () => {
      render(
        <NotificationProvider>
          <TestConsumer testID="test" />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(mockSetupNotificationHandler).toHaveBeenCalled();
    });

    it("should setup Android channels on mount", async () => {
      render(
        <NotificationProvider>
          <TestConsumer testID="test" />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(mockSetupAndroidChannels).toHaveBeenCalled();
    });

    it("should load stored settings on mount", async () => {
      const customSettings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        feedingReminders: {
          enabled: true,
          intervalHours: 4,
        },
      };
      mockGetSettings.mockResolvedValue(customSettings);

      render(
        <NotificationProvider>
          <TestConsumer testID="test" />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("feeding-enabled").props.children).toBe("enabled");
      expect(screen.getByTestId("feeding-interval").props.children).toBe(4);
    });

    it("should load permission status on mount", async () => {
      mockGetPermissionStatus.mockResolvedValue("granted");

      render(
        <NotificationProvider>
          <TestConsumer testID="test" />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("permission-status").props.children).toBe("granted");
    });

    it("should use default settings on init", async () => {
      render(
        <NotificationProvider>
          <TestConsumer testID="test" />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("feeding-enabled").props.children).toBe("disabled");
      expect(screen.getByTestId("feeding-interval").props.children).toBe(3);
      expect(screen.getByTestId("timer-alerts-enabled").props.children).toBe("enabled");
    });
  });

  describe("updateSettings", () => {
    it("should update feeding reminder settings", async () => {
      let updateFn: ((partial: Partial<NotificationSettings>) => Promise<void>) | undefined;

      function UpdateTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          updateFn = notifications.updateSettings;
        }, [notifications.updateSettings]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
            <Text testID="feeding-enabled">
              {notifications.settings.feedingReminders.enabled ? "enabled" : "disabled"}
            </Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <UpdateTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        if (updateFn) {
          await updateFn({
            feedingReminders: { enabled: true, intervalHours: 4 },
          });
        }
      });

      expect(screen.getByTestId("feeding-enabled").props.children).toBe("enabled");
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it("should save settings to storage", async () => {
      let updateFn: ((partial: Partial<NotificationSettings>) => Promise<void>) | undefined;

      function UpdateTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          updateFn = notifications.updateSettings;
        }, [notifications.updateSettings]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <UpdateTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        if (updateFn) {
          await updateFn({
            quietHours: { enabled: true, startTime: "23:00", endTime: "06:00" },
          });
        }
      });

      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          quietHours: expect.objectContaining({
            enabled: true,
            startTime: "23:00",
            endTime: "06:00",
          }),
        })
      );
    });
  });

  describe("requestPermissions", () => {
    it("should request permissions and update status", async () => {
      mockRequestPermissions.mockResolvedValue(true);
      mockGetPermissionStatus.mockResolvedValueOnce("undetermined").mockResolvedValue("granted");

      let requestFn: (() => Promise<boolean>) | undefined;

      function PermissionTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          requestFn = notifications.requestPermissions;
        }, [notifications.requestPermissions]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
            <Text testID="permission-status">{notifications.permissionStatus}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <PermissionTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      let result: boolean | undefined;
      await act(async () => {
        if (requestFn) {
          result = await requestFn();
        }
      });

      expect(result).toBe(true);
      expect(mockRequestPermissions).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByTestId("permission-status").props.children).toBe("granted");
      });
    });
  });

  describe("scheduleFeedingReminder", () => {
    it("should not schedule if feeding reminders disabled", async () => {
      mockGetSettings.mockResolvedValue(DEFAULT_NOTIFICATION_SETTINGS);
      mockGetPermissionStatus.mockResolvedValue("granted");

      let scheduleFn: ((lastTime: Date) => Promise<void>) | undefined;

      function ScheduleTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          scheduleFn = notifications.scheduleFeedingReminder;
        }, [notifications.scheduleFeedingReminder]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <ScheduleTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        if (scheduleFn) {
          await scheduleFn(new Date());
        }
      });

      expect(mockScheduleNotification).not.toHaveBeenCalled();
    });

    it("should not schedule if permissions not granted", async () => {
      mockGetSettings.mockResolvedValue({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        feedingReminders: { enabled: true, intervalHours: 3 },
      });
      mockGetPermissionStatus.mockResolvedValue("denied");

      let scheduleFn: ((lastTime: Date) => Promise<void>) | undefined;

      function ScheduleTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          scheduleFn = notifications.scheduleFeedingReminder;
        }, [notifications.scheduleFeedingReminder]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <ScheduleTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        if (scheduleFn) {
          await scheduleFn(new Date());
        }
      });

      expect(mockScheduleNotification).not.toHaveBeenCalled();
    });

    it("should schedule notification when enabled and permissions granted", async () => {
      mockGetSettings.mockResolvedValue({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        feedingReminders: { enabled: true, intervalHours: 3 },
      });
      mockGetPermissionStatus.mockResolvedValue("granted");

      let scheduleFn: ((lastTime: Date) => Promise<void>) | undefined;

      function ScheduleTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          scheduleFn = notifications.scheduleFeedingReminder;
        }, [notifications.scheduleFeedingReminder]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <ScheduleTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      const lastFeedingTime = new Date();

      await act(async () => {
        if (scheduleFn) {
          await scheduleFn(lastFeedingTime);
        }
      });

      expect(mockScheduleNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Feeding Reminder",
          data: { type: "feeding_reminder" },
        }),
        expect.any(Date)
      );
      expect(mockSaveFeedingReminderNotificationId).toHaveBeenCalledWith("test-notification-id");
    });

    it("should cancel existing reminder before scheduling new one", async () => {
      mockGetSettings.mockResolvedValue({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        feedingReminders: { enabled: true, intervalHours: 3 },
      });
      mockGetPermissionStatus.mockResolvedValue("granted");
      mockGetFeedingReminderNotificationId.mockResolvedValue("existing-notification-id");

      let scheduleFn: ((lastTime: Date) => Promise<void>) | undefined;

      function ScheduleTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          scheduleFn = notifications.scheduleFeedingReminder;
        }, [notifications.scheduleFeedingReminder]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <ScheduleTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        if (scheduleFn) {
          await scheduleFn(new Date());
        }
      });

      expect(mockCancelNotification).toHaveBeenCalledWith("existing-notification-id");
    });
  });

  describe("cancelFeedingReminder", () => {
    it("should cancel notification if one exists", async () => {
      mockGetFeedingReminderNotificationId.mockResolvedValue("existing-id");

      let cancelFn: (() => Promise<void>) | undefined;

      function CancelTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          cancelFn = notifications.cancelFeedingReminder;
        }, [notifications.cancelFeedingReminder]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <CancelTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        if (cancelFn) {
          await cancelFn();
        }
      });

      expect(mockCancelNotification).toHaveBeenCalledWith("existing-id");
      expect(mockClearFeedingReminderNotificationId).toHaveBeenCalled();
    });

    it("should not call cancel if no notification exists", async () => {
      mockGetFeedingReminderNotificationId.mockResolvedValue(null);

      let cancelFn: (() => Promise<void>) | undefined;

      function CancelTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          cancelFn = notifications.cancelFeedingReminder;
        }, [notifications.cancelFeedingReminder]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <CancelTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        if (cancelFn) {
          await cancelFn();
        }
      });

      expect(mockCancelNotification).not.toHaveBeenCalled();
      expect(mockClearFeedingReminderNotificationId).not.toHaveBeenCalled();
    });
  });

  describe("checkTimerAlert", () => {
    it("should return true when duration exceeds threshold", async () => {
      mockGetSettings.mockResolvedValue({
        ...DEFAULT_NOTIFICATION_SETTINGS,
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
      });

      let checkFn: ((type: keyof TimerThresholds, duration: number) => boolean) | undefined;

      function CheckTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          checkFn = notifications.checkTimerAlert;
        }, [notifications.checkTimerAlert]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <CheckTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      let result: boolean | undefined;
      await act(async () => {
        if (checkFn) {
          result = checkFn("breastfeeding", 65);
        }
      });

      expect(result).toBe(true);
    });

    it("should return false when duration is below threshold", async () => {
      mockGetSettings.mockResolvedValue({
        ...DEFAULT_NOTIFICATION_SETTINGS,
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
      });

      let checkFn: ((type: keyof TimerThresholds, duration: number) => boolean) | undefined;

      function CheckTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          checkFn = notifications.checkTimerAlert;
        }, [notifications.checkTimerAlert]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <CheckTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      let result: boolean | undefined;
      await act(async () => {
        if (checkFn) {
          result = checkFn("breastfeeding", 30);
        }
      });

      expect(result).toBe(false);
    });

    it("should return false when timer alerts are disabled", async () => {
      mockGetSettings.mockResolvedValue({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        timerAlerts: {
          enabled: false,
          thresholds: {
            breastfeeding: 60,
            pumping: 45,
            tummyTime: 30,
            nap: 180,
            nightSleep: 720,
          },
        },
      });

      let checkFn: ((type: keyof TimerThresholds, duration: number) => boolean) | undefined;

      function CheckTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          checkFn = notifications.checkTimerAlert;
        }, [notifications.checkTimerAlert]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <CheckTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      let result: boolean | undefined;
      await act(async () => {
        if (checkFn) {
          result = checkFn("breastfeeding", 65);
        }
      });

      expect(result).toBe(false);
    });
  });

  describe("context value", () => {
    it("should provide all required methods and properties", async () => {
      let contextValue: {
        settings?: NotificationSettings;
        permissionStatus?: PermissionStatus;
        isLoading?: boolean;
        updateSettings?: unknown;
        requestPermissions?: unknown;
        scheduleFeedingReminder?: unknown;
        cancelFeedingReminder?: unknown;
        checkTimerAlert?: unknown;
      } = {};

      function MethodsTestConsumer() {
        const notifications = useNotifications();
        useEffect(() => {
          contextValue = {
            settings: notifications.settings,
            permissionStatus: notifications.permissionStatus,
            isLoading: notifications.isLoading,
            updateSettings: notifications.updateSettings,
            requestPermissions: notifications.requestPermissions,
            scheduleFeedingReminder: notifications.scheduleFeedingReminder,
            cancelFeedingReminder: notifications.cancelFeedingReminder,
            checkTimerAlert: notifications.checkTimerAlert,
          };
        }, [notifications]);
        return (
          <View>
            <Text testID="loading">{notifications.isLoading ? "loading" : "ready"}</Text>
          </View>
        );
      }

      render(
        <NotificationProvider>
          <MethodsTestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(contextValue.settings).toBeDefined();
      expect(contextValue.permissionStatus).toBeDefined();
      expect(typeof contextValue.isLoading).toBe("boolean");
      expect(typeof contextValue.updateSettings).toBe("function");
      expect(typeof contextValue.requestPermissions).toBe("function");
      expect(typeof contextValue.scheduleFeedingReminder).toBe("function");
      expect(typeof contextValue.cancelFeedingReminder).toBe("function");
      expect(typeof contextValue.checkTimerAlert).toBe("function");
    });
  });
});
