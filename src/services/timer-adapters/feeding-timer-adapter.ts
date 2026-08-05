import type { BreastSide, FeedingType } from "@/constants/activities";
import {
  FeedingStorageService,
  type ActiveTimerData,
  type CreateFeedingInput,
  type StoredFeedingEntry,
} from "../feeding-storage";
import type { BreastSide as LiveActivityBreastSide } from "../live-activity-service";
import {
  calculateTimerDurationSeconds,
  type RestoredTimer,
  type SharedTimerPayload,
  type TimerLifecycleAdapter,
} from "../timer-lifecycle";
import type { TimerIdentity } from "../timer-completion-service";
import type { TimerLockReconciliationState } from "../timer-lock-reconciliation";

export interface FeedingTimerPayload extends SharedTimerPayload {
  side?: BreastSide;
  type: FeedingType;
  leftAccumulatedSeconds: number;
  rightAccumulatedSeconds: number;
  currentSideStartedAt: string;
}

export interface RestoredFeedingTimer extends TimerIdentity {
  isRunning: true;
  lockState: TimerLockReconciliationState;
  isPaused: boolean;
  startTime: Date;
  side?: BreastSide;
  leftAccumulatedSeconds: number;
  rightAccumulatedSeconds: number;
  currentSideStartedAt: Date;
  totalPausedMs: number;
  pausedAt?: Date;
}

interface CreateFeedingTimerAdapterOptions {
  babyId: string;
  dispatchRestoreTimer(restoredTimer: RestoredFeedingTimer): void;
}

function decodeSide(value: unknown): BreastSide | undefined {
  return value === "left" || value === "right" || value === "both"
    ? value
    : undefined;
}

export function createFeedingTimerAdapter({
  babyId,
  dispatchRestoreTimer,
}: CreateFeedingTimerAdapterOptions): TimerLifecycleAdapter<
  FeedingTimerPayload,
  ActiveTimerData,
  StoredFeedingEntry,
  CreateFeedingInput
> {
  return {
    activityType: "feeding",
    storage: {
      getActiveTimer: (babyIdArgument) =>
        FeedingStorageService.getActiveTimer(babyIdArgument),
      setActiveTimer: (babyIdArgument, activeTimer) =>
        FeedingStorageService.setActiveTimer(babyIdArgument, activeTimer),
      clearActiveTimer: (babyIdArgument) =>
        FeedingStorageService.clearActiveTimer(babyIdArgument),
      getRecordById: (babyIdArgument, recordId) =>
        FeedingStorageService.getFeedingById(babyIdArgument, recordId),
    },
    timerDataCodec: {
      encode: (payload) => ({
        ...(payload.timerInstanceId
          ? { timerInstanceId: payload.timerInstanceId }
          : {}),
        ...(payload.activityId ? { activityId: payload.activityId } : {}),
        ...(payload.side ? { side: payload.side } : {}),
        type: payload.type,
        leftAccumulatedSeconds: payload.leftAccumulatedSeconds,
        rightAccumulatedSeconds: payload.rightAccumulatedSeconds,
        currentSideStartedAt: payload.currentSideStartedAt,
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
        ...(decodeSide(timerData.side)
          ? { side: decodeSide(timerData.side) }
          : {}),
        type: "breast",
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
        ...(activeTimer.side ? { side: activeTimer.side } : {}),
        type: activeTimer.type,
        leftAccumulatedSeconds: activeTimer.leftAccumulatedSeconds ?? 0,
        rightAccumulatedSeconds: activeTimer.rightAccumulatedSeconds ?? 0,
        currentSideStartedAt:
          activeTimer.currentSideStartedAt ?? activeTimer.startedAt,
        isPaused: activeTimer.isPaused === true,
        totalPausedMs: activeTimer.totalPausedMs ?? 0,
        ...(activeTimer.pausedAt ? { pausedAt: activeTimer.pausedAt } : {}),
      }),
    },
    buildRecord: (startedAt, endedAt, payload) => {
      let leftDurationSeconds = payload.leftAccumulatedSeconds;
      let rightDurationSeconds = payload.rightAccumulatedSeconds;

      if (!payload.isPaused) {
        const currentSideStartedAt = payload.currentSideStartedAt
          ? new Date(payload.currentSideStartedAt)
          : startedAt;
        const currentSideElapsed = Math.max(
          0,
          Math.floor(
            (endedAt.getTime() - currentSideStartedAt.getTime()) / 1000
          )
        );
        if (payload.side === "left") leftDurationSeconds += currentSideElapsed;
        if (payload.side === "right")
          rightDurationSeconds += currentSideElapsed;
        if (payload.side === "both") {
          leftDurationSeconds += currentSideElapsed;
          rightDurationSeconds += currentSideElapsed;
        }
      }

      const largerSide =
        leftDurationSeconds >= rightDurationSeconds ? "left" : "right";
      const side =
        leftDurationSeconds > 0 && rightDurationSeconds > 0
          ? "both"
          : largerSide;

      return {
        id: payload.activityId,
        babyId,
        type: "breast",
        side,
        lastFinishedSide: payload.side,
        startedAt,
        endedAt,
        durationSeconds: calculateTimerDurationSeconds(
          startedAt,
          endedAt,
          payload.totalPausedMs
        ),
        leftDurationSeconds:
          leftDurationSeconds > 0 ? leftDurationSeconds : undefined,
        rightDurationSeconds:
          rightDurationSeconds > 0 ? rightDurationSeconds : undefined,
      };
    },
    liveActivity: {
      type: "feeding",
      detail: (payload) => payload.side as LiveActivityBreastSide,
    },
    dispatchRestoreTimer: ({
      startedAt,
      lockState,
      timerInstanceId,
      activityId,
      payload,
    }: RestoredTimer<FeedingTimerPayload>) =>
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
        currentSideStartedAt: payload.currentSideStartedAt
          ? new Date(payload.currentSideStartedAt)
          : startedAt,
        totalPausedMs: payload.totalPausedMs,
        pausedAt: payload.pausedAt ? new Date(payload.pausedAt) : undefined,
      }),
  };
}
