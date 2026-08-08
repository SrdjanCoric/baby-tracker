import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { decodeWidgetActivitySnapshotJson } from "./widget-activity-snapshot";

function fixture(name: "legacy" | "versioned"): string {
  return readFileSync(
    resolve(process.cwd(), `fixtures/widget-activity-snapshots/${name}.json`),
    "utf8"
  );
}

describe("widget activity snapshot decoder", () => {
  it("accepts an unversioned cache and normalizes its singular timer fallback", () => {
    const decoded = decodeWidgetActivitySnapshotJson(fixture("legacy"));

    expect(decoded?.kind).toBe("legacy");
    expect(decoded?.data.activeTimer?.timerInstanceId).toBe("legacy-timer");
    expect(decoded?.data.activeTimers).toEqual([decoded?.data.activeTimer]);
  });

  it("accepts the supported version with additive unknown metadata", () => {
    const decoded = decodeWidgetActivitySnapshotJson(fixture("versioned"));

    expect(decoded?.kind).toBe("versioned");
    expect(decoded?.data.schemaVersion).toBe(1);
    expect(decoded?.data.babyId).toBe("baby-versioned");
    expect(decoded?.data.activities.sleep.lastSleepEndedAt).toBe("2026-08-08T09:45:00.000Z");
  });

  it("rejects unsupported, incomplete, and timer-incoherent versioned payloads", () => {
    const base = JSON.parse(fixture("versioned")) as Record<string, unknown>;
    expect(decodeWidgetActivitySnapshotJson(JSON.stringify({ ...base, schemaVersion: 2 }))).toBeNull();

    const { activities: _activities, ...incomplete } = base;
    expect(decodeWidgetActivitySnapshotJson(JSON.stringify(incomplete))).toBeNull();

    expect(decodeWidgetActivitySnapshotJson(JSON.stringify({
      ...base,
      activeTimer: {
        type: "sleep",
        startTime: "2026-08-08T10:00:00.000Z",
        timerInstanceId: "stale-timer"
      },
      activeTimers: []
    }))).toBeNull();
  });
});
