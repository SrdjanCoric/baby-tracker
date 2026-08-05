import { describe, expect, it, vi } from "vitest";
import {
  restoreTimerLifecycle,
  type TimerLifecycleAdapter,
  type TimerLifecycleActiveTimer,
} from "./timer-lifecycle";
import { resolveTimerIdentity } from "./timer-completion-service";
import { reconcileTimerLock } from "./timer-lock-reconciliation";
import { readPendingTimerStop } from "./timer-stop-coordinator";

vi.mock("./live-activity-service", () => ({
  endLiveActivityByType: vi.fn(),
  endTimerLiveActivity: vi.fn(),
  isLiveActivityRunningWithTimeout: vi.fn(),
  startTimerLiveActivity: vi.fn(),
}));

vi.mock("./active-timer-service", () => ({
  getActiveTimerLock: vi.fn(),
  queuePendingLockRelease: vi.fn(),
  releaseTimerLock: vi.fn(),
}));

vi.mock("./timer-conflict-notice", () => ({
  showTimerConflictNotice: vi.fn(),
}));

vi.mock("./timer-completion-service", () => ({
  acceptTimerCompletion: vi.fn(),
  isTimerCompletionSecured: vi.fn(),
  markTimerCompletionDurable: vi.fn(),
  resolveTimerIdentity: vi.fn(),
}));

vi.mock("./timer-lock-reconciliation", () => ({
  reconcileTimerLock: vi.fn(),
}));

vi.mock("./timer-stop-coordinator", () => ({
  isPendingStopForTimer: vi.fn(() => false),
  isTimerRestoreObsolete: vi.fn(
    (versionAtStart: number, currentVersion: number, isStopping: boolean) =>
      isStopping || currentVersion !== versionAtStart
  ),
  readPendingTimerStop: vi.fn(),
}));

interface TestPayload {
  isPaused: boolean;
  totalPausedMs: number;
}

interface TestActiveTimer extends TimerLifecycleActiveTimer {
  isPaused: boolean;
  totalPausedMs: number;
}

describe("restoreTimerLifecycle", () => {
  it("abandons a restore when stop becomes obsolete during storage reads", async () => {
    let resolvePendingStop: (value: null) => void = () => undefined;
    const pendingStopRead = new Promise<null>((resolve) => {
      resolvePendingStop = resolve;
    });
    vi.mocked(readPendingTimerStop).mockReturnValueOnce(pendingStopRead);

    const setActiveTimer = vi.fn();
    const dispatchRestoreTimer = vi.fn();
    const adapter: TimerLifecycleAdapter<
      TestPayload,
      TestActiveTimer,
      { id: string },
      { id: string }
    > = {
      activityType: "sleep",
      storage: {
        getActiveTimer: vi.fn().mockResolvedValue({
          startedAt: "2026-08-05T12:00:00.000Z",
          isPaused: false,
          totalPausedMs: 0,
          lockState: "owned",
        }),
        setActiveTimer,
        clearActiveTimer: vi.fn(),
        getRecordById: vi.fn(),
      },
      timerDataCodec: {
        encode: vi.fn(() => ({})),
        decode: vi.fn(() => ({ isPaused: false, totalPausedMs: 0 })),
        fromActiveTimer: vi.fn(() => ({
          isPaused: false,
          totalPausedMs: 0,
        })),
      },
      buildRecord: vi.fn(() => ({ id: "record-1" })),
      liveActivity: { type: "sleep", detail: vi.fn() },
      dispatchRestoreTimer,
    };
    let stopVersion = 0;

    const restore = restoreTimerLifecycle({
      adapter,
      baby: { id: "baby-1", name: "Baby" },
      user: { id: "user-1", householdId: "household-1" },
      completedRecords: [],
      stopVersionAtStart: 0,
      currentStopVersion: () => stopVersion,
      isStopping: () => false,
      isCurrentBabyBinding: () => true,
      liveActivityIdRef: { current: null },
      refreshLocks: vi.fn(),
      persistRecord: vi.fn(),
      dispatchStopTimer: vi.fn(),
      dispatchAddRecord: vi.fn(),
      errorLabel: "[TimerLifecycleTest]",
    });

    await vi.waitFor(() => {
      expect(readPendingTimerStop).toHaveBeenCalledOnce();
    });
    stopVersion = 1;
    resolvePendingStop(null);
    await restore;

    expect(resolveTimerIdentity).not.toHaveBeenCalled();
    expect(reconcileTimerLock).not.toHaveBeenCalled();
    expect(setActiveTimer).not.toHaveBeenCalled();
    expect(dispatchRestoreTimer).not.toHaveBeenCalled();
  });
});
