import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  restoreTimerLifecycle,
  type TimerLifecycleAdapter,
  type TimerLifecycleActiveTimer,
} from "./timer-lifecycle";
import {
  isTimerCompletionSecured,
  resolveTimerIdentity,
} from "./timer-completion-service";
import { reconcileTimerLock } from "./timer-lock-reconciliation";
import { readPendingTimerStop } from "./timer-stop-coordinator";
import { createSleepTimerAdapter } from "./timer-adapters/sleep-timer-adapter";
import type { ActiveSleepTimerData } from "./sleep-storage";

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

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  NativeModules: {},
  Platform: { OS: "ios", Version: "18" },
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("re-derives unresolved morning classification on a later restore", async () => {
    let derivedClassification: "unresolved" | "automatic" = "unresolved";
    let storedActiveTimer: ActiveSleepTimerData = {
      startedAt: "2026-08-05T06:30:00.000Z",
      type: "nap",
      isPaused: true,
      totalPausedMs: 0,
    };
    const dispatchRestoreTimer = vi.fn();
    const adapter = createSleepTimerAdapter({
      babyId: "baby-1",
      resolveMorningClassification: (_startedAt, stored) =>
        stored ?? derivedClassification,
      dispatchRestoreTimer,
    });
    adapter.storage.getActiveTimer = vi.fn(async () => storedActiveTimer);
    adapter.storage.setActiveTimer = vi.fn(async (_babyId, activeTimer) => {
      storedActiveTimer = activeTimer;
    });
    adapter.storage.clearActiveTimer = vi.fn();
    adapter.storage.getRecordById = vi.fn();
    vi.mocked(readPendingTimerStop).mockResolvedValue(null);
    vi.mocked(resolveTimerIdentity).mockResolvedValue({
      timerInstanceId: "timer-1",
      activityId: "activity-1",
    });
    vi.mocked(isTimerCompletionSecured).mockResolvedValue(false);
    vi.mocked(reconcileTimerLock).mockImplementation(
      async ({ persistState }) => {
        await persistState("reconciling");
        return { state: "owned" };
      }
    );

    const restore = () =>
      restoreTimerLifecycle({
        adapter,
        baby: { id: "baby-1", name: "Baby" },
        user: { id: "user-1", householdId: "household-1" },
        completedRecords: [],
        stopVersionAtStart: 0,
        currentStopVersion: () => 0,
        isStopping: () => false,
        isCurrentBabyBinding: () => true,
        liveActivityIdRef: { current: null },
        refreshLocks: vi.fn(),
        persistRecord: vi.fn(),
        dispatchStopTimer: vi.fn(),
        dispatchAddRecord: vi.fn(),
        errorLabel: "[TimerLifecycleTest]",
      });

    await restore();
    expect(dispatchRestoreTimer).toHaveBeenLastCalledWith(
      expect.objectContaining({ morningClassification: "unresolved" })
    );

    derivedClassification = "automatic";
    await restore();

    expect(dispatchRestoreTimer).toHaveBeenLastCalledWith(
      expect.objectContaining({ morningClassification: "automatic" })
    );
  });
});
