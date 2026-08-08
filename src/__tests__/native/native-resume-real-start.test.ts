import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const widgetSource = readFileSync(
  new URL("../../../targets/widget/index.swift", import.meta.url),
  "utf8"
);
const watchSource = readFileSync(
  new URL("../../../targets/watch/index.swift", import.meta.url),
  "utf8"
);
const snapshotMigration = readFileSync(
  new URL("../../../supabase/migrations/061_get_baby_activity_snapshot.sql", import.meta.url),
  "utf8"
);

function sourceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("native counted-pause resume", () => {
  it("keeps the widget timer's real start locally and in the resume request", () => {
    const intent = sourceBetween(
      widgetSource,
      "struct TogglePauseActivityIntent",
      "struct SelectActivityIntent"
    );
    const resume = sourceBetween(intent, "if currentlyPaused {", "} else {");

    expect(resume).toContain("let effectiveStartISO = timer.startTime");
    expect(resume).toContain('"effectiveStartTime": effectiveStartISO');
    expect(resume).not.toContain("newStartTime");
    expect(resume).not.toContain('timer["startTime"] =');
  });

  it("keeps the Watch timer's real start locally and in the resume request", () => {
    const resume = sourceBetween(
      watchSource,
      "func resumeTimer(activityType: String)",
      "func switchSide(activityType: String"
    );
    const request = sourceBetween(
      watchSource,
      "private func supabaseTogglePause(",
      "private func cacheData("
    );

    expect(resume).toContain("var effectiveStartTime: String?");
    expect(resume).toContain("effectiveStartTime = self.localActiveTimers[index].startTime");
    expect(resume).toContain("effectiveStartTime = serverTimer.startTime");
    expect(resume).not.toContain("newStart");
    expect(request).toContain("effectiveStartTime: String? = nil");
    expect(request).toContain('body["effectiveStartTimeISO"] = effectiveStartTime');
    expect(request).toContain('timerData["effectiveStartTime"] = effectiveStartTime');
    expect(request).not.toContain("Date().addingTimeInterval");
  });

  it("uses the server's real start when native surfaces refresh", () => {
    const watchFetch = sourceBetween(
      watchSource,
      "private func fetchActiveTimersFromNetwork()",
      "// MARK: - Supabase Write Fallbacks"
    );

    expect(snapshotMigration).toMatch(
      /'startTime', pg_catalog\.to_char\(\s*timer\.started_at AT TIME ZONE 'UTC'/
    );
    expect(snapshotMigration).not.toContain("effectiveStartTime");
    expect(watchFetch).toContain("WatchTimerProbeDecoder.decode(");
    expect(watchFetch).not.toContain("startTime: timer.started_at");
    expect(watchFetch).not.toContain("effectiveStartTime");
  });
});
