import { useCallback, useEffect, useRef } from "react";
import { useBaby } from "@/contexts/baby-context";
import { useFeeding } from "@/contexts/feeding-context";
import { useSleep } from "@/contexts/sleep-context";
import { useDiaper } from "@/contexts/diaper-context";
import { usePumping } from "@/contexts/pumping-context";
import { useTummyTime } from "@/contexts/tummyTime-context";
import { useAuth } from "@/contexts/auth-context";
import { setWatchMessageHandler } from "@/services/watch-service";
import type { WatchReplyHandler } from "@/services/watch-service";
import { appendExternalTimerCommand } from "@/services/external-timer-command-service";
import type { TimerIdentity } from "@/services/timer-completion-service";
import type { BreastSide, DiaperType, SleepType, BottleContentType, StoolColor } from "@/constants/activities";
import { determineSleepType } from "@/validators/sleep";
import { clearPendingWidgetPauseToggle } from "@/services/widget-data-service";

const REQUEST_DEDUP_TTL_MS = 30_000;
const PROVIDER_BINDING_TIMEOUT_MS = 5_000;
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
  fingerprint: string;
  completedAt?: number;
  response?: Record<string, unknown>;
  waitingReplies: WatchReplyHandler[];
}

interface QueuedWatchMessage {
  message: Record<string, unknown>;
  replyHandler?: WatchReplyHandler;
  requestKey?: string;
  targetBabyId?: string;
  authScope: string;
  bindingDeadlineAt: number;
}

function requestFingerprint(message: Record<string, unknown>): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, normalize(nested)])
      );
    }
    return value;
  };

  return JSON.stringify(normalize(message));
}

function parseRequestedTime(timeString: unknown): Date | undefined {
  if (typeof timeString !== "string") return undefined;
  const parsed = new Date(timeString);
  if (isNaN(parsed.getTime())) return undefined;
  const hoursDiff = (Date.now() - parsed.getTime()) / (1000 * 60 * 60);
  return hoursDiff >= 0 && hoursDiff <= 24 ? parsed : undefined;
}

function parseRequestedIdentity(
  message: Record<string, unknown>
): TimerIdentity | undefined {
  return typeof message.timerInstanceId === "string" &&
    typeof message.activityId === "string"
    ? {
        timerInstanceId: message.timerInstanceId,
        activityId: message.activityId,
      }
    : undefined;
}

