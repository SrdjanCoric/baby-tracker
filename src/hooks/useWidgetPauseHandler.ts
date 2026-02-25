import { useEffect, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useRouter } from "expo-router";
import { useFeeding } from "@/contexts/feeding-context";
import { useSleep } from "@/contexts/sleep-context";
import { usePumping } from "@/contexts/pumping-context";
import { useTummyTime } from "@/contexts/tummyTime-context";
import {
  readPendingWidgetPauseToggle,
  clearPendingWidgetPauseToggle,
} from "@/services/widget-data-service";

const ACTIVITY_ROUTE_MAP: Record<string, string> = {
  feeding: "/feeding",
  sleep: "/sleep",
  pumping: "/pumping",
  tummy_time: "/tummyTime",
};

export function useWidgetPauseHandler() {
  const router = useRouter();
  const { pauseBreastfeeding, resumeBreastfeeding } = useFeeding();
  const { pauseSleep, resumeSleep } = useSleep();
  const { pausePumping, resumePumping } = usePumping();
  const { pauseTummyTime, resumeTummyTime } = useTummyTime();

  const processPendingPauseToggle = useCallback(async () => {
    const pending = await readPendingWidgetPauseToggle();
    if (!pending) return;

    if (pending.action === "pause") {
      const pauseTime = pending.pausedAt ? new Date(pending.pausedAt) : undefined;
      switch (pending.activityType) {
        case "feeding":
          await pauseBreastfeeding(pauseTime);
          break;
        case "sleep":
          await pauseSleep(pauseTime);
          break;
        case "pumping":
          await pausePumping(pauseTime);
          break;
        case "tummy_time":
          await pauseTummyTime(pauseTime);
          break;
      }
    } else if (pending.action === "resume") {
      const resumeTime = pending.resumedAt ? new Date(pending.resumedAt) : undefined;
      const pauseDurationMs = pending.pauseDurationMs;
      switch (pending.activityType) {
        case "feeding":
          await resumeBreastfeeding(resumeTime, pauseDurationMs);
          break;
        case "sleep":
          await resumeSleep(resumeTime, pauseDurationMs);
          break;
        case "pumping":
          await resumePumping(resumeTime, pauseDurationMs);
          break;
        case "tummy_time":
          await resumeTummyTime(resumeTime, pauseDurationMs);
          break;
      }
    }

    const route = ACTIVITY_ROUTE_MAP[pending.activityType];
    if (route) {
      router.push(route as never);
    }

    await clearPendingWidgetPauseToggle();
  }, [router, pauseBreastfeeding, resumeBreastfeeding, pauseSleep, resumeSleep, pausePumping, resumePumping, pauseTummyTime, resumeTummyTime]);

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
