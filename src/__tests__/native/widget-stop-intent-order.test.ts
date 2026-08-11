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

    const targetBaby = intentSource.indexOf("babyId: babyId");
    const persistStop = intentSource.indexOf(
      "appendExternalTimerCommand(command, to: userDefaults)"
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
    const releaseLock = releaseScope.indexOf("return request");

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

  it("uses the shared versioned queue schema and appends without replacing commands", () => {
    const source = readFileSync(
      new URL("../../../targets/widget/index.swift", import.meta.url),
      "utf8"
    );

    expect(source).toContain("struct ExternalTimerCommandQueue: Codable");
    expect(source).toContain("var version: Int = 1");
    expect(source).toContain('let externalTimerCommandQueueKey = "externalTimerCommandQueue"');
    expect(source).toContain("queue.commands.append(command)");
    expect(source).toContain("queue.commands.removeAll { $0.id == id }");
    expect(source).toContain("timerInstanceId: resolvedTimerInstanceId");
  });

  it("applies a matching pending pause before queuing and clearing a widget stop", () => {
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

    const readPendingPause = intentSource.indexOf(
      'string(forKey: "pendingWidgetPauseToggle")'
    );
    const matchPauseAction = intentSource.indexOf(
      'pendingPause["action"] as? String == "pause"'
    );
    const matchActivity = intentSource.indexOf(
      'pendingPause["activityType"] as? String == dbType'
    );
    const rejectFuturePause = intentSource.indexOf(
      "parsedPauseAt <= stopRequestedAt"
    );
    const applyPause = intentSource.indexOf(
      "effectiveStopDate = parsedPauseAt"
    );
    const persistStop = intentSource.indexOf(
      "appendExternalTimerCommand(command, to: userDefaults)"
    );
    const clearPendingPause = intentSource.indexOf(
      'removeObject(forKey: "pendingWidgetPauseToggle")'
    );

    expect(readPendingPause).toBeGreaterThanOrEqual(0);
    expect(matchPauseAction).toBeGreaterThan(readPendingPause);
    expect(matchActivity).toBeGreaterThan(matchPauseAction);
    expect(rejectFuturePause).toBeGreaterThan(matchActivity);
    expect(applyPause).toBeGreaterThan(rejectFuturePause);
    expect(persistStop).toBeGreaterThan(applyPause);
    expect(clearPendingPause).toBeGreaterThan(persistStop);
  });
});
