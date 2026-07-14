import { useCallback, useEffect, useRef } from "react";
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
const WATCH_ACTIONS = new Set([
  "requestSync",
  "selectBaby",
  "startTimer",
  "stopTimer",
  "stopPumpingWithVolume",
  "logDiaper",
  "logBottleFeeding",
  "pauseTimer",
  "resumeTimer",
  "switchSide",
]);

interface UseWatchMessageHandlerOptions {
  onRequestSync?: (replyHandler?: WatchReplyHandler) => void;
  onSelectBabyRequest?: (babyId: string) => void;
}

interface ProcessedRequest {
  timestamp: number;
  response?: Record<string, unknown>;
  waitingReplies: WatchReplyHandler[];
}

interface QueuedWatchMessage {
  message: Record<string, unknown>;
  replyHandler?: WatchReplyHandler;
  targetBabyId?: string;
}

function parseRequestedTime(timeString: unknown): Date | undefined {
  if (typeof timeString !== "string") return undefined;
  const parsed = new Date(timeString);
  if (isNaN(parsed.getTime())) return undefined;
  const hoursDiff = (Date.now() - parsed.getTime()) / (1000 * 60 * 60);
  return hoursDiff >= 0 && hoursDiff <= 24 ? parsed : undefined;
}

export function useWatchMessageHandler(options?: UseWatchMessageHandlerOptions) {
  const { onRequestSync, onSelectBabyRequest } = options ?? {};
  const { selectedBaby, getBabyById, selectBaby } = useBaby();
  const { startBreastfeeding, stopBreastfeeding, changeSide, addFeeding, pauseBreastfeeding, resumeBreastfeeding } = useFeeding();
  const { startSleep, stopSleep, pauseSleep, resumeSleep } = useSleep();
  const { addDiaper } = useDiaper();
  const { startPumping, stopPumping, changePumpingSide, pausePumping, resumePumping } = usePumping();
  const { startTummyTime, stopTummyTime, pauseTummyTime, resumeTummyTime } = useTummyTime();

  const processedRequestsRef = useRef<Map<string, ProcessedRequest>>(new Map());
  const messageQueueRef = useRef<QueuedWatchMessage[]>([]);
  const isProcessingRef = useRef(false);
  const processAgainRef = useRef(false);
  const selectingBabyIdRef = useRef<string | undefined>(undefined);
  const selectedBabyIdRef = useRef(selectedBaby?.id);
  selectedBabyIdRef.current = selectedBaby?.id;

  const executeMessage = useCallback(
    async (
      message: Record<string, unknown>,
      targetBabyId: string | undefined,
      replyHandler?: WatchReplyHandler
    ) => {
      const action = message.action as string;
      const activityType = message.activityType as string | undefined;
      const context = message.context as string | undefined;
      const startTime = parseRequestedTime(message.requestedStartTime);
      const endTime = parseRequestedTime(message.requestedEndTime);
      const logTime = parseRequestedTime(message.requestedLogTime);

      try {
        switch (action) {
          case "requestSync":
            onRequestSync?.(replyHandler);
            break;

          case "startTimer": {
            switch (activityType) {
              case "feeding":
                await startBreastfeeding((context as BreastSide) || "left", startTime);
                break;
              case "sleep": {
                const sleepType = context === "auto" || !context
                  ? determineSleepType(startTime ?? new Date())
                  : context as SleepType;
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
              if (
                (!pendingStop.babyId || pendingStop.babyId === targetBabyId) &&
                (pendingStop.activityType === dbType || pendingStop.activityType === activityType)
              ) {
                await clearPendingWidgetStop(pendingStop);
                await clearPendingWidgetPauseToggle();
              }
            }
            break;
          }

          case "stopTimer":
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

          case "stopPumpingWithVolume":
            await stopPumping(typeof message.volumeMl === "number" ? message.volumeMl : 0, endTime);
            break;

          case "logDiaper":
            if (targetBabyId) {
              await addDiaper({
                babyId: targetBabyId,
                type: message.diaperType as DiaperType,
                stoolColor: message.stoolColor as StoolColor | undefined,
                changedAt: logTime ?? new Date(),
              });
            }
            break;

          case "logBottleFeeding":
            if (targetBabyId) {
              const feedingTime = logTime ?? new Date();
              await addFeeding({
                babyId: targetBabyId,
                type: "bottle",
                startedAt: feedingTime,
                endedAt: feedingTime,
                amountMl: message.volumeMl as number,
                contentType: message.contentType as BottleContentType,
              });
            }
            break;

          case "pauseTimer":
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

          case "resumeTimer":
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

          case "switchSide": {
            const newSide: BreastSide = message.currentSide === "left" ? "right" : "left";
            if (activityType === "feeding") {
              changeSide(newSide);
            } else if (activityType === "pumping") {
              changePumpingSide(newSide);
            }
            break;
          }
        }
      } catch (error) {
        console.error(
          "[WatchMessageHandler] Action failed:",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [
      onRequestSync,
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

  const executeMessageRef = useRef(executeMessage);
  executeMessageRef.current = executeMessage;

  const processQueue = useCallback(async function processQueuedMessages() {
    if (isProcessingRef.current) {
      processAgainRef.current = true;
      return;
    }

    isProcessingRef.current = true;
    try {
      while (messageQueueRef.current.length > 0) {
        const queued = messageQueueRef.current[0];
        if (queued.targetBabyId && selectedBabyIdRef.current !== queued.targetBabyId) {
          if (selectingBabyIdRef.current === queued.targetBabyId) {
            return;
          }

          selectingBabyIdRef.current = queued.targetBabyId;
          try {
            await selectBaby(queued.targetBabyId);
            onSelectBabyRequest?.(queued.targetBabyId);
            return;
          } catch (error) {
            selectingBabyIdRef.current = undefined;
            console.error(
              "[WatchMessageHandler] Baby selection failed:",
              error instanceof Error ? error.message : "Unknown error"
            );
            messageQueueRef.current.shift();
            continue;
          }
        }

        messageQueueRef.current.shift();
        await executeMessageRef.current(
          queued.message,
          queued.targetBabyId ?? selectedBabyIdRef.current,
          queued.replyHandler
        );
      }
    } finally {
      isProcessingRef.current = false;
      if (processAgainRef.current) {
        processAgainRef.current = false;
        void processQueuedMessages();
      }
    }
  }, [onSelectBabyRequest, selectBaby]);

  useEffect(() => {
    selectedBabyIdRef.current = selectedBaby?.id;
    if (selectingBabyIdRef.current === selectedBaby?.id) {
      selectingBabyIdRef.current = undefined;
    }
    void processQueue();
  }, [processQueue, selectedBaby?.id]);

  const handleMessage = useCallback(
    async (message: Record<string, unknown>, replyHandler?: WatchReplyHandler) => {
      const action = typeof message.action === "string" ? message.action : undefined;
      if (!action || !WATCH_ACTIONS.has(action)) {
        console.warn("[WatchMessageHandler] Rejected invalid action");
        return;
      }

      const requestId = typeof message.requestId === "string" ? message.requestId : undefined;
      let trackedReplyHandler = replyHandler;

      if (requestId) {
        const now = Date.now();
        const seen = processedRequestsRef.current;
        for (const [id, request] of seen) {
          if (now - request.timestamp > REQUEST_DEDUP_TTL_MS) {
            seen.delete(id);
          }
        }

        const existing = seen.get(requestId);
        if (existing) {
          if (replyHandler) {
            if (existing.response) {
              replyHandler(existing.response);
            } else {
              existing.waitingReplies.push(replyHandler);
            }
          }
          return;
        }

        const request: ProcessedRequest = { timestamp: now, waitingReplies: [] };
        seen.set(requestId, request);
        if (replyHandler) {
          trackedReplyHandler = (response) => {
            request.response = response;
            replyHandler(response);
            for (const waitingReply of request.waitingReplies) {
              waitingReply(response);
            }
            request.waitingReplies = [];
          };
        }
      }

      const targetBabyId = typeof message.babyId === "string" ? message.babyId : undefined;
      if (targetBabyId && !getBabyById(targetBabyId)) {
        console.warn("[WatchMessageHandler] Rejected action for unknown baby");
        return;
      }

      if (action === "selectBaby") {
        if (targetBabyId && targetBabyId !== selectedBabyIdRef.current) {
          await selectBaby(targetBabyId);
          onSelectBabyRequest?.(targetBabyId);
        }
        return;
      }

      const resolvedBabyId = targetBabyId ?? selectedBabyIdRef.current;
      if (action !== "requestSync" && !resolvedBabyId) {
        console.warn("[WatchMessageHandler] Rejected activity action without a baby");
        return;
      }

      messageQueueRef.current.push({
        message,
        replyHandler: trackedReplyHandler,
        targetBabyId: resolvedBabyId,
      });
      await processQueue();
    },
    [getBabyById, onSelectBabyRequest, processQueue, selectBaby]
  );

  const registerHandler = useCallback(() => {
    return setWatchMessageHandler(handleMessage);
  }, [handleMessage]);

  return { registerHandler };
}
