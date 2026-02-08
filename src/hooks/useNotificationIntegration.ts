import { useCallback, useEffect, useRef } from "react";
import { useNotifications } from "@/contexts/notification-context";
import { useBaby } from "@/contexts/baby-context";

export function useNotificationIntegration() {
  const {
    settings,
    scheduleFeedingReminder,
    cancelFeedingReminder,
    syncFeedingPreferenceForBaby,
    isUserAuthenticated,
  } = useNotifications();
  const { selectedBaby } = useBaby();

  const prevSettingsRef = useRef(settings.feedingReminders);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!selectedBaby || !isUserAuthenticated()) return;

    const prev = prevSettingsRef.current;
    const curr = settings.feedingReminders;

    const settingsChanged =
      prev.enabled !== curr.enabled || prev.intervalHours !== curr.intervalHours;

    prevSettingsRef.current = curr;

    if (settingsChanged) {
      syncFeedingPreferenceForBaby(selectedBaby.id);
      hasSyncedRef.current = true;
    }
  }, [settings.feedingReminders, selectedBaby, isUserAuthenticated, syncFeedingPreferenceForBaby]);

  useEffect(() => {
    if (!selectedBaby || !isUserAuthenticated()) return;
    if (hasSyncedRef.current) return;
    syncFeedingPreferenceForBaby(selectedBaby.id);
    hasSyncedRef.current = true;
  }, [selectedBaby, isUserAuthenticated, syncFeedingPreferenceForBaby]);

  const scheduleReminderAfterFeeding = useCallback(async (feedingTime: Date) => {
    if (!settings.feedingReminders.enabled || !selectedBaby) return;

    if (isUserAuthenticated()) return;

    await scheduleFeedingReminder(selectedBaby.id, feedingTime, selectedBaby.name);
  }, [settings.feedingReminders.enabled, selectedBaby, scheduleFeedingReminder, isUserAuthenticated]);

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
