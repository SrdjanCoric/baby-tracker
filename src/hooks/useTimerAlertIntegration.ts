/**
 * Timer Alert Integration Hook
 * Handles checking and sending timer duration alerts
 */

import { useCallback, useRef, useState } from "react";
import { useNotifications } from "@/contexts/notification-context";
import { getTimerAlertMessage } from "@/constants/notifications";
import { NotificationService } from "@/services/notification-service";
import type { TimerThresholds } from "@/types/notifications";

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

      if (!timerAlertsEnabled) {
        return false;
      }

      const shouldSend = checkTimerAlert(activityType, durationMinutes);
      if (!shouldSend) {
        return false;
      }
      const message = getTimerAlertMessage(activityType);

      try {
        const notificationId = await NotificationService.scheduleNotification(
          {
            title: message.title,
            body: message.body,
            data: {
              type: "timer_alert",
              activityType,
            },
          },
          new Date(Date.now() + 1000)
        );

        if (notificationId) {
          alertSentRef.current = true;
          setAlertSent(true);
          return true;
        }

        return false;
      } catch (error) {
        console.error("Failed to send timer alert:", error);
        return false;
      }
    },
    [activityType, checkTimerAlert, permissionStatus, timerAlertsEnabled]
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
