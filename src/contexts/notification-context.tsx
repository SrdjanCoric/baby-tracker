/**
 * Notification Context
 * Manages notification settings and scheduling
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type {
  NotificationSettings,
  PermissionStatus,
  TimerThresholds,
} from "@/types/notifications";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/constants/notifications";
import { NotificationService } from "@/services/notification-service";
import { NotificationStorageService } from "@/services/notification-storage";
import {
  calculateNextFeedingReminder,
  shouldSendTimerAlert,
} from "@/utils/notification-scheduler";

interface NotificationContextValue {
  settings: NotificationSettings;
  permissionStatus: PermissionStatus;
  isLoading: boolean;
  updateSettings: (partial: Partial<NotificationSettings>) => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  scheduleFeedingReminder: (babyId: string, lastFeedingTime: Date) => Promise<void>;
  cancelFeedingReminder: (babyId: string) => Promise<void>;
  checkTimerAlert: (
    activityType: keyof TimerThresholds,
    durationMinutes: number
  ) => boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>("undetermined");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        NotificationService.setupNotificationHandler();
        await NotificationService.setupAndroidChannels();

        const [storedSettings, status] = await Promise.all([
          NotificationStorageService.getSettings(),
          NotificationService.getPermissionStatus(),
        ]);

        setSettings(storedSettings);
        setPermissionStatus(status);
      } catch (error) {
        console.error("Failed to initialize notifications:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<NotificationSettings>) => {
      const newSettings: NotificationSettings = {
        ...settings,
        ...partial,
        feedingReminders: {
          ...settings.feedingReminders,
          ...(partial.feedingReminders || {}),
        },
        timerAlerts: {
          ...settings.timerAlerts,
          ...(partial.timerAlerts || {}),
          thresholds: {
            ...settings.timerAlerts.thresholds,
            ...(partial.timerAlerts?.thresholds || {}),
          },
        },
        quietHours: {
          ...settings.quietHours,
          ...(partial.quietHours || {}),
        },
      };

      setSettings(newSettings);
      await NotificationStorageService.saveSettings(newSettings);
    },
    [settings]
  );

  const requestPermissions = useCallback(async () => {
    const granted = await NotificationService.requestPermissions();
    const status = await NotificationService.getPermissionStatus();
    setPermissionStatus(status);
    return granted;
  }, []);

  const scheduleFeedingReminder = useCallback(
    async (babyId: string, lastFeedingTime: Date) => {
      if (!babyId || !settings.feedingReminders.enabled) {
        return;
      }

      if (permissionStatus !== "granted") {
        return;
      }

      const existingId =
        await NotificationStorageService.getFeedingReminderNotificationId(babyId);
      if (existingId) {
        await NotificationService.cancelNotification(existingId);
      }

      const reminderTime = calculateNextFeedingReminder(
        lastFeedingTime,
        settings.feedingReminders.intervalHours,
        settings
      );

      if (!reminderTime) {
        return;
      }

      const notificationId = await NotificationService.scheduleNotification(
        {
          title: "Feeding Reminder",
          body: `It's been ${settings.feedingReminders.intervalHours} hours since the last feeding`,
          data: {
            type: "feeding_reminder",
            babyId,
          },
        },
        reminderTime
      );

      if (notificationId) {
        await NotificationStorageService.saveFeedingReminderNotificationId(
          babyId,
          notificationId
        );
      }
    },
    [settings, permissionStatus]
  );

  const cancelFeedingReminder = useCallback(async (babyId: string) => {
    if (!babyId) return;

    const notificationId =
      await NotificationStorageService.getFeedingReminderNotificationId(babyId);
    if (notificationId) {
      await NotificationService.cancelNotification(notificationId);
      await NotificationStorageService.clearFeedingReminderNotificationId(babyId);
    }
  }, []);

  const checkTimerAlert = useCallback(
    (activityType: keyof TimerThresholds, durationMinutes: number) => {
      return shouldSendTimerAlert(activityType, durationMinutes, settings);
    },
    [settings]
  );

  const value: NotificationContextValue = {
    settings,
    permissionStatus,
    isLoading,
    updateSettings,
    requestPermissions,
    scheduleFeedingReminder,
    cancelFeedingReminder,
    checkTimerAlert,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
}
