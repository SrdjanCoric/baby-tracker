import { useEffect, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useFeeding } from "@/contexts/feeding-context";
import { useBaby } from "@/contexts/baby-context";
import { readPendingBottleLog, clearPendingBottleLog } from "@/services/widget-data-service";
import type { BottleContentType } from "@/constants/activities";

export function useWidgetBottleFeedingHandler() {
  const { addFeeding } = useFeeding();
  const { selectedBaby } = useBaby();

  const processPendingLog = useCallback(async () => {
    const pending = await readPendingBottleLog();
    if (!pending) return;

    const requestedAt = new Date(pending.requestedAt).getTime();
    if (Date.now() - requestedAt > 300_000) {
      await clearPendingBottleLog();
      return;
    }

    if (!selectedBaby?.id) {
      await clearPendingBottleLog();
      return;
    }

    const validContentTypes = ["formula", "breast_milk"];
    if (!validContentTypes.includes(pending.contentType)) {
      await clearPendingBottleLog();
      return;
    }

    const feedingTime = new Date(pending.requestedAt);

    await addFeeding({
      babyId: selectedBaby.id,
      type: "bottle",
      amountMl: pending.amountMl,
      contentType: pending.contentType as BottleContentType,
      startedAt: feedingTime,
      endedAt: feedingTime,
    });

    await clearPendingBottleLog();
  }, [addFeeding, selectedBaby]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") processPendingLog();
    });
    return () => sub.remove();
  }, [processPendingLog]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    processPendingLog();
  }, [processPendingLog]);
}
