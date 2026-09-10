import {
  acquireTimerLock,
  getActiveTimerLock,
  type ActiveTimerLock,
  type TimerActivityType,
} from "./active-timer-service";
import { recordBreadcrumb, reportIssue } from "@/utils/observability-sink";

export type TimerLockReconciliationState =
  | "accountless"
  | "offline"
  | "reconciling"
  | "owned"
  | "conflicted";

export interface TimerLockReconciliationSnapshot {
  lockState?: TimerLockReconciliationState;
}

export interface ReconcileTimerLockInput {
  babyId: string;
  activityType: TimerActivityType;
  userId: string;
  startedAt: string;
  timerInstanceId: string;
  timerData: Record<string, unknown>;
  persistState: (state: TimerLockReconciliationState) => Promise<void>;
  timerSnapshot?: Promise<readonly ActiveTimerLock[]>;
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
    const lockStartedAtMs = lock ? new Date(lock.startedAt).getTime() : Number.NaN;
    const localStartedAtMs = new Date(startedAt).getTime();
    const ownsMatchingLock = lock?.startedBy === userId && (
      lockTimerInstanceId === timerInstanceId ||
      (
        typeof lockTimerInstanceId !== "string" &&
        Number.isFinite(lockStartedAtMs) &&
        lockStartedAtMs === localStartedAtMs
      )
    );

    if (ownsMatchingLock) {
      await persistState("owned");
      return { state: "owned" };
    }

    await persistState("conflicted");
    recordBreadcrumb({
      category: "timers",
      message: "lock reconciliation conflicted",
      level: "warning",
      data: { activityType, ownLock: lock?.startedBy === userId, hasLock: lock != null },
    });
    return {
      state: "conflicted",
      lockHolderId: lock?.startedBy ?? acquisition.lockHolderId,
      lockHolderName: lock?.startedByName ?? acquisition.lockHolderName,
      lockStartedAt: lock?.startedAt ?? acquisition.startedAt,
    };
  } catch (error) {
    await persistState("offline");
    console.error("[TimerLockReconciliation] Lock reconciliation failed:", error);
    reportIssue({
      name: "timers.lock_reconciliation_failed",
      area: "timers",
      level: "warning",
      error,
      tags: { activityType },
    });
    return { state: "offline" };
  }
}
