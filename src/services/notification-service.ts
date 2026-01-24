/**
 * Notification Service
 * Handles push notifications using expo-notifications
 */

import { Platform } from "react-native";
import type {
  NotificationContent,
  PermissionStatus,
} from "@/types/notifications";
import { NOTIFICATION_CHANNELS } from "@/constants/notifications";
import { getNavigationRoute } from "@/utils/notification-routes";

// Dynamic import - expo-notifications not available in Expo Go (SDK 53+)
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
} catch {
  console.log("[Notifications] Module not available (Expo Go)");
}

const IOS_NOTIFICATION_LIMIT = 64;

type NotificationRequest = {
  identifier: string;
  content: { title: string | null; body: string | null; data: Record<string, unknown> };
  trigger: unknown;
};

export const NotificationService = {
  isAvailable(): boolean {
    return Notifications !== null;
  },

  setupNotificationHandler(): void {
    if (!Notifications) return;
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

  async setupAndroidChannels(): Promise<void> {
    if (!Notifications || Platform.OS !== "android") return;

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

  async getPermissionStatus(): Promise<PermissionStatus> {
    if (!Notifications) return "undetermined";
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionStatus;
  },

  async requestPermissions(): Promise<boolean> {
    if (!Notifications) return false;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  },

  async getScheduledNotificationCount(): Promise<number> {
    if (!Notifications) return 0;
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications.length;
  },

  async canScheduleNotification(): Promise<boolean> {
    if (!Notifications) return false;
    if (Platform.OS !== "ios") return true;
    const count = await this.getScheduledNotificationCount();
    return count < IOS_NOTIFICATION_LIMIT;
  },

  async scheduleNotification(
    content: NotificationContent,
    triggerTime: Date
  ): Promise<string | null> {
    if (!Notifications) return null;
    const canSchedule = await this.canScheduleNotification();
    if (!canSchedule) {
      console.warn(`iOS notification limit (${IOS_NOTIFICATION_LIMIT}) reached`);
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

  async cancelNotification(notificationId: string): Promise<void> {
    if (!Notifications) return;
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  },

  async cancelAllNotifications(): Promise<void> {
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async getAllScheduledNotifications(): Promise<NotificationRequest[]> {
    if (!Notifications) return [];
    return await Notifications.getAllScheduledNotificationsAsync();
  },

  getNavigationRoute,
};
