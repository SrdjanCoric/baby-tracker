/**
 * Tests for BabyStorageService
 * TDD: Write tests first, then implement the service
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BabyStorageService,
  StoredBabyProfile,
} from "./baby-storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setStorageUserId } from "./storage-prefix";

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

// Mock expo-crypto
let uuidCounter = 0;
vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => `test-uuid-${++uuidCounter}`),
}));

describe("BabyStorageService", () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    uuidCounter = 0;
    setStorageUserId(null);
    vi.clearAllMocks();
  });

  describe("getAllBabies", () => {
    it("should return empty array when no babies stored", async () => {
      const babies = await BabyStorageService.getAllBabies();
      expect(babies).toEqual([]);
    });

    it("should return stored babies", async () => {
      const baby: StoredBabyProfile = {
        id: "baby-1",
        name: "Emma",
        birthDate: "2024-06-15T00:00:00.000Z",
        gender: "female",
        createdAt: "2024-06-15T10:00:00.000Z",
        updatedAt: "2024-06-15T10:00:00.000Z",
      };
      mockStorage["@babies"] = JSON.stringify([baby]);

      const babies = await BabyStorageService.getAllBabies();
      expect(babies).toHaveLength(1);
      expect(babies[0].name).toBe("Emma");
      expect(babies[0].id).toBe("baby-1");
    });
  });

  describe("getBabyById", () => {
    it("should return null when baby not found", async () => {
      const baby = await BabyStorageService.getBabyById("nonexistent");
      expect(baby).toBeNull();
    });

    it("should return baby when found", async () => {
      const baby: StoredBabyProfile = {
        id: "baby-1",
        name: "Emma",
        createdAt: "2024-06-15T10:00:00.000Z",
        updatedAt: "2024-06-15T10:00:00.000Z",
      };
      mockStorage["@babies"] = JSON.stringify([baby]);

      const result = await BabyStorageService.getBabyById("baby-1");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Emma");
    });
  });

  describe("addBaby", () => {
    it("should add a new baby with generated id", async () => {
      const newBaby = await BabyStorageService.addBaby({
        name: "Oliver",
        gender: "male",
      });

      expect(newBaby.id).toBeDefined();
      expect(newBaby.name).toBe("Oliver");
      expect(newBaby.gender).toBe("male");
      expect(newBaby.createdAt).toBeDefined();
      expect(newBaby.updatedAt).toBeDefined();

      // Verify it's stored
      const babies = await BabyStorageService.getAllBabies();
      expect(babies).toHaveLength(1);
      expect(babies[0].name).toBe("Oliver");
    });

    it("should add baby with birth date", async () => {
      const birthDate = new Date("2024-06-15");
      const newBaby = await BabyStorageService.addBaby({
        name: "Emma",
        birthDate,
      });

      expect(newBaby.birthDate).toBe(birthDate.toISOString());
    });

    it("should add multiple babies", async () => {
      await BabyStorageService.addBaby({ name: "Emma" });
      await BabyStorageService.addBaby({ name: "Oliver" });

      const babies = await BabyStorageService.getAllBabies();
      expect(babies).toHaveLength(2);
    });
  });

  describe("updateBaby", () => {
    it("should update existing baby", async () => {
      vi.useFakeTimers();
      const initialTime = new Date("2024-01-01T10:00:00.000Z");
      vi.setSystemTime(initialTime);

      const baby = await BabyStorageService.addBaby({ name: "Emma" });

      // Advance time to ensure updatedAt changes
      vi.setSystemTime(new Date("2024-01-01T10:00:01.000Z"));

      const updated = await BabyStorageService.updateBaby(baby.id, {
        name: "Emma Grace",
      });

      vi.useRealTimers();

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe("Emma Grace");
      expect(updated?.updatedAt).not.toBe(baby.updatedAt);
    });

    it("should return null when baby not found", async () => {
      const result = await BabyStorageService.updateBaby("nonexistent", {
        name: "Test",
      });
      expect(result).toBeNull();
    });

    it("should preserve unmodified fields", async () => {
      const baby = await BabyStorageService.addBaby({
        name: "Emma",
        gender: "female",
      });

      const updated = await BabyStorageService.updateBaby(baby.id, {
        name: "Emma Grace",
      });

      expect(updated?.gender).toBe("female");
    });
  });

  describe("deleteBaby", () => {
    it("should delete existing baby", async () => {
      const baby = await BabyStorageService.addBaby({ name: "Emma" });

      const result = await BabyStorageService.deleteBaby(baby.id);
      expect(result).toBe(true);

      const babies = await BabyStorageService.getAllBabies();
      expect(babies).toHaveLength(0);
    });

    it("should return false when baby not found", async () => {
      const result = await BabyStorageService.deleteBaby("nonexistent");
      expect(result).toBe(false);
    });

    it("should clear selected baby when deleting selected baby", async () => {
      const baby = await BabyStorageService.addBaby({ name: "Emma" });
      await BabyStorageService.setSelectedBabyId(baby.id);

      await BabyStorageService.deleteBaby(baby.id);

      const selectedId = await BabyStorageService.getSelectedBabyId();
      expect(selectedId).toBeNull();
    });
  });

  describe("selected baby", () => {
    it("should return null when no baby selected", async () => {
      const selectedId = await BabyStorageService.getSelectedBabyId();
      expect(selectedId).toBeNull();
    });

    it("should set and get selected baby id", async () => {
      const baby = await BabyStorageService.addBaby({ name: "Emma" });
      await BabyStorageService.setSelectedBabyId(baby.id);

      const selectedId = await BabyStorageService.getSelectedBabyId();
      expect(selectedId).toBe(baby.id);
    });

    it("should clear selected baby", async () => {
      const baby = await BabyStorageService.addBaby({ name: "Emma" });
      await BabyStorageService.setSelectedBabyId(baby.id);
      await BabyStorageService.setSelectedBabyId(null);

      const selectedId = await BabyStorageService.getSelectedBabyId();
      expect(selectedId).toBeNull();
    });

    it("should get selected baby object", async () => {
      const baby = await BabyStorageService.addBaby({ name: "Emma" });
      await BabyStorageService.setSelectedBabyId(baby.id);

      const selectedBaby = await BabyStorageService.getSelectedBaby();
      expect(selectedBaby).not.toBeNull();
      expect(selectedBaby?.name).toBe("Emma");
    });

    it("should return null when selected baby id is invalid", async () => {
      await BabyStorageService.setSelectedBabyId("invalid-id");

      const selectedBaby = await BabyStorageService.getSelectedBaby();
      expect(selectedBaby).toBeNull();
    });
  });

  it("keeps a queued mutation bound to the user scope that submitted it", async () => {
    const babyA: StoredBabyProfile = {
      id: "baby-a",
      name: "Baby A",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const babyB: StoredBabyProfile = {
      id: "baby-b",
      name: "Baby B",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    };
    mockStorage["@babies:user-a"] = JSON.stringify([babyA]);
    setStorageUserId("user-a");

    let resolveRead: ((value: string | null) => void) | undefined;
    let markReadStarted: (() => void) | undefined;
    const readStarted = new Promise<void>(resolve => {
      markReadStarted = resolve;
    });
    vi.mocked(AsyncStorage.getItem).mockImplementationOnce((_key: string) => {
      markReadStarted?.();
      return new Promise(resolve => {
        resolveRead = resolve;
      });
    });

    const mutation = BabyStorageService.upsertBaby(babyB);
    await readStarted;
    setStorageUserId("user-b");
    resolveRead?.(JSON.stringify([babyA]));
    await mutation;

    expect(JSON.parse(mockStorage["@babies:user-a"])).toEqual([babyA, babyB]);
    expect(mockStorage["@babies:user-b"]).toBeUndefined();
  });
});
