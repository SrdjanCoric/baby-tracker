import { describe, expect, it, vi } from "vitest";
import { createPumpingTimerAdapter } from "./pumping-timer-adapter";

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

describe("pumping timer adapter", () => {
  it("excludes and stores a resumed pause in the pumping span without inventing a volume", () => {
    const adapter = createPumpingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: vi.fn(),
    });
    const startedAt = new Date("2026-08-05T12:00:00.000Z");
    const endedAt = new Date("2026-08-05T12:02:03.999Z");

    expect(
      adapter.buildRecord(startedAt, endedAt, {
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        side: "right",
        leftAccumulatedSeconds: 0,
        rightAccumulatedSeconds: 60,
        currentSideStartedAt: "2026-08-05T12:01:03.000Z",
        isPaused: false,
        totalPausedMs: 3_000,
      })
    ).toEqual({
      id: "activity-1",
      babyId: "baby-1",
      side: "right",
      startedAt,
      endedAt,
      durationSeconds: 120,
      pausedSeconds: 3,
      rightDurationSeconds: 120,
    });
  });

  it.each([
    {
      label: "never paused",
      isPaused: false,
      totalPausedMs: 0,
      durationSeconds: 180,
      pausedSeconds: 0,
    },
    {
      label: "resumed multiple pauses",
      isPaused: false,
      totalPausedMs: 20_000 + 10_000,
      durationSeconds: 150,
      pausedSeconds: 30,
    },
    {
      label: "paused now after an earlier pause",
      isPaused: true,
      totalPausedMs: 30_000,
      durationSeconds: 150,
      pausedSeconds: 30,
    },
  ])(
    "saves $label",
    ({ label: _label, durationSeconds, pausedSeconds, ...payload }) => {
      const adapter = createPumpingTimerAdapter({
        babyId: "baby-1",
        dispatchRestoreTimer: vi.fn(),
      });
      const startedAt = new Date("2026-08-05T12:00:00.000Z");
      const endedAt = new Date("2026-08-05T12:03:00.000Z");
      expect(
        adapter.buildRecord(startedAt, endedAt, { side: "right", ...payload })
      ).toMatchObject({
        startedAt,
        endedAt,
        durationSeconds,
        pausedSeconds,
      });
    }
  );

  it("round-trips current pumping timer data with optional fields absent or present", () => {
    const adapter = createPumpingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: vi.fn(),
    });
    const payloads = [
      {
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        side: "left" as const,
        leftAccumulatedSeconds: 0,
        rightAccumulatedSeconds: 0,
        currentSideStartedAt: "2026-08-05T12:00:00.000Z",
        isPaused: false,
        totalPausedMs: 0,
      },
      {
        timerInstanceId: "timer-2",
        activityId: "activity-2",
        side: "both" as const,
        leftAccumulatedSeconds: 45,
        rightAccumulatedSeconds: 45,
        currentSideStartedAt: "2026-08-05T12:00:00.000Z",
        isPaused: true,
        totalPausedMs: 45_000,
        pausedAt: "2026-08-05T12:00:45.000Z",
      },
    ];

    for (const payload of payloads) {
      const encoded = adapter.timerDataCodec.encode(payload);

      expect(encoded).toEqual(payload);
      expect(
        adapter.timerDataCodec.decode(encoded, "2026-08-05T12:00:00.000Z")
      ).toEqual(payload);
    }
    expect(adapter.timerDataCodec.encode(payloads[0])).not.toHaveProperty(
      "pausedAt"
    );
  });

  it("drops an invalid restored pause timestamp", () => {
    const dispatchRestoreTimer = vi.fn();
    const adapter = createPumpingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer,
    });

    adapter.dispatchRestoreTimer({
      startedAt: new Date("2026-08-05T12:00:00.000Z"),
      lockState: "owned",
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      payload: {
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        side: "left",
        isPaused: true,
        totalPausedMs: 45_000,
        pausedAt: "not-a-date",
      },
    });

    expect(dispatchRestoreTimer).toHaveBeenCalledWith(
      expect.objectContaining({ pausedAt: undefined })
    );
  });

  it("dispatches paused and unpaused restored pumping timers", () => {
    const startedAt = new Date("2026-08-05T12:00:00.000Z");
    const pausedAt = "2026-08-05T12:00:45.000Z";

    for (const timer of [
      {
        isPaused: true,
        totalPausedMs: 45_000,
        pausedAt,
        expectedPausedAt: new Date(pausedAt),
      },
      {
        isPaused: false,
        totalPausedMs: 0,
        pausedAt: undefined,
        expectedPausedAt: undefined,
      },
    ]) {
      const dispatchRestoreTimer = vi.fn();
      const adapter = createPumpingTimerAdapter({
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
          side: "right",
          leftAccumulatedSeconds: 0,
          rightAccumulatedSeconds: 30,
          currentSideStartedAt: "2026-08-05T12:00:30.000Z",
          isPaused: timer.isPaused,
          totalPausedMs: timer.totalPausedMs,
          ...(timer.pausedAt ? { pausedAt: timer.pausedAt } : {}),
        },
      });

      expect(dispatchRestoreTimer).toHaveBeenCalledWith({
        isRunning: true,
        isPaused: timer.isPaused,
        lockState: "owned",
        startTime: startedAt,
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        side: "right",
        leftAccumulatedSeconds: 0,
        rightAccumulatedSeconds: 30,
        currentSideStartedAt: new Date("2026-08-05T12:00:30.000Z"),
        totalPausedMs: timer.totalPausedMs,
        pausedAt: timer.expectedPausedAt,
      });
    }
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
      const adapter = createPumpingTimerAdapter({
        babyId: "baby-1",
        dispatchRestoreTimer: vi.fn(),
      });
      const record = adapter.buildRecord(startedAt, endedAt, {
        isPaused: false,
        totalPausedMs: pausedMs,
      });
      expect(record).toMatchObject({ durationSeconds, pausedSeconds });
    },
  );
});

