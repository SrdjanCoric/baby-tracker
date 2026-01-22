/**
 * Timer Alert Integration Hook
 * Handles checking and sending timer duration alerts
 */

import { useCallback, useRef, useState } from "react";
import { useNotifications } from "@/contexts/notification-context";
import { NotificationService } from "@/services/notification-service";
import type { TimerThresholds } from "@/types/notifications";

const ALERT_MESSAGES: Record<keyof TimerThresholds, { title: string; body: string }> = {
  breastfeeding: {
    title: "Breastfeeding Timer",
    body: "Still breastfeeding? Tap to stop the timer.",
  },
  pumping: {
    title: "Pumping Timer",
    body: "Still pumping? Tap to stop the timer.",
  },
  tummyTime: {
    title: "Tummy Time Timer",
    body: "Still doing tummy time? Tap to stop the timer.",
  },
  nap: {
    title: "Nap Timer",
    body: "Baby still napping? Tap to check.",
  },
  nightSleep: {
    title: "Sleep Timer",
    body: "Baby still sleeping? Tap to check.",
  },
};

export function useTimerAlertIntegration(activityType: keyof TimerThresholds) {
  const { settings, permissionStatus, checkTimerAlert } = useNotifications();
  const [alertSent, setAlertSent] = useState(false);
  const alertSentRef = useRef(false);

  const threshold = settings.timerAlerts.thresholds[activityType];
  const timerAlertsEnabled = settings.timerAlerts.enabled;

  const checkAndSendAlert = useCallback(
    async (durationMinutes: number): Promise<boolean> => {
      if (alertSentRef.current) {
        return false;
      }

      if (permissionStatus !== "granted") {
        return false;
      }

      const shouldSend = checkTimerAlert(activityType, durationMinutes);
      if (!shouldSend) {
        return false;
      }

      const message = ALERT_MESSAGES[activityType];

      try {
        await NotificationService.scheduleNotification(
          {
            title: message.title,
            body: message.body,
            data: {
              type: "timer_alert",
              activityType,
            },
          },
          new Date()
        );

        alertSentRef.current = true;
        setAlertSent(true);
        return true;
      } catch (error) {
        console.error("Failed to send timer alert:", error);
        return false;
      }
    },
    [activityType, checkTimerAlert, permissionStatus]
  );

  const resetAlert = useCallback(() => {
    alertSentRef.current = false;
    setAlertSent(false);
  }, []);

  return {
    alertSent,
    timerAlertsEnabled,
    threshold,
    checkAndSendAlert,
    resetAlert,
  };
}
