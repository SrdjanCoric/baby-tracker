import { useEffect, useRef, useCallback } from "react";
import { useFeeding, useSleep, usePumping, useTummyTime } from "@/contexts";
import { useNotifications } from "@/contexts/notification-context";
import { getTimerAlertMessage } from "@/constants/notifications";
import { NotificationService } from "@/services/notification-service";
import type { TimerThresholds } from "@/types/notifications";

export function useGlobalTimerAlerts() {
  const { activeTimer: feedingTimer } = useFeeding();
  const { activeTimer: sleepTimer } = useSleep();
  const { activeTimer: pumpingTimer } = usePumping();
  const { activeTimer: tummyTimeTimer } = useTummyTime();
  const { settings, permissionStatus, checkTimerAlert } = useNotifications();

  const alertsSentRef = useRef<Set<string>>(new Set());

  const sendAlert = useCallback(async (activityType: keyof TimerThresholds) => {
    const key = activityType;
    if (alertsSentRef.current.has(key)) return;

    const message = getTimerAlertMessage(activityType);
    try {
      const notificationId = await NotificationService.scheduleNotification(
        {
          title: message.title,
          body: message.body,
          data: { type: "timer_alert", activityType },
        },
        new Date(Date.now() + 1000)
      );
      if (notificationId) {
        alertsSentRef.current.add(key);
      }
    } catch (error) {
      console.error("Failed to send timer alert:", error);
    }
  }, []);

  const anyTimerRunning =
    feedingTimer?.isRunning ||
    sleepTimer?.isRunning ||
    pumpingTimer?.isRunning ||
    tummyTimeTimer?.isRunning;

  useEffect(() => {
    if (!anyTimerRunning || permissionStatus !== "granted" || !settings.timerAlerts.enabled) {
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();

      if (feedingTimer?.isRunning) {
        const mins = Math.floor((now.getTime() - feedingTimer.startTime.getTime()) / 60000);
        if (checkTimerAlert("breastfeeding", mins)) {
          sendAlert("breastfeeding");
        }
      }

      if (sleepTimer?.isRunning) {
        const mins = Math.floor((now.getTime() - sleepTimer.startTime.getTime()) / 60000);
        const type = sleepTimer.sleepType === "night" ? "nightSleep" : "nap";
        if (checkTimerAlert(type, mins)) {
          sendAlert(type);
        }
      }

      if (pumpingTimer?.isRunning) {
        const mins = Math.floor((now.getTime() - pumpingTimer.startTime.getTime()) / 60000);
        if (checkTimerAlert("pumping", mins)) {
          sendAlert("pumping");
        }
      }

      if (tummyTimeTimer?.isRunning) {
        const mins = Math.floor((now.getTime() - tummyTimeTimer.startTime.getTime()) / 60000);
        if (checkTimerAlert("tummyTime", mins)) {
          sendAlert("tummyTime");
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [
    anyTimerRunning,
    permissionStatus,
    settings.timerAlerts.enabled,
    feedingTimer?.isRunning,
    feedingTimer?.startTime,
    sleepTimer?.isRunning,
    sleepTimer?.startTime,
    sleepTimer?.sleepType,
    pumpingTimer?.isRunning,
    pumpingTimer?.startTime,
    tummyTimeTimer?.isRunning,
    tummyTimeTimer?.startTime,
    checkTimerAlert,
    sendAlert,
  ]);

  // Reset sent alerts when timers stop
  useEffect(() => {
    if (!feedingTimer?.isRunning) alertsSentRef.current.delete("breastfeeding");
    if (!sleepTimer?.isRunning) {
      alertsSentRef.current.delete("nap");
      alertsSentRef.current.delete("nightSleep");
    }
    if (!pumpingTimer?.isRunning) alertsSentRef.current.delete("pumping");
    if (!tummyTimeTimer?.isRunning) alertsSentRef.current.delete("tummyTime");
  }, [
    feedingTimer?.isRunning,
    sleepTimer?.isRunning,
    pumpingTimer?.isRunning,
    tummyTimeTimer?.isRunning,
  ]);
}
