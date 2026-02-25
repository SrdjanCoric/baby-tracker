import { useEffect, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useRouter } from "expo-router";
import { useFeeding } from "@/contexts/feeding-context";
import { useSleep } from "@/contexts/sleep-context";
import { usePumping } from "@/contexts/pumping-context";
import { useTummyTime } from "@/contexts/tummyTime-context";
import {
  readPendingWidgetStop,
  clearPendingWidgetStop,
  clearPendingWidgetPauseToggle,
} from "@/services/widget-data-service";

const ACTIVITY_ROUTE_MAP: Record<string, string> = {
  feeding: "/feeding",
  sleep: "/sleep",
  pumping: "/pumping",
  tummy_time: "/tummyTime",
};

export function useWidgetStopHandler() {
  const router = useRouter();
  const { activeTimer: feedingTimer, stopBreastfeeding } = useFeeding();
  const { activeTimer: sleepTimer, stopSleep } = useSleep();
  const { activeTimer: pumpingTimer, stopPumping } = usePumping();
  const { activeTimer: tummyTimeTimer, stopTummyTime } = useTummyTime();

  const processPendingStop = useCallback(async () => {
    const pending = await readPendingWidgetStop();
    if (!pending) return;

    const stoppedAtMs = new Date(pending.stoppedAt).getTime();

    const currentTimer = (() => {
      switch (pending.activityType) {
        case "feeding": return feedingTimer;
        case "sleep": return sleepTimer;
        case "pumping": return pumpingTimer;
        case "tummy_time": return tummyTimeTimer;
        default: return null;
      }
    })();

    if (currentTimer?.isRunning && currentTimer.startTime.getTime() > stoppedAtMs) {
      await clearPendingWidgetPauseToggle();
      await clearPendingWidgetStop();
      return;
    }

    const endTime = new Date(pending.stoppedAt);

    switch (pending.activityType) {
      case "feeding":
        await stopBreastfeeding(endTime);
        break;
      case "sleep":
        await stopSleep(endTime);
        break;
      case "pumping":
        await stopPumping(0, endTime);
        break;
      case "tummy_time":
        await stopTummyTime(endTime);
        break;
    }

    const route = ACTIVITY_ROUTE_MAP[pending.activityType];
    if (route) {
      router.push(route as never);
    }

    await clearPendingWidgetPauseToggle();
    await clearPendingWidgetStop();
  }, [router, feedingTimer, sleepTimer, pumpingTimer, tummyTimeTimer, stopBreastfeeding, stopSleep, stopPumping, stopTummyTime]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        processPendingStop();
      }
    });
    return () => sub.remove();
  }, [processPendingStop]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    processPendingStop();
  }, [processPendingStop]);
}
