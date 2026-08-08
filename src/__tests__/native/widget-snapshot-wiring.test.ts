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

    expect(stop).toContain("await refreshWidgetSnapshot()");
    expect(pause).toContain("await refreshWidgetSnapshot()");
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
});
