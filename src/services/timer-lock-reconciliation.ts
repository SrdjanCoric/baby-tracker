import {
  acquireTimerLock,
  getActiveTimerLock,
  type TimerActivityType,
} from "./active-timer-service";

export type TimerLockReconciliationState =
  | "offline"
  | "reconciling"
  | "owned"
  | "conflicted";

export interface TimerLockReconciliationSnapshot {
  lockState?: TimerLockReconciliationState;
}

interface ReconcileTimerLockInput {
  babyId: string;
  activityType: TimerActivityType;
  userId: string;
  startedAt: string;
  timerInstanceId: string;
  timerData: Record<string, unknown>;
  persistState: (state: TimerLockReconciliationState) => Promise<void>;
}

export type ReconcileTimerLockResult =
  | { state: "offline" | "owned" }
  | {
      state: "conflicted";
      lockHolderId?: string;
      lockHolderName?: string;
      lockStartedAt?: string;
    };

export async function reconcileTimerLock({
  babyId,
  activityType,
  userId,
  startedAt,
  timerInstanceId,
  timerData,
  persistState,
}: ReconcileTimerLockInput): Promise<ReconcileTimerLockResult> {
  await persistState("reconciling");

  try {
    const acquisition = await acquireTimerLock(
      babyId,
      activityType,
      userId,
      timerData,
      new Date(startedAt)
    );

    if (acquisition.success) {
      await persistState("owned");
      return { state: "owned" };
    }

    if (!acquisition.lockHolderId) {
      await persistState("offline");
      return { state: "offline" };
    }

    if (acquisition.lockHolderId !== userId) {
      await persistState("conflicted");
      return {
        state: "conflicted",
        lockHolderId: acquisition.lockHolderId,
        lockHolderName: acquisition.lockHolderName,
        lockStartedAt: acquisition.startedAt,
      };
    }

    const lock = await getActiveTimerLock(babyId, activityType);
    const lockTimerInstanceId = lock?.timerData?.timerInstanceId;
    const ownsMatchingLock = lock?.startedBy === userId && (
      lockTimerInstanceId === timerInstanceId ||
      (typeof lockTimerInstanceId !== "string" && lock.startedAt === startedAt)
    );

    if (ownsMatchingLock) {
      await persistState("owned");
      return { state: "owned" };
    }

    await persistState("conflicted");
    return {
      state: "conflicted",
      lockHolderId: lock?.startedBy ?? acquisition.lockHolderId,
      lockHolderName: lock?.startedByName ?? acquisition.lockHolderName,
      lockStartedAt: lock?.startedAt ?? acquisition.startedAt,
    };
  } catch (error) {
    await persistState("offline");
    console.error("[TimerLockReconciliation] Lock reconciliation failed:", error);
    return { state: "offline" };
  }
}
