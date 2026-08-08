import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const watchSource = fs.readFileSync(path.join(root, "targets/watch/index.swift"), "utf8");
const coordinatorSource = fs.readFileSync(
  path.join(root, "targets/watch/WatchActivitySummary.swift"),
  "utf8"
);
const swiftRunner = fs.readFileSync(path.join(root, "scripts/run-widget-swift-tests.mjs"), "utf8");

describe("Watch complete-summary wiring", () => {
  it("keeps the active-timer request as a probe and never commits its rows directly", () => {
    expect(watchSource).toContain("/rest/v1/active_timers?baby_id=eq.");
    expect(watchSource).toContain("acceptTimerProbe(fingerprint)");
    expect(watchSource).not.toContain("reconcileWithNetworkTimers");
    expect(watchSource).not.toContain("updatedBaby.activeTimers = remoteTimers");
  });

  it("polls every 30 seconds only while Watch believes a timer is active", () => {
    expect(watchSource).toContain("guard hasActiveTimers else");
    expect(watchSource).toContain("let interval: TimeInterval = 30");
    expect(watchSource).not.toContain("hasActiveTimers ? 30 : 120");
  });

  it("uses the selected-baby summary RPC and isolated account/baby cache", () => {
    expect(watchSource).toContain("/rest/v1/rpc/get_baby_activity_snapshot");
    expect(watchSource).toContain('"p_baby_id": identity.babyId');
    expect(watchSource).toContain('"watchSummary.\\(identity.cacheKey)"');
    expect(coordinatorSource).toContain("identityReader.currentIdentity() == identity");
  });

  it("keeps optimistic state outside authoritative watchData and tests the shared fixture contract", () => {
    const optimisticBody = watchSource.slice(
      watchSource.indexOf("func syncOptimisticStateToCache()"),
      watchSource.indexOf("private func canPerformAction()")
    );
    expect(optimisticBody).toContain("watchOptimisticState.");
    expect(optimisticBody).not.toContain('forKey: "watchData"');
    expect(optimisticBody).not.toContain('forKey: "widgetData"');
    expect(swiftRunner).toContain("targets/watch/WatchActivitySummary.swift");
    expect(swiftRunner).toContain("fixtures/widget-activity-snapshots");
  });
});
