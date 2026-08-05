import { describe, expect, it, vi } from "vitest";
import {
  calculateTimerDurationSeconds,
  restoreTimerLifecycle,
} from "../timer-lifecycle";
import {
  acceptTimerCompletion,
  isTimerCompletionSecured,
  markTimerCompletionDurable,
  resolveTimerIdentity,
} from "../timer-completion-service";
import { reconcileTimerLock } from "../timer-lock-reconciliation";
import { createTummyTimeTimerAdapter } from "./tummy-time-timer-adapter";

vi.mock("../live-activity-service", () => ({
  endLiveActivityByType: vi.fn(),
  endTimerLiveActivity: vi.fn(),
  isLiveActivityRunningWithTimeout: vi.fn(),
  startTimerLiveActivity: vi.fn(),
}));

vi.mock("../active-timer-service", () => ({
  acquireTimerLock: vi.fn(),
  getActiveTimerLock: vi.fn(),
  queuePendingLockRelease: vi.fn(),
  releaseTimerLock: vi.fn(),
}));

vi.mock("../timer-conflict-notice", () => ({
  showTimerConflictNotice: vi.fn(),
}));

vi.mock("../timer-completion-service", () => ({
  acceptTimerCompletion: vi.fn(),
  isTimerCompletionSecured: vi.fn(),
  markTimerCompletionDurable: vi.fn(),
  resolveTimerIdentity: vi.fn(),
}));

vi.mock("../timer-lock-reconciliation", () => ({
  reconcileTimerLock: vi.fn(),
}));

vi.mock("../timer-stop-coordinator", () => ({
  isPendingStopForTimer: vi.fn(() => false),
  isTimerRestoreObsolete: vi.fn(() => false),
  readPendingTimerStop: vi.fn(() => Promise.resolve(null)),
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

describe("tummy time timer adapter", () => {
  it("builds the bare tummy time span from decoded timer data", () => {
    const adapter = createTummyTimeTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: vi.fn(),
    });
    const startedAt = new Date("2026-08-05T12:00:00.000Z");
    const endedAt = new Date("2026-08-05T12:02:03.999Z");

    expect(
      adapter.buildRecord(startedAt, endedAt, {
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        isPaused: false,
        totalPausedMs: 0,
      })
    ).toEqual({
      id: "activity-1",
      babyId: "baby-1",
      startedAt,
      endedAt,
      durationSeconds: 123,
    });
  });

  it("round-trips today's timer_data payload without inventing pausedAt", () => {
    const adapter = createTummyTimeTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: vi.fn(),
    });
    const payload = {
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      isPaused: false,
      totalPausedMs: 0,
    };

    const encoded = adapter.timerDataCodec.encode(payload);

    expect(encoded).toEqual(payload);
    expect(adapter.timerDataCodec.decode(encoded)).toEqual(payload);
    expect(encoded).not.toHaveProperty("pausedAt");
  });

  it("round-trips a paused timer_data payload", () => {
    const adapter = createTummyTimeTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: vi.fn(),
    });
    const payload = {
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      isPaused: true,
      totalPausedMs: 45_000,
      pausedAt: "2026-08-05T12:00:45.000Z",
    };

    const encoded = adapter.timerDataCodec.encode(payload);

    expect(encoded).toEqual(payload);
    expect(adapter.timerDataCodec.decode(encoded)).toEqual(payload);
  });

  it("builds a conflicted timer record with the accepted completion activity id", async () => {
    const adapter = createTummyTimeTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: vi.fn(),
    });
    const decodeTimerData = vi.spyOn(adapter.timerDataCodec, "decode");
    adapter.storage.getActiveTimer = vi.fn().mockResolvedValue({
      timerInstanceId: "timer-1",
      activityId: "resolved-activity",
      startedAt: "2026-08-05T12:00:00.000Z",
      isPaused: true,
      totalPausedMs: 0,
      lockState: "owned",
    });
    adapter.storage.getRecordById = vi.fn().mockResolvedValue(null);
    adapter.storage.setActiveTimer = vi.fn().mockResolvedValue(undefined);
    adapter.storage.clearActiveTimer = vi.fn().mockResolvedValue(undefined);
    vi.mocked(resolveTimerIdentity).mockResolvedValue({
      timerInstanceId: "timer-1",
      activityId: "resolved-activity",
    });
    vi.mocked(isTimerCompletionSecured).mockResolvedValue(false);
    vi.mocked(reconcileTimerLock).mockResolvedValue({
      state: "conflicted",
      lockHolderName: "Other caregiver",
    });
    vi.mocked(acceptTimerCompletion).mockResolvedValue({
      timerInstanceId: "timer-1",
      activityId: "accepted-activity",
      babyId: "baby-1",
      activityType: "tummy_time",
      startedAt: "2026-08-05T12:00:00.000Z",
      stoppedAt: "2026-08-05T12:01:00.000Z",
      status: "pending",
    });
    vi.mocked(markTimerCompletionDurable).mockResolvedValue({
      timerInstanceId: "timer-1",
      activityId: "accepted-activity",
      babyId: "baby-1",
      activityType: "tummy_time",
      startedAt: "2026-08-05T12:00:00.000Z",
      stoppedAt: "2026-08-05T12:01:00.000Z",
      status: "completed",
    });
    const persistedRecord = {
      id: "accepted-activity",
      babyId: "baby-1",
      startedAt: "2026-08-05T12:00:00.000Z",
      endedAt: "2026-08-05T12:01:00.000Z",
      durationSeconds: 60,
      createdAt: "2026-08-05T12:01:00.000Z",
      updatedAt: "2026-08-05T12:01:00.000Z",
    };
    const persistRecord = vi.fn().mockResolvedValue(persistedRecord);

    await restoreTimerLifecycle({
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
      persistRecord,
      dispatchStopTimer: vi.fn(),
      dispatchAddRecord: vi.fn(),
      errorLabel: "[TummyTimeContext]",
    });

    expect(adapter.storage.getRecordById).toHaveBeenCalledWith(
      "baby-1",
      "accepted-activity"
    );
    expect(persistRecord).toHaveBeenCalledWith(
      expect.objectContaining({ id: "accepted-activity" })
    );
    expect(decodeTimerData).not.toHaveBeenCalled();
  });
});

describe("calculateTimerDurationSeconds", () => {
  it("clamps negative spans, floors fractional seconds, and subtracts a pause once", () => {
    const startedAt = new Date("2026-08-05T12:00:00.000Z");

    expect(
      calculateTimerDurationSeconds(
        startedAt,
        new Date("2026-08-05T11:59:59.000Z"),
        0
      )
    ).toBe(0);
    expect(
      calculateTimerDurationSeconds(
        startedAt,
        new Date("2026-08-05T12:00:03.999Z"),
        0
      )
    ).toBe(3);
    expect(
      calculateTimerDurationSeconds(
        startedAt,
        new Date("2026-08-05T12:00:08.750Z"),
        2_500
      )
    ).toBe(6);
  });
});
