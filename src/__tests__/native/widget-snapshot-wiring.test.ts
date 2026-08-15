import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const widgetSource = readFileSync(
  resolve(process.cwd(), "targets/widget/index.swift"),
  "utf8"
);
const snapshotSource = readFileSync(
  resolve(process.cwd(), "targets/widget/WidgetActivitySnapshot.swift"),
  "utf8"
);

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("Widget coherent snapshot wiring", () => {
  it("calls the authenticated selected-baby RPC without a caller identity parameter", () => {
    expect(widgetSource).toContain("/rest/v1/rpc/get_baby_activity_snapshot");
    expect(widgetSource).toContain('"p_baby_id"');
    expect(widgetSource).toContain('"p_timezone"');
    expect(widgetSource).not.toContain('"p_user_id"');
    expect(snapshotSource).toContain("WidgetSnapshotCoordinator");
    expect(widgetSource).toContain('let idsKey = "widgetSnapshotBabyIds"');
  });

  it("routes all three timeline providers through the complete snapshot coordinator", () => {
    const providers = between(
      widgetSource,
      "struct SingleActivityProvider",
      "// MARK: - Small Widget View"
    );
    expect(
      providers.match(/await refreshWidgetSnapshot\(reloadTimelines: false\)/g)
    ).toHaveLength(3);
    expect(providers).not.toContain("fetchActiveTimersFromNetwork");
    expect(providers).not.toContain("mergeNetworkTimers");
  });

  it("reconciles stop and pause actions without committing timer-only base data", () => {
    const stop = between(widgetSource, "struct StopActivityIntent", "// MARK: - Toggle Pause Intent");
    const pause = between(widgetSource, "struct TogglePauseActivityIntent", "// MARK: - Configuration Intents");
    const missingPauseTimer = between(
      pause,
      "guard let widgetData,",
      "let currentlyPaused"
    );

    expect(stop).toContain("await refreshWidgetSnapshot()");
    expect(pause).toContain("await refreshWidgetSnapshot()");
    expect(missingPauseTimer).toContain("WidgetCenter.shared.reloadAllTimelines()");
    expect(stop).not.toContain('set(updatedString, forKey: "widgetData")');
    expect(pause).not.toContain('set(updatedString, forKey: "widgetData")');
    expect(widgetSource).not.toContain("func fetchActiveTimersFromNetwork");
    expect(widgetSource).not.toContain("func mergeNetworkTimers");
  });

  it("gates newborn wake windows with the device-local Widget preference", () => {
    const countdown = between(
      widgetSource,
      "func getWakeWindowCountdown",
      "func computeWakeWindowText"
    );

    expect(countdown).toContain('string(forKey: "widgetNewbornNapOptIn.\\(data.babyId)") == "true"');
    expect(countdown).toContain("canPresentWakeWindow");
  });

  it("suppresses sleep-derived timing until a queued Widget stop is persisted", () => {
    const countdown = between(
      widgetSource,
      "func getWakeWindowCountdown",
      "func computeWakeWindowText"
    );
    const awakeTime = between(
      widgetSource,
      "func getAwakeTimeText",
      "func formatRelative"
    );

    expect(widgetSource).toContain("func pendingSleepStopAt");
    expect(countdown).toContain("canPresentSleepDerivedTiming");
    expect(awakeTime).toContain("canPresentSleepDerivedTiming");
  });

  it("advances small-widget sleep timing with each timeline entry", () => {
    const smallWidget = between(
      widgetSource,
      "struct SmallWidgetView",
      "// Maps a raw data token"
    );
    const mainText = between(
      widgetSource,
      "func getSmallWidgetMainText",
      "func getSmallWidgetSubtext"
    );
    const subtext = between(
      widgetSource,
      "func getSmallWidgetSubtext",
      "func formatTimerContext"
    );
    const wakeWindow = between(
      widgetSource,
      "func getWakeWindowCountdown",
      "func computeWakeWindowText"
    );

    expect(smallWidget).toContain(
      "getSmallWidgetMainText(for: activity, data: data, now: entry.date)"
    );
    expect(smallWidget).toContain(
      "getSmallWidgetSubtext(for: activity, data: data, now: entry.date)"
    );
    expect(mainText).toContain("getAwakeTimeText(data: data, now: now)");
    expect(subtext).toContain("getWakeWindowCountdown(data: data, now: now)");
    expect(wakeWindow).not.toContain("Date()");
  });

  it("does not repeat the sleep end age below the small sleep widget", () => {
    const smallWidget = between(
      widgetSource,
      "struct SmallWidgetView",
      "// Maps a raw data token"
    );

    expect(smallWidget).toContain("activity != .sleep");
  });

  it("gives the small sleep widget a larger awake status and app-backed prediction capsule", () => {
    const smallWidget = between(
      widgetSource,
      "struct SmallWidgetView",
      "// Maps a raw data token"
    );

    expect(smallWidget).toContain("size: activity == .sleep ? 15 : 13");
    expect(smallWidget).toContain(
      "getSmallWidgetSleepPrediction(data: data, now: entry.date)"
    );
    expect(smallWidget).toContain("Capsule()");
  });

  it("keeps the sleep prediction off the medium and large widgets", () => {
    const mediumWidget = between(
      widgetSource,
      "struct MediumWidgetView",
      "struct ColorfulCircleButton"
    );
    const largeWidget = between(
      widgetSource,
      "struct LargeWidgetView",
      "struct ActivityRowView"
    );

    expect(mediumWidget).not.toContain("getSmallWidgetSleepPrediction");
    expect(largeWidget).not.toContain("getSmallWidgetSleepPrediction");
  });

  it("keeps every medium circle timer at its established size", () => {
    const circleButton = between(
      widgetSource,
      "struct ColorfulCircleButton",
      "// MARK: - Large Widget View"
    );

    expect(
      circleButton.match(/size: 9, weight: \.semibold, design: \.monospaced/g)
    ).toHaveLength(2);
  });

  it("formats optional nap and bedtime predictions from app snapshot data", () => {
    const prediction = between(
      widgetSource,
      "func getSmallWidgetSleepPrediction",
      "func computeWakeWindowText"
    );

    expect(prediction).toContain("data.sleepPrediction");
    expect(prediction).toContain("canPresentSleepDerivedTiming");
    expect(prediction).toContain("widgetSleepPredictionDisplay(prediction, now: now)");
    expect(prediction).toContain("L.nighttime");
    expect(prediction).toContain("formatWidgetClockTime");
    expect(prediction).toContain("timeFormat: data.timeFormat");
    expect(prediction).toContain("L.nextNapAt");
    expect(prediction).toContain("L.bedtimeAt");
  });

  it("keeps a passed prediction on its clock time and marks it only by tint", () => {
    const prediction = between(
      widgetSource,
      "func getSmallWidgetSleepPrediction",
      "func computeWakeWindowText"
    );
    const smallWidget = between(
      widgetSource,
      "struct SmallWidgetView",
      "// Maps a raw data token"
    );

    expect(prediction).toContain("case let .overdue(predictedAt, isBedtime)");
    expect(prediction).toContain("isOverdue: true");
    expect(prediction).not.toContain("Ago");
    expect(smallWidget).toContain('prediction.isOverdue ? Color(hex: "B4632F")');
  });

  it("shrinks a running small-widget timer only once it would overflow", () => {
    const smallWidget = between(
      widgetSource,
      "struct SmallWidgetView",
      "// Maps a raw data token"
    );

    expect(smallWidget).toContain("size: 32, weight: .light, design: .rounded");
    expect(smallWidget).toContain(".minimumScaleFactor(0.75)");
  });
});
