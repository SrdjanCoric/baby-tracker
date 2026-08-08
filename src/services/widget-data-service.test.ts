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
    reloadWidget: vi.fn(),
  },
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: mocks.asyncStorage }));
vi.mock("@/services/extension-storage", () => ({
  loadExtensionStorage: vi.fn().mockResolvedValue(mocks.extensionStorage),
}));

import {
  clearWidgetData,
  createEmptyWidgetData,
  getWidgetData,
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

  it("publishes the selected timezone with the native widget identity", async () => {
    await writeAuthToAppGroup({
      supabaseUrl: "http://localhost:54321",
      supabaseAnonKey: "anon",
      accessToken: "access-token",
      userId: "user-1",
      selectedBabyId: "baby-1",
      timezone: "Europe/Belgrade",
    });

    expect(mocks.extensionStorage.set).toHaveBeenCalledWith(
      "widgetTimezone",
      "Europe/Belgrade",
      "group.com.sofibaby.app"
    );
  });

  it("removes the per-baby snapshot and native auth generation on sign-out", async () => {
    mocks.extensionStorage.get.mockImplementation(async (key: string) => {
      if (key === "selectedBabyId") return "baby-1";
      if (key === "widgetSnapshotBabyIds") return JSON.stringify(["baby-1", "baby-2"]);
      return null;
    });

    await clearWidgetData();

    for (const key of [
      "widgetData",
      "widgetSnapshot.baby-1",
      "widgetSnapshot.baby-2",
      "widgetSnapshotBabyIds",
      "supabaseAccessToken",
      "userId",
      "selectedBabyId",
      "widgetTimezone",
    ]) {
      expect(mocks.extensionStorage.set).toHaveBeenCalledWith(
        key,
        "",
        "group.com.sofibaby.app"
      );
    }
  });
});
