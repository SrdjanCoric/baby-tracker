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
  useRef,
} from "react";
import type {
  NotificationSettings,
  PermissionStatus,
  TimerThresholds,
  NotificationPrivacySettings,
} from "@/types/notifications";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/constants/notifications";
import { NotificationService } from "@/services/notification-service";
import { NotificationStorageService } from "@/services/notification-storage";
import {
  calculateNextFeedingReminder,
  shouldSendTimerAlert,
} from "@/utils/notification-scheduler";
import { createSafeNotificationContent } from "@/utils/notification-sanitizer";

interface NotificationContextValue {
  settings: NotificationSettings;
  permissionStatus: PermissionStatus;
  isLoading: boolean;
  inAppRemindersEnabled: boolean;
  updateSettings: (partial: Partial<NotificationSettings>) => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  scheduleFeedingReminder: (babyId: string, lastFeedingTime: Date, babyName?: string) => Promise<void>;
  cancelFeedingReminder: (babyId: string) => Promise<void>;
  checkTimerAlert: (
    activityType: keyof TimerThresholds,
    durationMinutes: number
  ) => boolean;
  setInAppRemindersEnabled: (enabled: boolean) => Promise<void>;
  checkInAppReminder: (babyId: string, lastFeedingTime: Date) => boolean;
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
  const [inAppRemindersEnabled, setInAppRemindersEnabledState] = useState(false);

  // Track scheduled reminders for rescheduling
  const scheduledRemindersRef = useRef<Map<string, { babyId: string; lastFeedingTime: Date; babyName?: string }>>(new Map());

  useEffect(() => {
    const initialize = async () => {
      try {
        NotificationService.setupNotificationHandler();
        await NotificationService.setupAndroidChannels();

        const [storedSettings, status, inAppEnabled] = await Promise.all([
          NotificationStorageService.getSettings(),
          NotificationService.getPermissionStatus(),
          NotificationStorageService.getInAppReminderEnabled(),
        ]);

        setSettings(storedSettings);
        setPermissionStatus(status);
        setInAppRemindersEnabledState(inAppEnabled);
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
        privacy: {
          ...settings.privacy,
          ...(partial.privacy || {}),
        },
      };

      // Check if we need to reschedule notifications
      const needsReschedule =
        partial.feedingReminders?.intervalHours !== undefined ||
        partial.feedingReminders?.enabled !== undefined ||
        partial.quietHours?.enabled !== undefined ||
        partial.quietHours?.startTime !== undefined ||
        partial.quietHours?.endTime !== undefined;

      setSettings(newSettings);
      await NotificationStorageService.saveSettings(newSettings);

      // Reschedule all feeding reminders if settings that affect timing changed
      if (needsReschedule && permissionStatus === "granted") {
        // Cancel and reschedule all tracked reminders
        for (const [key, reminder] of scheduledRemindersRef.current.entries()) {
          // Cancel existing
          const existingId = await NotificationStorageService.getFeedingReminderNotificationId(reminder.babyId);
          if (existingId) {
            await NotificationService.cancelNotification(existingId);
          }

          // Reschedule with new settings if reminders are still enabled
          if (newSettings.feedingReminders.enabled) {
            const reminderTime = calculateNextFeedingReminder(
              reminder.lastFeedingTime,
              newSettings.feedingReminders.intervalHours,
              newSettings
            );

            if (reminderTime) {
              const content = createSafeNotificationContent(
                {
                  title: "Feeding Reminder",
                  body: `It's been ${newSettings.feedingReminders.intervalHours} hours since the last feeding`,
                  data: {
                    type: "feeding_reminder",
                    babyId: reminder.babyId,
                  },
                },
                newSettings.privacy,
                reminder.babyName
              );

              const notificationId = await NotificationService.scheduleNotification(
                content,
                reminderTime
              );

              if (notificationId) {
                await NotificationStorageService.saveFeedingReminderNotificationId(
                  reminder.babyId,
                  notificationId
                );
              }
            }
          }
        }
      }
    },
    [settings, permissionStatus]
  );

  const requestPermissions = useCallback(async () => {
    const granted = await NotificationService.requestPermissions();
    const status = await NotificationService.getPermissionStatus();
    setPermissionStatus(status);
    return granted;
  }, []);

  const scheduleFeedingReminder = useCallback(
    async (babyId: string, lastFeedingTime: Date, babyName?: string) => {
      if (!babyId || !settings.feedingReminders.enabled) {
        // Clean up tracking if disabled
        scheduledRemindersRef.current.delete(babyId);
        return;
      }

      if (permissionStatus !== "granted") {
        return;
      }

      // Track this reminder for rescheduling
      scheduledRemindersRef.current.set(babyId, {
        babyId,
        lastFeedingTime,
        babyName,
      });

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

      // Create sanitized notification content with privacy settings applied
      const content = createSafeNotificationContent(
        {
          title: "Feeding Reminder",
          body: settings.privacy.showBabyName && babyName
            ? `Time to feed ${babyName}`
            : `It's been ${settings.feedingReminders.intervalHours} hours since the last feeding`,
          data: {
            type: "feeding_reminder",
            babyId,
          },
        },
        settings.privacy,
        babyName
      );

      const notificationId = await NotificationService.scheduleNotification(
        content,
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

    // Remove from tracking
    scheduledRemindersRef.current.delete(babyId);

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

  const setInAppRemindersEnabled = useCallback(async (enabled: boolean) => {
    setInAppRemindersEnabledState(enabled);
    await NotificationStorageService.setInAppReminderEnabled(enabled);
  }, []);

  /**
   * Checks if an in-app reminder should be shown
   * Used when push notifications are denied
   */
  const checkInAppReminder = useCallback(
    (babyId: string, lastFeedingTime: Date): boolean => {
      if (!inAppRemindersEnabled || !settings.feedingReminders.enabled) {
        return false;
      }

      // Calculate when reminder should trigger
      const reminderTime = calculateNextFeedingReminder(
        lastFeedingTime,
        settings.feedingReminders.intervalHours,
        settings
      );

      if (!reminderTime) {
        return false;
      }

      // Check if we're past the reminder time
      return new Date() >= reminderTime;
    },
    [inAppRemindersEnabled, settings]
  );

  const value: NotificationContextValue = {
    settings,
    permissionStatus,
    isLoading,
    inAppRemindersEnabled,
    updateSettings,
    requestPermissions,
    scheduleFeedingReminder,
    cancelFeedingReminder,
    checkTimerAlert,
    setInAppRemindersEnabled,
    checkInAppReminder,
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
