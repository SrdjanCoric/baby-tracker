import type { BreastSide } from "@/constants/activities";
import {
  PumpingStorageService,
  type ActivePumpingTimerData,
  type CreatePumpingInput,
  type StoredPumpingEntry,
} from "../pumping-storage";
import {
  calculateTimerDurationSeconds,
  parseTimerDate,
  type RestoredTimer,
  type SharedTimerPayload,
  type TimerLifecycleAdapter,
} from "../timer-lifecycle";
import type { TimerIdentity } from "../timer-completion-service";
import type { TimerLockReconciliationState } from "../timer-lock-reconciliation";

export interface PumpingTimerPayload extends SharedTimerPayload {
  side: BreastSide;
}

export interface RestoredPumpingTimer extends TimerIdentity {
  isRunning: true;
  lockState: TimerLockReconciliationState;
  isPaused: boolean;
  startTime: Date;
  side: BreastSide;
  totalPausedMs: number;
  pausedAt?: Date;
}

interface CreatePumpingTimerAdapterOptions {
  babyId: string;
  dispatchRestoreTimer(restoredTimer: RestoredPumpingTimer): void;
}

export function createPumpingTimerAdapter({
  babyId,
  dispatchRestoreTimer,
}: CreatePumpingTimerAdapterOptions): TimerLifecycleAdapter<
  PumpingTimerPayload,
  ActivePumpingTimerData,
  StoredPumpingEntry,
  CreatePumpingInput
> {
  return {
    activityType: "pumping",
    storage: {
      getActiveTimer: (babyIdArgument) =>
        PumpingStorageService.getActiveTimer(babyIdArgument),
      setActiveTimer: (babyIdArgument, activeTimer) =>
        PumpingStorageService.setActiveTimer(babyIdArgument, activeTimer),
      clearActiveTimer: (babyIdArgument) =>
        PumpingStorageService.clearActiveTimer(babyIdArgument),
      getRecordById: (babyIdArgument, recordId) =>
        PumpingStorageService.getPumpingById(babyIdArgument, recordId),
    },
    timerDataCodec: {
      encode: (payload) => ({
        ...(payload.timerInstanceId
          ? { timerInstanceId: payload.timerInstanceId }
          : {}),
        ...(payload.activityId ? { activityId: payload.activityId } : {}),
        side: payload.side,
        isPaused: payload.isPaused,
        totalPausedMs: payload.totalPausedMs,
        ...(payload.pausedAt ? { pausedAt: payload.pausedAt } : {}),
      }),
      decode: (timerData) => ({
        ...(typeof timerData.timerInstanceId === "string"
          ? { timerInstanceId: timerData.timerInstanceId }
          : {}),
        ...(typeof timerData.activityId === "string"
          ? { activityId: timerData.activityId }
          : {}),
        side:
          timerData.side === "left" || timerData.side === "right"
            ? timerData.side
            : "both",
        isPaused: timerData.isPaused === true,
        totalPausedMs:
          typeof timerData.totalPausedMs === "number"
            ? timerData.totalPausedMs
            : 0,
        ...(typeof timerData.pausedAt === "string"
          ? { pausedAt: timerData.pausedAt }
          : {}),
      }),
      fromActiveTimer: (activeTimer) => ({
        ...(activeTimer.timerInstanceId
          ? { timerInstanceId: activeTimer.timerInstanceId }
          : {}),
        ...(activeTimer.activityId
          ? { activityId: activeTimer.activityId }
          : {}),
        side: activeTimer.side,
        isPaused: activeTimer.isPaused === true,
        totalPausedMs: activeTimer.totalPausedMs ?? 0,
        ...(activeTimer.pausedAt ? { pausedAt: activeTimer.pausedAt } : {}),
      }),
    },
    buildRecord: (startedAt, endedAt, payload) => ({
      id: payload.activityId,
      babyId,
      side: payload.side,
      startedAt,
      endedAt,
      durationSeconds: calculateTimerDurationSeconds(
        startedAt,
        endedAt,
        payload.totalPausedMs
      ),
    }),
    liveActivity: {
      type: "pumping",
      detail: (payload) => payload.side,
    },
    dispatchRestoreTimer: ({
      startedAt,
      lockState,
      timerInstanceId,
      activityId,
      payload,
    }: RestoredTimer<PumpingTimerPayload>) =>
      dispatchRestoreTimer({
        isRunning: true,
        isPaused: payload.isPaused,
        lockState,
        startTime: startedAt,
        timerInstanceId,
        activityId,
        side: payload.side,
        totalPausedMs: payload.totalPausedMs,
        pausedAt: parseTimerDate(payload.pausedAt),
      }),
  };
}
