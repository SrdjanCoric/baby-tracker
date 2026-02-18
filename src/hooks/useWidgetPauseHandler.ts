import { useEffect, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useFeeding } from "@/contexts/feeding-context";
import { useSleep } from "@/contexts/sleep-context";
import { usePumping } from "@/contexts/pumping-context";
import { useTummyTime } from "@/contexts/tummyTime-context";
import {
  readPendingWidgetPauseToggle,
  clearPendingWidgetPauseToggle,
} from "@/services/widget-data-service";

export function useWidgetPauseHandler() {
  const { pauseBreastfeeding, resumeBreastfeeding } = useFeeding();
  const { pauseSleep, resumeSleep } = useSleep();
  const { pausePumping, resumePumping } = usePumping();
  const { pauseTummyTime, resumeTummyTime } = useTummyTime();

  const processPendingPauseToggle = useCallback(async () => {
    const pending = await readPendingWidgetPauseToggle();
    if (!pending) return;

    if (pending.action === "pause") {
      switch (pending.activityType) {
        case "feeding":
          await pauseBreastfeeding();
          break;
        case "sleep":
          await pauseSleep();
          break;
        case "pumping":
          await pausePumping();
          break;
        case "tummy_time":
          await pauseTummyTime();
          break;
      }
    } else if (pending.action === "resume") {
      switch (pending.activityType) {
        case "feeding":
          await resumeBreastfeeding();
          break;
        case "sleep":
          await resumeSleep();
          break;
        case "pumping":
          await resumePumping();
          break;
        case "tummy_time":
          await resumeTummyTime();
          break;
      }
    }

    await clearPendingWidgetPauseToggle();
  }, [pauseBreastfeeding, resumeBreastfeeding, pauseSleep, resumeSleep, pausePumping, resumePumping, pauseTummyTime, resumeTummyTime]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        processPendingPauseToggle();
      }
    });
    return () => sub.remove();
  }, [processPendingPauseToggle]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    processPendingPauseToggle();
  }, [processPendingPauseToggle]);
}
