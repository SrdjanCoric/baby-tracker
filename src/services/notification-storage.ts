/**
 * Notification Storage Service
 * Handles persisting notification settings in AsyncStorage
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NotificationSettings } from "@/types/notifications";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/constants/notifications";

const NOTIFICATION_SETTINGS_KEY = "@notification_settings";
const FEEDING_REMINDER_ID_KEY = "@feeding_reminder_notification_id";

function isValidNotificationSettings(data: unknown): data is NotificationSettings {
  if (!data || typeof data !== "object") {
    return false;
  }

  const settings = data as Record<string, unknown>;

  if (!settings.feedingReminders || typeof settings.feedingReminders !== "object") {
    return false;
  }

  if (!settings.timerAlerts || typeof settings.timerAlerts !== "object") {
    return false;
  }

  if (!settings.quietHours || typeof settings.quietHours !== "object") {
    return false;
  }

  return true;
}

export const NotificationStorageService = {
  async getSettings(): Promise<NotificationSettings> {
    const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (isValidNotificationSettings(parsed)) {
          return {
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...parsed,
            feedingReminders: {
              ...DEFAULT_NOTIFICATION_SETTINGS.feedingReminders,
              ...parsed.feedingReminders,
            },
            timerAlerts: {
              ...DEFAULT_NOTIFICATION_SETTINGS.timerAlerts,
              ...parsed.timerAlerts,
              thresholds: {
                ...DEFAULT_NOTIFICATION_SETTINGS.timerAlerts.thresholds,
                ...parsed.timerAlerts.thresholds,
              },
            },
            quietHours: {
              ...DEFAULT_NOTIFICATION_SETTINGS.quietHours,
              ...parsed.quietHours,
            },
          };
        }
      } catch {
        // Invalid JSON, return defaults
      }
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
  },

  async saveSettings(settings: NotificationSettings): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  },

  async clearSettings(): Promise<void> {
    await AsyncStorage.removeItem(NOTIFICATION_SETTINGS_KEY);
  },

  async getFeedingReminderNotificationId(): Promise<string | null> {
    return await AsyncStorage.getItem(FEEDING_REMINDER_ID_KEY);
  },

  async saveFeedingReminderNotificationId(notificationId: string): Promise<void> {
    await AsyncStorage.setItem(FEEDING_REMINDER_ID_KEY, notificationId);
  },

  async clearFeedingReminderNotificationId(): Promise<void> {
    await AsyncStorage.removeItem(FEEDING_REMINDER_ID_KEY);
  },
};
