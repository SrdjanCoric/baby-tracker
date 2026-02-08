/**
 * Notification Storage Service
 * Handles persisting notification settings in AsyncStorage
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NotificationSettings } from "@/types/notifications";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/constants/notifications";

const NOTIFICATION_SETTINGS_KEY = "@notification_settings";
const FEEDING_REMINDER_ID_PREFIX = "@feeding_reminder_notification_id_";
const IN_APP_REMINDER_KEY = "@in_app_reminder_settings";

function getFeedingReminderKey(babyId: string): string {
  return `${FEEDING_REMINDER_ID_PREFIX}${babyId}`;
}

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

  // Privacy settings are optional for backwards compatibility
  // They will be merged with defaults if missing

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
            privacy: {
              ...DEFAULT_NOTIFICATION_SETTINGS.privacy,
              ...(parsed.privacy || {}),
            },
            wakeWindowReminders: {
              ...DEFAULT_NOTIFICATION_SETTINGS.wakeWindowReminders,
              ...(parsed.wakeWindowReminders || {}),
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

  async getFeedingReminderNotificationId(babyId: string): Promise<string | null> {
    if (!babyId) return null;
    return await AsyncStorage.getItem(getFeedingReminderKey(babyId));
  },

  async saveFeedingReminderNotificationId(babyId: string, notificationId: string): Promise<void> {
    if (!babyId) return;
    await AsyncStorage.setItem(getFeedingReminderKey(babyId), notificationId);
  },

  async clearFeedingReminderNotificationId(babyId: string): Promise<void> {
    if (!babyId) return;
    await AsyncStorage.removeItem(getFeedingReminderKey(babyId));
  },

  async clearAllFeedingReminderNotificationIds(): Promise<void> {
    const allKeys = await AsyncStorage.getAllKeys();
    const feedingReminderKeys = allKeys.filter((key) =>
      key.startsWith(FEEDING_REMINDER_ID_PREFIX)
    );
    if (feedingReminderKeys.length > 0) {
      await AsyncStorage.multiRemove(feedingReminderKeys);
    }
  },

  /**
   * Gets in-app reminder settings (for when push notifications are denied)
   */
  async getInAppReminderEnabled(): Promise<boolean> {
    const stored = await AsyncStorage.getItem(IN_APP_REMINDER_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.enabled === true;
      } catch {
        return false;
      }
    }
    return false;
  },

  /**
   * Sets in-app reminder enabled status
   */
  async setInAppReminderEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(IN_APP_REMINDER_KEY, JSON.stringify({ enabled }));
  },

  /**
   * Gets the last in-app reminder time for a baby
   */
  async getLastInAppReminderTime(babyId: string): Promise<Date | null> {
    const key = `@in_app_reminder_last_${babyId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      try {
        return new Date(stored);
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * Sets the last in-app reminder time for a baby
   */
  async setLastInAppReminderTime(babyId: string, time: Date): Promise<void> {
    const key = `@in_app_reminder_last_${babyId}`;
    await AsyncStorage.setItem(key, time.toISOString());
  },
};
