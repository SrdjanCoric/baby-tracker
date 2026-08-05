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
  it("builds a pumping span without inventing a volume", () => {
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
    });
  });

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
        isPaused: false,
        totalPausedMs: 0,
      },
      {
        timerInstanceId: "timer-2",
        activityId: "activity-2",
        side: "both" as const,
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
        totalPausedMs: timer.totalPausedMs,
        pausedAt: timer.expectedPausedAt,
      });
    }
  });
});
