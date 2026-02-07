import { useEffect, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useFeeding } from "@/contexts/feeding-context";
import { useSleep } from "@/contexts/sleep-context";
import { usePumping } from "@/contexts/pumping-context";
import { useTummyTime } from "@/contexts/tummyTime-context";
import {
  readPendingWidgetStop,
  clearPendingWidgetStop,
} from "@/services/widget-data-service";

export function useWidgetStopHandler() {
  const { stopBreastfeeding } = useFeeding();
  const { stopSleep } = useSleep();
  const { stopPumping } = usePumping();
  const { stopTummyTime } = useTummyTime();

  const processPendingStop = useCallback(async () => {
    const pending = await readPendingWidgetStop();
    if (!pending) return;

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

    await clearPendingWidgetStop();
  }, [stopBreastfeeding, stopSleep, stopPumping, stopTummyTime]);

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
