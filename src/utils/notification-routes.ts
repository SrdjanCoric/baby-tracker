/**
 * Notification Route Utilities
 * Pure functions for notification routing - no React Native dependencies
 */

import type { NotificationData } from "@/types/notifications";

/**
 * Route mapping for notification navigation
 */
const ACTIVITY_ROUTES: Record<string, string> = {
  feeding: "/(tabs)/feeding",
  sleep: "/(tabs)/sleep",
  pumping: "/(tabs)/pumping",
  tummyTime: "/(tabs)/tummyTime",
  diaper: "/(tabs)/diaper",
};

/**
 * Gets the navigation route for a notification
 */
export function getNavigationRoute(data: NotificationData): string {
  if (data.type === "feeding_reminder") {
    return "/(tabs)/feeding";
  }

  if (data.type === "timer_alert" && data.activityType) {
    return ACTIVITY_ROUTES[data.activityType] || "/(tabs)";
  }

  return "/(tabs)";
}
