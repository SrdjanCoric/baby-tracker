import {
  getActiveTimerLock,
  isRetryableTimerWriteError,
  queuePendingLockRelease,
  queuePendingTimerStartEdit,
  releaseTimerLock,
  updateTimerStartTime,
  type TimerActivityType,
} from "./active-timer-service";
import {
  endLiveActivityByType,
  endTimerLiveActivity,
  isLiveActivityRunningWithTimeout,
  pauseTimerLiveActivity,
  startTimerLiveActivity,
  type BreastSide,
  type SleepType,
  type TimerActivityType as LiveActivityType,
} from "./live-activity-service";
import {
  acceptTimerCompletion,
  isTimerCompletionSecured,
  markTimerCompletionDurable,
  resolveTimerIdentity,
  type TimerIdentity,
} from "./timer-completion-service";
import {
  reconcileTimerLock,
  type TimerLockReconciliationSnapshot,
  type TimerLockReconciliationState,
} from "./timer-lock-reconciliation";
import {
  isPendingStopForTimer,
  isTimerRestoreObsolete,
  readPendingTimerStop,
} from "./timer-stop-coordinator";
import { showTimerConflictNotice } from "./timer-conflict-notice";
import { shouldDiscardTimerDuration } from "@/utils/timer-duration";

export interface SharedTimerPayload extends Partial<TimerIdentity> {
  isPaused: boolean;
  totalPausedMs: number;
  pausedAt?: string;
}

export interface TimerLifecycleActiveTimer
  extends Partial<TimerIdentity>, TimerLockReconciliationSnapshot {
  startedAt: string;
  liveActivityId?: string;
  isPaused?: boolean;
  totalPausedMs?: number;
  pausedAt?: string;
}

export interface RestoredTimer<
  TPayload extends SharedTimerPayload,
> extends TimerIdentity {
  startedAt: Date;
  lockState: TimerLockReconciliationState;
  payload: TPayload & TimerIdentity;
}

type MutableRef<T> = { current: T };

interface TimerLifecycleUser {
  id?: string;
  householdId?: string;
}

export interface TimerDataCodec<TPayload, TActiveTimer> {
  encode(payload: TPayload): Record<string, unknown>;
  decode(timerData: Record<string, unknown>, startedAt: string): TPayload;
  fromActiveTimer(activeTimer: TActiveTimer): TPayload;
}

type HydratedActiveTimer<TPayload extends SharedTimerPayload> =
  TimerLifecycleActiveTimer & TPayload & TimerIdentity;

export interface TimerLifecycleStorage<
  TPayload extends SharedTimerPayload,
  TActiveTimer,
  TRecord,
> {
  getActiveTimer(babyId: string): Promise<TActiveTimer | null>;
  setActiveTimer(
    babyId: string,
    activeTimer: HydratedActiveTimer<TPayload>
  ): Promise<void>;
  clearActiveTimer(babyId: string): Promise<void>;
  getRecordById(babyId: string, recordId: string): Promise<TRecord | null>;
}

export interface TimerLifecycleAdapter<
  TPayload extends SharedTimerPayload,
  TActiveTimer extends TimerLifecycleActiveTimer,
  TRecord,
  TCreateInput,
> {
  activityType: TimerActivityType;
  storage: TimerLifecycleStorage<TPayload, TActiveTimer, TRecord>;
  timerDataCodec: TimerDataCodec<TPayload, TActiveTimer>;
  buildRecord(
    startedAt: Date,
    endedAt: Date,
    payload: TPayload & TimerIdentity
  ): TCreateInput;
  liveActivity: {
    type: LiveActivityType;
    detail(payload: TPayload): BreastSide | SleepType | undefined;
  };
  dispatchRestoreTimer(restoredTimer: RestoredTimer<TPayload>): void;
  alreadyStopped?(
    startedAt: string,
    completedRecords: ReadonlyArray<TRecord>
  ): boolean;
}

export interface EditRunningTimerStartTimeOptions<
  TPayload extends SharedTimerPayload,
  TActiveTimer extends TimerLifecycleActiveTimer,
  TRecord,
  TCreateInput,
> {
  adapter: TimerLifecycleAdapter<
    TPayload,
    TActiveTimer,
    TRecord,
    TCreateInput
  >;
  baby: { id: string; name: string };
  userId: string;
  activeTimer: TActiveTimer & TimerIdentity;
  payload: TPayload & TimerIdentity;
  startedAt: Date;
  liveActivityIdRef: MutableRef<string | null>;
  dispatchEditedStart(startedAt: Date): void;
}

