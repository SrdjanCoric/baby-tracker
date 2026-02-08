/**
 * Notification Scheduler Utilities
 * Handles scheduling logic for feeding reminders and timer alerts
 */

import type {
  NotificationSettings,
  QuietHoursSettings,
  TimerThresholds,
} from "@/types/notifications";

interface ParsedTime {
  hours: number;
  minutes: number;
}

/**
 * Parses a time string in "HH:mm" format
 */
export function parseTimeString(timeStr: string): ParsedTime | null {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const match = timeStr.match(timeRegex);

  if (!match) {
    return null;
  }

  return {
    hours: parseInt(match[1], 10),
    minutes: parseInt(match[2], 10),
  };
}

/**
 * Formats hours and minutes to "HH:mm" format
 */
export function formatTimeString(hours: number, minutes: number): string {
  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Converts time to minutes since midnight for comparison
 */
function timeToMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

/**
 * Checks if a given time is within quiet hours
 */
export function isInQuietHours(
  time: Date,
  quietHoursSettings: QuietHoursSettings
): boolean {
  if (!quietHoursSettings.enabled) {
    return false;
  }

  const start = parseTimeString(quietHoursSettings.startTime);
  const end = parseTimeString(quietHoursSettings.endTime);

  if (!start || !end) {
    return false;
  }

  const currentMinutes = timeToMinutes(time.getHours(), time.getMinutes());
  const startMinutes = timeToMinutes(start.hours, start.minutes);
  const endMinutes = timeToMinutes(end.hours, end.minutes);

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    // Quiet hours span midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    // Same day quiet hours (e.g., 13:00 - 15:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

/**
 * Gets the next end time for quiet hours
 */
function getNextQuietHoursEnd(
  fromTime: Date,
  quietHoursSettings: QuietHoursSettings
): Date {
  const end = parseTimeString(quietHoursSettings.endTime);
  if (!end) {
    return fromTime;
  }

  const result = new Date(fromTime);
  result.setHours(end.hours, end.minutes, 0, 0);

  // If end time is before current time, it's the next day
  if (result <= fromTime) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

/**
 * Delays a notification time to after quiet hours if needed
 */
export function getDelayedNotificationTime(
  originalTime: Date,
  quietHoursSettings: QuietHoursSettings
): Date {
  if (!quietHoursSettings.enabled) {
    return originalTime;
  }

  if (isInQuietHours(originalTime, quietHoursSettings)) {
    return getNextQuietHoursEnd(originalTime, quietHoursSettings);
  }

  return originalTime;
}

/**
 * Calculates the next feeding reminder time based on last feeding
 */
export function calculateNextFeedingReminder(
  lastFeedingTime: Date | null,
  intervalHours: number,
  settings: NotificationSettings
): Date | null {
  if (!lastFeedingTime) {
    return null;
  }

  const now = new Date();
  const reminderTime = new Date(lastFeedingTime.getTime() + intervalHours * 60 * 60 * 1000);

  // If reminder time is in the past, don't schedule
  if (reminderTime <= now) {
    return null;
  }

  // Apply quiet hours delay if needed
  return getDelayedNotificationTime(reminderTime, settings.quietHours);
}

/**
 * Maps activity types to timer threshold keys
 */
type TimerActivityToThresholdKey = {
  breastfeeding: "breastfeeding";
  pumping: "pumping";
  tummyTime: "tummyTime";
  nap: "nap";
  nightSleep: "nightSleep";
};

type TimerAlertActivityType = keyof TimerActivityToThresholdKey;

/**
 * Gets the alert threshold for a timer activity type
 */
export function getTimerAlertThreshold(
  activityType: TimerAlertActivityType,
  settings: NotificationSettings
): number {
  return settings.timerAlerts.thresholds[activityType];
}

/**
 * Determines if a timer alert should be sent
 */
export function shouldSendTimerAlert(
  activityType: keyof TimerThresholds,
  durationMinutes: number,
  settings: NotificationSettings
): boolean {
  if (!settings.timerAlerts.enabled) {
    return false;
  }

  if (isInQuietHours(new Date(), settings.quietHours)) {
    return false;
  }

  const threshold = settings.timerAlerts.thresholds[activityType];
  return durationMinutes >= threshold;
}
