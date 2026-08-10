import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  asyncStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  extensionStorage: {
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    reloadWidget: vi.fn(),
  },
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: mocks.asyncStorage }));
vi.mock("@/services/extension-storage", () => ({
  loadExtensionStorage: vi.fn().mockResolvedValue(mocks.extensionStorage),
}));
vi.mock("./watch-service", () => ({ syncToWatch: vi.fn() }));

import {
  clearWidgetData,
  createEmptyWidgetData,
  getWidgetData,
  updateWidgetData,
  updateSleepWidgetData,
  writeAuthToAppGroup,
} from "./widget-data-service";

describe("sleep extension data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extensionStorage.get.mockResolvedValue(null);
  });

  it("carries a pending morning confirmation without blocking active sleep transport", () => {
    const empty = createEmptyWidgetData("baby-1", "Sofi");
    const activities = updateSleepWidgetData(
      empty.activities,
      "2026-07-25T08:30:00.000Z",
      60,
      840,
      null,
      true,
      "night",
      120,
      "nap1",
      "2026-07-25T07:00:00.000Z",
      0,
      true
    );

    expect(activities.sleep).toEqual(expect.objectContaining({
      isActive: true,
      sleepType: "night",
      morningConfirmationPending: true,
    }));
  });

  it("rejects malformed cached widget data through the shared snapshot decoder", async () => {
    mocks.asyncStorage.getItem.mockResolvedValue(JSON.stringify({ babyId: "baby-1" }));

    await expect(getWidgetData()).resolves.toBeNull();
  });

  it("reads a real legacy cache through the public widget data API", async () => {
    const raw = readFileSync(
      resolve(process.cwd(), "fixtures/widget-activity-snapshots/legacy.json"),
      "utf8"
    );
    const legacy = JSON.parse(raw);
    mocks.asyncStorage.getItem.mockResolvedValue(raw);

    await expect(getWidgetData()).resolves.toEqual({
      ...legacy,
      activeTimers: [legacy.activeTimer],
    });
  });

  it("publishes the selected timezone with the native widget identity", async () => {
    await writeAuthToAppGroup({
      supabaseUrl: "http://localhost:54321",
      supabaseAnonKey: "anon",
      accessToken: "access-token",
      userId: "user-1",
      selectedBabyId: "baby-1",
      timezone: "Europe/Belgrade",
      newbornNapOptIn: true,
    });

    expect(mocks.extensionStorage.set).toHaveBeenCalledWith(
      "widgetTimezone",
      "Europe/Belgrade",
      "group.com.sofibaby.app"
    );
    expect(mocks.extensionStorage.set).toHaveBeenCalledWith(
      "widgetNewbornNapOptIn.baby-1",
      "true",
      "group.com.sofibaby.app"
    );
  });

  it("publishes app snapshots to the preferred per-baby cache", async () => {
    const data = createEmptyWidgetData("baby-1", "Sofi");
    const json = JSON.stringify(data);
    mocks.extensionStorage.get.mockResolvedValue(JSON.stringify(["baby-2"]));

    await updateWidgetData(data);

    expect(mocks.extensionStorage.set).toHaveBeenCalledWith(
      "widgetData",
      json,
      "group.com.sofibaby.app"
    );
    expect(mocks.extensionStorage.set).toHaveBeenCalledWith(
      "widgetSnapshot.baby-1",
      json,
      "group.com.sofibaby.app"
    );
    expect(mocks.extensionStorage.set).toHaveBeenCalledWith(
      "widgetSnapshotBabyIds",
      JSON.stringify(["baby-1", "baby-2"]),
      "group.com.sofibaby.app"
    );
    expect(mocks.extensionStorage.reloadWidget).toHaveBeenCalledOnce();
  });

  it("preserves the app-written cache while removing authenticated widget state on sign-out", async () => {
    mocks.extensionStorage.get.mockImplementation(async (key: string) => {
      if (key === "selectedBabyId") return "baby-1";
      if (key === "widgetSnapshotBabyIds") return JSON.stringify(["baby-1", "baby-2"]);
      return null;
    });

    await clearWidgetData();

    expect(mocks.extensionStorage.remove).not.toHaveBeenCalledWith(
      "widgetData",
      "group.com.sofibaby.app"
    );
    for (const key of [
      "widgetSnapshot.baby-1",
      "widgetNewbornNapOptIn.baby-1",
      "widgetSnapshot.baby-2",
      "widgetNewbornNapOptIn.baby-2",
      "widgetSnapshotBabyIds",
      "supabaseAccessToken",
      "userId",
      "selectedBabyId",
      "widgetTimezone",
    ]) {
      expect(mocks.extensionStorage.remove).toHaveBeenCalledWith(
        key,
        "group.com.sofibaby.app"
      );
    }
  });

  it("purges the app-written widgetData cache on account deletion request", async () => {
    mocks.extensionStorage.get.mockResolvedValue(null);

    await clearWidgetData({ preserveLocalCache: false });

    expect(mocks.extensionStorage.remove).toHaveBeenCalledWith(
      "widgetData",
      "group.com.sofibaby.app"
    );
    for (const key of [
      "supabaseAccessToken",
      "userId",
      "selectedBabyId",
      "widgetTimezone",
    ]) {
      expect(mocks.extensionStorage.remove).toHaveBeenCalledWith(
        key,
        "group.com.sofibaby.app"
      );
    }
  });
});
