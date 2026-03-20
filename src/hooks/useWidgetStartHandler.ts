import { useEffect, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useRouter } from "expo-router";
import { useFeeding } from "@/contexts/feeding-context";
import { useSleep } from "@/contexts/sleep-context";
import { usePumping } from "@/contexts/pumping-context";
import { useTummyTime } from "@/contexts/tummyTime-context";
import {
  readPendingWidgetStart,
  clearPendingWidgetStart,
} from "@/services/widget-data-service";
import type { BreastSide } from "@/constants/activities";
import { determineSleepType } from "@/validators/sleep";

const ACTIVITY_ROUTE_MAP: Record<string, string> = {
  feeding: "/feeding",
  sleep: "/sleep",
  pumping: "/pumping",
  tummy_time: "/tummyTime",
  diaper: "/diaper",
};

export function useWidgetStartHandler() {
  const router = useRouter();
  const { startBreastfeeding } = useFeeding();
  const { startSleep } = useSleep();
  const { startPumping } = usePumping();
  const { startTummyTime } = useTummyTime();

  const processPendingStart = useCallback(async () => {
    const pending = await readPendingWidgetStart();
    if (!pending) return;

    const requestedAt = new Date(pending.requestedAt).getTime();
    const now = Date.now();
    if (now - requestedAt > 60_000) {
      await clearPendingWidgetStart();
      return;
    }

    const requestedTime = new Date(pending.requestedAt);

    switch (pending.activityType) {
      case "feeding": {
        const side = (pending.side as BreastSide) || "left";
        await startBreastfeeding(side, requestedTime);
        break;
      }
      case "sleep": {
        await startSleep(determineSleepType(requestedTime), requestedTime);
        break;
      }
      case "pumping": {
        const side = (pending.side as BreastSide) || "left";
        await startPumping(side, requestedTime);
        break;
      }
      case "tummy_time": {
        await startTummyTime(requestedTime);
        break;
      }
    }

    const route = ACTIVITY_ROUTE_MAP[pending.activityType];
    if (route) {
      router.push(route as never);
    }

    await clearPendingWidgetStart();
  }, [router, startBreastfeeding, startSleep, startPumping, startTummyTime]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        processPendingStart();
      }
    });
    return () => sub.remove();
  }, [processPendingStart]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    processPendingStart();
  }, [processPendingStart]);
}
