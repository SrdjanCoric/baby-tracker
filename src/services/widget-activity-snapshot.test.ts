import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { decodeWidgetActivitySnapshotJson } from "./widget-activity-snapshot";

type FixtureName =
  | "legacy"
  | "legacy-old"
  | "versioned"
  | "versioned-weight-only"
  | "versioned-missing-nap-count"
  | "versioned-missing-morning-pending"
  | "local-stamped";

function fixture(name: FixtureName): string {
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

  it("accepts an older unversioned cache without newer sleep summary fields", () => {
    const decoded = decodeWidgetActivitySnapshotJson(fixture("legacy-old"));

    expect(decoded?.kind).toBe("legacy");
    expect(decoded?.data.activities.sleep.napCountToday).toBe(0);
    expect(decoded?.data.activities.sleep.morningConfirmationPending).toBe(false);
  });

  it("accepts the supported version with additive unknown metadata", () => {
    const decoded = decodeWidgetActivitySnapshotJson(fixture("versioned"));

    expect(decoded?.kind).toBe("versioned");
    expect(decoded?.data.schemaVersion).toBe(1);
    expect(decoded?.data.babyId).toBe("baby-versioned");
    expect(decoded?.data.activities.sleep.lastSleepEndedAt).toBe("2026-08-08T09:45:00.000Z");
    expect(decoded?.data.activities.sleep.wakeWindowRequiresNewbornOptIn).toBe(true);
  });

  it("accepts a versioned weight-only growth measurement", () => {
    const decoded = decodeWidgetActivitySnapshotJson(fixture("versioned-weight-only"));

    expect(decoded?.data.activities.growth.lastMeasurement).toEqual({
      date: "2026-08-07T10:00:00.000Z",
      weightKg: 7.125,
    });
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

  it("rejects versioned payloads missing required sleep summary fields", () => {
    for (const name of [
      "versioned-missing-nap-count",
      "versioned-missing-morning-pending",
    ] as const) {
      expect(decodeWidgetActivitySnapshotJson(fixture(name))).toBeNull();
    }
  });

  it("classifies an app-written stamped cache as a local snapshot, not legacy", () => {
    const decoded = decodeWidgetActivitySnapshotJson(fixture("local-stamped"));

    expect(decoded?.kind).toBe("local");
    expect(decoded?.data.localAsOf).toBe("2026-08-08T10:01:00.000Z");
    expect(decoded?.data.activeTimers).toHaveLength(1);
    expect(decoded?.data.activeTimers[0].lockState).toBe("offline");
  });

  it("rejects a non-boolean newborn wake-window requirement", () => {
    const base = JSON.parse(fixture("versioned")) as {
      activities: { sleep: Record<string, unknown> };
    };
    base.activities.sleep.wakeWindowRequiresNewbornOptIn = "true";

    expect(decodeWidgetActivitySnapshotJson(JSON.stringify(base))).toBeNull();
  });
});
