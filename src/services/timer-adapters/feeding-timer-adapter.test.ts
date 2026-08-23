import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("restores a Wear-started timer through the phone timer contract", () => {
    const fixture = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "plugins/with-wear-os/android/wear/src/test/resources/phone-feeding-timer-row.json"
        ),
        "utf8"
      )
    );
    const dispatchRestoreTimer = vi.fn();
    const adapter = createFeedingTimerAdapter({
      babyId: fixture.p_baby_id,
      dispatchRestoreTimer,
    });
    const payload = adapter.timerDataCodec.decode(
      fixture.p_timer_data,
      fixture.p_started_at
    );

    adapter.dispatchRestoreTimer({
      startedAt: new Date(fixture.p_started_at),
      lockState: "owned",
      timerInstanceId: fixture.p_timer_data.timerInstanceId,
      activityId: fixture.p_timer_data.activityId,
      payload: {
        ...payload,
        timerInstanceId: fixture.p_timer_data.timerInstanceId,
        activityId: fixture.p_timer_data.activityId,
      },
    });

    expect(dispatchRestoreTimer).toHaveBeenCalledWith(
      expect.objectContaining({
        isRunning: true,
        timerInstanceId: fixture.p_timer_data.timerInstanceId,
        activityId: fixture.p_timer_data.activityId,
        side: "left",
        currentSideStartedAt: new Date(fixture.p_started_at),
      })
    );
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

  it("counts a resumed pause in the breastfeed span", () => {
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
      durationSeconds: 1200,
      leftDurationSeconds: 1200,
      rightDurationSeconds: undefined,
    });
    const encoded = adapter.timerDataCodec.encode(payload);
    expect(encoded).toEqual(payload);
    expect(
      adapter.timerDataCodec.decode(encoded, "2026-08-05T12:00:00.000Z")
    ).toEqual(payload);
    expect(encoded).not.toHaveProperty("pausedAt");
  });

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
