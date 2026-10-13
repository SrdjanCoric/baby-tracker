import { describe, expect, it, vi } from "vitest";
import { calculateActiveDurationSeconds } from "@/utils/timer-duration";
import { createFeedingTimerAdapter } from "./feeding-timer-adapter";

vi.mock("../live-activity-service", () => ({}));
vi.mock("../active-timer-service", () => ({}));
vi.mock("../timer-conflict-notice", () => ({}));
vi.mock("../timer-completion-service", () => ({}));
vi.mock("../timer-lock-reconciliation", () => ({}));
vi.mock("../timer-stop-coordinator", () => ({}));
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

describe("feeding timer adapter", () => {
  const startedAt = new Date("2026-08-05T12:00:00.000Z");
  const endedAt = new Date("2026-08-05T12:01:00.000Z");

  function build(overrides: Record<string, unknown>) {
    const adapter = createFeedingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: vi.fn(),
    });

    return adapter.buildRecord(startedAt, endedAt, {
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      side: "left",
      type: "breast",
      leftAccumulatedSeconds: 10,
      rightAccumulatedSeconds: 20,
      currentSideStartedAt: "2026-08-05T12:00:30.000Z",
      isPaused: false,
      totalPausedMs: 0,
      ...overrides,
    });
  }

  it("matches edit duration rounding for fractional wall and pause milliseconds", () => {
    const adapter = createFeedingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: vi.fn(),
    });
    const end = new Date(startedAt.getTime() + 90_999);
    const record = adapter.buildRecord(startedAt, end, {
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      type: "breast",
      side: "left",
      leftAccumulatedSeconds: 0,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: startedAt.toISOString(),
      isPaused: false,
      totalPausedMs: 30_999,
    });
    expect(record.pausedSeconds).toBe(30);
    expect(record.durationSeconds).toBe(60);
    expect(
      calculateActiveDurationSeconds(startedAt, end, record.pausedSeconds!)
    ).toBe(record.durationSeconds);
  });

  it("adds running elapsed time to the active left, right, or both sides", () => {
    expect(build({ side: "left" })).toMatchObject({
      side: "both",
      lastFinishedSide: "left",
      leftDurationSeconds: 40,
      rightDurationSeconds: 20,
    });
    expect(build({ side: "right" })).toMatchObject({
      side: "both",
      lastFinishedSide: "right",
      leftDurationSeconds: 10,
      rightDurationSeconds: 50,
    });
    expect(build({ side: "both" })).toMatchObject({
      side: "both",
      lastFinishedSide: "both",
      leftDurationSeconds: 40,
      rightDurationSeconds: 50,
    });
  });

  it("does not add current-side elapsed time while paused", () => {
    expect(build({ side: "left", isPaused: true })).toMatchObject({
      leftDurationSeconds: 10,
      rightDurationSeconds: 20,
    });
  });

  it("omits an unused side and resolves equal one-sided totals to left", () => {
    expect(
      build({
        side: "left",
        leftAccumulatedSeconds: 0,
        rightAccumulatedSeconds: 0,
      })
    ).toMatchObject({
      side: "left",
      lastFinishedSide: "left",
      leftDurationSeconds: 30,
      rightDurationSeconds: undefined,
    });
    expect(
      build({
        side: undefined,
        leftAccumulatedSeconds: 30,
        rightAccumulatedSeconds: 30,
      })
    ).toMatchObject({
      side: "both",
      lastFinishedSide: undefined,
      leftDurationSeconds: 30,
      rightDurationSeconds: 30,
    });
  });

  it("clamps a future current-side timestamp instead of subtracting time", () => {
    expect(
      build({
        side: "left",
        leftAccumulatedSeconds: 0,
        rightAccumulatedSeconds: 0,
        currentSideStartedAt: "2026-08-05T12:02:00.000Z",
      })
    ).toMatchObject({
      side: "left",
      leftDurationSeconds: undefined,
      rightDurationSeconds: undefined,
    });
  });

  it("excludes and stores a resumed pause in the breastfeed span", () => {
    const adapter = createFeedingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: vi.fn(),
    });
    const resumedPauseStartedAt = new Date("2026-08-05T10:00:00.000Z");
    const resumedPauseEndedAt = new Date("2026-08-05T10:20:00.000Z");
    const payload = {
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      side: "left" as const,
      type: "breast" as const,
      leftAccumulatedSeconds: 300,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: "2026-08-05T10:15:00.000Z",
      isPaused: false,
      totalPausedMs: 600_000,
    };

    expect(
      adapter.buildRecord(
        resumedPauseStartedAt,
        resumedPauseEndedAt,
        payload
      )
    ).toEqual({
      id: "activity-1",
      babyId: "baby-1",
      type: "breast",
      side: "left",
      lastFinishedSide: "left",
      startedAt: resumedPauseStartedAt,
      endedAt: resumedPauseEndedAt,
      durationSeconds: 600,
      pausedSeconds: 600,
      leftDurationSeconds: 600,
      rightDurationSeconds: undefined,
    });
    const encoded = adapter.timerDataCodec.encode(payload);
    expect(encoded).toEqual(payload);
    expect(
      adapter.timerDataCodec.decode(encoded, "2026-08-05T12:00:00.000Z")
    ).toEqual(payload);
    expect(encoded).not.toHaveProperty("pausedAt");
  });

  it.each([
    {
      label: "never paused",
      isPaused: false,
      totalPausedMs: 0,
      durationSeconds: 60,
      pausedSeconds: 0,
    },
    {
      label: "resumed multiple pauses",
      isPaused: false,
      totalPausedMs: 20_000 + 10_000,
      durationSeconds: 30,
      pausedSeconds: 30,
    },
    {
      label: "paused now after an earlier pause",
      isPaused: true,
      totalPausedMs: 10_000,
      durationSeconds: 50,
      pausedSeconds: 10,
    },
  ])(
    "saves $label",
    ({ label: _label, durationSeconds, pausedSeconds, ...payload }) => {
      expect(build(payload)).toMatchObject({
        startedAt,
        endedAt,
        durationSeconds,
        pausedSeconds,
      });
    }
  );

  it.each(["left", "right", "both"])(
    "adds no resumed pause to the %s side",
    (side) => {
      expect(
        build({ side, isPaused: true, totalPausedMs: 10_000 })
      ).toMatchObject({
        leftDurationSeconds: 10,
        rightDurationSeconds: 20,
      });
    }
  );

  it("normalizes invalid restored timer timestamps", () => {
    const dispatchRestoreTimer = vi.fn();
    const adapter = createFeedingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer,
    });

    adapter.dispatchRestoreTimer({
      startedAt,
      lockState: "owned",
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      payload: {
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        side: "left",
        type: "breast",
        leftAccumulatedSeconds: 12,
        rightAccumulatedSeconds: 34,
        currentSideStartedAt: "not-a-date",
        isPaused: true,
        totalPausedMs: 45_000,
        pausedAt: "also-not-a-date",
      },
    });

    expect(dispatchRestoreTimer).toHaveBeenCalledWith(
      expect.objectContaining({
        currentSideStartedAt: startedAt,
        pausedAt: undefined,
      })
    );
  });

  it("dispatches restored feeding fields and falls back to the timer start", () => {
    const dispatchRestoreTimer = vi.fn();
    const adapter = createFeedingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer,
    });
    const pausedAt = "2026-08-05T12:00:45.000Z";

    adapter.dispatchRestoreTimer({
      startedAt,
      lockState: "owned",
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      payload: {
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        side: "both",
        type: "breast",
        leftAccumulatedSeconds: 12,
        rightAccumulatedSeconds: 34,
        currentSideStartedAt: "",
        isPaused: true,
        totalPausedMs: 45_000,
        pausedAt,
      },
    });

    expect(dispatchRestoreTimer).toHaveBeenCalledWith({
      isRunning: true,
      isPaused: true,
      lockState: "owned",
      startTime: startedAt,
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      side: "both",
      leftAccumulatedSeconds: 12,
      rightAccumulatedSeconds: 34,
      currentSideStartedAt: startedAt,
      totalPausedMs: 45_000,
      pausedAt: new Date(pausedAt),
    });
  });
});

