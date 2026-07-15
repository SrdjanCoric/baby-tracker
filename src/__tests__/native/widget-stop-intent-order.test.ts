import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("StopActivityIntent", () => {
  it("persists the baby-targeted stop before releasing the server lock", () => {
    const source = readFileSync(
      new URL("../../../targets/widget/index.swift", import.meta.url),
      "utf8"
    );
    const intentStart = source.indexOf("struct StopActivityIntent");
    const nextDeclaration = source.indexOf("\nstruct ", intentStart + 1);
    const intentSource = source.slice(
      intentStart,
      nextDeclaration === -1 ? source.length : nextDeclaration
    );

    const targetBaby = intentSource.indexOf('stop["babyId"] = babyId');
    const persistStop = intentSource.indexOf(
      'userDefaults.set(jsonString, forKey: "pendingWidgetStop")'
    );
    const activeTimersUrl = intentSource.indexOf(
      "/rest/v1/active_timers?baby_id=eq."
    );
    const releaseScopeEnd = intentSource.indexOf(
      'userDefaults.removeObject(forKey: "pendingWidgetPauseToggle")'
    );
    const releaseScope = intentSource.slice(activeTimersUrl, releaseScopeEnd);
    const activityPredicate = releaseScope.indexOf("&activity_type=eq.");
    const userPredicate = releaseScope.indexOf("&started_by=eq.");
    const requestCreation = releaseScope.indexOf("URLRequest(url: url)");
    const deleteRequest = releaseScope.indexOf('request.httpMethod = "DELETE"');
    const releaseLock = releaseScope.indexOf(
      "await URLSession.shared.data(for: request)"
    );

    expect(intentStart).toBeGreaterThanOrEqual(0);
    expect(targetBaby).toBeGreaterThanOrEqual(0);
    expect(persistStop).toBeGreaterThan(targetBaby);
    expect(activeTimersUrl).toBeGreaterThan(persistStop);
    expect(releaseScopeEnd).toBeGreaterThan(activeTimersUrl);
    expect(activityPredicate).toBeGreaterThanOrEqual(0);
    expect(userPredicate).toBeGreaterThan(activityPredicate);
    expect(requestCreation).toBeGreaterThan(userPredicate);
    expect(deleteRequest).toBeGreaterThan(requestCreation);
    expect(releaseLock).toBeGreaterThan(deleteRequest);
  });
});
