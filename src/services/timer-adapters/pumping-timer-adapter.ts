import type { BreastSide } from "@/constants/activities";
import {
  PumpingStorageService,
  type ActivePumpingTimerData,
  type CreatePumpingInput,
  type StoredPumpingEntry,
} from "../pumping-storage";
import {
  calculateTimerDuration,
  parseTimerDate,
  type RestoredTimer,
  type SharedTimerPayload,
  type TimerLifecycleAdapter,
} from "../timer-lifecycle";
import type { TimerIdentity } from "../timer-completion-service";
import type { TimerLockReconciliationState } from "../timer-lock-reconciliation";

export interface PumpingTimerPayload extends SharedTimerPayload {
  side: BreastSide;
  leftAccumulatedSeconds: number;
  rightAccumulatedSeconds: number;
  currentSideStartedAt: string;
  /**
   * Set when the timer started on a release without per-side seconds, so
   * the time already run cannot be split and the entry saves no sides.
   */
  sidesUntracked?: boolean;
}

export interface RestoredPumpingTimer extends TimerIdentity {
  isRunning: true;
  lockState: TimerLockReconciliationState;
  isPaused: boolean;
  startTime: Date;
  side: BreastSide;
  leftAccumulatedSeconds: number;
  rightAccumulatedSeconds: number;
  currentSideStartedAt: Date;
  sidesUntracked?: boolean;
  totalPausedMs: number;
  pausedAt?: Date;
  lastResumedAt?: Date;
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
    discardsShortSessions: true,
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
        ...(payload.sidesUntracked
          ? {}
          : {
              leftAccumulatedSeconds: payload.leftAccumulatedSeconds,
              rightAccumulatedSeconds: payload.rightAccumulatedSeconds,
              currentSideStartedAt: payload.currentSideStartedAt,
            }),
        ...(payload.lastResumedAt
          ? { lastResumedAt: payload.lastResumedAt }
          : {}),
        isPaused: payload.isPaused,
        totalPausedMs: payload.totalPausedMs,
        ...(payload.pausedAt ? { pausedAt: payload.pausedAt } : {}),
      }),
      decode: (timerData, startedAt) => ({
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
        leftAccumulatedSeconds:
          typeof timerData.leftAccumulatedSeconds === "number"
            ? timerData.leftAccumulatedSeconds
            : 0,
        rightAccumulatedSeconds:
          typeof timerData.rightAccumulatedSeconds === "number"
            ? timerData.rightAccumulatedSeconds
            : 0,
        currentSideStartedAt:
          typeof timerData.currentSideStartedAt === "string"
            ? timerData.currentSideStartedAt
            : startedAt,
        ...(typeof timerData.currentSideStartedAt === "string"
          ? {}
          : { sidesUntracked: true }),
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
      fromActiveTimer: (activeTimer) => ({
        ...(activeTimer.timerInstanceId
          ? { timerInstanceId: activeTimer.timerInstanceId }
          : {}),
        ...(activeTimer.activityId
          ? { activityId: activeTimer.activityId }
          : {}),
        side: activeTimer.side,
        leftAccumulatedSeconds: activeTimer.leftAccumulatedSeconds ?? 0,
        rightAccumulatedSeconds: activeTimer.rightAccumulatedSeconds ?? 0,
        currentSideStartedAt:
          activeTimer.currentSideStartedAt ?? activeTimer.startedAt,
        ...(activeTimer.sidesUntracked || !activeTimer.currentSideStartedAt
          ? { sidesUntracked: true }
          : {}),
        ...(activeTimer.lastResumedAt
          ? { lastResumedAt: activeTimer.lastResumedAt }
          : {}),
        isPaused: activeTimer.isPaused === true,
        totalPausedMs: activeTimer.totalPausedMs ?? 0,
        ...(activeTimer.pausedAt ? { pausedAt: activeTimer.pausedAt } : {}),
      }),
    },
    buildRecord: (startedAt, endedAt, payload) => {
      let leftDurationSeconds = payload.leftAccumulatedSeconds;
      let rightDurationSeconds = payload.rightAccumulatedSeconds;
      if (payload.sidesUntracked) {
        leftDurationSeconds = 0;
        rightDurationSeconds = 0;
      } else if (!payload.isPaused) {
        const currentSideElapsed = Math.max(
          0,
          Math.floor(
            (endedAt.getTime() -
              new Date(payload.currentSideStartedAt).getTime()) /
              1000
          )
        );
        if (payload.side === "left" || payload.side === "both")
          leftDurationSeconds += currentSideElapsed;
        if (payload.side === "right" || payload.side === "both")
          rightDurationSeconds += currentSideElapsed;
      }

      return {
        id: payload.activityId,
        babyId,
        side: payload.side,
        startedAt,
        endedAt,
        ...calculateTimerDuration(
          startedAt,
          endedAt,
          payload.totalPausedMs,
          "pumping"
        ),
        leftDurationSeconds:
          leftDurationSeconds > 0 ? leftDurationSeconds : undefined,
        rightDurationSeconds:
          rightDurationSeconds > 0 ? rightDurationSeconds : undefined,
      };
    },
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
        leftAccumulatedSeconds: payload.leftAccumulatedSeconds,
        rightAccumulatedSeconds: payload.rightAccumulatedSeconds,
        currentSideStartedAt:
          parseTimerDate(payload.currentSideStartedAt) ?? startedAt,
        ...(payload.sidesUntracked ? { sidesUntracked: true } : {}),
        totalPausedMs: payload.totalPausedMs,
        pausedAt: parseTimerDate(payload.pausedAt),
        lastResumedAt: parseTimerDate(payload.lastResumedAt),
      }),
  };
}
