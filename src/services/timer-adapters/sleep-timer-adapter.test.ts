import { describe, expect, it, vi } from "vitest";
import { createFeedingTimerAdapter } from "./feeding-timer-adapter";
import { createPumpingTimerAdapter } from "./pumping-timer-adapter";
import { createSleepTimerAdapter } from "./sleep-timer-adapter";
import { createTummyTimeTimerAdapter } from "./tummy-time-timer-adapter";

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

describe("sleep timer adapter", () => {
  const resolveMorningClassification = vi.fn(
    (_startedAt: string, stored: "confirmed_first_nap" | null | undefined) =>
      stored ?? "confirmed_first_nap"
  );

  function createAdapter() {
    return createSleepTimerAdapter({
      babyId: "baby-1",
      resolveMorningClassification,
      dispatchRestoreTimer: vi.fn(),
    });
  }

  it("builds the classified sleep span from decoded timer data", () => {
    const adapter = createAdapter();
    const startedAt = new Date("2026-08-05T12:00:00.000Z");
    const endedAt = new Date("2026-08-05T12:02:03.999Z");

    expect(
      adapter.buildRecord(startedAt, endedAt, {
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        type: "night",
        isPaused: false,
        totalPausedMs: 3_000,
        morningClassification: "confirmed_first_nap",
        morningClassificationVersion: 4,
      })
    ).toEqual({
      id: "activity-1",
      babyId: "baby-1",
      type: "night",
      startedAt,
      endedAt,
      durationSeconds: 120,
      morningClassification: "confirmed_first_nap",
      morningClassificationVersion: 4,
    });
  });

  it("round-trips every current sleep timer-data field", () => {
    const adapter = createAdapter();
    const payload = {
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      type: "nap" as const,
      isPaused: true,
      totalPausedMs: 45_000,
      morningClassification: "confirmed_first_nap" as const,
      morningClassificationVersion: 4,
    };

    const encoded = adapter.timerDataCodec.encode(payload);

    expect(encoded).toEqual(payload);
    expect(
      adapter.timerDataCodec.decode(encoded, "2026-08-05T12:00:00.000Z")
    ).toEqual(payload);
    expect(encoded).not.toHaveProperty("pausedAt");
  });

  it("drops an invalid restored pause timestamp", () => {
    const dispatchRestoreTimer = vi.fn();
    const adapter = createSleepTimerAdapter({
      babyId: "baby-1",
      resolveMorningClassification,
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
        type: "nap",
        isPaused: true,
        totalPausedMs: 45_000,
        pausedAt: "not-a-date",
        morningClassification: "confirmed_first_nap",
        morningClassificationVersion: 4,
      },
    });

    expect(dispatchRestoreTimer).toHaveBeenCalledWith(
      expect.objectContaining({ pausedAt: undefined })
    );
  });

  it("dispatches every restored sleep timer field", () => {
    const dispatchRestoreTimer = vi.fn();
    const adapter = createSleepTimerAdapter({
      babyId: "baby-1",
      resolveMorningClassification,
      dispatchRestoreTimer,
    });
    const startedAt = new Date("2026-08-05T12:00:00.000Z");
    const pausedAt = "2026-08-05T12:00:45.000Z";

    adapter.dispatchRestoreTimer({
      startedAt,
      lockState: "owned",
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      payload: {
        timerInstanceId: "timer-1",
        activityId: "activity-1",
        type: "night",
        isPaused: true,
        totalPausedMs: 45_000,
        pausedAt,
        morningClassification: "confirmed_night_continuation",
        morningClassificationVersion: 4,
      },
    });

    expect(dispatchRestoreTimer).toHaveBeenCalledWith({
      isRunning: true,
      isPaused: true,
      lockState: "owned",
      startTime: startedAt,
      timerInstanceId: "timer-1",
      activityId: "activity-1",
      sleepType: "night",
      totalPausedMs: 45_000,
      pausedAt: new Date(pausedAt),
      morningClassification: "confirmed_night_continuation",
      morningClassificationVersion: 4,
    });
  });

  it("matches only sleeps starting within 5000 ms of the lock", () => {
    const adapter = createAdapter();
    const lockStartedAt = "2026-08-05T12:00:00.000Z";

    expect(
      adapter.alreadyStopped?.(lockStartedAt, [
        { id: "near", startedAt: "2026-08-05T12:00:04.999Z" },
      ])
    ).toBe(true);
    expect(
      adapter.alreadyStopped?.(lockStartedAt, [
        { id: "boundary", startedAt: "2026-08-05T12:00:05.000Z" },
      ])
    ).toBe(false);
  });

  it("is the only timer adapter with the proximity completion rule", () => {
    const options = { babyId: "baby-1", dispatchRestoreTimer: vi.fn() };

    expect(createPumpingTimerAdapter(options).alreadyStopped).toBeUndefined();
    expect(createFeedingTimerAdapter(options).alreadyStopped).toBeUndefined();
    expect(createTummyTimeTimerAdapter(options).alreadyStopped).toBeUndefined();
  });
});
