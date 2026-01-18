/**
 * GrowthStorageService tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GrowthStorageService, StoredGrowthEntry } from "./growth-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("GrowthStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllMeasurements", () => {
    it("should return empty array when no measurements exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await GrowthStorageService.getAllMeasurements("baby-123");

      expect(result).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@growth:baby-123");
    });

    it("should return stored measurements for a baby", async () => {
      const mockMeasurements: StoredGrowthEntry[] = [
        {
          id: "growth-1",
          babyId: "baby-123",
          measuredAt: "2024-01-17T13:00:00.000Z",
          weightKg: 5.5,
          heightCm: 55,
          headCircumferenceCm: 38,
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T13:00:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(mockMeasurements));

      const result = await GrowthStorageService.getAllMeasurements("baby-123");

      expect(result).toEqual(mockMeasurements);
    });
  });

  describe("getMeasurementById", () => {
    it("should return null when measurement not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await GrowthStorageService.getMeasurementById("baby-123", "growth-999");

      expect(result).toBeNull();
    });

    it("should return measurement when found", async () => {
      const mockMeasurement: StoredGrowthEntry = {
        id: "growth-1",
        babyId: "baby-123",
        measuredAt: "2024-01-17T13:00:00.000Z",
        weightKg: 5.5,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([mockMeasurement]));

      const result = await GrowthStorageService.getMeasurementById("baby-123", "growth-1");

      expect(result).toEqual(mockMeasurement);
    });
  });

  describe("addMeasurement", () => {
    it("should add a new weight-only measurement", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        measuredAt: new Date("2024-01-17T13:00:00.000Z"),
        weightKg: 5.5,
      };

      const result = await GrowthStorageService.addMeasurement(input);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^growth-/);
      expect(result.babyId).toBe("baby-123");
      expect(result.weightKg).toBe(5.5);
      expect(result.heightCm).toBeUndefined();
      expect(result.headCircumferenceCm).toBeUndefined();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should add a new height-only measurement", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        measuredAt: new Date("2024-01-17T13:00:00.000Z"),
        heightCm: 55,
      };

      const result = await GrowthStorageService.addMeasurement(input);

      expect(result.heightCm).toBe(55);
      expect(result.weightKg).toBeUndefined();
    });

    it("should add a new head circumference-only measurement", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        measuredAt: new Date("2024-01-17T13:00:00.000Z"),
        headCircumferenceCm: 38,
      };

      const result = await GrowthStorageService.addMeasurement(input);

      expect(result.headCircumferenceCm).toBe(38);
      expect(result.weightKg).toBeUndefined();
      expect(result.heightCm).toBeUndefined();
    });

    it("should add a complete measurement with all fields", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        measuredAt: new Date("2024-01-17T13:00:00.000Z"),
        weightKg: 5.5,
        heightCm: 55,
        headCircumferenceCm: 38,
        notes: "Doctor's visit",
      };

      const result = await GrowthStorageService.addMeasurement(input);

      expect(result.weightKg).toBe(5.5);
      expect(result.heightCm).toBe(55);
      expect(result.headCircumferenceCm).toBe(38);
      expect(result.notes).toBe("Doctor's visit");
    });

    it("should append to existing measurements", async () => {
      const existingMeasurement: StoredGrowthEntry = {
        id: "growth-1",
        babyId: "baby-123",
        measuredAt: "2024-01-01T09:00:00.000Z",
        weightKg: 4.5,
        createdAt: "2024-01-01T09:00:00.000Z",
        updatedAt: "2024-01-01T09:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingMeasurement]));

      const input = {
        babyId: "baby-123",
        measuredAt: new Date("2024-01-17T13:00:00.000Z"),
        weightKg: 5.5,
      };

      await GrowthStorageService.addMeasurement(input);

      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedMeasurements = JSON.parse(setItemCall[1]);
      expect(savedMeasurements).toHaveLength(2);
    });
  });

  describe("updateMeasurement", () => {
    it("should return null when measurement not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await GrowthStorageService.updateMeasurement(
        "baby-123",
        "growth-999",
        { notes: "Updated" }
      );

      expect(result).toBeNull();
    });

    it("should update existing measurement notes", async () => {
      const existingMeasurement: StoredGrowthEntry = {
        id: "growth-1",
        babyId: "baby-123",
        measuredAt: "2024-01-17T13:00:00.000Z",
        weightKg: 5.5,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingMeasurement]));

      const result = await GrowthStorageService.updateMeasurement(
        "baby-123",
        "growth-1",
        { notes: "Pediatrician visit" }
      );

      expect(result?.notes).toBe("Pediatrician visit");
      expect(result?.updatedAt).not.toBe(existingMeasurement.updatedAt);
    });

    it("should update weight", async () => {
      const existingMeasurement: StoredGrowthEntry = {
        id: "growth-1",
        babyId: "baby-123",
        measuredAt: "2024-01-17T13:00:00.000Z",
        weightKg: 5.5,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingMeasurement]));

      const result = await GrowthStorageService.updateMeasurement(
        "baby-123",
        "growth-1",
        { weightKg: 5.7 }
      );

      expect(result?.weightKg).toBe(5.7);
    });

    it("should update height and head circumference", async () => {
      const existingMeasurement: StoredGrowthEntry = {
        id: "growth-1",
        babyId: "baby-123",
        measuredAt: "2024-01-17T13:00:00.000Z",
        heightCm: 55,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingMeasurement]));

      const result = await GrowthStorageService.updateMeasurement(
        "baby-123",
        "growth-1",
        { heightCm: 56, headCircumferenceCm: 39 }
      );

      expect(result?.heightCm).toBe(56);
      expect(result?.headCircumferenceCm).toBe(39);
    });
  });

  describe("deleteMeasurement", () => {
    it("should return false when measurement not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await GrowthStorageService.deleteMeasurement("baby-123", "growth-999");

      expect(result).toBe(false);
    });

    it("should delete existing measurement", async () => {
      const existingMeasurement: StoredGrowthEntry = {
        id: "growth-1",
        babyId: "baby-123",
        measuredAt: "2024-01-17T13:00:00.000Z",
        weightKg: 5.5,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingMeasurement]));

      const result = await GrowthStorageService.deleteMeasurement("baby-123", "growth-1");

      expect(result).toBe(true);
      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedMeasurements = JSON.parse(setItemCall[1]);
      expect(savedMeasurements).toHaveLength(0);
    });
  });

  describe("getLastMeasurement", () => {
    it("should return null when no measurements exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await GrowthStorageService.getLastMeasurement("baby-123");

      expect(result).toBeNull();
    });

    it("should return the most recent measurement", async () => {
      const measurements: StoredGrowthEntry[] = [
        {
          id: "growth-1",
          babyId: "baby-123",
          measuredAt: "2024-01-01T09:00:00.000Z",
          weightKg: 4.5,
          createdAt: "2024-01-01T09:00:00.000Z",
          updatedAt: "2024-01-01T09:00:00.000Z",
        },
        {
          id: "growth-2",
          babyId: "baby-123",
          measuredAt: "2024-01-17T13:00:00.000Z",
          weightKg: 5.5,
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T13:00:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(measurements));

      const result = await GrowthStorageService.getLastMeasurement("baby-123");

      expect(result?.id).toBe("growth-2");
    });
  });

  describe("getMeasurementHistory", () => {
    it("should return empty array when no measurements exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await GrowthStorageService.getMeasurementHistory("baby-123");

      expect(result).toEqual([]);
    });

    it("should return measurements sorted by date descending", async () => {
      const measurements: StoredGrowthEntry[] = [
        {
          id: "growth-2",
          babyId: "baby-123",
          measuredAt: "2024-01-17T13:00:00.000Z",
          weightKg: 5.5,
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T13:00:00.000Z",
        },
        {
          id: "growth-1",
          babyId: "baby-123",
          measuredAt: "2024-01-01T09:00:00.000Z",
          weightKg: 4.5,
          createdAt: "2024-01-01T09:00:00.000Z",
          updatedAt: "2024-01-01T09:00:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(measurements));

      const result = await GrowthStorageService.getMeasurementHistory("baby-123");

      expect(result[0].id).toBe("growth-2");
      expect(result[1].id).toBe("growth-1");
    });

    it("should limit results when limit parameter is provided", async () => {
      const measurements: StoredGrowthEntry[] = [
        {
          id: "growth-3",
          babyId: "baby-123",
          measuredAt: "2024-01-20T09:00:00.000Z",
          weightKg: 6.0,
          createdAt: "2024-01-20T09:00:00.000Z",
          updatedAt: "2024-01-20T09:00:00.000Z",
        },
        {
          id: "growth-2",
          babyId: "baby-123",
          measuredAt: "2024-01-10T09:00:00.000Z",
          weightKg: 5.5,
          createdAt: "2024-01-10T09:00:00.000Z",
          updatedAt: "2024-01-10T09:00:00.000Z",
        },
        {
          id: "growth-1",
          babyId: "baby-123",
          measuredAt: "2024-01-01T09:00:00.000Z",
          weightKg: 4.5,
          createdAt: "2024-01-01T09:00:00.000Z",
          updatedAt: "2024-01-01T09:00:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(measurements));

      const result = await GrowthStorageService.getMeasurementHistory("baby-123", 2);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("growth-3");
      expect(result[1].id).toBe("growth-2");
    });
  });
});
