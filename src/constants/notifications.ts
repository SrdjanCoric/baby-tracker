/**
 * Notification constants and defaults
 * Central source of truth for notification-related configuration
 */

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
      breastfeeding: 60, // minutes
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
    showBabyName: false, // Default to not showing baby name for privacy
    showActivityDetails: true,
  },
};

/**
 * Available feeding reminder intervals in hours
 */
export const FEEDING_REMINDER_INTERVALS = [2, 2.5, 3, 3.5, 4] as const;

export type FeedingReminderInterval = (typeof FEEDING_REMINDER_INTERVALS)[number];

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

/**
 * Timer alert messages by activity type
 */
export const TIMER_ALERT_MESSAGES: Record<keyof TimerThresholds, { title: string; body: string }> = {
  breastfeeding: {
    title: "Feeding Timer",
    body: "Still breastfeeding? Tap to stop timer",
  },
  pumping: {
    title: "Pumping Timer",
    body: "Still pumping? Tap to stop timer",
  },
  tummyTime: {
    title: "Tummy Time",
    body: "Still doing tummy time? Tap to stop timer",
  },
  nap: {
    title: "Nap Timer",
    body: "Baby still napping? Tap to stop timer",
  },
  nightSleep: {
    title: "Sleep Timer",
    body: "Baby still sleeping? Tap to check",
  },
};

/**
 * Default feeding reminder message
 */
export const FEEDING_REMINDER_MESSAGE = {
  title: "Feeding Reminder",
  body: "Time to feed your baby",
};

/**
 * Validates that a value is a valid feeding reminder interval
 */
export function isValidFeedingInterval(value: number): value is FeedingReminderInterval {
  return FEEDING_REMINDER_INTERVALS.includes(value as FeedingReminderInterval);
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
