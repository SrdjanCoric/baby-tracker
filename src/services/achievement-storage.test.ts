import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchAchievementsFromDatabase,
  insertAchievementInDatabase,
} from "./activity-sync-service";
import { getDetectedAchievementIds, saveAchievement } from "./achievement-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("./activity-sync-service", () => ({
  fetchAchievementsFromDatabase: vi.fn(),
  insertAchievementInDatabase: vi.fn(),
}));

vi.mock("./storage-prefix", () => ({
  getUserScopedKey: (key: string) => key,
}));

describe("achievement storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([
      { id: "sleep_6h", detectedAt: "2026-01-01T00:00:00.000Z" },
    ]));
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    vi.mocked(insertAchievementInDatabase).mockResolvedValue(undefined);
  });

  it("uses local achievements without a database request for a guest", async () => {
    await expect(getDetectedAchievementIds("baby-1", false)).resolves.toEqual(new Set(["sleep_6h"]));
    expect(fetchAchievementsFromDatabase).not.toHaveBeenCalled();
  });

  it("does not attempt to sync a guest achievement", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([]));

    await saveAchievement("baby-1", "first_solid");

    expect(AsyncStorage.setItem).toHaveBeenCalled();
    expect(insertAchievementInDatabase).not.toHaveBeenCalled();
  });

  it("stores a celebration and its unearned lower tiers in one write and syncs each new id", async () => {
    await saveAchievement("baby-1", "sleep_10h", "user-1", ["sleep_6h", "sleep_8h"]);

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(vi.mocked(AsyncStorage.setItem).mock.calls[0][1]);
    expect(saved.map((entry: { id: string }) => entry.id)).toEqual(["sleep_6h", "sleep_10h", "sleep_8h"]);
    expect(saved[0].detectedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(saved[1].detectedAt).toBe(saved[2].detectedAt);
    expect(insertAchievementInDatabase).toHaveBeenCalledTimes(2);
    expect(insertAchievementInDatabase).toHaveBeenCalledWith("baby-1", "sleep_10h", "user-1");
    expect(insertAchievementInDatabase).toHaveBeenCalledWith("baby-1", "sleep_8h", "user-1");
  });

  it("does not rewrite or sync tiers that are already stored", async () => {
    await saveAchievement("baby-1", "sleep_6h", "user-1", []);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(insertAchievementInDatabase).not.toHaveBeenCalled();
  });

});
