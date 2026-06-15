import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DashboardConfigStorageService } from "./dashboard-config-storage";
import { setStorageUserId } from "./storage-prefix";

const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  },
}));

describe("DashboardConfigStorageService", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    setStorageUserId(null);
  });

  it("returns the default config with all eight cards visible for a fresh account", async () => {
    setStorageUserId("user-a");

    const config = await DashboardConfigStorageService.getConfig();

    expect(config.cards).toHaveLength(8);
    expect(config.cards.every((card) => card.visible)).toBe(true);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith("@dashboard_config:user-a");
  });

  it("persists visibility changes across reads", async () => {
    setStorageUserId("user-a");

    await DashboardConfigStorageService.updateCardVisibility("feeding", false);
    const config = await DashboardConfigStorageService.getConfig();

    const feeding = config.cards.find((card) => card.activity === "feeding");
    const others = config.cards.filter((card) => card.activity !== "feeding");
    expect(feeding?.visible).toBe(false);
    expect(others.every((card) => card.visible)).toBe(true);
  });

  it("keeps configs independent between two accounts on the same device", async () => {
    setStorageUserId("user-a");
    await DashboardConfigStorageService.updateCardVisibility("feeding", false);

    setStorageUserId("user-b");
    const configB = await DashboardConfigStorageService.getConfig();

    expect(configB.cards.every((card) => card.visible)).toBe(true);

    setStorageUserId("user-a");
    const configA = await DashboardConfigStorageService.getConfig();
    expect(configA.cards.find((card) => card.activity === "feeding")?.visible).toBe(false);
  });

  it("resets to the default config with all cards visible", async () => {
    setStorageUserId("user-a");
    await DashboardConfigStorageService.updateCardVisibility("feeding", false);
    await DashboardConfigStorageService.updateCardVisibility("growth", false);

    await DashboardConfigStorageService.resetToDefault();
    const config = await DashboardConfigStorageService.getConfig();

    expect(config.cards).toHaveLength(8);
    expect(config.cards.every((card) => card.visible)).toBe(true);
  });
});
