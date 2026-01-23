/**
 * Notification type definitions
 * Types for push notifications, reminders, and timer alerts
 */

import type { TimerActivityType } from "@/constants/activities";

export type NotificationType = "feeding_reminder" | "timer_alert";

export interface NotificationSettings {
  feedingReminders: FeedingReminderSettings;
  timerAlerts: TimerAlertSettings;
  quietHours: QuietHoursSettings;
  privacy: NotificationPrivacySettings;
}

export interface NotificationPrivacySettings {
  showBabyName: boolean; // Whether to include baby name in notifications
  showActivityDetails: boolean; // Whether to show detailed activity info
}

export interface FeedingReminderSettings {
  enabled: boolean;
  intervalHours: number;
}

export interface TimerAlertSettings {
  enabled: boolean;
  thresholds: TimerThresholds;
}

export interface TimerThresholds {
  breastfeeding: number; // minutes
  pumping: number;
  tummyTime: number;
  nap: number;
  nightSleep: number;
}

export interface QuietHoursSettings {
  enabled: boolean;
  startTime: string; // "HH:mm" format
  endTime: string; // "HH:mm" format
}

export interface ScheduledNotification {
  id: string;
  type: NotificationType;
  scheduledTime: Date;
  activityType?: TimerActivityType;
  babyId?: string;
}

export interface NotificationContent {
  title: string;
  body: string;
  data?: NotificationData;
}

export interface NotificationData {
  type: NotificationType;
  activityType?: string;
  babyId?: string;
  route?: string;
  [key: string]: unknown;
}

export type PermissionStatus = "granted" | "denied" | "undetermined";

/**
 * In-app reminder settings (used when push notifications are denied)
 */
export interface InAppReminderSettings {
  enabled: boolean;
  lastReminderTime?: string; // ISO timestamp
}
