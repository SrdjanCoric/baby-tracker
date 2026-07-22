import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../targets/watch/index.swift", import.meta.url),
  "utf8"
);

function functionSource(name: string, nextName: string): string {
  const start = source.indexOf(`func ${name}`);
  const end = source.indexOf(`func ${nextName}`, start + 1);
  return source.slice(start, end);
}

describe("Watch external timer commands", () => {
  it("durably transfers a typed stop before releasing the server timer", () => {
    const stopSource = functionSource("stopTimer", "stopPumpingWithVolume");
    const commandId = stopSource.indexOf('"id": UUID().uuidString');
    const timerIdentity = stopSource.indexOf('"timerInstanceId": timerInstanceId');
    const transfer = stopSource.indexOf("sendAction(message)");
    const remoteMutation = stopSource.indexOf("supabaseStopTimer(activityType: activityType)");

    expect(commandId).toBeGreaterThanOrEqual(0);
    expect(timerIdentity).toBeGreaterThan(commandId);
    expect(transfer).toBeGreaterThan(timerIdentity);
    expect(remoteMutation).toBeGreaterThan(transfer);
  });

  it("uses one identity from Watch start through later stop delivery", () => {
    const startSource = functionSource("startTimer", "stopTimer");

    expect(startSource).toContain("let timerInstanceId = UUID().uuidString");
    expect(startSource).toContain('"timerInstanceId": timerInstanceId');
    expect(startSource).toContain("timerInstanceId: timerInstanceId");
    expect(startSource).toContain("activityId: activityId");
  });

  it("queues transferUserInfo before attempting immediate delivery", () => {
    const sendSource = functionSource("sendAction", "startTimer");

    expect(sendSource.indexOf("session.transferUserInfo(messageWithId)"))
      .toBeLessThan(sendSource.indexOf("session.sendMessage(messageWithId"));
  });
});
