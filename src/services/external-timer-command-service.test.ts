import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("@/services/extension-storage", () => ({
  loadExtensionStorage: vi.fn(async () => ({
    get: async (key: string) => storage.get(key) ?? null,
    set: async (key: string, value: string) => {
      storage.set(key, value);
    },
    reloadWidget: async () => undefined,
  })),
}));

import {
  acknowledgeExternalTimerCommand,
  appendExternalTimerCommand,
  claimLegacyExternalTimerCommand,
  createRoutedExternalTimerCommand,
  readExternalTimerCommands,
  type ExternalTimerCommand,
} from "./external-timer-command-service";

const feedingStop: ExternalTimerCommand = {
  id: "command-feeding",
  action: "stop",
  activityType: "feeding",
  babyId: "baby-1",
  timerInstanceId: "timer-feeding",
  eventAt: "2026-07-20T08:15:00.000Z",
  source: "widget",
};

const sleepStop: ExternalTimerCommand = {
  id: "command-sleep",
  action: "stop",
  activityType: "sleep",
  babyId: "baby-2",
  timerInstanceId: "timer-sleep",
  eventAt: "2026-07-20T09:15:00.000Z",
  source: "watch",
};

describe("external timer command queue", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("creates a targeted command from a routed widget stop", () => {
    expect(
      createRoutedExternalTimerCommand(
        "sofibaby://tummyTime?action=stop&babyId=baby-1&timerInstanceId=timer-1&commandId=command-1",
        "2026-07-20T08:15:00.000Z"
      )
    ).toEqual({
      id: "command-1",
      action: "stop",
      activityType: "tummy_time",
      babyId: "baby-1",
      timerInstanceId: "timer-1",
      eventAt: "2026-07-20T08:15:00.000Z",
      source: "routed",
    });
  });

  it("retains two commands and acknowledges only the handled command", async () => {
    await appendExternalTimerCommand(feedingStop);
    await appendExternalTimerCommand(sleepStop);

    await expect(readExternalTimerCommands()).resolves.toEqual([
      feedingStop,
      sleepStop,
    ]);

    await acknowledgeExternalTimerCommand(feedingStop);

    await expect(readExternalTimerCommands()).resolves.toEqual([sleepStop]);
  });

  it("migrates one valid legacy stop once", async () => {
    storage.set("selectedBabyId", "baby-legacy");
    storage.set(
      "pendingWidgetStop",
      JSON.stringify({
        activityType: "tummy_time",
        stoppedAt: "2026-07-20T10:15:00.000Z",
      })
    );

    const firstRead = await readExternalTimerCommands();
    const secondRead = await readExternalTimerCommands();

    expect(firstRead).toEqual([
      expect.objectContaining({
        action: "stop",
        activityType: "tummy_time",
        babyId: "baby-legacy",
        eventAt: "2026-07-20T10:15:00.000Z",
        source: "legacy",
        legacy: true,
      }),
    ]);
    expect(firstRead[0].timerInstanceId).toMatch(/^legacy:/);
    expect(secondRead).toEqual(firstRead);
    expect(storage.get("pendingWidgetStop")).toBe("");
  });

  it("uses the active baby when a legacy stop predates baby targeting", async () => {
    storage.set(
      "pendingWidgetStop",
      JSON.stringify({
        activityType: "sleep",
        stoppedAt: "2026-07-20T10:15:00.000Z",
      })
    );

    const commands = await readExternalTimerCommands("fallback-baby");

    expect(commands).toEqual([
      expect.objectContaining({ babyId: "fallback-baby", source: "legacy" }),
    ]);
  });

  it("deduplicates repeated delivery by command id", async () => {
    await appendExternalTimerCommand(feedingStop);
    await appendExternalTimerCommand(feedingStop);

    await expect(readExternalTimerCommands()).resolves.toEqual([feedingStop]);
  });

  it("discards malformed legacy data without disturbing queued commands", async () => {
    await appendExternalTimerCommand(feedingStop);
    storage.set("pendingWidgetStop", "not-json");

    await expect(readExternalTimerCommands()).resolves.toEqual([feedingStop]);
    expect(storage.get("pendingWidgetStop")).toBe("");
  });

  it("persists the resolved timer identity before acknowledging a legacy command", async () => {
    storage.set("selectedBabyId", "baby-legacy");
    storage.set(
      "pendingWidgetStop",
      JSON.stringify({
        activityType: "feeding",
        stoppedAt: "2026-07-20T10:15:00.000Z",
      })
    );
    const [legacyCommand] = await readExternalTimerCommands();

    const claimed = await claimLegacyExternalTimerCommand(
      legacyCommand,
      "timer-real"
    );

    expect(claimed.timerInstanceId).toBe("timer-real");
    await expect(readExternalTimerCommands()).resolves.toEqual([claimed]);
  });
});
