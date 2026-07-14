import { useEffect, useCallback, useRef } from "react";
import { Platform, AppState } from "react-native";
import { useRouter } from "expo-router";
import { useFeeding } from "@/contexts/feeding-context";
import { useSleep } from "@/contexts/sleep-context";
import { usePumping } from "@/contexts/pumping-context";
import { useTummyTime } from "@/contexts/tummyTime-context";
import { useBaby } from "@/contexts/baby-context";
import {
  readPendingWidgetStop,
  clearPendingWidgetStop,
  clearPendingWidgetPauseToggle,
} from "@/services/widget-data-service";
import { processPendingTimerStop } from "@/services/timer-stop-coordinator";

const ACTIVITY_ROUTE_MAP: Record<string, string> = {
  feeding: "/feeding",
  sleep: "/sleep",
  pumping: "/pumping",
  tummy_time: "/tummyTime",
};

export function useWidgetStopHandler() {
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { activeTimer: feedingTimer, stopBreastfeeding } = useFeeding();
  const { activeTimer: sleepTimer, stopSleep } = useSleep();
  const { activeTimer: pumpingTimer, stopPumping } = usePumping();
  const { activeTimer: tummyTimeTimer, stopTummyTime } = useTummyTime();
  const isProcessingRef = useRef(false);
  const shouldReprocessRef = useRef(false);
  const processPendingStopRef = useRef<() => Promise<void>>(async () => {});

  const processPendingStop = useCallback(async () => {
    if (isProcessingRef.current) {
      shouldReprocessRef.current = true;
      return;
    }
    isProcessingRef.current = true;

    try {
      const pending = await readPendingWidgetStop();
      if (!pending) return;

      let result: "waiting" | "consumed" | "stale";
      switch (pending.activityType) {
        case "feeding":
          result = await processPendingTimerStop(
            pending,
            feedingTimer,
            stopBreastfeeding,
            selectedBaby?.id
          );
          break;
        case "sleep":
          result = await processPendingTimerStop(
            pending,
            sleepTimer,
            stopSleep,
            selectedBaby?.id
          );
          break;
        case "pumping":
          result = await processPendingTimerStop(
            pending,
            pumpingTimer,
            (endTime) => stopPumping(0, endTime),
            selectedBaby?.id
          );
          break;
        case "tummy_time":
          result = await processPendingTimerStop(
            pending,
            tummyTimeTimer,
            stopTummyTime,
            selectedBaby?.id
          );
          break;
        default:
          await clearPendingWidgetStop(pending);
          return;
      }

      if (result === "waiting") return;

      if (result === "consumed") {
        await clearPendingWidgetPauseToggle();
      }
      await clearPendingWidgetStop(pending);

      if (result === "consumed") {
        const route = ACTIVITY_ROUTE_MAP[pending.activityType];
        if (route) {
          router.push(route as never);
        }
      }
    } catch (error) {
      console.error("[WidgetStopHandler] Failed to process pending stop:", error);
    } finally {
      isProcessingRef.current = false;
      if (shouldReprocessRef.current) {
        shouldReprocessRef.current = false;
        void processPendingStopRef.current();
      }
    }
  }, [
    router,
    selectedBaby?.id,
    feedingTimer,
    sleepTimer,
    pumpingTimer,
    tummyTimeTimer,
    stopBreastfeeding,
    stopSleep,
    stopPumping,
    stopTummyTime,
  ]);
  processPendingStopRef.current = processPendingStop;

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
