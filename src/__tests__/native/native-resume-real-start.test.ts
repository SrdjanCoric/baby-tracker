import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const watchSource = readFileSync(
  new URL("../../../targets/watch/index.swift", import.meta.url),
  "utf8"
);
const liveActivityControllerSource = readFileSync(
  new URL("../../../plugins/with-live-activity-controller/ios/LiveActivityController.swift", import.meta.url),
  "utf8"
);
const liveActivityViewSource = readFileSync(
  new URL("../../../targets/widget/LiveActivity.swift", import.meta.url),
  "utf8"
);
const widgetSource = readFileSync(
  new URL("../../../targets/widget/index.swift", import.meta.url),
  "utf8"
);
const snapshotMigration = readFileSync(
  new URL("../../../supabase/migrations/077_snapshot_resumed_pause_total.sql", import.meta.url),
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
    expect(request).toContain('timerData["effectiveStartTime"] = effectiveStartTime');
    // The starter's Live Activity ticks on from the frozen value, not from the real start.
    expect(resume.match(/liveActivityStartTime = Self\.liveActivityStartISO\(/g)).toHaveLength(2);
    expect(request).toContain("if let liveActivityStart = liveActivityStartTime ?? effectiveStartTime");
    expect(request).toContain('body["effectiveStartTimeISO"] = liveActivityStart');
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

  it("counts every running widget tile from the anchor that leaves out resumed pauses", () => {
    const anchors = widgetSource.match(/let timerAnchor = getRunningTimerAnchor\(for: activity, data: data\)/g);
    const runningTexts = widgetSource.match(/Text\([^)]*, style: \.timer\)/g) ?? [];

    expect(anchors).toHaveLength(6);
    expect(runningTexts.length).toBeGreaterThan(0);
    expect(runningTexts.every((text) => text === "Text(timerAnchor, style: .timer)")).toBe(true);
  });

  it("counts the Watch's running and paused timers the way a stop saves them", () => {
    const pause = sourceBetween(watchSource, "func pauseTimer(activityType: String)", "func resumeTimer(activityType: String)");
    const resume = sourceBetween(watchSource, "func resumeTimer(activityType: String)", "func switchSide(activityType: String");
    const summary = sourceBetween(watchSource, "private func installAcceptedSummary(", "let activities = WatchActivityData(");

    expect(summary).toContain("excludedPauseSeconds: $0.excludedPauseSeconds");
    expect(pause.match(/WatchTimerCount\.pausedSeconds\(/g)).toHaveLength(2);
    expect(pause).not.toContain("Int(Date().timeIntervalSince(startTime))");
    expect(resume.match(/excludedPauseSeconds = Self\.excludedPauseSecondsAfterResume\(/g)).toHaveLength(2);
    // Server and app starts carry milliseconds, which a default ISO8601DateFormatter rejects.
    expect(pause.match(/parseDate\(/g)).toHaveLength(2);
    expect(resume).not.toContain("ISO8601DateFormatter().date(from:");
    expect(pause).not.toContain("ISO8601DateFormatter().date(from:");
    expect(watchSource.match(/style: \.timer/g)).toHaveLength(2);
    expect(
      watchSource.match(/WatchTimerCount\.runningAnchor\(start: start, excludedPauseSeconds: timer\.excludedPauseSeconds\),\s+style: \.timer/g)
    ).toHaveLength(2);
  });

  it("shows the app's counted elapsed on the starter's Live Activity across updates and restarts", () => {
    const pause = sourceBetween(
      liveActivityControllerSource,
      "@objc func pauseTimerActivity(",
      "@objc func resumeTimerActivity("
    );
    const resume = sourceBetween(
      liveActivityControllerSource,
      "@objc func resumeTimerActivity(",
      "\n    }\n"
    );
    const update = sourceBetween(
      liveActivityControllerSource,
      "@objc func updateTimerActivity(",
      "@objc func endTimerActivity("
    );

    expect(pause).toContain("elapsedSeconds: Int(activeElapsedSeconds.doubleValue)");
    // A resumed activity ticks on from those seconds; the anchor lives in the
    // activity's own state, so it survives an app restart that reuses it.
    expect(resume).toContain("let effectiveStart = Date().addingTimeInterval(-elapsed)");
    expect(resume).toContain("effectiveStartTimeISO: formatter.string(from: effectiveStart)");
    expect(update).toContain("effectiveStartTimeISO: currentState.effectiveStartTimeISO");
    expect(
      liveActivityViewSource.match(
        /Text\(effectiveTimerStart\(for: context\.state, fallback: context\.attributes\.startTime\), style: \.timer\)/g
      )
    ).toHaveLength(3);
  });
});