describe("bounded saved pause totals", () => {
  it.each([
    { pausedMs: -60_000, durationSeconds: 360, pausedSeconds: 0 },
    { pausedMs: 600_000, durationSeconds: 0, pausedSeconds: 360 },
  ])(
    "bounds $pausedMs pause milliseconds to the saved interval",
    ({ pausedMs, durationSeconds, pausedSeconds }) => {
      const startedAt = new Date("2026-07-15T08:00:00.000Z");
      const endedAt = new Date(startedAt.getTime() + 360_400);
      const adapter = createFeedingTimerAdapter({
        babyId: "baby-1",
        dispatchRestoreTimer: vi.fn(),
      });
      const record = adapter.buildRecord(startedAt, endedAt, {
        type: "breast",
        side: "left",
        isPaused: false,
        totalPausedMs: pausedMs,
        leftAccumulatedSeconds: 0,
        rightAccumulatedSeconds: 0,
        currentSideStartedAt: startedAt.toISOString(),
      });
      expect(record).toMatchObject({ durationSeconds, pausedSeconds });
    }
  );
});

it("preserves whole wall seconds when rounding a resumed pause", () => {
  const startedAt = new Date("2026-07-15T08:00:00.000Z");
  const endedAt = new Date(startedAt.getTime() + 360_400);
  const adapter = createFeedingTimerAdapter({
    babyId: "baby-1",
    dispatchRestoreTimer: vi.fn(),
  });
  const record = adapter.buildRecord(startedAt, endedAt, {
    isPaused: false,
    totalPausedMs: 180_700,
    type: "breast",
    side: "left",
    leftAccumulatedSeconds: 0,
    rightAccumulatedSeconds: 0,
    currentSideStartedAt: startedAt.toISOString(),
  });
  expect(record).toMatchObject({ durationSeconds: 180, pausedSeconds: 180 });
  expect(record.durationSeconds! + record.pausedSeconds!).toBe(360);
});