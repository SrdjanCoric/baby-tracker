import {
  TummyTimeStorageService,
  type ActiveTummyTimeTimerData,
  type CreateTummyTimeInput,
  type StoredTummyTimeEntry,
} from "../tummyTime-storage";
import {
  calculateTimerDuration,
  parseTimerDate,
  type RestoredTimer,
  type SharedTimerPayload,
  type TimerLifecycleAdapter,
} from "../timer-lifecycle";
import type { TimerIdentity } from "../timer-completion-service";
import type { TimerLockReconciliationState } from "../timer-lock-reconciliation";

export type TummyTimeTimerPayload = SharedTimerPayload;

export interface RestoredTummyTimeTimer extends TimerIdentity {
  isRunning: true;
  lockState: TimerLockReconciliationState;
  isPaused: boolean;
  startTime: Date;
  totalPausedMs: number;
  pausedAt?: Date;
  lastResumedAt?: Date;
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
    discardsShortSessions: false,
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
        ...(payload.lastResumedAt
          ? { lastResumedAt: payload.lastResumedAt }
          : {}),
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
        ...(typeof timerData.lastResumedAt === "string"
          ? { lastResumedAt: timerData.lastResumedAt }
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
        ...(activeTimer.lastResumedAt
          ? { lastResumedAt: activeTimer.lastResumedAt }
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
      ...calculateTimerDuration(
        startedAt,
        endedAt,
        payload.totalPausedMs,
        "tummy_time"
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
        pausedAt: parseTimerDate(payload.pausedAt),
        lastResumedAt: parseTimerDate(payload.lastResumedAt),
      }),
  };
}
