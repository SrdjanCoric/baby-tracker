/**
 * Notification Integration Hook
 * Connects notification scheduling with activity contexts
 */

import { useCallback } from "react";
import { useNotifications } from "@/contexts/notification-context";
import { useFeeding } from "@/contexts/feeding-context";
import { useBaby } from "@/contexts/baby-context";

export function useNotificationIntegration() {
  const { settings, scheduleFeedingReminder, cancelFeedingReminder } =
    useNotifications();
  const { getLastFeeding } = useFeeding();
  const { selectedBaby } = useBaby();

  const scheduleReminderAfterFeeding = useCallback(async () => {
    if (!settings.feedingReminders.enabled || !selectedBaby) {
      return;
    }

    const lastFeeding = getLastFeeding();
    if (!lastFeeding) {
      return;
    }

    const feedingTime = new Date(lastFeeding.startedAt);
    await scheduleFeedingReminder(selectedBaby.id, feedingTime, selectedBaby.name);
  }, [settings.feedingReminders.enabled, selectedBaby, getLastFeeding, scheduleFeedingReminder]);

  const cancelReminder = useCallback(async () => {
    if (!selectedBaby) return;
    await cancelFeedingReminder(selectedBaby.id);
  }, [selectedBaby, cancelFeedingReminder]);

  return {
    scheduleReminderAfterFeeding,
    cancelReminder,
    feedingRemindersEnabled: settings.feedingReminders.enabled,
  };
}
