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
   * Schedules a local notification
   * @returns The notification identifier
   */
  async scheduleNotification(
    content: NotificationContent,
    triggerTime: Date
  ): Promise<string> {
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
