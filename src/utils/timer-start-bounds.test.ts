import { describe, expect, it } from "vitest";
import {
  getTimerStartBounds,
  normalizeTimerStartSelection,
} from "./timer-start-bounds";

describe("timer start bounds", () => {
  const now = new Date("2026-08-06T12:00:00.000Z");

  it("uses the later of the twelve-hour floor and the previous activity end", () => {
    expect(
      getTimerStartBounds(
        [
          { endedAt: "2026-08-05T20:00:00.000Z" },
          { endedAt: "2026-08-06T03:30:00.000Z" },
        ],
        now
      )
    ).toEqual({
      minimumDate: new Date("2026-08-06T03:30:00.000Z"),
      maximumDate: now,
    });

    expect(getTimerStartBounds([], now).minimumDate).toEqual(
      new Date("2026-08-06T00:00:00.000Z")
    );
  });

  it("caps a paused timer at its pause instant without moving the twelve-hour floor", () => {
    expect(
      getTimerStartBounds(
        [],
        new Date("2026-08-06T23:00:00.000Z"),
        new Date("2026-08-06T22:30:00.000Z")
      )
    ).toEqual({
      minimumDate: new Date("2026-08-06T11:00:00.000Z"),
      maximumDate: new Date("2026-08-06T22:30:00.000Z"),
    });
  });

  it("applies both bounds to Android's reconstructed time", () => {
    const bounds = getTimerStartBounds(
      [{ endedAt: "2026-08-06T03:30:00.000Z" }],
      now
    );

    expect(
      normalizeTimerStartSelection(
        new Date("2020-01-01T02:00:00.000Z"),
        bounds,
        now,
        "android"
      )
    ).toEqual(bounds.minimumDate);
    expect(
      normalizeTimerStartSelection(
        new Date("2020-01-01T13:00:00.000Z"),
        bounds,
        now,
        "android"
      ).getTime()
    ).toBeLessThanOrEqual(bounds.maximumDate.getTime());
  });
});
