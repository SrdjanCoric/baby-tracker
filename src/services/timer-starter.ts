import type { TimerLockReconciliationState } from "./timer-lock-reconciliation";

export function isTimerStarter(
  lock: { startedBy: string } | null | undefined,
  lockState: TimerLockReconciliationState | undefined,
  userId: string | undefined
): boolean {
  if (lock) return Boolean(userId && lock.startedBy === userId);
  if (lockState === "accountless") return !userId;
  return Boolean(userId && (lockState === "owned" || lockState === "offline"));
}
