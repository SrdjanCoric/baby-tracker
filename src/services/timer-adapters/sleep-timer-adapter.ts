import type { SleepType } from "@/constants/activities";
import type { MorningClassificationState } from "@/types/sleep";
import { MORNING_CLASSIFICATION_VERSION } from "@/types/sleep";
import {
  SleepStorageService,
  type ActiveSleepTimerData,
  type CreateSleepInput,
  type StoredSleepEntry,
} from "../sleep-storage";
import {
  calculateTimerDurationSeconds,
  type RestoredTimer,
  type SharedTimerPayload,
  type TimerLifecycleAdapter,
} from "../timer-lifecycle";
import type { TimerIdentity } from "../timer-completion-service";
import type { TimerLockReconciliationState } from "../timer-lock-reconciliation";

export interface SleepTimerPayload extends SharedTimerPayload {
  type: SleepType;
  morningClassification: MorningClassificationState;
  morningClassificationVersion: number;
}

export interface RestoredSleepTimer extends TimerIdentity {
  isRunning: true;
  lockState: TimerLockReconciliationState;
  isPaused: boolean;
  startTime: Date;
  sleepType: SleepType;
  totalPausedMs: number;
  pausedAt?: Date;
  morningClassification: MorningClassificationState;
  morningClassificationVersion: number;
}

interface CreateSleepTimerAdapterOptions {
  babyId: string;
  resolveMorningClassification(
    startedAt: string,
    stored: MorningClassificationState | null | undefined
  ): MorningClassificationState;
  dispatchRestoreTimer(restoredTimer: RestoredSleepTimer): void;
}

export function createSleepTimerAdapter({
  babyId,
  resolveMorningClassification,
  dispatchRestoreTimer,
}: CreateSleepTimerAdapterOptions): TimerLifecycleAdapter<
  SleepTimerPayload,
  ActiveSleepTimerData,
  StoredSleepEntry,
  CreateSleepInput
> {
  const decodeClassification = (
    startedAt: string,
    value: unknown
  ): MorningClassificationState =>
    resolveMorningClassification(
      startedAt,
      typeof value === "string" && value !== "unresolved"
        ? (value as MorningClassificationState)
        : undefined
    );

  return {
    activityType: "sleep",
    storage: {
      getActiveTimer: (babyIdArgument) =>
        SleepStorageService.getActiveTimer(babyIdArgument),
      setActiveTimer: (babyIdArgument, activeTimer) =>
        SleepStorageService.setActiveTimer(babyIdArgument, activeTimer),
      clearActiveTimer: (babyIdArgument) =>
        SleepStorageService.clearActiveTimer(babyIdArgument),
      getRecordById: (babyIdArgument, recordId) =>
        SleepStorageService.getSleepById(babyIdArgument, recordId),
    },
    timerDataCodec: {
      encode: (payload) => ({
        ...(payload.timerInstanceId
          ? { timerInstanceId: payload.timerInstanceId }
          : {}),
        ...(payload.activityId ? { activityId: payload.activityId } : {}),
        type: payload.type,
        isPaused: payload.isPaused,
        totalPausedMs: payload.totalPausedMs,
        ...(payload.pausedAt ? { pausedAt: payload.pausedAt } : {}),
        morningClassification: payload.morningClassification,
        morningClassificationVersion: payload.morningClassificationVersion,
      }),
      decode: (timerData, startedAt = "") => ({
        ...(typeof timerData.timerInstanceId === "string"
          ? { timerInstanceId: timerData.timerInstanceId }
          : {}),
        ...(typeof timerData.activityId === "string"
          ? { activityId: timerData.activityId }
          : {}),
        type: timerData.type === "night" ? "night" : "nap",
        isPaused: timerData.isPaused === true,
        totalPausedMs:
          typeof timerData.totalPausedMs === "number"
            ? timerData.totalPausedMs
            : 0,
        ...(typeof timerData.pausedAt === "string"
          ? { pausedAt: timerData.pausedAt }
          : {}),
        morningClassification: decodeClassification(
          startedAt,
          timerData.morningClassification
        ),
        morningClassificationVersion:
          typeof timerData.morningClassificationVersion === "number"
            ? timerData.morningClassificationVersion
            : MORNING_CLASSIFICATION_VERSION,
      }),
      fromActiveTimer: (activeTimer) => ({
        ...(activeTimer.timerInstanceId
          ? { timerInstanceId: activeTimer.timerInstanceId }
          : {}),
        ...(activeTimer.activityId
          ? { activityId: activeTimer.activityId }
          : {}),
        type: activeTimer.type === "night" ? "night" : "nap",
        isPaused: activeTimer.isPaused === true,
        totalPausedMs: activeTimer.totalPausedMs ?? 0,
        ...(activeTimer.pausedAt ? { pausedAt: activeTimer.pausedAt } : {}),
        morningClassification: decodeClassification(
          activeTimer.startedAt,
          activeTimer.morningClassification
        ),
        morningClassificationVersion:
          activeTimer.morningClassificationVersion ??
          MORNING_CLASSIFICATION_VERSION,
      }),
    },
    buildRecord: (startedAt, endedAt, payload) => ({
      id: payload.activityId,
      babyId,
      type: payload.type,
      startedAt,
      endedAt,
      durationSeconds: calculateTimerDurationSeconds(
        startedAt,
        endedAt,
        payload.totalPausedMs
      ),
      morningClassification: payload.morningClassification,
      morningClassificationVersion: payload.morningClassificationVersion,
    }),
    liveActivity: {
      type: "sleep",
      detail: (payload) => payload.type,
    },
    dispatchRestoreTimer: ({
      startedAt,
      lockState,
      timerInstanceId,
      activityId,
      payload,
    }: RestoredTimer<SleepTimerPayload>) =>
      dispatchRestoreTimer({
        isRunning: true,
        isPaused: payload.isPaused,
        lockState,
        startTime: startedAt,
        timerInstanceId,
        activityId,
        sleepType: payload.type,
        totalPausedMs: payload.totalPausedMs,
        pausedAt: payload.pausedAt ? new Date(payload.pausedAt) : undefined,
        morningClassification: payload.morningClassification,
        morningClassificationVersion: payload.morningClassificationVersion,
      }),
    alreadyStopped: (startedAt, completedRecords) => {
      const lockStartTime = new Date(startedAt).getTime();
      return completedRecords.some((record) => {
        const entryStart = new Date(record.startedAt).getTime();
        return Math.abs(entryStart - lockStartTime) < 5_000;
      });
    },
  };
}
