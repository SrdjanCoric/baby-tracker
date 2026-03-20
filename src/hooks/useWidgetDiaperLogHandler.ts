import { useEffect, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useDiaper } from "@/contexts/diaper-context";
import { useBaby } from "@/contexts/baby-context";
import { readPendingDiaperLog, clearPendingDiaperLog } from "@/services/widget-data-service";
import type { DiaperType, StoolColor } from "@/constants/activities";
import { isValidStoolColor } from "@/constants/activities";

export function useWidgetDiaperLogHandler() {
  const { addDiaper } = useDiaper();
  const { selectedBaby } = useBaby();

  const processPendingLog = useCallback(async () => {
    const pending = await readPendingDiaperLog();
    if (!pending) return;

    const requestedAt = new Date(pending.requestedAt).getTime();
    if (Date.now() - requestedAt > 300_000) {
      await clearPendingDiaperLog();
      return;
    }

    if (!selectedBaby?.id) {
      await clearPendingDiaperLog();
      return;
    }

    const validTypes = ["wet", "dirty", "mixed", "dry"];
    if (!validTypes.includes(pending.type)) {
      await clearPendingDiaperLog();
      return;
    }

    await addDiaper({
      babyId: selectedBaby.id,
      type: pending.type as DiaperType,
      stoolColor: pending.stoolColor && isValidStoolColor(pending.stoolColor)
        ? (pending.stoolColor as StoolColor)
        : undefined,
      changedAt: new Date(pending.requestedAt),
    });

    await clearPendingDiaperLog();
  }, [addDiaper, selectedBaby]);

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
