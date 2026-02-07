import { useCallback } from "react";
import { useNotifications } from "@/contexts/notification-context";
import { useBaby } from "@/contexts/baby-context";

export function useNotificationIntegration() {
  const { settings, scheduleFeedingReminder, cancelFeedingReminder } =
    useNotifications();
  const { selectedBaby } = useBaby();

  const scheduleReminderAfterFeeding = useCallback(async (feedingTime: Date) => {
    if (!settings.feedingReminders.enabled || !selectedBaby) {
      return;
    }

    await scheduleFeedingReminder(selectedBaby.id, feedingTime, selectedBaby.name);
  }, [settings.feedingReminders.enabled, selectedBaby, scheduleFeedingReminder]);

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
