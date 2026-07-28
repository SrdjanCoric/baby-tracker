import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  classifyGuestBabyMigration,
  runGuestAccountMigration,
} from "./guest-account-migration";
import { BabyStorageService, type StoredBabyProfile } from "./baby-storage";
import { syncLocalBabiesToDatabase } from "./baby-sync-service";
import {
  acknowledgeGuestActivityMigration,
  clearGuestActivitiesAfterMigration,
  syncGuestActivitiesToDatabase,
} from "./activity-sync-service";

vi.mock("expo-crypto", () => ({
  randomUUID: () => "77777777-7777-4777-8777-777777777777",
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("./baby-sync-service", () => ({
  syncLocalBabiesToDatabase: vi.fn(),
}));

vi.mock("./activity-sync-service", () => ({
  acknowledgeGuestActivityMigration: vi.fn(),
  clearGuestActivitiesAfterMigration: vi.fn(),
  syncGuestActivitiesToDatabase: vi.fn(),
}));

vi.mock("./baby-storage", () => ({
  BabyStorageService: {
    scopeForUser: vi.fn((userId: string, householdId: string) => ({
      babiesKey: `@babies:${userId}:${householdId}`,
      selectedBabyKey: `@selected_baby_id:${userId}:${householdId}`,
    })),
    setSelectedBabyId: vi.fn(),
  },
}));

const baby = (overrides: Partial<StoredBabyProfile>): StoredBabyProfile => ({
  id: "guest-baby",
  name: "Mila",
  birthDate: "2026-06-12T00:00:00.000Z",
  gender: "female",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  ...overrides,
});

describe("guest account migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("requires a choice when account and guest babies differ", () => {
    const result = classifyGuestBabyMigration(
      [baby({})],
      [baby({ id: "account-baby", name: "Noah" })]
    );

    expect(result).toEqual({ kind: "conflict" });
  });

  it("requires a choice when the account contains an unmatched extra baby", () => {
    const result = classifyGuestBabyMigration(
      [baby({})],
      [baby({ id: "account-baby-1" }), baby({ id: "account-baby-2", name: "Noah" })]
    );

    expect(result).toEqual({ kind: "conflict" });
  });

  it("requires a choice when more than one account baby matches", () => {
    const result = classifyGuestBabyMigration(
      [baby({})],
      [baby({ id: "account-baby-1" }), baby({ id: "account-baby-2" })]
    );

    expect(result).toEqual({ kind: "conflict" });
  });

  it("keeps deterministic IDs when a new account has no babies", () => {
    const result = classifyGuestBabyMigration([baby({})], []);

    expect(result).toEqual({
      kind: "ready",
      idMap: new Map([["guest-baby", "guest-baby"]]),
    });
  });

  it("keeps the guest snapshot until baby, activity, and selection migration succeeds", async () => {
    const storage = new Map<string, string>([
      ["@babies", JSON.stringify([baby({})])],
      ["@selected_baby_id", "guest-baby"],
    ]);
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async key => {
      storage.delete(key);
    });
    vi.mocked(syncLocalBabiesToDatabase).mockResolvedValue({
      idMap: new Map([["guest-baby", "guest-baby"]]),
    });
    vi.mocked(syncGuestActivitiesToDatabase).mockResolvedValue(undefined);
    vi.mocked(acknowledgeGuestActivityMigration).mockResolvedValue(undefined);
    vi.mocked(clearGuestActivitiesAfterMigration).mockResolvedValue(undefined);
    vi.mocked(BabyStorageService.setSelectedBabyId).mockResolvedValue(undefined);

    await expect(runGuestAccountMigration({
      userId: "user-1",
      householdId: "household-1",
      accountBabies: [],
    })).resolves.toEqual({ status: "completed" });

    expect(syncGuestActivitiesToDatabase).toHaveBeenCalledWith(
      "user-1",
      new Map([["guest-baby", "77777777-7777-4777-8777-777777777777"]])
    );
    expect(BabyStorageService.setSelectedBabyId).toHaveBeenCalledWith(
      "77777777-7777-4777-8777-777777777777",
      BabyStorageService.scopeForUser("user-1", "household-1")
    );
    expect(acknowledgeGuestActivityMigration).toHaveBeenCalledTimes(1);
    expect(clearGuestActivitiesAfterMigration).toHaveBeenCalledWith(["guest-baby"]);
    expect(storage.has("@babies")).toBe(false);
    expect(storage.has("@selected_baby_id")).toBe(false);
  });

  it("retains guest data until queued activities receive server acknowledgement", async () => {
    const storage = new Map<string, string>([
      ["@babies", JSON.stringify([baby({})])],
      ["@selected_baby_id", "guest-baby"],
    ]);
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async key => {
      storage.delete(key);
    });
    vi.mocked(syncLocalBabiesToDatabase).mockResolvedValue({
      idMap: new Map([["guest-baby", "77777777-7777-4777-8777-777777777777"]]),
    });
    vi.mocked(syncGuestActivitiesToDatabase).mockResolvedValue(undefined);
    vi.mocked(acknowledgeGuestActivityMigration).mockRejectedValue(new Error("offline"));

    await expect(runGuestAccountMigration({
      userId: "user-1",
      householdId: "household-1",
      accountBabies: [],
    })).rejects.toThrow("offline");

    expect(clearGuestActivitiesAfterMigration).not.toHaveBeenCalled();
    expect(storage.has("@babies")).toBe(true);
    expect(storage.has("@selected_baby_id")).toBe(true);
  });

  it("retains its durable record and guest snapshot after an interrupted activity migration", async () => {
    const storage = new Map<string, string>([
      ["@babies", JSON.stringify([baby({})])],
      ["@selected_baby_id", "guest-baby"],
    ]);
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async key => {
      storage.delete(key);
    });
    vi.mocked(syncLocalBabiesToDatabase).mockResolvedValue({
      idMap: new Map([["guest-baby", "guest-baby"]]),
    });
    vi.mocked(syncGuestActivitiesToDatabase).mockRejectedValue(new Error("offline"));

    await expect(runGuestAccountMigration({
      userId: "user-1",
      householdId: "household-1",
      accountBabies: [],
    })).rejects.toThrow("offline");

    expect(storage.has("@babies")).toBe(true);
    expect(JSON.parse(storage.get("@guest_account_migration_v1") ?? "null")).toMatchObject({
      status: "prepared",
      idMap: { "guest-baby": "77777777-7777-4777-8777-777777777777" },
    });
  });

  it("maps one normalized exact match to the existing account baby", () => {
    const result = classifyGuestBabyMigration(
      [baby({ name: "  MILA " })],
      [baby({ id: "account-baby", name: "Mila" })]
    );

    expect(result).toEqual({
      kind: "ready",
      idMap: new Map([["guest-baby", "account-baby"]]),
    });
  });
});
