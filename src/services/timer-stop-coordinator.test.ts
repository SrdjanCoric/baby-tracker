import { describe, expect, it, vi } from "vitest";
import {
  isPendingStopForTimer,
  isTimerRestoreObsolete,
  processPendingTimerStop,
  type PendingTimerStop,
} from "./timer-stop-coordinator";

const pendingStop: PendingTimerStop = {
  activityType: "sleep",
  stoppedAt: "2026-07-14T10:00:00.000Z",
};

describe("timer stop coordinator", () => {
  it("waits for a cold-start timer to restore without consuming the stop", async () => {
    const stop = vi.fn();

    const result = await processPendingTimerStop(pendingStop, undefined, stop);

    expect(result).toBe("waiting");
    expect(stop).not.toHaveBeenCalled();
  });

  it("keeps repeated delivery pending without duplicating a completed stop", async () => {
    const stop = vi.fn();

    const result = await processPendingTimerStop(pendingStop, null, stop);

    expect(result).toBe("waiting");
    expect(stop).not.toHaveBeenCalled();
  });

  it("consumes the command when a sub-minute stop returns no saved entry", async () => {
    const stop = vi.fn().mockResolvedValue(null);

    const result = await processPendingTimerStop(
      pendingStop,
      { isRunning: true, startTime: new Date("2026-07-14T09:00:00.000Z") },
      stop
    );

    expect(result).toBe("consumed");
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(new Date(pendingStop.stoppedAt));
  });

  it("rejects a stale stop when a newer timer is running", async () => {
    const stop = vi.fn();

    const result = await processPendingTimerStop(
      pendingStop,
      { isRunning: true, startTime: new Date("2026-07-14T10:05:00.000Z") },
      stop
    );

    expect(result).toBe("stale");
    expect(stop).not.toHaveBeenCalled();
  });

  it.each(["feeding", "sleep", "pumping", "tummy_time"] as const)(
    "allows %s local restoration after the matching external stop released the lock",
    (activityType) => {
      expect(
        isPendingStopForTimer(
          { ...pendingStop, activityType },
          activityType,
          new Date("2026-07-14T09:00:00.000Z")
        )
      ).toBe(true);
    }
  );

  it("does not match a pending stop to another activity", () => {
    expect(
      isPendingStopForTimer(
        pendingStop,
        "feeding",
        new Date("2026-07-14T09:00:00.000Z")
      )
    ).toBe(false);
  });

  it("does not apply a stop command to a different baby", async () => {
    const targetedStop: PendingTimerStop = { ...pendingStop, babyId: "baby-1" };
    const stop = vi.fn();

    expect(
      isPendingStopForTimer(
        targetedStop,
        "sleep",
        new Date("2026-07-14T09:00:00.000Z"),
        "baby-2"
      )
    ).toBe(false);
    expect(
      await processPendingTimerStop(
        targetedStop,
        { isRunning: true, startTime: new Date("2026-07-14T09:00:00.000Z") },
        stop,
        "baby-2"
      )
    ).toBe("waiting");
    expect(stop).not.toHaveBeenCalled();
  });

  it("blocks asynchronous restoration once stopping begins or completes", () => {
    expect(isTimerRestoreObsolete(4, 4, true)).toBe(true);
    expect(isTimerRestoreObsolete(4, 5, false)).toBe(true);
    expect(isTimerRestoreObsolete(4, 4, false)).toBe(false);
  });
});
