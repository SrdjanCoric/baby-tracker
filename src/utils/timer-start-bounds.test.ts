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

  it("keeps paused-timer bounds ordered from the same reference instant", () => {
    expect(
      getTimerStartBounds(
        [],
        new Date("2026-08-06T23:00:00.000Z"),
        new Date("2026-08-06T08:00:00.000Z")
      )
    ).toEqual({
      minimumDate: new Date("2026-08-05T20:00:00.000Z"),
      maximumDate: new Date("2026-08-06T08:00:00.000Z"),
    });
  });

  it("clamps a complete datetime selection to both bounds", () => {
    const bounds = getTimerStartBounds([], now);

    expect(
      normalizeTimerStartSelection(
        new Date("2026-08-05T23:00:00.000Z"),
        bounds
      )
    ).toEqual(bounds.minimumDate);
    expect(
      normalizeTimerStartSelection(
        new Date("2026-08-06T13:00:00.000Z"),
        bounds
      )
    ).toEqual(bounds.maximumDate);
  });
});
