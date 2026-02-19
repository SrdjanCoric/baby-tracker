import { describe, it, expect } from "vitest";
import {
  isNightTime,
  determineSleepTypeFromBoundary,
  countNapsWithContinuation,
} from "./day-night-boundary";
import type { StoredSleepEntry } from "@/services/sleep-storage";

function makeNap(startedAt: string, endedAt: string): StoredSleepEntry {
  return {
    id: `nap-${startedAt}`,
    babyId: "baby-1",
    type: "nap",
    startedAt,
    endedAt,
    durationSeconds: (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

describe("isNightTime", () => {
  it("returns true for hours before day start (default 6)", () => {
    expect(isNightTime(new Date(2024, 5, 15, 0, 0))).toBe(true);
    expect(isNightTime(new Date(2024, 5, 15, 3, 0))).toBe(true);
    expect(isNightTime(new Date(2024, 5, 15, 5, 59))).toBe(true);
  });

  it("returns false for hours during the day (default 6-19)", () => {
    expect(isNightTime(new Date(2024, 5, 15, 6, 0))).toBe(false);
    expect(isNightTime(new Date(2024, 5, 15, 12, 0))).toBe(false);
    expect(isNightTime(new Date(2024, 5, 15, 18, 59))).toBe(false);
  });

  it("returns true for hours at or after day end (default 19)", () => {
    expect(isNightTime(new Date(2024, 5, 15, 19, 0))).toBe(true);
    expect(isNightTime(new Date(2024, 5, 15, 21, 0))).toBe(true);
    expect(isNightTime(new Date(2024, 5, 15, 23, 59))).toBe(true);
  });

  it("respects custom day start and end hours", () => {
    expect(isNightTime(new Date(2024, 5, 15, 6, 30), 7, 20)).toBe(true);
    expect(isNightTime(new Date(2024, 5, 15, 7, 0), 7, 20)).toBe(false);
    expect(isNightTime(new Date(2024, 5, 15, 19, 30), 7, 20)).toBe(false);
    expect(isNightTime(new Date(2024, 5, 15, 20, 0), 7, 20)).toBe(true);
  });

  it("handles midnight boundary correctly", () => {
    expect(isNightTime(new Date(2024, 5, 15, 0, 0))).toBe(true);
    expect(isNightTime(new Date(2024, 5, 15, 23, 59))).toBe(true);
  });
});

describe("determineSleepTypeFromBoundary", () => {
  it("returns night for nighttime hours with defaults", () => {
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 20, 0))).toBe("night");
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 3, 0))).toBe("night");
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 23, 30))).toBe("night");
  });

  it("returns nap for daytime hours with defaults", () => {
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 9, 0))).toBe("nap");
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 14, 0))).toBe("nap");
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 6, 0))).toBe("nap");
  });

  it("returns night at the boundary (19:00)", () => {
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 19, 0))).toBe("night");
  });

  it("returns nap at the boundary (6:00)", () => {
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 6, 0))).toBe("nap");
  });

  it("uses custom boundaries", () => {
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 6, 30), 7, 20)).toBe("night");
    expect(determineSleepTypeFromBoundary(new Date(2024, 5, 15, 19, 30), 7, 20)).toBe("nap");
  });
});

describe("countNapsWithContinuation", () => {
  it("returns 0 for empty array", () => {
    expect(countNapsWithContinuation([])).toBe(0);
  });

  it("returns 1 for a single nap", () => {
    const naps = [makeNap("2024-06-15T08:00:00Z", "2024-06-15T08:30:00Z")];
    expect(countNapsWithContinuation(naps)).toBe(1);
  });

  it("counts two naps 10 min apart as 1 (below 15 min threshold)", () => {
    const naps = [
      makeNap("2024-06-15T08:00:00Z", "2024-06-15T08:20:00Z"),
      makeNap("2024-06-15T08:30:00Z", "2024-06-15T09:30:00Z"),
    ];
    expect(countNapsWithContinuation(naps)).toBe(1);
  });

  it("counts two naps 30 min apart as 2 (above 15 min threshold)", () => {
    const naps = [
      makeNap("2024-06-15T08:00:00Z", "2024-06-15T08:20:00Z"),
      makeNap("2024-06-15T08:50:00Z", "2024-06-15T09:30:00Z"),
    ];
    expect(countNapsWithContinuation(naps)).toBe(2);
  });

  it("counts three naps: first two close, third far apart as 2", () => {
    const naps = [
      makeNap("2024-06-15T08:00:00Z", "2024-06-15T08:20:00Z"),
      makeNap("2024-06-15T08:30:00Z", "2024-06-15T09:00:00Z"),
      makeNap("2024-06-15T11:00:00Z", "2024-06-15T12:00:00Z"),
    ];
    expect(countNapsWithContinuation(naps)).toBe(2);
  });

  it("counts with exactly threshold gap as separate naps", () => {
    const naps = [
      makeNap("2024-06-15T08:00:00Z", "2024-06-15T08:20:00Z"),
      makeNap("2024-06-15T08:35:00Z", "2024-06-15T09:00:00Z"),
    ];
    expect(countNapsWithContinuation(naps, 15)).toBe(2);
  });

  it("uses custom threshold", () => {
    const naps = [
      makeNap("2024-06-15T08:00:00Z", "2024-06-15T08:20:00Z"),
      makeNap("2024-06-15T08:38:00Z", "2024-06-15T09:00:00Z"),
    ];
    expect(countNapsWithContinuation(naps, 20)).toBe(1);
    expect(countNapsWithContinuation(naps, 15)).toBe(2);
  });

  it("handles unsorted input correctly", () => {
    const naps = [
      makeNap("2024-06-15T11:00:00Z", "2024-06-15T12:00:00Z"),
      makeNap("2024-06-15T08:00:00Z", "2024-06-15T08:20:00Z"),
      makeNap("2024-06-15T08:30:00Z", "2024-06-15T09:00:00Z"),
    ];
    expect(countNapsWithContinuation(naps)).toBe(2);
  });
});
