/**
 * Notification Service
 * Handles push notifications using expo-notifications
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type {
  NotificationContent,
  PermissionStatus,
} from "@/types/notifications";
import { NOTIFICATION_CHANNELS } from "@/constants/notifications";
import { getNavigationRoute } from "@/utils/notification-routes";

const IOS_NOTIFICATION_LIMIT = 64;

export const NotificationService = {
  /**
   * Sets up the notification handler for foreground notifications
   */
  setupNotificationHandler(): void {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  },

  /**
   * Sets up Android notification channels
   */
  async setupAndroidChannels(): Promise<void> {
    if (Platform.OS !== "android") {
      return;
    }

    await Notifications.setNotificationChannelAsync(
      NOTIFICATION_CHANNELS.FEEDING_REMINDERS,
      {
        name: "Feeding Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#14b8a6",
        description: "Reminders for feeding times",
      }
    );

    await Notifications.setNotificationChannelAsync(
      NOTIFICATION_CHANNELS.TIMER_ALERTS,
      {
        name: "Timer Alerts",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#14b8a6",
        description: "Alerts when timers exceed thresholds",
      }
    );
  },

  /**
   * Gets current notification permission status
   */
  async getPermissionStatus(): Promise<PermissionStatus> {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionStatus;
  },

  /**
   * Requests notification permissions
   * @returns true if granted, false otherwise
   */
  async requestPermissions(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  },

  /**
   * Gets the count of currently scheduled notifications
   */
  async getScheduledNotificationCount(): Promise<number> {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications.length;
  },

  /**
   * Checks if we can schedule another notification
   * iOS has a limit of 64 scheduled notifications
   */
  async canScheduleNotification(): Promise<boolean> {
    if (Platform.OS !== "ios") {
      return true;
    }

    const count = await this.getScheduledNotificationCount();
    return count < IOS_NOTIFICATION_LIMIT;
  },

  /**
   * Schedules a local notification
   * @returns The notification identifier, or null if limit reached
   */
  async scheduleNotification(
    content: NotificationContent,
    triggerTime: Date
  ): Promise<string | null> {
    const canSchedule = await this.canScheduleNotification();
    if (!canSchedule) {
      console.warn(
        `iOS notification limit (${IOS_NOTIFICATION_LIMIT}) reached, cannot schedule new notification`
      );
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: content.data,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerTime,
      },
    });

    return notificationId;
  },

  /**
   * Cancels a scheduled notification by ID
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  },

  /**
   * Cancels all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  /**
   * Gets all currently scheduled notifications
   */
  async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  },

  /**
   * Gets the navigation route for a notification
   */
  getNavigationRoute,
};
