import { isTimerAccessUnavailable } from "./timer-access-error";
import {
  getActiveTimerLock,
  hasPendingLockRelease,
  findActiveTimerLock,
  isRetryableTimerWriteError,
  queuePendingLockRelease,
  queuePendingTimerStartEdit,
  releaseTimerLock,
  releaseTimerLockDurably,
  updateTimerStartTime,
  type TimerActivityType,
  type ActiveTimerLock,
} from "./active-timer-service";
import {
  endLiveActivityByType,
  endTimerLiveActivity,
  isLiveActivityRunningWithTimeout,
  pauseTimerLiveActivity,
  startTimerLiveActivity,
  bindTimerLiveActivity,
  type BreastSide,
  type SleepType,
  type TimerActivityType as LiveActivityType,
} from "./live-activity-service";
import {
  acceptTimerCompletion,
  discardTimerCompletion,
  isTimerCompletionSecured,
  markTimerCompletionDurable,
  resolveTimerIdentity,
  type TimerIdentity,
  type TimerCompletionRecord,
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
import {
  calculateActiveDurationSeconds,
  shouldDiscardTimerDuration,
} from "@/utils/timer-duration";
import {
  errorCode,
  recordBreadcrumb,
  reportIssue,
} from "@/utils/observability-sink";

export interface SharedTimerPayload extends Partial<TimerIdentity> {
  isPaused: boolean;
  totalPausedMs: number;
  pausedAt?: string;
  lastResumedAt?: string;
}

export interface TimerLifecycleActiveTimer
  extends Partial<TimerIdentity>, TimerLockReconciliationSnapshot {
  startedAt: string;
  liveActivityId?: string;
  isPaused?: boolean;
  totalPausedMs?: number;
  pausedAt?: string;
  lastResumedAt?: string;
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
  discardsShortSessions: boolean;
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
  adapter: TimerLifecycleAdapter<TPayload, TActiveTimer, TRecord, TCreateInput>;
  baby: { id: string; name: string };
  userId?: string;
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
  persistRecord(
    input: TCreateInput,
    completion: TimerCompletionRecord
  ): Promise<TRecord>;
  dispatchStopTimer(): void;
  dispatchAddRecord(record: TRecord): void;
  onCompletionSecured?(): Promise<unknown> | unknown;
  errorLabel: string;
  timerSnapshot?: Promise<readonly ActiveTimerLock[]>;
}

export interface StopRemoteTimerLifecycleOptions<
  TPayload extends SharedTimerPayload,
  TActiveTimer extends TimerLifecycleActiveTimer,
  TRecord extends { id: string },
  TCreateInput,
> {
  adapter: TimerLifecycleAdapter<TPayload, TActiveTimer, TRecord, TCreateInput>;
  babyId: string;
  userId: string;
  lock: ActiveTimerLock;
  requestedStopTime?: Date;
  persistRecord(
    input: TCreateInput,
    completion: TimerCompletionRecord
  ): Promise<TRecord>;
  dispatchAddRecord(record: TRecord): void;
  refreshLocks?(): Promise<unknown> | unknown;
}

export interface ObservedOwnedTimer {
  timerInstanceId: string;
  startTime: Date;
  lockState: TimerLockReconciliationState;
  isPaused: boolean;
  totalPausedMs: number;
  pausedAt?: Date;
  lastResumedAt?: Date;
}

export interface ObservedTimerPauseChange<TPayload extends SharedTimerPayload> {
  isPaused: boolean;
  totalPausedMs: number;
  pausedAt?: Date;
  lastResumedAt?: Date;
  accumulatedSeconds: number;
  payload: TPayload;
}

export interface SyncObservedOwnedTimerLockOptions<
  TPayload extends SharedTimerPayload,
  TActiveTimer extends ObservedOwnedTimer,
> {
  activityType: TimerActivityType;
  babyId?: string;
  userId?: string;
  activeTimer: TActiveTimer | null;
  locks: readonly ActiveTimerLock[];
  locksLoading: boolean;
  observedTimerInstanceIdRef: { current: string | null };
  timerDataCodec: Pick<TimerDataCodec<TPayload, unknown>, "decode">;
  onPauseChange(
    change: ObservedTimerPauseChange<TPayload>,
    activeTimer: TActiveTimer
  ): Promise<unknown> | unknown;
  onVanished(activeTimer: TActiveTimer): Promise<unknown> | unknown;
}

function matchesOwnedTimerLock(
  lock: ActiveTimerLock | undefined,
  userId: string,
  timerInstanceId: string,
  startedAt: Date
): boolean {
  if (!lock || lock.startedBy !== userId) return false;
  const serverTimerInstanceId = lock.timerData?.timerInstanceId;
  return typeof serverTimerInstanceId === "string"
    ? serverTimerInstanceId === timerInstanceId
    : new Date(lock.startedAt).getTime() === startedAt.getTime();
}

export async function syncObservedOwnedTimerLock<
  TPayload extends SharedTimerPayload,
  TActiveTimer extends ObservedOwnedTimer,
>({
  activityType,
  babyId,
  userId,
  activeTimer,
  locks,
  locksLoading,
  observedTimerInstanceIdRef,
  onPauseChange,
  onVanished,
  timerDataCodec,
}: SyncObservedOwnedTimerLockOptions<TPayload, TActiveTimer>): Promise<void> {
  if (!babyId || !activeTimer || activeTimer.lockState !== "owned") {
    observedTimerInstanceIdRef.current = null;
    return;
  }
  if (!userId || locksLoading) return;

  const lock = locks.find(
    (candidate) =>
      candidate.babyId === babyId && candidate.activityType === activityType
  );
  if (
    lock &&
    matchesOwnedTimerLock(
      lock,
      userId,
      activeTimer.timerInstanceId,
      activeTimer.startTime
    )
  ) {
    observedTimerInstanceIdRef.current = activeTimer.timerInstanceId;
    const payload = timerDataCodec.decode(lock.timerData ?? {}, lock.startedAt);
    const isPaused = payload.isPaused;
    const totalPausedMs = payload.totalPausedMs;
    const pausedAt =
      isPaused && payload.pausedAt
        ? parseTimerDate(payload.pausedAt)
        : undefined;
    const lastResumedAt = parseTimerDate(payload.lastResumedAt);
    if (
      activeTimer.lastResumedAt?.getTime() !== lastResumedAt?.getTime() ||
      activeTimer.isPaused !== isPaused ||
      activeTimer.totalPausedMs !== totalPausedMs ||
      activeTimer.pausedAt?.getTime() !== pausedAt?.getTime()
    ) {
      const accumulatedSeconds =
        typeof lock.timerData?.accumulatedSeconds === "number"
          ? lock.timerData.accumulatedSeconds
          : Math.max(
              0,
              Math.floor(
                ((pausedAt ?? new Date()).getTime() -
                  activeTimer.startTime.getTime()) /
                  1000
              )
            );
      await onPauseChange(
        {
          isPaused,
          totalPausedMs,
          pausedAt,
          accumulatedSeconds,
          payload,
          ...(activityType !== "sleep" ? { lastResumedAt } : {}),
        },
        activeTimer
      );
    }
    return;
  }

  if (observedTimerInstanceIdRef.current === activeTimer.timerInstanceId) {
    observedTimerInstanceIdRef.current = null;
    await onVanished(activeTimer);
  }
}

export function shouldDiscardActiveSession(
  adapter: { activityType: TimerActivityType; discardsShortSessions: boolean },
  startedAt: Date,
  endedAt: Date,
  totalPausedMs: number
): boolean {
  return (
    adapter.discardsShortSessions &&
    shouldDiscardTimerDuration(
      calculateTimerDurationSeconds(
        startedAt,
        endedAt,
        totalPausedMs,
        adapter.activityType
      )
    )
  );
}

export function calculateTimerDuration(
  startedAt: Date,
  endedAt: Date,
  totalPausedMs: number,
  activityType: TimerActivityType
): { durationSeconds: number; pausedSeconds: number } {
  const wallMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const pausedMs =
    activityType !== "sleep" ? Math.min(Math.max(0, totalPausedMs), wallMs) : 0;
  return {
    durationSeconds: calculateActiveDurationSeconds(
      startedAt,
      endedAt,
      Math.floor(pausedMs / 1000)
    ),
    pausedSeconds: Math.floor(pausedMs / 1000),
  };
}

export function calculateTimerDurationSeconds(
  startedAt: Date,
  endedAt: Date,
  totalPausedMs: number,
  activityType: TimerActivityType
): number {
  return calculateTimerDuration(startedAt, endedAt, totalPausedMs, activityType)
    .durationSeconds;
}

export function parseTimerDate(
  value: string | undefined,
  fallback?: Date
): Date | undefined {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

export async function stopRemoteTimerLifecycle<
  TPayload extends SharedTimerPayload,
  TActiveTimer extends TimerLifecycleActiveTimer,
  TRecord extends { id: string },
  TCreateInput,
>({
  adapter,
  babyId,
  userId,
  lock,
  requestedStopTime,
  persistRecord,
  dispatchAddRecord,
  refreshLocks,
}: StopRemoteTimerLifecycleOptions<
  TPayload,
  TActiveTimer,
  TRecord,
  TCreateInput
>): Promise<TRecord | null> {
  const timerData = lock.timerData ?? {};
  const identity = await resolveTimerIdentity(
    babyId,
    adapter.activityType,
    lock.startedAt,
    timerData
  );
  const payload = adapter.timerDataCodec.decode(timerData, lock.startedAt);
  const stopTime = payload.isPaused
    ? (parseTimerDate(payload.pausedAt, requestedStopTime ?? new Date()) ??
      requestedStopTime ??
      new Date())
    : (requestedStopTime ?? new Date());
  const completion = await acceptTimerCompletion(
    babyId,
    adapter.activityType,
    lock.startedAt,
    identity,
    stopTime
  );
  if (
    shouldDiscardActiveSession(
      adapter,
      new Date(lock.startedAt),
      new Date(completion.stoppedAt),
      payload.totalPausedMs
    )
  ) {
    await discardTimerCompletion(completion);
    await releaseTimerLockDurably(
      babyId,
      adapter.activityType,
      userId,
      identity.timerInstanceId,
      lock.startedAt
    );
    await refreshLocks?.();
    return null;
  }

  let record = await adapter.storage.getRecordById(
    babyId,
    completion.activityId
  );
  if (!record) {
    record = await persistRecord(
      adapter.buildRecord(
        new Date(lock.startedAt),
        new Date(completion.stoppedAt),
        { ...payload, ...identity, activityId: completion.activityId }
      ),
      completion
    );
    await markTimerCompletionDurable(completion);
  }
  const releaseLockPromise = releaseTimerLockDurably(
    babyId,
    adapter.activityType,
    userId,
    identity.timerInstanceId,
    lock.startedAt
  ).catch((error) => {
    reportIssue({
      name: "timers.lock_release_queued",
      area: "timers",
      level: "warning",
      error,
      tags: { activityType: adapter.activityType, code: errorCode(error) },
    });
  });

  dispatchAddRecord(record);

  await releaseLockPromise;
  await refreshLocks?.();
  return record;
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
  if (
    adapter.activityType !== "sleep" && payload.totalPausedMs > 0 &&
    startedAt.getTime() > new Date(activeTimer.startedAt).getTime()
  ) {
    throw new Error("Cannot move the start later after completed pauses");
  }
  const pausedAt = payload.isPaused
    ? parseTimerDate(payload.pausedAt, new Date())
    : undefined;
  const timerData = {
    ...adapter.timerDataCodec.encode(payload),
    effectiveStartTime: startedAt.toISOString(),
    ...(pausedAt
      ? {
          accumulatedSeconds: Math.max(
            0,
            Math.floor((pausedAt.getTime() - startedAt.getTime()) / 1000)
          ),
        }
      : {}),
  };
  if (!userId) {
    if (activeTimer.lockState !== "accountless") {
      throw new Error("A signed-in timer edit requires a user id");
    }
    // Account-less timers have no server row or attributable queue owner.
  } else if (
    activeTimer.lockState === "accountless" ||
    activeTimer.lockState === "offline"
  ) {
    await queuePendingTimerStartEdit(
      baby.id,
      adapter.activityType,
      userId,
      activeTimer.timerInstanceId,
      startedAt,
      timerData
    );
  } else {
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
      recordBreadcrumb({
        category: "timers",
        message: "start edit queued",
        level: "warning",
        data: { activityType: adapter.activityType },
      });
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
  let replacementLiveActivityId: string | null = null;
  let endedExistingLiveActivity = false;
  if (oldLiveActivityId) {
    endedExistingLiveActivity = await endTimerLiveActivity(oldLiveActivityId);
  }
  if (!endedExistingLiveActivity) {
    endedExistingLiveActivity = await endLiveActivityByType(
      adapter.liveActivity.type
    );
  }

  if (endedExistingLiveActivity) {
    replacementLiveActivityId = await startTimerLiveActivity(
      adapter.liveActivity.type,
      baby.name,
      adapter.liveActivity.detail(payload),
      startedAt,
      userId && activeTimer.lockState === "owned"
        ? {
            babyId: baby.id,
            timerInstanceId: activeTimer.timerInstanceId,
            userId,
          }
        : undefined
    );
  }
  liveActivityIdRef.current = replacementLiveActivityId;

  if (replacementLiveActivityId && payload.isPaused) {
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
  timerSnapshot,
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
  const clearRevokedTimer = async (activityId?: string) => {
    await endAdapterLiveActivity(activityId ?? liveActivityIdRef.current);
    await adapter.storage.clearActiveTimer(baby.id);
    dispatchStopTimer();
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
    } catch (error) {
      // The other device keeps seeing this timer as running until the queued
      // release succeeds, so surface how often that happens.
      reportIssue({
        name: "timers.lock_release_queued",
        area: "timers",
        level: "warning",
        error,
        tags: { activityType: adapter.activityType, code: errorCode(error) },
      });
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
    payload: TPayload,
    identity: TimerIdentity,
    lockState: TimerLockReconciliationState
  ) => {
    const activityId = await startTimerLiveActivity(
      adapter.liveActivity.type,
      baby.name,
      adapter.liveActivity.detail(payload),
      new Date(startedAt),
      user?.id && lockState === "owned"
        ? {
            babyId: baby.id,
            timerInstanceId: identity.timerInstanceId,
            userId: user.id,
          }
        : undefined
    );
    return acceptStartedLiveActivity(activityId);
  };

  if (isRestoreObsolete()) return;

  const activeTimer = await adapter.storage.getActiveTimer(baby.id);
  const pendingStop = activeTimer
    ? await readPendingTimerStop(adapter.activityType, baby.id)
    : null;
  if (!isCurrentBabyBinding() || isRestoreObsolete()) return;
  let timerAccessFailed = false;
  if (timerSnapshot && user?.id && user.householdId) {
    try {
      await timerSnapshot;
    } catch (error) {
      if (!isCurrentBabyBinding() || isRestoreObsolete()) return;
      if (isTimerAccessUnavailable(error)) {
        if (error.reason === "revoked") {
          await clearRevokedTimer(activeTimer?.liveActivityId);
          return;
        }
        timerAccessFailed = true;
      } else if (
        isRetryableTimerWriteError(error) ||
        errorCode(error) === "42501"
      ) {
        timerAccessFailed = true;
        reportIssue({
          name: "timers.restore_failed",
          area: "timers",
          error,
          tags: { activityType: adapter.activityType },
        });
      }
    }
  }
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

    if (
      user?.id &&
      user.householdId &&
      activeTimer.lockState === "owned" &&
      !hasPendingStop &&
      timerSnapshot
    ) {
      const snapshot = await timerSnapshot.catch(() => null);
      const lock = snapshot
        ? findActiveTimerLock(snapshot, adapter.activityType)
        : null;
      if (snapshot) {
        const sameServerTimer = matchesOwnedTimerLock(
          lock ?? undefined,
          user.id,
          identity.timerInstanceId,
          new Date(activeTimer.startedAt)
        );
        if (!sameServerTimer) {
          await endAdapterLiveActivity(
            activeTimer.liveActivityId ?? liveActivityIdRef.current
          );
          await adapter.storage.clearActiveTimer(baby.id);
          dispatchStopTimer();
          return;
        }
      }
    }

    if (!activeTimer.timerInstanceId || !activeTimer.activityId) {
      await adapter.storage.setActiveTimer(baby.id, {
        ...activeTimer,
        ...payloadWithIdentity,
      });
    }

    let isStale = false;
    let lockState: TimerLockReconciliationState = user?.id
      ? activeTimer.lockState === "accountless"
        ? "offline"
        : (activeTimer.lockState ?? "offline")
      : "accountless";

    if (activeTimer.lockState !== lockState) {
      if (!isCurrentBabyBinding() || isRestoreObsolete()) return;
      await adapter.storage.setActiveTimer(baby.id, {
        ...activeTimer,
        ...payloadWithIdentity,
        lockState,
      });
    }

    if (user?.id && user.householdId && !hasPendingStop && !timerAccessFailed) {
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
        timerSnapshot,
      }).catch(async (error) => {
        if (!isTimerAccessUnavailable(error) || error.reason !== "revoked")
          throw error;
        if (!isCurrentBabyBinding() || isRestoreObsolete()) return null;
        await clearRevokedTimer(activeTimer.liveActivityId);
        return null;
      });
      if (!reconciliation) return;
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
        if (
          !Number.isFinite(startedAtMs) ||
          !Number.isFinite(requestedStopTimeMs) ||
          requestedStopTimeMs < startedAtMs
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
        if (
          adapter.activityType === "sleep"
            ? shouldDiscardTimerDuration(
                calculateTimerDurationSeconds(
                  startedAt,
                  new Date(completion.stoppedAt),
                  0,
                  "sleep"
                )
              )
            : shouldDiscardActiveSession(
                adapter,
                startedAt,
                new Date(completion.stoppedAt),
                payloadWithIdentity.totalPausedMs
              )
        ) {
          await discardTimerCompletion(completion);
          dispatchStopTimer();
          isStale = true;
          await adapter.storage.clearActiveTimer(baby.id);
          await endAdapterLiveActivity(activeTimer.liveActivityId);
          showTimerConflictNotice(reconciliation.lockHolderName);
          return;
        }
        dispatchStopTimer();
        let record = await adapter.storage.getRecordById(
          baby.id,
          completion.activityId
        );

        if (!record) {
          record = await persistRecord(
            adapter.buildRecord(startedAt, new Date(completion.stoppedAt), {
              ...payloadWithIdentity,
              activityId: completion.activityId,
            }),
            completion
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
          if (user?.id && lockState === "owned") {
            await bindTimerLiveActivity(activeTimer.liveActivityId, {
              babyId: baby.id,
              timerInstanceId: identity.timerInstanceId,
              userId: user.id,
            });
          }
        } else if (!payload.isPaused) {
          if (
            !(await startAdapterLiveActivity(
              activeTimer.startedAt,
              payload,
              identity,
              lockState
            ))
          ) {
            return;
          }
        }
      } else if (!hasPendingStop && !payload.isPaused) {
        if (
          !(await startAdapterLiveActivity(
            activeTimer.startedAt,
            payload,
            identity,
            lockState
          ))
        ) {
          return;
        }
      }
    }
  } else if (user?.id && user.householdId) {
    try {
      const lock = timerSnapshot
        ? findActiveTimerLock(await timerSnapshot, adapter.activityType)
        : await getActiveTimerLock(baby.id, adapter.activityType);
      if (!isCurrentBabyBinding()) return;
      if (lock && lock.startedBy === user.id && !isRestoreObsolete()) {
        const timerData = lock.timerData ?? {};
        const identity = await resolveTimerIdentity(
          baby.id,
          adapter.activityType,
          lock.startedAt,
          timerData
        );
        if (
          await hasPendingLockRelease(
            baby.id,
            adapter.activityType,
            user.id,
            identity.timerInstanceId
          )
        ) {
          await releaseOrQueueLock(identity, lock.startedAt);
          return;
        }
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
          if (
            !(await startAdapterLiveActivity(
              lock.startedAt,
              payload,
              identity,
              "owned"
            ))
          ) {
            return;
          }
        }
      }
    } catch (error) {
      if (!isCurrentBabyBinding()) return;
      if (isTimerAccessUnavailable(error)) {
        if (error.reason === "revoked") {
          if (isRestoreObsolete()) return;
          await clearRevokedTimer();
        }
        return;
      }
      console.error(`${errorLabel} Failed to restore from server:`, error);
      reportIssue({
        name: "timers.restore_failed",
        area: "timers",
        error,
        tags: { activityType: adapter.activityType },
      });
    }
  }
}
