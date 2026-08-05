import { describe, expect, it, vi } from "vitest";
import { calculateTimerDurationSeconds } from "../timer-lifecycle";
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
