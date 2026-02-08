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
import { AppState, AppStateStatus } from "react-native";
import type {
  NotificationSettings,
  PermissionStatus,
  TimerThresholds,
} from "@/types/notifications";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/constants/notifications";
import { NotificationService } from "@/services/notification-service";
import { NotificationStorageService } from "@/services/notification-storage";
import {
  savePushToken,
  saveDeviceToken,
  removePushToken,
  getActivityNotificationsEnabled,
  setActivityNotificationsEnabled as setActivityNotificationsEnabledService,
  upsertFeedingReminderPreference,
  upsertWakeWindowPreference,
} from "@/services/push-token-service";
import {
  calculateNextFeedingReminder,
  shouldSendTimerAlert,
} from "@/utils/notification-scheduler";
import { createSafeNotificationContent } from "@/utils/notification-sanitizer";
import { withRetryResult } from "@/utils/retry";

interface NotificationContextValue {
  settings: NotificationSettings;
  permissionStatus: PermissionStatus;
  isLoading: boolean;
  inAppRemindersEnabled: boolean;
  activityNotificationsEnabled: boolean;
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
  setActivityNotificationsEnabled: (enabled: boolean) => Promise<void>;
  registerPushTokenForUser: (userId: string | null) => Promise<void>;
  syncFeedingPreferenceForBaby: (babyId: string) => Promise<void>;
  syncWakeWindowPreferenceForBaby: (
    babyId: string,
    napCount: number,
    slots: { slotIndex: number; label: string; durationMinutes: number }[],
    source: string,
    enabled: boolean
  ) => Promise<void>;
  isUserAuthenticated: () => boolean;
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
  const [activityNotificationsEnabled, setActivityNotificationsEnabledState] = useState(false);

  // Track scheduled reminders for rescheduling
  const scheduledRemindersRef = useRef<Map<string, { babyId: string; lastFeedingTime: Date; babyName?: string }>>(new Map());
  const currentPushTokenRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        const status = await NotificationService.getPermissionStatus();
        if (status !== permissionStatus) {
          setPermissionStatus(status);

          if (status === "granted" && currentUserIdRef.current) {
            const token = await NotificationService.getExpoPushToken();
            if (token && token !== currentPushTokenRef.current) {
              currentPushTokenRef.current = token;
              await savePushToken(token);

              const deviceToken = await NotificationService.getDevicePushToken();
              if (deviceToken) {
                await saveDeviceToken(deviceToken);
              }
            }
          }
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [permissionStatus]);

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
        wakeWindowReminders: {
          ...settings.wakeWindowReminders,
          ...(partial.wakeWindowReminders || {}),
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
        for (const [_key, reminder] of scheduledRemindersRef.current.entries()) {
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

    if (granted && currentUserIdRef.current) {
      const token = await NotificationService.getExpoPushToken();
      if (token) {
        currentPushTokenRef.current = token;
        await savePushToken(token);

        const deviceToken = await NotificationService.getDevicePushToken();
        if (deviceToken) {
          await saveDeviceToken(deviceToken);
        }
      }
    }

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

  const setActivityNotificationsEnabled = useCallback(async (enabled: boolean) => {
    setActivityNotificationsEnabledState(enabled);
    const { error } = await setActivityNotificationsEnabledService(enabled);
    if (error) {
      console.error("Failed to update activity notifications setting:", error);
      setActivityNotificationsEnabledState(!enabled);
    }
  }, []);

  const registerPushTokenForUser = useCallback(async (userId: string | null) => {
    if (!userId) {
      if (currentPushTokenRef.current) {
        const tokenToRemove = currentPushTokenRef.current;
        currentPushTokenRef.current = null;

        const { error } = await withRetryResult(
          async () => {
            const result = await removePushToken(tokenToRemove);
            if (result.error) throw result.error;
            return result;
          },
          { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 2000 }
        );

        if (error) {
          console.warn("Failed to remove push token on logout:", error);
        }
      }
      currentUserIdRef.current = null;
      setActivityNotificationsEnabledState(false);
      return;
    }

    if (userId === currentUserIdRef.current) {
      return;
    }

    currentUserIdRef.current = userId;

    const activityEnabled = await getActivityNotificationsEnabled();
    setActivityNotificationsEnabledState(activityEnabled);

    const currentStatus = await NotificationService.getPermissionStatus();
    if (currentStatus !== "granted") {
      return;
    }

    const token = await NotificationService.getExpoPushToken();
    if (token) {
      currentPushTokenRef.current = token;
      const { error } = await savePushToken(token);
      if (error) {
        console.error("Failed to save push token:", error);
      }

      const deviceToken = await NotificationService.getDevicePushToken();
      if (deviceToken) {
        const { error: dtError } = await saveDeviceToken(deviceToken);
        if (dtError) {
          console.error("Failed to save device token:", dtError);
        }
      }
    }
  }, []);

  const syncFeedingPreferenceForBaby = useCallback(async (babyId: string) => {
    if (!currentUserIdRef.current || !babyId) return;

    const { error } = await upsertFeedingReminderPreference(
      babyId,
      settings.feedingReminders.enabled,
      settings.feedingReminders.intervalHours
    );
    if (error) {
      console.error("Failed to sync feeding reminder preference:", error);
    }
  }, [settings.feedingReminders]);

  const syncWakeWindowPreferenceForBaby = useCallback(async (
    babyId: string,
    napCount: number,
    slots: { slotIndex: number; label: string; durationMinutes: number }[],
    source: string,
    enabled: boolean
  ) => {
    if (!currentUserIdRef.current || !babyId) return;

    const { error } = await upsertWakeWindowPreference(
      babyId,
      enabled,
      napCount,
      slots,
      source
    );
    if (error) {
      console.error("Failed to sync wake window preference:", error);
    }
  }, []);

  const isUserAuthenticated = useCallback(() => {
    return currentUserIdRef.current !== null;
  }, []);

  const value: NotificationContextValue = {
    settings,
    permissionStatus,
    isLoading,
    inAppRemindersEnabled,
    activityNotificationsEnabled,
    updateSettings,
    requestPermissions,
    scheduleFeedingReminder,
    cancelFeedingReminder,
    checkTimerAlert,
    setInAppRemindersEnabled,
    checkInAppReminder,
    setActivityNotificationsEnabled,
    registerPushTokenForUser,
    syncFeedingPreferenceForBaby,
    syncWakeWindowPreferenceForBaby,
    isUserAuthenticated,
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
