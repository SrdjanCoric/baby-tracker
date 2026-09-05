import { useEffect, useCallback, useRef } from "react";
import { Platform, AppState } from "react-native";
import { useRouter } from "expo-router";
import { useFeeding } from "@/contexts/feeding-context";
import { useSleep } from "@/contexts/sleep-context";
import { usePumping } from "@/contexts/pumping-context";
import { useTummyTime } from "@/contexts/tummyTime-context";
import { useBaby } from "@/contexts/baby-context";
import { useAuth } from "@/contexts/auth-context";
import { useActiveTimers } from "@/contexts/active-timers-context";
import { clearPendingWidgetPauseToggle } from "@/services/widget-data-service";
import {
  acknowledgeExternalTimerCommand,
  claimLegacyExternalTimerCommand,
  readExternalTimerCommands,
  subscribeExternalTimerCommands,
  type ExternalTimerCommand,
} from "@/services/external-timer-command-service";
import { getTimerCompletion } from "@/services/timer-completion-service";

const ACTIVITY_ROUTE_MAP: Record<string, string> = {
  feeding: "/feeding",
  sleep: "/sleep",
  pumping: "/pumping",
  tummy_time: "/tummyTime",
};

interface CommandTimer {
  isRunning: boolean;
  startTime: Date;
  timerInstanceId: string;
}

export function useWidgetStopHandler() {
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { user } = useAuth();
  const { getLockForActivity } = useActiveTimers();
  const {
    activeTimer: feedingTimer,
    stopBreastfeeding,
    stopRemoteBreastfeeding,
  } = useFeeding();
  const { activeTimer: sleepTimer, stopSleep, stopRemoteSleep } = useSleep();
  const {
    activeTimer: pumpingTimer,
    stopPumping,
    stopRemotePumping,
  } = usePumping();
  const {
    activeTimer: tummyTimeTimer,
    stopTummyTime,
    stopRemoteTummyTime,
  } = useTummyTime();
  const isProcessingRef = useRef(false);
  const shouldReprocessRef = useRef(false);
  const processPendingStopRef = useRef<() => Promise<void>>(async () => {});

  const processCommand = useCallback(
    async (queuedCommand: ExternalTimerCommand): Promise<void> => {
      if (queuedCommand.babyId !== selectedBaby?.id) return;

      const completion = await getTimerCompletion(
        queuedCommand.babyId,
        queuedCommand.activityType,
        queuedCommand.timerInstanceId
      );
      if (completion?.status === "completed") {
        await clearPendingWidgetPauseToggle();
        await acknowledgeExternalTimerCommand(queuedCommand);
        return;
      }

      let timer: CommandTimer | null = null;
      let stop: ((endTime: Date) => Promise<unknown>) | null = null;
      let stopRemote: ((endTime: Date) => Promise<unknown>) | null = null;
      switch (queuedCommand.activityType) {
        case "feeding":
          timer = feedingTimer;
          stop = stopBreastfeeding;
          stopRemote = stopRemoteBreastfeeding;
          break;
        case "sleep":
          timer = sleepTimer;
          stop = stopSleep;
          stopRemote = stopRemoteSleep;
          break;
        case "pumping":
          timer = pumpingTimer;
          stop = (endTime) =>
            stopPumping(queuedCommand.payload?.volumeMl ?? 0, endTime);
          stopRemote = stopRemotePumping;
          break;
        case "tummy_time":
          timer = tummyTimeTimer;
          stop = stopTummyTime;
          stopRemote = stopRemoteTummyTime;
          break;
      }

      if (!timer?.isRunning && stopRemote && user?.id && user.householdId) {
        const lock = getLockForActivity(
          queuedCommand.babyId,
          queuedCommand.activityType
        );
        const startedAt = lock ? new Date(lock.startedAt) : null;
        if (
          lock &&
          lock.startedBy !== user.id &&
          startedAt &&
          Number.isFinite(startedAt.getTime())
        ) {
          const timerInstanceId = lock.timerData?.timerInstanceId;
          if (typeof timerInstanceId !== "string" || timerInstanceId.length === 0) {
            await acknowledgeExternalTimerCommand(queuedCommand);
            return;
          }
          timer = {
            isRunning: true,
            startTime: startedAt,
            timerInstanceId,
          };
          stop = stopRemote;
        }
      }

      if (!timer?.isRunning || !stop) return;

      const eventAt = new Date(queuedCommand.eventAt);
      if (timer.startTime.getTime() > eventAt.getTime()) {
        await acknowledgeExternalTimerCommand(queuedCommand);
        return;
      }

      let command = queuedCommand;
      if (command.legacy && command.timerInstanceId.startsWith("legacy:")) {
        command = await claimLegacyExternalTimerCommand(
          command,
          timer.timerInstanceId
        );
      } else if (timer.timerInstanceId !== command.timerInstanceId) {
        await acknowledgeExternalTimerCommand(command);
        return;
      }

      await stop(eventAt);
      await clearPendingWidgetPauseToggle();
      await acknowledgeExternalTimerCommand(command);
      const route = ACTIVITY_ROUTE_MAP[command.activityType];
      if (route) router.push(route as never);
    },
    [
      selectedBaby?.id,
      user?.id,
      user?.householdId,
      getLockForActivity,
      feedingTimer,
      sleepTimer,
      pumpingTimer,
      tummyTimeTimer,
      stopBreastfeeding,
      stopRemoteBreastfeeding,
      stopSleep,
      stopRemoteSleep,
      stopPumping,
      stopRemotePumping,
      stopTummyTime,
      stopRemoteTummyTime,
      router,
    ]
  );

  const processPendingStop = useCallback(async () => {
    if (isProcessingRef.current) {
      shouldReprocessRef.current = true;
      return;
    }
    isProcessingRef.current = true;

    try {
      const commands = await readExternalTimerCommands(selectedBaby?.id);
      for (const command of commands) {
        try {
          await processCommand(command);
        } catch (error) {
          console.error(
            "[WidgetStopHandler] Failed to process pending stop:",
            error
          );
        }
      }
    } catch (error) {
      console.error("[WidgetStopHandler] Failed to read pending stops:", error);
    } finally {
      isProcessingRef.current = false;
      if (shouldReprocessRef.current) {
        shouldReprocessRef.current = false;
        void processPendingStopRef.current();
      }
    }
  }, [processCommand, selectedBaby?.id]);
  processPendingStopRef.current = processPendingStop;

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") processPendingStop();
    });
    const unsubscribeCommands = subscribeExternalTimerCommands(() => {
      void processPendingStopRef.current();
    });
    return () => {
      appStateSubscription.remove();
      unsubscribeCommands();
    };
  }, [processPendingStop]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    processPendingStop();
  }, [processPendingStop]);
}
