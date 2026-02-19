import { describe, it, expect } from "vitest";
import { countFeedingSessions, computeSuggestedSide } from "./feeding-sessions";
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

describe("computeSuggestedSide", () => {
  it("returns null for empty array", () => {
    expect(computeSuggestedSide([])).toBeNull();
  });

  it("returns null when no breast feedings exist", () => {
    const feedings = [
      makeFeeding({ id: "1", type: "bottle", startedAt: "2024-01-15T08:00:00Z", durationSeconds: 300 }),
    ];
    expect(computeSuggestedSide(feedings)).toBeNull();
  });

  describe("single entry - both sides used", () => {
    it("suggests left when left had less time", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:15:00Z",
          durationSeconds: 900,
          leftDurationSeconds: 300,
          rightDurationSeconds: 600,
          lastFinishedSide: "right",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBe("left");
    });

    it("suggests right when right had less time", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:15:00Z",
          durationSeconds: 900,
          leftDurationSeconds: 600,
          rightDurationSeconds: 300,
          lastFinishedSide: "left",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBe("right");
    });

    it("suggests both when equal and lastFinishedSide is both", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:10:00Z",
          durationSeconds: 600,
          leftDurationSeconds: 300,
          rightDurationSeconds: 300,
          lastFinishedSide: "both",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBe("both");
    });

    it("suggests opposite of lastFinishedSide when equal durations", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:10:00Z",
          durationSeconds: 600,
          leftDurationSeconds: 300,
          rightDurationSeconds: 300,
          lastFinishedSide: "left",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBe("right");
    });
  });

  describe("single entry - one side only", () => {
    it("suggests right when only left was used", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:10:00Z",
          durationSeconds: 600,
          leftDurationSeconds: 600,
          lastFinishedSide: "left",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBe("right");
    });

    it("suggests left when only right was used", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:10:00Z",
          durationSeconds: 600,
          rightDurationSeconds: 600,
          lastFinishedSide: "right",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBe("left");
    });
  });

  describe("no duration data (old entries)", () => {
    it("suggests opposite of lastFinishedSide", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:10:00Z",
          durationSeconds: 600,
          lastFinishedSide: "left",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBe("right");
    });

    it("suggests opposite of side when no lastFinishedSide", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:10:00Z",
          durationSeconds: 600,
          side: "right",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBe("left");
    });

    it("defaults to left when side is both and no duration data", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:10:00Z",
          durationSeconds: 600,
          side: "both",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBe("left");
    });
  });

  describe("session grouping", () => {
    it("sums durations across entries within 1 hour", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:10:00Z",
          durationSeconds: 600,
          leftDurationSeconds: 600,
          lastFinishedSide: "left",
        }),
        makeFeeding({
          id: "2",
          startedAt: "2024-01-15T08:20:00Z",
          endedAt: "2024-01-15T08:25:00Z",
          durationSeconds: 300,
          rightDurationSeconds: 300,
          lastFinishedSide: "right",
        }),
      ];
      // Session total: left=600, right=300 → suggest right (less used)
      expect(computeSuggestedSide(feedings)).toBe("right");
    });

    it("only considers the most recent session when entries > 1 hour apart", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T06:00:00Z",
          endedAt: "2024-01-15T06:10:00Z",
          durationSeconds: 600,
          leftDurationSeconds: 600,
          lastFinishedSide: "left",
        }),
        makeFeeding({
          id: "2",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:10:00Z",
          durationSeconds: 600,
          rightDurationSeconds: 600,
          lastFinishedSide: "right",
        }),
      ];
      // Most recent session: only right used → suggest left
      expect(computeSuggestedSide(feedings)).toBe("left");
    });
  });

  describe("short session handling", () => {
    it("returns null when only session is under 2 minutes", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:01:30Z",
          durationSeconds: 90,
          leftDurationSeconds: 90,
          lastFinishedSide: "left",
        }),
      ];
      expect(computeSuggestedSide(feedings)).toBeNull();
    });

    it("falls back to previous session when most recent is under 2 minutes", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T06:00:00Z",
          endedAt: "2024-01-15T06:10:00Z",
          durationSeconds: 600,
          leftDurationSeconds: 600,
          lastFinishedSide: "left",
        }),
        makeFeeding({
          id: "2",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:01:00Z",
          durationSeconds: 60,
          rightDurationSeconds: 60,
          lastFinishedSide: "right",
        }),
      ];
      // Most recent session (60s) is too short, falls back to 06:00 session → suggest right
      expect(computeSuggestedSide(feedings)).toBe("right");
    });

    it("uses session total when short attempt + real feeding are in same session", () => {
      const feedings = [
        makeFeeding({
          id: "1",
          startedAt: "2024-01-15T08:00:00Z",
          endedAt: "2024-01-15T08:00:30Z",
          durationSeconds: 30,
          leftDurationSeconds: 30,
          lastFinishedSide: "left",
        }),
        makeFeeding({
          id: "2",
          startedAt: "2024-01-15T08:05:00Z",
          endedAt: "2024-01-15T08:15:00Z",
          durationSeconds: 600,
          rightDurationSeconds: 600,
          lastFinishedSide: "right",
        }),
      ];
      // Same session, total duration = 630s (valid), left=30, right=600 → suggest left (less used)
      expect(computeSuggestedSide(feedings)).toBe("left");
    });
  });

  it("ignores non-breast feedings", () => {
    const feedings = [
      makeFeeding({
        id: "1",
        type: "bottle",
        startedAt: "2024-01-15T09:00:00Z",
        durationSeconds: 300,
      }),
      makeFeeding({
        id: "2",
        startedAt: "2024-01-15T08:00:00Z",
        endedAt: "2024-01-15T08:10:00Z",
        durationSeconds: 600,
        leftDurationSeconds: 600,
        lastFinishedSide: "left",
      }),
    ];
    expect(computeSuggestedSide(feedings)).toBe("right");
  });
});
