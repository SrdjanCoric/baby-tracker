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
});
