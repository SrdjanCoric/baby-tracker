import { describe, it, expect } from "vitest";
import { buildOngoingSleepEntry } from "./ongoing-sleep";

const NOW = new Date(2026, 6, 15, 11, 0, 0);
const START = new Date(2026, 6, 15, 10, 0, 0);

function build(overrides: Partial<Parameters<typeof buildOngoingSleepEntry>[0]> = {}) {
  return buildOngoingSleepEntry({
    timer: { isRunning: true, startTime: START, totalPausedMs: 0 },
    babyId: "baby1",
    isCurrentBaby: true,
    now: NOW,
    dayStartHour: 6,
    dayEndHour: 19,
    ...overrides,
  });
}

describe("buildOngoingSleepEntry", () => {
  it("returns a closed entry spanning the elapsed time of a running timer", () => {
    const entry = build();

    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("ongoing-baby1");
    expect(entry!.babyId).toBe("baby1");
    expect(entry!.startedAt).toBe(START.toISOString());
    expect(entry!.endedAt).toBe(NOW.toISOString());
    expect(entry!.type).toBe("nap");
  });

  it("subtracts paused time from the reported duration", () => {
    const entry = build({ timer: { isRunning: true, startTime: START, totalPausedMs: 600_000 } });

    expect(entry!.durationSeconds).toBe(50 * 60);
  });

  it("shortens the entry interval by completed pauses, so surfaces that measure the interval report unpaused time", () => {
    const entry = build({ timer: { isRunning: true, startTime: START, totalPausedMs: 600_000 } });

    expect(entry!.startedAt).toBe(new Date(2026, 6, 15, 10, 10, 0).toISOString());
    expect(entry!.endedAt).toBe(NOW.toISOString());
    expect(
      (new Date(entry!.endedAt!).getTime() - new Date(entry!.startedAt).getTime()) / 60000
    ).toBe(50);
  });

  it("stops growing while the timer is paused", () => {
    const pausedAt = new Date(2026, 6, 15, 10, 50, 0);
    const timer = {
      isRunning: true,
      startTime: START,
      totalPausedMs: 0,
      isPaused: true,
      pausedAt,
    };

    const atPause = build({ timer, now: new Date(2026, 6, 15, 10, 50, 0) });
    const halfHourLater = build({ timer, now: new Date(2026, 6, 15, 11, 20, 0) });

    expect(atPause!.durationSeconds).toBe(50 * 60);
    expect(halfHourLater!.durationSeconds).toBe(50 * 60);
    expect(
      (new Date(halfHourLater!.endedAt!).getTime() -
        new Date(halfHourLater!.startedAt).getTime()) /
        60000
    ).toBe(50);
  });

  it("classifies by the configured day boundary", () => {
    const entry = build({ dayEndHour: 9 });

    expect(entry!.type).toBe("night");
  });

  it("returns null when no timer is running", () => {
    expect(build({ timer: null })).toBeNull();
    expect(
      build({ timer: { isRunning: false, startTime: START, totalPausedMs: 0 } })
    ).toBeNull();
  });

  it("returns null when the timer belongs to another baby or no baby is selected", () => {
    expect(build({ isCurrentBaby: false })).toBeNull();
    expect(build({ babyId: undefined })).toBeNull();
  });
});
