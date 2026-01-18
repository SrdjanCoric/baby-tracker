/**
 * DiaperStorageService tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DiaperStorageService, StoredDiaperEntry } from "./diaper-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("DiaperStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllDiapers", () => {
    it("should return empty array when no diapers exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await DiaperStorageService.getAllDiapers("baby-123");

      expect(result).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@diapers:baby-123");
    });

    it("should return stored diapers for a baby", async () => {
      const mockDiapers: StoredDiaperEntry[] = [
        {
          id: "diaper-1",
          babyId: "baby-123",
          type: "wet",
          changedAt: "2024-01-17T13:00:00.000Z",
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T13:00:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(mockDiapers));

      const result = await DiaperStorageService.getAllDiapers("baby-123");

      expect(result).toEqual(mockDiapers);
    });
  });

  describe("getDiaperById", () => {
    it("should return null when diaper not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await DiaperStorageService.getDiaperById("baby-123", "diaper-999");

      expect(result).toBeNull();
    });

    it("should return diaper when found", async () => {
      const mockDiaper: StoredDiaperEntry = {
        id: "diaper-1",
        babyId: "baby-123",
        type: "dirty",
        stoolColor: "brown",
        changedAt: "2024-01-17T13:00:00.000Z",
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([mockDiaper]));

      const result = await DiaperStorageService.getDiaperById("baby-123", "diaper-1");

      expect(result).toEqual(mockDiaper);
    });
  });

  describe("addDiaper", () => {
    it("should add a new wet diaper entry", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        type: "wet" as const,
        changedAt: new Date("2024-01-17T13:00:00.000Z"),
      };

      const result = await DiaperStorageService.addDiaper(input);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^diaper-/);
      expect(result.babyId).toBe("baby-123");
      expect(result.type).toBe("wet");
      expect(result.stoolColor).toBeUndefined();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should add a new dirty diaper entry with stool color", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        type: "dirty" as const,
        stoolColor: "brown" as const,
        changedAt: new Date("2024-01-17T13:00:00.000Z"),
      };

      const result = await DiaperStorageService.addDiaper(input);

      expect(result.type).toBe("dirty");
      expect(result.stoolColor).toBe("brown");
    });

    it("should add a new mixed diaper entry", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        type: "mixed" as const,
        stoolColor: "yellow" as const,
        changedAt: new Date("2024-01-17T13:00:00.000Z"),
      };

      const result = await DiaperStorageService.addDiaper(input);

      expect(result.type).toBe("mixed");
      expect(result.stoolColor).toBe("yellow");
    });

    it("should add diaper entry with notes", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        type: "wet" as const,
        changedAt: new Date("2024-01-17T13:00:00.000Z"),
        notes: "First diaper of the day",
      };

      const result = await DiaperStorageService.addDiaper(input);

      expect(result.notes).toBe("First diaper of the day");
    });

    it("should append to existing diapers", async () => {
      const existingDiaper: StoredDiaperEntry = {
        id: "diaper-1",
        babyId: "baby-123",
        type: "wet",
        changedAt: "2024-01-17T09:00:00.000Z",
        createdAt: "2024-01-17T09:00:00.000Z",
        updatedAt: "2024-01-17T09:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingDiaper]));

      const input = {
        babyId: "baby-123",
        type: "dirty" as const,
        changedAt: new Date("2024-01-17T13:00:00.000Z"),
      };

      await DiaperStorageService.addDiaper(input);

      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedDiapers = JSON.parse(setItemCall[1]);
      expect(savedDiapers).toHaveLength(2);
    });
  });

  describe("updateDiaper", () => {
    it("should return null when diaper not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await DiaperStorageService.updateDiaper(
        "baby-123",
        "diaper-999",
        { notes: "Updated" }
      );

      expect(result).toBeNull();
    });

    it("should update existing diaper", async () => {
      const existingDiaper: StoredDiaperEntry = {
        id: "diaper-1",
        babyId: "baby-123",
        type: "wet",
        changedAt: "2024-01-17T13:00:00.000Z",
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingDiaper]));

      const result = await DiaperStorageService.updateDiaper(
        "baby-123",
        "diaper-1",
        { notes: "Was very full" }
      );

      expect(result?.notes).toBe("Was very full");
      expect(result?.updatedAt).not.toBe(existingDiaper.updatedAt);
    });

    it("should update stool color", async () => {
      const existingDiaper: StoredDiaperEntry = {
        id: "diaper-1",
        babyId: "baby-123",
        type: "dirty",
        stoolColor: "brown",
        changedAt: "2024-01-17T13:00:00.000Z",
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingDiaper]));

      const result = await DiaperStorageService.updateDiaper(
        "baby-123",
        "diaper-1",
        { stoolColor: "green" }
      );

      expect(result?.stoolColor).toBe("green");
    });

    it("should update diaper type", async () => {
      const existingDiaper: StoredDiaperEntry = {
        id: "diaper-1",
        babyId: "baby-123",
        type: "wet",
        changedAt: "2024-01-17T13:00:00.000Z",
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingDiaper]));

      const result = await DiaperStorageService.updateDiaper(
        "baby-123",
        "diaper-1",
        { type: "mixed", stoolColor: "yellow" }
      );

      expect(result?.type).toBe("mixed");
      expect(result?.stoolColor).toBe("yellow");
    });
  });

  describe("deleteDiaper", () => {
    it("should return false when diaper not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await DiaperStorageService.deleteDiaper("baby-123", "diaper-999");

      expect(result).toBe(false);
    });

    it("should delete existing diaper", async () => {
      const existingDiaper: StoredDiaperEntry = {
        id: "diaper-1",
        babyId: "baby-123",
        type: "wet",
        changedAt: "2024-01-17T13:00:00.000Z",
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingDiaper]));

      const result = await DiaperStorageService.deleteDiaper("baby-123", "diaper-1");

      expect(result).toBe(true);
      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedDiapers = JSON.parse(setItemCall[1]);
      expect(savedDiapers).toHaveLength(0);
    });
  });

  describe("getLastDiaper", () => {
    it("should return null when no diapers exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await DiaperStorageService.getLastDiaper("baby-123");

      expect(result).toBeNull();
    });

    it("should return the most recent diaper", async () => {
      const diapers: StoredDiaperEntry[] = [
        {
          id: "diaper-1",
          babyId: "baby-123",
          type: "wet",
          changedAt: "2024-01-17T09:00:00.000Z",
          createdAt: "2024-01-17T09:00:00.000Z",
          updatedAt: "2024-01-17T09:00:00.000Z",
        },
        {
          id: "diaper-2",
          babyId: "baby-123",
          type: "dirty",
          stoolColor: "brown",
          changedAt: "2024-01-17T13:00:00.000Z",
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T13:00:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(diapers));

      const result = await DiaperStorageService.getLastDiaper("baby-123");

      expect(result?.id).toBe("diaper-2");
    });
  });

  describe("getTodaysDiapers", () => {
    it("should return empty array when no diapers exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await DiaperStorageService.getTodaysDiapers("baby-123");

      expect(result).toEqual([]);
    });

    it("should return only today's diapers", async () => {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      const todayStr = today.toISOString();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      const diapers: StoredDiaperEntry[] = [
        {
          id: "diaper-1",
          babyId: "baby-123",
          type: "wet",
          changedAt: yesterdayStr,
          createdAt: yesterdayStr,
          updatedAt: yesterdayStr,
        },
        {
          id: "diaper-2",
          babyId: "baby-123",
          type: "dirty",
          stoolColor: "brown",
          changedAt: todayStr,
          createdAt: todayStr,
          updatedAt: todayStr,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(diapers));

      const result = await DiaperStorageService.getTodaysDiapers("baby-123");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("diaper-2");
    });
  });

  describe("getTodaysDiaperCounts", () => {
    it("should return zero counts when no diapers exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await DiaperStorageService.getTodaysDiaperCounts("baby-123");

      expect(result).toEqual({ wet: 0, dirty: 0, mixed: 0, total: 0 });
    });

    it("should count diapers by type correctly", async () => {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      const todayStr = today.toISOString();

      const today2 = new Date();
      today2.setHours(11, 0, 0, 0);
      const today2Str = today2.toISOString();

      const today3 = new Date();
      today3.setHours(14, 0, 0, 0);
      const today3Str = today3.toISOString();

      const diapers: StoredDiaperEntry[] = [
        {
          id: "diaper-1",
          babyId: "baby-123",
          type: "wet",
          changedAt: todayStr,
          createdAt: todayStr,
          updatedAt: todayStr,
        },
        {
          id: "diaper-2",
          babyId: "baby-123",
          type: "wet",
          changedAt: today2Str,
          createdAt: today2Str,
          updatedAt: today2Str,
        },
        {
          id: "diaper-3",
          babyId: "baby-123",
          type: "dirty",
          stoolColor: "brown",
          changedAt: today3Str,
          createdAt: today3Str,
          updatedAt: today3Str,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(diapers));

      const result = await DiaperStorageService.getTodaysDiaperCounts("baby-123");

      expect(result).toEqual({ wet: 2, dirty: 1, mixed: 0, total: 3 });
    });
  });
});
