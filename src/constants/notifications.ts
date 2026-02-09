/**
 * Notification constants and defaults
 * Central source of truth for notification-related configuration
 */

import i18n from "@/i18n";
import type {
  NotificationSettings,
  TimerThresholds,
} from "@/types/notifications";

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  feedingReminders: {
    enabled: false,
    intervalHours: 3,
  },
  timerAlerts: {
    enabled: true,
    thresholds: {
      breastfeeding: 60,
      pumping: 45,
      tummyTime: 30,
      nap: 180, // 3 hours
      nightSleep: 720, // 12 hours
    },
  },
  quietHours: {
    enabled: false,
    startTime: "22:00",
    endTime: "07:00",
  },
  privacy: {
    showBabyName: false,
    showActivityDetails: true,
  },
  wakeWindowReminders: {
    enabled: false,
  },
};

/**
 * Available feeding reminder intervals in hours
 */
const PROD_INTERVALS = [2, 2.5, 3, 3.5, 4] as const;
const DEV_INTERVALS = [1 / 60, ...PROD_INTERVALS] as const;

export const FEEDING_REMINDER_INTERVALS = __DEV__ ? DEV_INTERVALS : PROD_INTERVALS;

export type FeedingReminderInterval = (typeof PROD_INTERVALS)[number] | (typeof DEV_INTERVALS)[number];

/**
 * Android notification channel IDs
 */
export const NOTIFICATION_CHANNELS = {
  FEEDING_REMINDERS: "feeding-reminders",
  TIMER_ALERTS: "timer-alerts",
  HOUSEHOLD_ACTIVITY: "household-activity",
} as const;

/**
 * Notification storage keys
 */
export const NOTIFICATION_STORAGE_KEYS = {
  SETTINGS: "@notification_settings",
  SCHEDULED: "@scheduled_notifications",
  LAST_FEEDING_REMINDER: "@last_feeding_reminder",
} as const;

const TIMER_ALERT_KEYS: Record<keyof TimerThresholds, { titleKey: string; bodyKey: string }> = {
  breastfeeding: {
    titleKey: "notificationMessages.feedingTimerTitle",
    bodyKey: "notificationMessages.feedingTimerBody",
  },
  pumping: {
    titleKey: "notificationMessages.pumpingTimerTitle",
    bodyKey: "notificationMessages.pumpingTimerBody",
  },
  tummyTime: {
    titleKey: "notificationMessages.tummyTimeTimerTitle",
    bodyKey: "notificationMessages.tummyTimeTimerBody",
  },
  nap: {
    titleKey: "notificationMessages.napTimerTitle",
    bodyKey: "notificationMessages.napTimerBody",
  },
  nightSleep: {
    titleKey: "notificationMessages.nightSleepTimerTitle",
    bodyKey: "notificationMessages.nightSleepTimerBody",
  },
};

export function getTimerAlertMessage(activityType: keyof TimerThresholds): { title: string; body: string } {
  const keys = TIMER_ALERT_KEYS[activityType];
  return {
    title: i18n.t(keys.titleKey as never),
    body: i18n.t(keys.bodyKey as never),
  };
}

export function getFeedingReminderMessage(): { title: string; body: string } {
  return {
    title: i18n.t("notificationMessages.feedingReminderTitle"),
    body: i18n.t("notificationMessages.feedingReminderBody"),
  };
}

export function getWakeWindowReminderMessage(
  slotLabel: string
): { title: string; body: string } {
  const isBedtime = slotLabel === "bedtime";
  return {
    title: i18n.t(
      isBedtime
        ? "notificationMessages.wakeWindowBedtimeTitle"
        : "notificationMessages.wakeWindowNapTitle"
    ),
    body: i18n.t(
      isBedtime
        ? "notificationMessages.wakeWindowBedtimeBody"
        : "notificationMessages.wakeWindowNapBody"
    ),
  };
}

/**
 * Validates that a value is a valid feeding reminder interval
 */
export function isValidFeedingInterval(value: number): value is FeedingReminderInterval {
  return (FEEDING_REMINDER_INTERVALS as readonly number[]).includes(value);
}

/**
 * Validates time format "HH:mm"
 */
export function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * Gets the default threshold for a timer activity type
 */
export function getDefaultThreshold(activityType: keyof TimerThresholds): number {
  return DEFAULT_NOTIFICATION_SETTINGS.timerAlerts.thresholds[activityType];
}