export function useWatchMessageHandler(options?: UseWatchMessageHandlerOptions) {
  const { onRequestSync, onSelectBabyRequest } = options ?? {};
  const { user } = useAuth();
  const { selectedBaby, getBabyById, selectBaby } = useBaby();
  const { babyBinding: feedingBinding, startBreastfeeding, changeSide, addFeeding, pauseBreastfeeding, resumeBreastfeeding } = useFeeding();
  const { babyBinding: sleepBinding, startSleep, pauseSleep, resumeSleep } = useSleep();
  const { babyBinding: diaperBinding, addDiaper } = useDiaper();
  const { babyBinding: pumpingBinding, startPumping, changePumpingSide, pausePumping, resumePumping } = usePumping();
  const { babyBinding: tummyTimeBinding, startTummyTime, pauseTummyTime, resumeTummyTime } = useTummyTime();

  const processedRequestsRef = useRef<Map<string, ProcessedRequest>>(new Map());
  const messageQueueRef = useRef<QueuedWatchMessage[]>([]);
  const isProcessingRef = useRef(false);
  const processAgainRef = useRef(false);
  const selectingBabyIdRef = useRef<string | undefined>(undefined);
  const bindingWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authScope = user ? `${user.id}:${user.householdId ?? ""}` : "guest";
  const authScopeRef = useRef(authScope);
  const changedAuthScopeRef = useRef<string | null>(null);
  if (authScopeRef.current !== authScope) {
    changedAuthScopeRef.current = authScopeRef.current;
    authScopeRef.current = authScope;
  }
  const selectedBabyIdRef = useRef(selectedBaby?.id);
  selectedBabyIdRef.current = selectedBaby?.id;
  const providerBindingsRef = useRef([
    feedingBinding,
    sleepBinding,
    diaperBinding,
    pumpingBinding,
    tummyTimeBinding,
  ]);
  providerBindingsRef.current = [
    feedingBinding,
    sleepBinding,
    diaperBinding,
    pumpingBinding,
    tummyTimeBinding,
  ];

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
      const logTime = parseRequestedTime(message.requestedLogTime);
      const requestedIdentity = parseRequestedIdentity(message);

      try {
        switch (action) {
          case "requestSync":
            if (onRequestSync) {
              onRequestSync(replyHandler);
              return null;
            }
            return { success: true };

          case "startTimer": {
            let startResult: { success: boolean; lockedByName?: string } | undefined;
            switch (activityType) {
              case "feeding":
                startResult = await startBreastfeeding(
                  (context as BreastSide) || "left",
                  startTime,
                  requestedIdentity
                );
                break;
              case "sleep": {
                const sleepType = context === "auto" || !context
                  ? determineSleepType(startTime ?? new Date())
                  : context as SleepType;
                startResult = await startSleep(
                  sleepType,
                  startTime,
                  requestedIdentity
                );
                break;
              }
              case "pumping":
                startResult = await startPumping(
                  (context as BreastSide) || "left",
                  startTime,
                  requestedIdentity
                );
                break;
              case "tummyTime":
                startResult = await startTummyTime(startTime, requestedIdentity);
                break;
            }
            if (startResult && !startResult.success) {
              return {
                success: false,
                error: "timer-start-rejected",
                ...(startResult.lockedByName && { lockedByName: startResult.lockedByName }),
              };
            }
            await clearPendingWidgetPauseToggle();
            break;
          }

          case "stopTimer":
          case "stopPumpingWithVolume": {
            const suppliedCommand = message.externalTimerCommand &&
              typeof message.externalTimerCommand === "object"
              ? message.externalTimerCommand as Record<string, unknown>
              : undefined;
            const suppliedActivityType = suppliedCommand?.activityType;
            const commandActivityType = suppliedActivityType === "feeding" ||
              suppliedActivityType === "sleep" ||
              suppliedActivityType === "pumping" ||
              suppliedActivityType === "tummy_time"
              ? suppliedActivityType
              : activityType === "tummyTime"
                ? "tummy_time"
                : activityType;
            const requestedEndValue = typeof suppliedCommand?.eventAt === "string"
              ? suppliedCommand.eventAt
              : message.requestedEndTime;
            const requestedEndTime = typeof requestedEndValue === "string"
              ? new Date(requestedEndValue)
              : new Date();
            if (
              !targetBabyId ||
              !Number.isFinite(requestedEndTime.getTime()) ||
              (commandActivityType !== "feeding" &&
                commandActivityType !== "sleep" &&
                commandActivityType !== "pumping" &&
                commandActivityType !== "tummy_time") ||
              (suppliedCommand?.babyId !== undefined &&
                suppliedCommand.babyId !== targetBabyId)
            ) {
              return { success: false, error: "invalid-timer-command" };
            }
            const timerInstanceId = typeof suppliedCommand?.timerInstanceId === "string"
              ? suppliedCommand.timerInstanceId
              : `legacy:${targetBabyId}:${commandActivityType}:${requestedEndTime.toISOString()}`;
            const commandId = typeof suppliedCommand?.id === "string"
              ? suppliedCommand.id
              : typeof message.requestId === "string"
                ? `watch:${message.requestId}`
                : timerInstanceId;
            const suppliedPayload = suppliedCommand?.payload &&
              typeof suppliedCommand.payload === "object"
              ? suppliedCommand.payload as Record<string, unknown>
              : undefined;
            const suppliedVolume = suppliedPayload?.volumeMl;
            const volumeMl = typeof suppliedVolume === "number"
              ? suppliedVolume
              : action === "stopPumpingWithVolume" &&
                  typeof message.volumeMl === "number"
                ? message.volumeMl
                : undefined;
            await appendExternalTimerCommand({
              id: commandId,
              action: "stop",
              activityType: commandActivityType,
              babyId: targetBabyId,
              timerInstanceId,
              eventAt: requestedEndTime.toISOString(),
              source: "watch",
              legacy: suppliedCommand?.legacy === true ||
                typeof suppliedCommand?.timerInstanceId !== "string" || undefined,
              ...(volumeMl === undefined ? {} : { payload: { volumeMl } }),
            });
            break;
          }

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
        return { success: false, error: "action-failed" };
      }

      return { success: true };
    },
    [
      onRequestSync,
      startBreastfeeding,
      pauseBreastfeeding,
      resumeBreastfeeding,
      changeSide,
      addFeeding,
      startSleep,
      pauseSleep,
      resumeSleep,
      addDiaper,
      startPumping,
      pausePumping,
      resumePumping,
      changePumpingSide,
      startTummyTime,
      pauseTummyTime,
      resumeTummyTime,
    ]
  );

  const executeMessageRef = useRef(executeMessage);
  executeMessageRef.current = executeMessage;

  const completeProcessedRequest = useCallback(
    (request: ProcessedRequest, response: Record<string, unknown>) => {
      if (request.response) return;
      request.response = response;
      request.completedAt = Date.now();
      for (const waitingReply of request.waitingReplies) {
        waitingReply(response);
      }
      request.waitingReplies = [];
    },
    []
  );

  const finishQueuedRequest = useCallback(
    (queued: QueuedWatchMessage, response: Record<string, unknown>) => {
      if (queued.requestKey) {
        const request = processedRequestsRef.current.get(queued.requestKey);
        if (request) completeProcessedRequest(request, response);
        return;
      }

      queued.replyHandler?.(response);
    },
    [completeProcessedRequest]
  );

  useEffect(() => {
    const previousScope = changedAuthScopeRef.current;
    if (!previousScope) return;
    changedAuthScopeRef.current = null;
    const response = { success: false, error: "auth-scope-changed" };

    for (const queued of messageQueueRef.current) {
      if (queued.authScope === previousScope) {
        finishQueuedRequest(queued, response);
      }
    }
    messageQueueRef.current = messageQueueRef.current.filter(
      queued => queued.authScope !== previousScope
    );

    const requestPrefix = `${previousScope}\u0000`;
    for (const [requestKey, request] of processedRequestsRef.current) {
      if (!requestKey.startsWith(requestPrefix)) continue;
      completeProcessedRequest(request, response);
      processedRequestsRef.current.delete(requestKey);
    }

    selectingBabyIdRef.current = undefined;
    if (bindingWaitTimerRef.current) {
      clearTimeout(bindingWaitTimerRef.current);
      bindingWaitTimerRef.current = null;
    }
  }, [authScope, completeProcessedRequest, finishQueuedRequest]);

  const processQueue = useCallback(async function processQueuedMessages() {
    if (isProcessingRef.current) {
      processAgainRef.current = true;
      return;
    }

    isProcessingRef.current = true;
    try {
      while (messageQueueRef.current.length > 0) {
        const queued = messageQueueRef.current[0];
        if (bindingWaitTimerRef.current) {
          clearTimeout(bindingWaitTimerRef.current);
          bindingWaitTimerRef.current = null;
        }
        if (queued.authScope !== authScopeRef.current) {
          messageQueueRef.current.shift();
          continue;
        }
        if (queued.targetBabyId && selectedBabyIdRef.current !== queued.targetBabyId) {
          if (selectingBabyIdRef.current === queued.targetBabyId) {
            return;
          }

          selectingBabyIdRef.current = queued.targetBabyId;
          try {
            const baby = await selectBaby(queued.targetBabyId);
            if (queued.authScope !== authScopeRef.current) {
              selectingBabyIdRef.current = undefined;
              continue;
            }
            if (!baby) {
              selectingBabyIdRef.current = undefined;
              messageQueueRef.current.shift();
              finishQueuedRequest(queued, {
                success: false,
                error: "baby-selection-failed",
              });
              continue;
            }
            onSelectBabyRequest?.(queued.targetBabyId);
            return;
          } catch (error) {
            selectingBabyIdRef.current = undefined;
            console.error(
              "[WatchMessageHandler] Baby selection failed:",
              error instanceof Error ? error.message : "Unknown error"
            );
            messageQueueRef.current.shift();
            finishQueuedRequest(queued, {
              success: false,
              error: "baby-selection-failed",
            });
            continue;
          }
        }

        if (queued.targetBabyId) {
          const bindings = providerBindingsRef.current;
          const bindingFailed = bindings.some(
            binding => binding.babyId === queued.targetBabyId && binding.status === "error"
          );
          if (bindingFailed) {
            messageQueueRef.current.shift();
            finishQueuedRequest(queued, {
              success: false,
              error: "provider-binding-failed",
            });
            continue;
          }

          const providersReady = bindings.every(
            binding => binding.babyId === queued.targetBabyId && binding.status === "ready"
          );
          if (!providersReady) {
            const remainingMs = queued.bindingDeadlineAt - Date.now();
            if (remainingMs <= 0) {
              messageQueueRef.current.shift();
              finishQueuedRequest(queued, {
                success: false,
                error: "provider-binding-timeout",
              });
              continue;
            }
            bindingWaitTimerRef.current = setTimeout(() => {
              bindingWaitTimerRef.current = null;
              void processQueuedMessages();
            }, remainingMs);
            return;
          }
        }

        messageQueueRef.current.shift();
        const response = await executeMessageRef.current(
          queued.message,
          queued.targetBabyId ?? selectedBabyIdRef.current,
          queued.replyHandler
        );
        if (response) finishQueuedRequest(queued, response);
      }
    } finally {
      isProcessingRef.current = false;
      if (processAgainRef.current) {
        processAgainRef.current = false;
        void processQueuedMessages();
      }
    }
  }, [finishQueuedRequest, onSelectBabyRequest, selectBaby]);

  useEffect(() => () => {
    if (bindingWaitTimerRef.current) clearTimeout(bindingWaitTimerRef.current);

    const response = { success: false, error: "handler-unmounted" };
    for (const queued of messageQueueRef.current) {
      finishQueuedRequest(queued, response);
    }
    messageQueueRef.current = [];

    for (const request of processedRequestsRef.current.values()) {
      completeProcessedRequest(request, response);
    }
    processedRequestsRef.current.clear();
  }, [completeProcessedRequest, finishQueuedRequest]);

  useEffect(() => {
    selectedBabyIdRef.current = selectedBaby?.id;
    if (selectingBabyIdRef.current === selectedBaby?.id) {
      selectingBabyIdRef.current = undefined;
    }
    void processQueue();
  }, [
    diaperBinding.babyId,
    diaperBinding.status,
    feedingBinding.babyId,
    feedingBinding.status,
    processQueue,
    pumpingBinding.babyId,
    pumpingBinding.status,
    selectedBaby?.id,
    sleepBinding.babyId,
    sleepBinding.status,
    tummyTimeBinding.babyId,
    tummyTimeBinding.status,
  ]);

  const handleMessage = useCallback(
    async (message: Record<string, unknown>, replyHandler?: WatchReplyHandler) => {
      const action = typeof message.action === "string" ? message.action : undefined;
      if (!action || !WATCH_ACTIONS.has(action)) {
        console.warn("[WatchMessageHandler] Rejected invalid action");
        return;
      }

      const targetBabyId = typeof message.babyId === "string" ? message.babyId : undefined;
      if (targetBabyId && !getBabyById(targetBabyId)) {
        console.warn("[WatchMessageHandler] Rejected action for unknown baby");
        replyHandler?.({ success: false, error: "unknown-baby" });
        return;
      }

      const resolvedBabyId = targetBabyId ?? selectedBabyIdRef.current;
      if (action !== "requestSync" && action !== "selectBaby" && !resolvedBabyId) {
        console.warn("[WatchMessageHandler] Rejected activity action without a baby");
        replyHandler?.({ success: false, error: "missing-baby" });
        return;
      }

      const requestId = typeof message.requestId === "string" ? message.requestId : undefined;
      const requestKey = requestId && (action !== "requestSync" || replyHandler)
        ? `${authScope}\u0000${requestId}`
        : undefined;
      const fingerprint = requestFingerprint(message);
      let trackedReplyHandler = replyHandler;

      if (requestKey) {
        const now = Date.now();
        const seen = processedRequestsRef.current;
        for (const [id, request] of seen) {
          if (
            request.completedAt !== undefined &&
            now - request.completedAt > REQUEST_DEDUP_TTL_MS
          ) {
            seen.delete(id);
          }
        }

        const existing = seen.get(requestKey);
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            replyHandler?.({ success: false, error: "request-id-conflict" });
            return;
          }
          if (replyHandler) {
            if (existing.response) {
              replyHandler(existing.response);
            } else {
              existing.waitingReplies.push(replyHandler);
            }
          }
          return;
        }

        const request: ProcessedRequest = { fingerprint, waitingReplies: [] };
        seen.set(requestKey, request);
        if (replyHandler) {
          request.waitingReplies.push(replyHandler);
          trackedReplyHandler = (response) => {
            completeProcessedRequest(request, response);
          };
        }
      }

      if (action === "selectBaby") {
        const queued: QueuedWatchMessage = {
          message,
          replyHandler: trackedReplyHandler,
          requestKey,
          targetBabyId,
          authScope,
          bindingDeadlineAt: Date.now() + PROVIDER_BINDING_TIMEOUT_MS,
        };
        try {
          if (targetBabyId && targetBabyId !== selectedBabyIdRef.current) {
            const baby = await selectBaby(targetBabyId);
            if (authScope !== authScopeRef.current) return;
            if (!baby) {
              finishQueuedRequest(queued, { success: false, error: "baby-selection-failed" });
              return;
            }
            onSelectBabyRequest?.(targetBabyId);
          }
          finishQueuedRequest(queued, { success: true });
        } catch {
          if (authScope === authScopeRef.current) {
            finishQueuedRequest(queued, { success: false, error: "baby-selection-failed" });
          }
        }
        return;
      }

      messageQueueRef.current.push({
        message,
        replyHandler: trackedReplyHandler,
        requestKey,
        targetBabyId: resolvedBabyId,
        authScope,
        bindingDeadlineAt: Date.now() + PROVIDER_BINDING_TIMEOUT_MS,
      });
      await processQueue();
    },
    [authScope, completeProcessedRequest, finishQueuedRequest, getBabyById, onSelectBabyRequest, processQueue, selectBaby]
  );

  const registerHandler = useCallback(() => {
    return setWatchMessageHandler(handleMessage);
  }, [handleMessage]);

  return { registerHandler };
}
