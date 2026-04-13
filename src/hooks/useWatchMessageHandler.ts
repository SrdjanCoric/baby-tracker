import { useCallback, useRef } from "react";
import { useBaby } from "@/contexts/baby-context";
import { useFeeding } from "@/contexts/feeding-context";
import { useSleep } from "@/contexts/sleep-context";
import { useDiaper } from "@/contexts/diaper-context";
import { usePumping } from "@/contexts/pumping-context";
import { useTummyTime } from "@/contexts/tummyTime-context";
import { setWatchMessageHandler } from "@/services/watch-service";
import type { WatchReplyHandler } from "@/services/watch-service";
import type { BreastSide, DiaperType, SleepType, BottleContentType, StoolColor } from "@/constants/activities";
import { determineSleepType } from "@/validators/sleep";
import {
  readPendingWidgetStop,
  clearPendingWidgetStop,
  clearPendingWidgetPauseToggle,
} from "@/services/widget-data-service";

const REQUEST_DEDUP_TTL_MS = 30_000;

interface UseWatchMessageHandlerOptions {
  onRequestSync?: (replyHandler?: WatchReplyHandler) => void;
  onSelectBabyRequest?: (babyId: string) => void;
}

export function useWatchMessageHandler(options?: UseWatchMessageHandlerOptions) {
  const { selectedBaby, selectBaby } = useBaby();
  const { startBreastfeeding, stopBreastfeeding, changeSide, addFeeding, pauseBreastfeeding, resumeBreastfeeding } = useFeeding();
  const { startSleep, stopSleep, pauseSleep, resumeSleep } = useSleep();
  const { addDiaper } = useDiaper();
  const { startPumping, stopPumping, changePumpingSide, pausePumping, resumePumping } = usePumping();
  const { startTummyTime, stopTummyTime, pauseTummyTime, resumeTummyTime } = useTummyTime();

  const processedRequestIds = useRef<Map<string, number>>(new Map());

  const handleMessage = useCallback(
    async (message: Record<string, unknown>, replyHandler?: WatchReplyHandler) => {
      const action = message.action as string;
      const messageBabyId = message.babyId as string | undefined;
      const requestId = message.requestId as string | undefined;

      console.log(
        `[WatchMessageHandler] Received: action=${action}, babyId=${messageBabyId}, requestId=${requestId}, selectedBaby=${selectedBaby?.id}`
      );

      if (requestId) {
        const now = Date.now();
        const seen = processedRequestIds.current;

        for (const [id, timestamp] of seen) {
          if (now - timestamp > REQUEST_DEDUP_TTL_MS) {
            seen.delete(id);
          }
        }

        if (seen.has(requestId)) {
          console.log(`[WatchMessageHandler] DUPLICATE requestId=${requestId}, skipping`);
          return;
        }
        seen.set(requestId, now);
      }

      if (action === "requestSync") {
        options?.onRequestSync?.(replyHandler);
        return;
      }

      if (action === "selectBaby") {
        const babyId = message.babyId as string;
        if (babyId) {
          await selectBaby(babyId);
          options?.onSelectBabyRequest?.(babyId);
        }
        return;
      }

      if (!selectedBaby) {
        console.log(`[WatchMessageHandler] DROPPING action ${action} - no selectedBaby`);
        return;
      }

      if (messageBabyId && messageBabyId !== selectedBaby.id) {
        console.log(
          `[WatchMessageHandler] Baby mismatch - switching from ${selectedBaby.id} to ${messageBabyId}, then processing action`
        );
        await selectBaby(messageBabyId);
      }

      const activityType = message.activityType as string | undefined;
      const context = message.context as string | undefined;
      const requestedStartTime = message.requestedStartTime as string | undefined;
      const requestedEndTime = message.requestedEndTime as string | undefined;
      const requestedLogTime = message.requestedLogTime as string | undefined;

      // Helper to parse and validate a time string (within last 24 hours)
      const parseRequestedTime = (timeString: string | undefined): Date | undefined => {
        if (!timeString) return undefined;
        const parsed = new Date(timeString);
        if (isNaN(parsed.getTime())) return undefined;
        const now = new Date();
        const hoursDiff = (now.getTime() - parsed.getTime()) / (1000 * 60 * 60);
        if (hoursDiff >= 0 && hoursDiff <= 24) {
          return parsed;
        }
        return undefined;
      };

      const startTime = parseRequestedTime(requestedStartTime);
      const endTime = parseRequestedTime(requestedEndTime);
      const logTime = parseRequestedTime(requestedLogTime);

      if (startTime) {
        console.log(`[WatchMessageHandler] Using requested start time: ${startTime.toISOString()}`);
      }
      if (endTime) {
        console.log(`[WatchMessageHandler] Using requested end time: ${endTime.toISOString()}`);
      }
      if (logTime) {
        console.log(`[WatchMessageHandler] Using requested log time: ${logTime.toISOString()}`);
      }

      try {
        switch (action) {
          case "startTimer": {
            switch (activityType) {
              case "feeding":
                await startBreastfeeding((context as BreastSide) || "left", startTime);
                break;
              case "sleep": {
                let sleepType: SleepType;
                if (context === "auto" || !context) {
                  sleepType = determineSleepType(startTime ?? new Date());
                } else {
                  sleepType = context as SleepType;
                }
                await startSleep(sleepType, startTime);
                break;
              }
              case "pumping":
                await startPumping((context as BreastSide) || "left", startTime);
                break;
              case "tummyTime":
                await startTummyTime(startTime);
                break;
            }
            const pendingStop = await readPendingWidgetStop();
            if (pendingStop) {
              const dbType = activityType === "tummyTime" ? "tummy_time" : activityType;
              if (pendingStop.activityType === dbType || pendingStop.activityType === activityType) {
                await clearPendingWidgetStop();
                await clearPendingWidgetPauseToggle();
              }
            }
            break;
          }

          case "stopTimer": {
            switch (activityType) {
              case "feeding":
                await stopBreastfeeding(endTime);
                break;
              case "sleep":
                await stopSleep(endTime);
                break;
              case "pumping":
                await stopPumping(0, endTime);
                break;
              case "tummyTime":
                await stopTummyTime(endTime);
                break;
            }
            break;
          }

          case "stopPumpingWithVolume": {
            const volumeMl = (message.volumeMl as number) || 0;
            await stopPumping(volumeMl, endTime);
            break;
          }

          case "logDiaper": {
            const diaperType = message.diaperType as DiaperType;
            const stoolColor = message.stoolColor as StoolColor | undefined;
            const changedAt = logTime ?? new Date();
            await addDiaper({
              babyId: selectedBaby.id,
              type: diaperType,
              stoolColor,
              changedAt,
            });
            break;
          }

          case "logBottleFeeding": {
            const volumeMl = message.volumeMl as number;
            const contentType = message.contentType as BottleContentType;
            const feedingTime = logTime ?? new Date();
            await addFeeding({
              babyId: selectedBaby.id,
              type: "bottle",
              startedAt: feedingTime,
              endedAt: feedingTime,
              amountMl: volumeMl,
              contentType,
            });
            break;
          }

          case "pauseTimer": {
            switch (activityType) {
              case "feeding":
                await pauseBreastfeeding();
                break;
              case "sleep":
                await pauseSleep();
                break;
              case "pumping":
                await pausePumping();
                break;
              case "tummyTime":
                await pauseTummyTime();
                break;
            }
            break;
          }

          case "resumeTimer": {
            switch (activityType) {
              case "feeding":
                await resumeBreastfeeding();
                break;
              case "sleep":
                await resumeSleep();
                break;
              case "pumping":
                await resumePumping();
                break;
              case "tummyTime":
                await resumeTummyTime();
                break;
            }
            break;
          }

          case "switchSide": {
            const currentSide = message.currentSide as BreastSide;
            const newSide: BreastSide = currentSide === "left" ? "right" : "left";
            if (activityType === "feeding") {
              changeSide(newSide);
            } else if (activityType === "pumping") {
              changePumpingSide(newSide);
            }
            break;
          }
        }
      } catch (error) {
        console.error("[WatchMessageHandler] Error handling message:", error);
      }
    },
    [
      selectedBaby,
      selectBaby,
      options?.onRequestSync,
      options?.onSelectBabyRequest,
      startBreastfeeding,
      stopBreastfeeding,
      pauseBreastfeeding,
      resumeBreastfeeding,
      changeSide,
      addFeeding,
      startSleep,
      stopSleep,
      pauseSleep,
      resumeSleep,
      addDiaper,
      startPumping,
      stopPumping,
      pausePumping,
      resumePumping,
      changePumpingSide,
      startTummyTime,
      stopTummyTime,
      pauseTummyTime,
      resumeTummyTime,
    ]
  );

  const registerHandler = useCallback(() => {
    return setWatchMessageHandler(handleMessage);
  }, [handleMessage]);

  return { registerHandler };
}