it("preserves whole wall seconds when rounding a resumed pause", () => {
  const startedAt = new Date("2026-07-15T08:00:00.000Z");
  const endedAt = new Date(startedAt.getTime() + 360_400);
  const adapter = createPumpingTimerAdapter({
    babyId: "baby-1",
    dispatchRestoreTimer: vi.fn(),
  });
  const record = adapter.buildRecord(startedAt, endedAt, {
    isPaused: false,
    totalPausedMs: 180_700,
  });
  expect(record).toMatchObject({ durationSeconds: 180, pausedSeconds: 180 });
  expect(record.durationSeconds! + record.pausedSeconds!).toBe(360);
});

it("keeps whole-second active and pause totals equal to the floored wall span", () => {
  const adapter = createPumpingTimerAdapter({ babyId: "baby-1", dispatchRestoreTimer: vi.fn() });
  const start = new Date("2026-08-05T12:00:00.000Z");
  const record = adapter.buildRecord(start, new Date(start.getTime() + 10_900), {
    side: "left", isPaused: false, totalPausedMs: 950,
  });
  expect(record.durationSeconds).toBe(10);
  expect(record.pausedSeconds).toBe(0);
  expect(record.durationSeconds! + record.pausedSeconds!).toBe(10);
});

describe("pumping minutes per side", () => {
  const startedAt = new Date("2026-10-13T08:00:00.000Z");
  const at = (seconds: number) =>
    new Date(startedAt.getTime() + seconds * 1000);
  const adapter = () =>
    createPumpingTimerAdapter({ babyId: "baby-1", dispatchRestoreTimer: vi.fn() });

  it.each([
    {
      label: "ran only on the left",
      endSecond: 180,
      payload: {
        side: "left" as const,
        leftAccumulatedSeconds: 0,
        rightAccumulatedSeconds: 0,
        currentSideStartedAt: at(0).toISOString(),
        isPaused: false,
        totalPausedMs: 0,
      },
      left: 180,
      right: undefined,
    },
    {
      label: "left then right",
      endSecond: 200,
      payload: {
        side: "right" as const,
        leftAccumulatedSeconds: 120,
        rightAccumulatedSeconds: 0,
        currentSideStartedAt: at(120).toISOString(),
        isPaused: false,
        totalPausedMs: 0,
      },
      left: 120,
      right: 80,
    },
    {
      label: "both the whole time",
      endSecond: 180,
      payload: {
        side: "both" as const,
        leftAccumulatedSeconds: 0,
        rightAccumulatedSeconds: 0,
        currentSideStartedAt: at(0).toISOString(),
        isPaused: false,
        totalPausedMs: 0,
      },
      left: 180,
      right: 180,
    },
    {
      label: "mixed with a resumed pause",
      endSecond: 200,
      payload: {
        side: "right" as const,
        leftAccumulatedSeconds: 120,
        rightAccumulatedSeconds: 0,
        currentSideStartedAt: at(150).toISOString(),
        isPaused: false,
        totalPausedMs: 30_000,
        lastResumedAt: at(90).toISOString(),
      },
      left: 120,
      right: 50,
    },
    {
      label: "stopped while paused",
      endSecond: 90,
      payload: {
        side: "left" as const,
        leftAccumulatedSeconds: 90,
        rightAccumulatedSeconds: 0,
        currentSideStartedAt: at(0).toISOString(),
        isPaused: true,
        pausedAt: at(90).toISOString(),
        totalPausedMs: 0,
      },
      left: 90,
      right: undefined,
    },
  ])("saves per-side seconds when the timer $label", ({ endSecond, payload, left, right }) => {
    const record = adapter().buildRecord(startedAt, at(endSecond), payload);

    expect(record.leftDurationSeconds).toBe(left);
    expect(record.rightDurationSeconds).toBe(right);
    expect(record.side).toBe(payload.side);
    if (payload.side !== "both") {
      expect(
        (left ?? 0) + (right ?? 0) + record.pausedSeconds!
      ).toBe(endSecond);
    }
  });

  it("round-trips per-side seconds through the server lock timer data", () => {
    const payload = {
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      side: "right" as const,
      leftAccumulatedSeconds: 120,
      rightAccumulatedSeconds: 15,
      currentSideStartedAt: at(135).toISOString(),
      isPaused: false,
      totalPausedMs: 0,
    };
    const codec = adapter().timerDataCodec;

    expect(codec.decode(codec.encode(payload), at(0).toISOString())).toEqual(
      payload
    );
  });

  it("saves no side split for a timer started before per-side seconds existed", () => {
    const codec = adapter().timerDataCodec;
    const fromLock = codec.decode(
      { side: "right", isPaused: false, totalPausedMs: 0 },
      at(0).toISOString()
    );
    const fromLocalTimer = codec.fromActiveTimer({
      startedAt: at(0).toISOString(),
      side: "right",
    });

    for (const payload of [fromLock, fromLocalTimer]) {
      expect(payload.sidesUntracked).toBe(true);
      const record = adapter().buildRecord(at(0), at(1200), payload);
      expect(record.leftDurationSeconds).toBeUndefined();
      expect(record.rightDurationSeconds).toBeUndefined();
    }
  });

  it("keeps an untracked timer untracked across the server lock and restore", () => {
    const dispatchRestoreTimer = vi.fn();
    const codec = createPumpingTimerAdapter({ babyId: "baby-1", dispatchRestoreTimer })
      .timerDataCodec;
    const untracked = codec.decode(
      { side: "left", isPaused: false, totalPausedMs: 0 },
      at(0).toISOString()
    );
    const timerData = codec.encode({ ...untracked, side: "right" });

    expect(timerData).not.toHaveProperty("currentSideStartedAt");
    expect(timerData).not.toHaveProperty("leftAccumulatedSeconds");
    const restored = codec.decode(timerData, at(0).toISOString());
    expect(restored.sidesUntracked).toBe(true);
    createPumpingTimerAdapter({ babyId: "baby-1", dispatchRestoreTimer })
      .dispatchRestoreTimer({
        startedAt,
        lockState: "owned",
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        payload: restored,
      });
    expect(dispatchRestoreTimer).toHaveBeenCalledWith(
      expect.objectContaining({ sidesUntracked: true })
    );
  });

  it("restores per-side seconds onto the running timer", () => {
    const dispatchRestoreTimer = vi.fn();
    createPumpingTimerAdapter({ babyId: "baby-1", dispatchRestoreTimer })
      .dispatchRestoreTimer({
        startedAt,
        lockState: "owned",
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        payload: {
          side: "right",
          leftAccumulatedSeconds: 120,
          rightAccumulatedSeconds: 15,
          currentSideStartedAt: at(135).toISOString(),
          isPaused: false,
          totalPausedMs: 0,
        },
      });

    expect(dispatchRestoreTimer).toHaveBeenCalledWith(
      expect.objectContaining({
        leftAccumulatedSeconds: 120,
        rightAccumulatedSeconds: 15,
        currentSideStartedAt: at(135),
      })
    );
  });
});
