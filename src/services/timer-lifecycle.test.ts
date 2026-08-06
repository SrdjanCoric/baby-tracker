import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  editRunningTimerStartTime,
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
import {
  endLiveActivityByType,
  endTimerLiveActivity,
  startTimerLiveActivity,
} from "./live-activity-service";
import {
  queuePendingTimerStartEdit,
  updateTimerStartTime,
} from "./active-timer-service";

vi.mock("./live-activity-service", () => ({
  endLiveActivityByType: vi.fn(),
  endTimerLiveActivity: vi.fn(),
  isLiveActivityRunningWithTimeout: vi.fn(),
  startTimerLiveActivity: vi.fn(),
}));

vi.mock("./active-timer-service", () => ({
  getActiveTimerLock: vi.fn(),
  isRetryableTimerWriteError: vi.fn(
    (error: unknown) => error instanceof TypeError
  ),
  queuePendingLockRelease: vi.fn(),
  queuePendingTimerStartEdit: vi.fn(),
  releaseTimerLock: vi.fn(),
  updateTimerStartTime: vi.fn(),
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

describe("editRunningTimerStartTime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes, persists, updates provider state, and re-anchors the Live Activity", async () => {
    const events: string[] = [];
    const oldStart = "2026-08-06T08:00:00.000Z";
    const newStart = new Date("2026-08-06T07:30:00.000Z");
    const activeTimer: TestActiveTimer = {
      startedAt: oldStart,
      isPaused: false,
      totalPausedMs: 0,
      lockState: "owned",
      liveActivityId: "live-old",
      timerInstanceId: "timer-1",
      activityId: "record-1",
    };
    const setActiveTimer = vi.fn(async () => {
      events.push("persist");
    });
    const dispatchEditedStart = vi.fn(() => {
      events.push("dispatch");
    });
    const encodedTimerData = {
      timerInstanceId: "timer-1",
      activityId: "record-1",
      isPaused: false,
      totalPausedMs: 0,
      effectiveStartTime: oldStart,
    };
    const adapter: TimerLifecycleAdapter<
      TestPayload,
      TestActiveTimer,
      { id: string },
      { id: string }
    > = {
      activityType: "sleep",
      storage: {
        getActiveTimer: vi.fn(),
        setActiveTimer,
        clearActiveTimer: vi.fn(),
        getRecordById: vi.fn(),
      },
      timerDataCodec: {
        encode: vi.fn(() => encodedTimerData),
        decode: vi.fn(() => ({ isPaused: false, totalPausedMs: 0 })),
        fromActiveTimer: vi.fn(() => ({ isPaused: false, totalPausedMs: 0 })),
      },
      buildRecord: vi.fn(() => ({ id: "record-1" })),
      liveActivity: { type: "sleep", detail: vi.fn(() => "nap") },
      dispatchRestoreTimer: vi.fn(),
    };
    vi.mocked(updateTimerStartTime).mockImplementation(async () => {
      events.push("write");
      return true;
    });
    vi.mocked(endTimerLiveActivity).mockImplementation(async () => {
      events.push("end");
      return true;
    });
    vi.mocked(startTimerLiveActivity).mockImplementation(async () => {
      events.push("start");
      return "live-new";
    });
    const liveActivityIdRef = { current: "live-old" as string | null };

    await editRunningTimerStartTime({
      adapter,
      baby: { id: "baby-1", name: "Baby" },
      userId: "user-1",
      activeTimer,
      payload: { isPaused: false, totalPausedMs: 0 },
      startedAt: newStart,
      liveActivityIdRef,
      dispatchEditedStart,
    });

    expect(events).toEqual(["write", "end", "start", "persist", "dispatch"]);
    expect(updateTimerStartTime).toHaveBeenCalledWith(
      "baby-1",
      "sleep",
      "user-1",
      newStart,
      {
        ...encodedTimerData,
        effectiveStartTime: newStart.toISOString(),
      }
    );
    expect(endTimerLiveActivity).toHaveBeenCalledWith("live-old");
    expect(startTimerLiveActivity).toHaveBeenCalledWith(
      "sleep",
      "Baby",
      "nap",
      newStart
    );
    expect(setActiveTimer).toHaveBeenCalledWith(
      "baby-1",
      expect.objectContaining({
        startedAt: newStart.toISOString(),
        liveActivityId: "live-new",
      })
    );
    expect(dispatchEditedStart).toHaveBeenCalledWith(newStart);
    expect(liveActivityIdRef.current).toBe("live-new");
  });

  it("re-anchors a running Live Activity when its identifier was lost", async () => {
    const newStart = new Date("2026-08-06T07:30:00.000Z");
    const activeTimer: TestActiveTimer = {
      startedAt: "2026-08-06T08:00:00.000Z",
      isPaused: false,
      totalPausedMs: 0,
      lockState: "owned",
      timerInstanceId: "timer-1",
      activityId: "record-1",
    };
    const setActiveTimer = vi.fn();
    const adapter: TimerLifecycleAdapter<
      TestPayload,
      TestActiveTimer,
      { id: string },
      { id: string }
    > = {
      activityType: "sleep",
      storage: {
        getActiveTimer: vi.fn(),
        setActiveTimer,
        clearActiveTimer: vi.fn(),
        getRecordById: vi.fn(),
      },
      timerDataCodec: {
        encode: vi.fn(() => ({ timerInstanceId: "timer-1" })),
        decode: vi.fn(() => ({ isPaused: false, totalPausedMs: 0 })),
        fromActiveTimer: vi.fn(() => ({ isPaused: false, totalPausedMs: 0 })),
      },
      buildRecord: vi.fn(() => ({ id: "record-1" })),
      liveActivity: { type: "sleep", detail: vi.fn(() => "nap") },
      dispatchRestoreTimer: vi.fn(),
    };
    vi.mocked(updateTimerStartTime).mockResolvedValue(true);
    vi.mocked(endLiveActivityByType).mockResolvedValue(true);
    vi.mocked(startTimerLiveActivity).mockResolvedValue("live-new");
    const liveActivityIdRef = { current: null as string | null };

    await editRunningTimerStartTime({
      adapter,
      baby: { id: "baby-1", name: "Baby" },
      userId: "user-1",
      activeTimer,
      payload: {
        timerInstanceId: "timer-1",
        activityId: "record-1",
        isPaused: false,
        totalPausedMs: 0,
      },
      startedAt: newStart,
      liveActivityIdRef,
      dispatchEditedStart: vi.fn(),
    });

    expect(endTimerLiveActivity).not.toHaveBeenCalled();
    expect(endLiveActivityByType).toHaveBeenCalledWith("sleep");
    expect(startTimerLiveActivity).toHaveBeenCalledWith(
      "sleep",
      "Baby",
      "nap",
      newStart
    );
    expect(liveActivityIdRef.current).toBe("live-new");
    expect(setActiveTimer).toHaveBeenCalledWith(
      "baby-1",
      expect.objectContaining({ liveActivityId: "live-new" })
    );
  });

  it("queues a transport-failed edit before applying it locally", async () => {
    const newStart = new Date("2026-08-06T07:30:00.000Z");
    const activeTimer: TestActiveTimer = {
      startedAt: "2026-08-06T08:00:00.000Z",
      isPaused: true,
      pausedAt: "2026-08-06T09:00:00.000Z",
      totalPausedMs: 0,
      lockState: "owned",
      timerInstanceId: "timer-1",
      activityId: "record-1",
    };
    const encodedTimerData = {
      timerInstanceId: "timer-1",
      activityId: "record-1",
      isPaused: true,
      pausedAt: "2026-08-06T09:00:00.000Z",
      totalPausedMs: 0,
      effectiveStartTime: "2026-08-06T08:00:00.000Z",
      accumulatedSeconds: 3600,
    };
    const setActiveTimer = vi.fn();
    const dispatchEditedStart = vi.fn();
    const adapter: TimerLifecycleAdapter<
      TestPayload,
      TestActiveTimer,
      { id: string },
      { id: string }
    > = {
      activityType: "sleep",
      storage: {
        getActiveTimer: vi.fn(),
        setActiveTimer,
        clearActiveTimer: vi.fn(),
        getRecordById: vi.fn(),
      },
      timerDataCodec: {
        encode: vi.fn(() => encodedTimerData),
        decode: vi.fn(() => ({ isPaused: false, totalPausedMs: 0 })),
        fromActiveTimer: vi.fn(() => ({
          isPaused: false,
          totalPausedMs: 0,
        })),
      },
      buildRecord: vi.fn(() => ({ id: "record-1" })),
      liveActivity: { type: "sleep", detail: vi.fn(() => "nap") },
      dispatchRestoreTimer: vi.fn(),
    };
    vi.mocked(updateTimerStartTime).mockRejectedValue(
      new TypeError("Network request failed")
    );
    vi.mocked(queuePendingTimerStartEdit).mockResolvedValue();
    vi.mocked(startTimerLiveActivity).mockResolvedValue(null);

    await editRunningTimerStartTime({
      adapter,
      baby: { id: "baby-1", name: "Baby" },
      userId: "user-1",
      activeTimer,
      payload: {
        timerInstanceId: "timer-1",
        activityId: "record-1",
        isPaused: true,
        pausedAt: "2026-08-06T09:00:00.000Z",
        totalPausedMs: 0,
      },
      startedAt: newStart,
      liveActivityIdRef: { current: null },
      dispatchEditedStart,
    });

    expect(queuePendingTimerStartEdit).toHaveBeenCalledWith(
      "baby-1",
      "sleep",
      "user-1",
      "timer-1",
      newStart,
      {
        ...encodedTimerData,
        effectiveStartTime: newStart.toISOString(),
        accumulatedSeconds: 5400,
      }
    );
    expect(setActiveTimer).toHaveBeenCalledWith(
      "baby-1",
      expect.objectContaining({ startedAt: newStart.toISOString() })
    );
    expect(dispatchEditedStart).toHaveBeenCalledWith(newStart);
    expect(startTimerLiveActivity).not.toHaveBeenCalled();
  });

  it("queues an offline edit before applying it locally", async () => {
    const newStart = new Date("2026-08-06T07:30:00.000Z");
    const activeTimer: TestActiveTimer = {
      startedAt: "2026-08-06T08:00:00.000Z",
      isPaused: false,
      totalPausedMs: 0,
      lockState: "offline",
      timerInstanceId: "timer-1",
      activityId: "record-1",
    };
    const timerData = {
      timerInstanceId: "timer-1",
      activityId: "record-1",
      isPaused: false,
      totalPausedMs: 0,
    };
    const setActiveTimer = vi.fn();
    const dispatchEditedStart = vi.fn();
    const adapter: TimerLifecycleAdapter<
      TestPayload,
      TestActiveTimer,
      { id: string },
      { id: string }
    > = {
      activityType: "sleep",
      storage: {
        getActiveTimer: vi.fn(),
        setActiveTimer,
        clearActiveTimer: vi.fn(),
        getRecordById: vi.fn(),
      },
      timerDataCodec: {
        encode: vi.fn(() => timerData),
        decode: vi.fn(() => ({ isPaused: false, totalPausedMs: 0 })),
        fromActiveTimer: vi.fn(() => ({ isPaused: false, totalPausedMs: 0 })),
      },
      buildRecord: vi.fn(() => ({ id: "record-1" })),
      liveActivity: { type: "sleep", detail: vi.fn(() => "nap") },
      dispatchRestoreTimer: vi.fn(),
    };
    vi.mocked(queuePendingTimerStartEdit).mockResolvedValue();

    await editRunningTimerStartTime({
      adapter,
      baby: { id: "baby-1", name: "Baby" },
      userId: "user-1",
      activeTimer,
      payload: {
        timerInstanceId: "timer-1",
        activityId: "record-1",
        isPaused: false,
        totalPausedMs: 0,
      },
      startedAt: newStart,
      liveActivityIdRef: { current: null },
      dispatchEditedStart,
    });

    expect(updateTimerStartTime).not.toHaveBeenCalled();
    expect(queuePendingTimerStartEdit).toHaveBeenCalledWith(
      "baby-1",
      "sleep",
      "user-1",
      "timer-1",
      newStart,
      {
        ...timerData,
        effectiveStartTime: newStart.toISOString(),
      }
    );
    expect(setActiveTimer).toHaveBeenCalledWith(
      "baby-1",
      expect.objectContaining({ startedAt: newStart.toISOString() })
    );
    expect(dispatchEditedStart).toHaveBeenCalledWith(newStart);
  });
});

describe("restoreTimerLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restarts a resumed timer's Live Activity from the real start", async () => {
    const startedAt = "2026-08-05T12:00:00.000Z";
    const activeTimer: TestActiveTimer = {
      startedAt,
      isPaused: false,
      totalPausedMs: 10 * 60 * 1000,
      lockState: "owned",
    };
    const adapter: TimerLifecycleAdapter<
      TestPayload,
      TestActiveTimer,
      { id: string },
      { id: string }
    > = {
      activityType: "sleep",
      storage: {
        getActiveTimer: vi.fn().mockResolvedValue(activeTimer),
        setActiveTimer: vi.fn(),
        clearActiveTimer: vi.fn(),
        getRecordById: vi.fn(),
      },
      timerDataCodec: {
        encode: vi.fn(() => ({})),
        decode: vi.fn(() => ({ isPaused: false, totalPausedMs: 0 })),
        fromActiveTimer: vi.fn(() => ({
          isPaused: false,
          totalPausedMs: activeTimer.totalPausedMs,
        })),
      },
      buildRecord: vi.fn(() => ({ id: "record-1" })),
      liveActivity: { type: "sleep", detail: vi.fn(() => "nap") },
      dispatchRestoreTimer: vi.fn(),
    };
    vi.mocked(readPendingTimerStop).mockResolvedValue(null);
    vi.mocked(resolveTimerIdentity).mockResolvedValue({
      timerInstanceId: "timer-1",
      activityId: "activity-1",
    });
    vi.mocked(isTimerCompletionSecured).mockResolvedValue(false);
    vi.mocked(startTimerLiveActivity).mockResolvedValue("live-activity-1");

    await restoreTimerLifecycle({
      adapter,
      baby: { id: "baby-1", name: "Baby" },
      user: null,
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

    expect(startTimerLiveActivity).toHaveBeenCalledWith(
      "sleep",
      "Baby",
      "nap",
      new Date(startedAt)
    );
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
