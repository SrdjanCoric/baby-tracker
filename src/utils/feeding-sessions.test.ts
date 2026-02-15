import { describe, it, expect } from "vitest";
import { countFeedingSessions } from "./feeding-sessions";
import type { StoredFeedingEntry } from "@/services/feeding-storage";

function makeFeeding(overrides: Partial<StoredFeedingEntry> & { startedAt: string }): StoredFeedingEntry {
  return {
    id: "1",
    babyId: "baby1",
    type: "breast",
    startedAt: overrides.startedAt,
    createdAt: overrides.startedAt,
    updatedAt: overrides.startedAt,
    ...overrides,
  };
}

describe("countFeedingSessions", () => {
  it("returns 0 for empty array", () => {
    expect(countFeedingSessions([])).toBe(0);
  });

  it("returns 1 for a single feeding", () => {
    const feedings = [makeFeeding({ startedAt: "2024-01-15T08:00:00Z" })];
    expect(countFeedingSessions(feedings)).toBe(1);
  });

  it("groups two feedings 30min apart as 1 session", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", endedAt: "2024-01-15T08:15:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T08:30:00Z", endedAt: "2024-01-15T08:45:00Z" }),
    ];
    expect(countFeedingSessions(feedings)).toBe(1);
  });

  it("counts two feedings 90min apart as 2 sessions", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", endedAt: "2024-01-15T08:15:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T09:45:00Z", endedAt: "2024-01-15T10:00:00Z" }),
    ];
    expect(countFeedingSessions(feedings)).toBe(2);
  });

  it("groups three feedings with 10min + 90min gaps as 2 sessions", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", endedAt: "2024-01-15T08:15:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T08:25:00Z", endedAt: "2024-01-15T08:40:00Z" }),
      makeFeeding({ id: "3", startedAt: "2024-01-15T10:10:00Z", endedAt: "2024-01-15T10:25:00Z" }),
    ];
    expect(countFeedingSessions(feedings)).toBe(2);
  });

  it("uses endedAt for gap calculation when available", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", endedAt: "2024-01-15T08:50:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T09:40:00Z" }),
    ];
    // Gap is from endedAt 08:50 to startedAt 09:40 = 50min < 1hr → 1 session
    expect(countFeedingSessions(feedings)).toBe(1);
  });

  it("uses startedAt when endedAt is missing", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T09:30:00Z" }),
    ];
    // Gap is from startedAt 08:00 to startedAt 09:30 = 90min >= 1hr → 2 sessions
    expect(countFeedingSessions(feedings)).toBe(2);
  });

  it("sorts feedings in non-chronological order correctly", () => {
    const feedings = [
      makeFeeding({ id: "3", startedAt: "2024-01-15T14:00:00Z", endedAt: "2024-01-15T14:15:00Z" }),
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", endedAt: "2024-01-15T08:15:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T08:20:00Z", endedAt: "2024-01-15T08:35:00Z" }),
    ];
    // 08:00-08:15 + 08:20-08:35 = session 1, 14:00-14:15 = session 2
    expect(countFeedingSessions(feedings)).toBe(2);
  });

  it("treats exactly 60min gap as a new session", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", endedAt: "2024-01-15T08:15:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T09:15:00Z" }),
    ];
    // Gap is exactly 60min → new session
    expect(countFeedingSessions(feedings)).toBe(2);
  });

  it("treats 59min 59sec gap as same session", () => {
    const feedings = [
      makeFeeding({ id: "1", startedAt: "2024-01-15T08:00:00Z", endedAt: "2024-01-15T08:15:00Z" }),
      makeFeeding({ id: "2", startedAt: "2024-01-15T09:14:59Z" }),
    ];
    // Gap is 59min 59sec < 1hr → same session
    expect(countFeedingSessions(feedings)).toBe(1);
  });
});
