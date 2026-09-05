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
  it("offers pumping side switching only for own running timers", () => {
    const card = source.slice(source.indexOf("struct PumpingActiveCard:"));
    const switchButton = card.slice(0, card.indexOf("connector.switchSide("));
    expect(switchButton).toContain("if let context = timer.context, !isPaused, timer.isRemote != true {");
  });

  it.each([
    ["pauseTimer", "resumeTimer"],
    ["resumeTimer", "switchSide"],
  ])("does not pin remote optimism after %s", (name, nextName) => {
    const body = functionSource(name, nextName);
    const send = body.indexOf("sendAction(message)");
    const ownOnly = body.indexOf("guard timer.isRemote != true else");
    const pin = body.indexOf("self.localActiveTimers.append(serverTimer)");
    expect(send).toBeGreaterThanOrEqual(0);
    expect(ownOnly).toBeGreaterThan(send);
    expect(pin).toBeGreaterThan(ownOnly);
    expect(body.slice(ownOnly, pin)).toContain("return");
    expect(body).toContain('"timerInstanceId": timerInstanceId');
    expect(body).toContain('"eventAt": requestedAt');
  });

  it("durably transfers a typed stop before releasing the server timer", () => {
    const stopSource = functionSource("stopTimer", "stopPumpingWithVolume");
    const commandId = stopSource.indexOf("let stopCommand = WatchStopCommand");
    const timerIdentity = stopSource.indexOf("timerInstanceId: timerInstanceId");
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

  it("keeps remote stops durable and scopes offline deletion to the signed-in caregiver", () => {
    const stopSource = functionSource("stopTimer", "stopPumpingWithVolume");
    const pumpingSource = functionSource("stopPumpingWithVolume", "logDiaper");
    const fallbackSource = functionSource("supabaseStopTimer", "endLiveActivityViaEdgeFunction");

    expect(stopSource).toContain("timer.isRemote != true");
    expect(pumpingSource).toContain("timer.isRemote != true");
    expect(fallbackSource).toContain("let supabaseUserId");
    expect(fallbackSource).toContain("&started_by=eq.\\(supabaseUserId)");
  });
});
