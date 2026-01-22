/**
 * Notification Integration Hook
 * Connects notification scheduling with activity contexts
 */

import { useCallback } from "react";
import { useNotifications } from "@/contexts/notification-context";
import { useFeeding } from "@/contexts/feeding-context";

export function useNotificationIntegration() {
  const { settings, scheduleFeedingReminder, cancelFeedingReminder } =
    useNotifications();
  const { getLastFeeding } = useFeeding();

  const scheduleReminderAfterFeeding = useCallback(async () => {
    if (!settings.feedingReminders.enabled) {
      return;
    }

    const lastFeeding = getLastFeeding();
    if (!lastFeeding) {
      return;
    }

    const feedingTime = new Date(lastFeeding.startedAt);
    await scheduleFeedingReminder(feedingTime);
  }, [settings.feedingReminders.enabled, getLastFeeding, scheduleFeedingReminder]);

  const cancelReminder = useCallback(async () => {
    await cancelFeedingReminder();
  }, [cancelFeedingReminder]);

  return {
    scheduleReminderAfterFeeding,
    cancelReminder,
    feedingRemindersEnabled: settings.feedingReminders.enabled,
  };
}