export interface RestoreTimerLifecycleOptions<
  TPayload extends SharedTimerPayload,
  TActiveTimer extends TimerLifecycleActiveTimer,
  TRecord extends { id: string },
  TCreateInput,
> {
  adapter: TimerLifecycleAdapter<TPayload, TActiveTimer, TRecord, TCreateInput>;
  baby: { id: string; name: string };
  user: TimerLifecycleUser | null | undefined;
  completedRecords: ReadonlyArray<TRecord>;
  stopVersionAtStart: number;
  currentStopVersion(): number;
  isStopping(): boolean;
  isCurrentBabyBinding(): boolean;
  liveActivityIdRef: MutableRef<string | null>;
  refreshLocks(): Promise<unknown> | unknown;
  persistRecord(input: TCreateInput): Promise<TRecord>;
  dispatchStopTimer(): void;
  dispatchAddRecord(record: TRecord): void;
  onCompletionSecured?(): Promise<unknown> | unknown;
  errorLabel: string;
}

export function calculateTimerDurationSeconds(
  startedAt: Date,
  endedAt: Date,
  _totalPausedMs: number
): number {
  return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
}

export function parseTimerDate(
  value: string | undefined,
  fallback?: Date
): Date | undefined {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

export async function editRunningTimerStartTime<
  TPayload extends SharedTimerPayload,
  TActiveTimer extends TimerLifecycleActiveTimer,
  TRecord,
  TCreateInput,
>({
  adapter,
  baby,
  userId,
  activeTimer,
  payload,
  startedAt,
  liveActivityIdRef,
  dispatchEditedStart,
}: EditRunningTimerStartTimeOptions<
  TPayload,
  TActiveTimer,
  TRecord,
  TCreateInput
>): Promise<void> {
  const timerData = adapter.timerDataCodec.encode(payload);
  if (activeTimer.lockState !== "offline") {
    try {
      await updateTimerStartTime(
        baby.id,
        adapter.activityType,
        userId,
        startedAt,
        timerData
      );
    } catch (error) {
      if (!isRetryableTimerWriteError(error)) throw error;
      await queuePendingTimerStartEdit(
        baby.id,
        adapter.activityType,
        userId,
        activeTimer.timerInstanceId,
        startedAt,
        timerData
      );
    }
  }

  const oldLiveActivityId =
    liveActivityIdRef.current ?? activeTimer.liveActivityId ?? null;
  const endedById = oldLiveActivityId
    ? await endTimerLiveActivity(oldLiveActivityId)
    : false;
  if (!endedById) {
    await endLiveActivityByType(adapter.liveActivity.type);
  }

  const replacementLiveActivityId = await startTimerLiveActivity(
    adapter.liveActivity.type,
    baby.name,
    adapter.liveActivity.detail(payload),
    startedAt
  );
  liveActivityIdRef.current = replacementLiveActivityId;

  if (replacementLiveActivityId && payload.isPaused) {
    const pausedAt = parseTimerDate(payload.pausedAt, new Date());
    const activeElapsedSeconds = Math.max(
      0,
      Math.floor(
        ((pausedAt ?? new Date()).getTime() - startedAt.getTime()) / 1000
      )
    );
    await pauseTimerLiveActivity(
      replacementLiveActivityId,
      activeElapsedSeconds
    );
  }

  await adapter.storage.setActiveTimer(baby.id, {
    ...activeTimer,
    ...payload,
    startedAt: startedAt.toISOString(),
    liveActivityId: replacementLiveActivityId ?? undefined,
  });
  dispatchEditedStart(startedAt);
}

function restoredTimer<TPayload extends SharedTimerPayload>(
  startedAt: string,
  lockState: TimerLockReconciliationState,
  identity: TimerIdentity,
  payload: TPayload
): RestoredTimer<TPayload> {
  return {
    startedAt: new Date(startedAt),
    lockState,
    ...identity,
    payload: { ...payload, ...identity },
  };
}

export async function restoreTimerLifecycle<
  TPayload extends SharedTimerPayload,
  TActiveTimer extends TimerLifecycleActiveTimer,
  TRecord extends { id: string },
  TCreateInput,
>({
  adapter,
  baby,
  user,
  completedRecords,
  stopVersionAtStart,
  currentStopVersion,
  isStopping,
  isCurrentBabyBinding,
  liveActivityIdRef,
  refreshLocks,
  persistRecord,
  dispatchStopTimer,
  dispatchAddRecord,
  onCompletionSecured,
  errorLabel,
}: RestoreTimerLifecycleOptions<
  TPayload,
  TActiveTimer,
  TRecord,
  TCreateInput
>): Promise<void> {
  const isRestoreObsolete = () =>
    isTimerRestoreObsolete(
      stopVersionAtStart,
      currentStopVersion(),
      isStopping()
    );
  const acceptStartedLiveActivity = async (activityId: string | null) => {
    if (!isCurrentBabyBinding()) {
      if (activityId) await endTimerLiveActivity(activityId);
      return false;
    }
    if (activityId) liveActivityIdRef.current = activityId;
    return true;
  };
  const endAdapterLiveActivity = async (activityId?: string | null) => {
    const endedById = activityId
      ? await endTimerLiveActivity(activityId)
      : false;
    if (!endedById) {
      await endLiveActivityByType(adapter.liveActivity.type);
    }
    liveActivityIdRef.current = null;
  };
  const releaseOrQueueLock = async (
    identity: TimerIdentity,
    startedAt: string
  ) => {
    if (!user?.id) return;
    try {
      await releaseTimerLock(
        baby.id,
        adapter.activityType,
        user.id,
        identity.timerInstanceId,
        startedAt
      );
    } catch {
      await queuePendingLockRelease(
        baby.id,
        adapter.activityType,
        user.id,
        identity.timerInstanceId,
        startedAt
      );
    }
  };
  const startAdapterLiveActivity = async (
    startedAt: string,
    payload: TPayload
  ) => {
    const activityId = await startTimerLiveActivity(
      adapter.liveActivity.type,
      baby.name,
      adapter.liveActivity.detail(payload),
      new Date(startedAt)
    );
    return acceptStartedLiveActivity(activityId);
  };

  if (isRestoreObsolete()) return;

  const activeTimer = await adapter.storage.getActiveTimer(baby.id);
  const pendingStop = activeTimer
    ? await readPendingTimerStop(adapter.activityType, baby.id)
    : null;
  if (!isCurrentBabyBinding() || isRestoreObsolete()) return;
  const hasPendingStop = activeTimer
    ? isPendingStopForTimer(
        pendingStop,
        adapter.activityType,
        new Date(activeTimer.startedAt),
        baby.id,
        activeTimer.timerInstanceId
      )
    : false;

  if (activeTimer) {
    const identity = await resolveTimerIdentity(
      baby.id,
      adapter.activityType,
      activeTimer.startedAt,
      activeTimer
    );
    if (
      await isTimerCompletionSecured(
        baby.id,
        adapter.activityType,
        identity,
        completedRecords
      )
    ) {
      await endAdapterLiveActivity(
        activeTimer.liveActivityId ?? liveActivityIdRef.current
      );
      await adapter.storage.clearActiveTimer(baby.id);
      dispatchStopTimer();
      await onCompletionSecured?.();
      await releaseOrQueueLock(identity, activeTimer.startedAt);
      return;
    }

    const payload = adapter.timerDataCodec.fromActiveTimer(activeTimer);
    const payloadWithIdentity = { ...payload, ...identity };

    if (!activeTimer.timerInstanceId || !activeTimer.activityId) {
      await adapter.storage.setActiveTimer(baby.id, {
        ...activeTimer,
        ...payloadWithIdentity,
      });
    }

    let isStale = false;
    let lockState: TimerLockReconciliationState =
      activeTimer.lockState ?? "offline";

    if (user?.id && user.householdId && !hasPendingStop) {
      const persistLockState = async (
        nextLockState: TimerLockReconciliationState
      ) => {
        if (!isCurrentBabyBinding() || isRestoreObsolete()) return;
        lockState = nextLockState;
        await adapter.storage.setActiveTimer(baby.id, {
          ...activeTimer,
          ...payloadWithIdentity,
          lockState: nextLockState,
        });
      };

      const reconciliation = await reconcileTimerLock({
        babyId: baby.id,
        activityType: adapter.activityType,
        userId: user.id,
        startedAt: activeTimer.startedAt,
        timerInstanceId: identity.timerInstanceId,
        timerData: adapter.timerDataCodec.encode(payloadWithIdentity),
        persistState: persistLockState,
      });
      if (!isCurrentBabyBinding() || isRestoreObsolete()) return;
      if (reconciliation.state !== "offline") await refreshLocks();

      if (reconciliation.state === "conflicted") {
        const currentTime = new Date(Date.now());
        const requestedStopTime = activeTimer.isPaused
          ? (parseTimerDate(activeTimer.pausedAt, currentTime) ?? currentTime)
          : currentTime;
        const startedAt = new Date(activeTimer.startedAt);
        const startedAtMs = startedAt.getTime();
        const requestedStopTimeMs = requestedStopTime.getTime();
        const requestedDurationSeconds = Math.floor(
          (requestedStopTimeMs - startedAtMs) / 1000
        );
        if (
          !Number.isFinite(startedAtMs) ||
          !Number.isFinite(requestedStopTimeMs) ||
          requestedStopTimeMs < startedAtMs ||
          shouldDiscardTimerDuration(requestedDurationSeconds)
        ) {
          dispatchStopTimer();
          isStale = true;
          await adapter.storage.clearActiveTimer(baby.id);
          await endAdapterLiveActivity(activeTimer.liveActivityId);
          showTimerConflictNotice(reconciliation.lockHolderName);
          return;
        }
        const completion = await acceptTimerCompletion(
          baby.id,
          adapter.activityType,
          activeTimer.startedAt,
          identity,
          requestedStopTime
        );
        dispatchStopTimer();
        let record = await adapter.storage.getRecordById(
          baby.id,
          completion.activityId
        );

        if (!record) {
          record = await persistRecord(
            adapter.buildRecord(
              startedAt,
              new Date(completion.stoppedAt),
              {
                ...payloadWithIdentity,
                activityId: completion.activityId,
              }
            )
          );
          await markTimerCompletionDurable(completion);
        }

        dispatchAddRecord(record);
        dispatchStopTimer();
        isStale = true;
        await adapter.storage.clearActiveTimer(baby.id);
        await endAdapterLiveActivity(activeTimer.liveActivityId);
        showTimerConflictNotice(reconciliation.lockHolderName);
        if (!isCurrentBabyBinding()) return;
      }
    }

    if (!isStale && !isRestoreObsolete()) {
      adapter.dispatchRestoreTimer(
        restoredTimer(activeTimer.startedAt, lockState, identity, payload)
      );

      if (!hasPendingStop && activeTimer.liveActivityId) {
        const isRunning = await isLiveActivityRunningWithTimeout(
          activeTimer.liveActivityId
        );
        if (!isCurrentBabyBinding()) return;
        if (isRunning) {
          liveActivityIdRef.current = activeTimer.liveActivityId;
        } else if (!payload.isPaused) {
          if (
            !(await startAdapterLiveActivity(activeTimer.startedAt, payload))
          ) {
            return;
          }
        }
      } else if (!hasPendingStop && !payload.isPaused) {
        if (!(await startAdapterLiveActivity(activeTimer.startedAt, payload))) {
          return;
        }
      }
    }
  } else if (user?.id && user.householdId) {
    try {
      const lock = await getActiveTimerLock(baby.id, adapter.activityType);
      if (!isCurrentBabyBinding()) return;
      if (lock && lock.startedBy === user.id && !isRestoreObsolete()) {
        const timerData = lock.timerData ?? {};
        const identity = await resolveTimerIdentity(
          baby.id,
          adapter.activityType,
          lock.startedAt,
          timerData
        );
        const completionSecured = await isTimerCompletionSecured(
          baby.id,
          adapter.activityType,
          identity,
          completedRecords
        );
        if (
          completionSecured ||
          adapter.alreadyStopped?.(lock.startedAt, completedRecords)
        ) {
          await releaseOrQueueLock(identity, lock.startedAt);
          return;
        }

        const payload = adapter.timerDataCodec.decode(
          timerData,
          lock.startedAt
        );
        const payloadWithIdentity = { ...payload, ...identity };
        adapter.dispatchRestoreTimer(
          restoredTimer(lock.startedAt, "owned", identity, payload)
        );
        await adapter.storage.setActiveTimer(baby.id, {
          startedAt: lock.startedAt,
          ...payloadWithIdentity,
          lockState: "owned",
        });
        if (!isCurrentBabyBinding()) return;

        if (!payload.isPaused) {
          if (!(await startAdapterLiveActivity(lock.startedAt, payload))) {
            return;
          }
        }
      }
    } catch (error) {
      if (!isCurrentBabyBinding()) return;
      console.error(`${errorLabel} Failed to restore from server:`, error);
    }
  }
}
