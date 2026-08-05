import {
  TummyTimeStorageService,
  type ActiveTummyTimeTimerData,
  type CreateTummyTimeInput,
  type StoredTummyTimeEntry,
} from "../tummyTime-storage";
import {
  calculateTimerDurationSeconds,
  type RestoredTimer,
  type TimerLifecycleAdapter,
} from "../timer-lifecycle";
import type { TimerIdentity } from "../timer-completion-service";
import type { TimerLockReconciliationState } from "../timer-lock-reconciliation";

export interface TummyTimeTimerPayload extends Partial<TimerIdentity> {
  isPaused: boolean;
  totalPausedMs: number;
  pausedAt?: string;
}

export interface RestoredTummyTimeTimer extends TimerIdentity {
  isRunning: true;
  lockState: TimerLockReconciliationState;
  isPaused: boolean;
  startTime: Date;
  totalPausedMs: number;
  pausedAt?: Date;
}

interface CreateTummyTimeTimerAdapterOptions {
  babyId: string;
  dispatchRestoreTimer(restoredTimer: RestoredTummyTimeTimer): void;
}

export function createTummyTimeTimerAdapter({
  babyId,
  dispatchRestoreTimer,
}: CreateTummyTimeTimerAdapterOptions): TimerLifecycleAdapter<
  TummyTimeTimerPayload,
  ActiveTummyTimeTimerData,
  StoredTummyTimeEntry,
  CreateTummyTimeInput
> {
  return {
    activityType: "tummy_time",
    storage: {
      getActiveTimer: babyIdArgument =>
        TummyTimeStorageService.getActiveTimer(babyIdArgument),
      setActiveTimer: (babyIdArgument, activeTimer) =>
        TummyTimeStorageService.setActiveTimer(babyIdArgument, activeTimer),
      clearActiveTimer: babyIdArgument =>
        TummyTimeStorageService.clearActiveTimer(babyIdArgument),
      getRecordById: (babyIdArgument, recordId) =>
        TummyTimeStorageService.getTummyTimeById(babyIdArgument, recordId),
    },
    timerDataCodec: {
      encode: payload => ({
        ...(payload.timerInstanceId
          ? { timerInstanceId: payload.timerInstanceId }
          : {}),
        ...(payload.activityId ? { activityId: payload.activityId } : {}),
        isPaused: payload.isPaused,
        totalPausedMs: payload.totalPausedMs,
        ...(payload.pausedAt ? { pausedAt: payload.pausedAt } : {}),
      }),
      decode: timerData => ({
        ...(typeof timerData.timerInstanceId === "string"
          ? { timerInstanceId: timerData.timerInstanceId }
          : {}),
        ...(typeof timerData.activityId === "string"
          ? { activityId: timerData.activityId }
          : {}),
        isPaused: timerData.isPaused === true,
        totalPausedMs:
          typeof timerData.totalPausedMs === "number"
            ? timerData.totalPausedMs
            : 0,
        ...(typeof timerData.pausedAt === "string"
          ? { pausedAt: timerData.pausedAt }
          : {}),
      }),
      fromActiveTimer: activeTimer => ({
        ...(activeTimer.timerInstanceId
          ? { timerInstanceId: activeTimer.timerInstanceId }
          : {}),
        ...(activeTimer.activityId
          ? { activityId: activeTimer.activityId }
          : {}),
        isPaused: activeTimer.isPaused === true,
        totalPausedMs: activeTimer.totalPausedMs ?? 0,
        ...(activeTimer.pausedAt ? { pausedAt: activeTimer.pausedAt } : {}),
      }),
    },
    buildRecord: (startedAt, endedAt, payload) => ({
      id: payload.activityId,
      babyId,
      startedAt,
      endedAt,
      durationSeconds: calculateTimerDurationSeconds(
        startedAt,
        endedAt,
        payload.totalPausedMs
      ),
    }),
    liveActivity: {
      type: "tummyTime",
      detail: () => undefined,
    },
    dispatchRestoreTimer: ({
      startedAt,
      lockState,
      timerInstanceId,
      activityId,
      payload,
    }: RestoredTimer<TummyTimeTimerPayload>) =>
      dispatchRestoreTimer({
        isRunning: true,
        isPaused: payload.isPaused,
        lockState,
        startTime: startedAt,
        timerInstanceId,
        activityId,
        totalPausedMs: payload.totalPausedMs,
        pausedAt: payload.pausedAt ? new Date(payload.pausedAt) : undefined,
      }),
  };
}
