/**
 * PumpingStorageService tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PumpingStorageService, StoredPumpingEntry } from "./pumping-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("PumpingStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllPumpings", () => {
    it("should return empty array when no pumpings exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await PumpingStorageService.getAllPumpings("baby-123");

      expect(result).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@pumpings:baby-123");
    });

    it("should return stored pumpings for a baby", async () => {
      const mockPumpings: StoredPumpingEntry[] = [
        {
          id: "pumping-1",
          babyId: "baby-123",
          side: "left",
          startedAt: "2024-01-17T13:00:00.000Z",
          endedAt: "2024-01-17T13:30:00.000Z",
          durationSeconds: 1800,
          volumeMl: 120,
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T13:30:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(mockPumpings));

      const result = await PumpingStorageService.getAllPumpings("baby-123");

      expect(result).toEqual(mockPumpings);
    });
  });

  describe("getPumpingById", () => {
    it("should return null when pumping not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await PumpingStorageService.getPumpingById("baby-123", "pumping-999");

      expect(result).toBeNull();
    });

    it("should return pumping when found", async () => {
      const mockPumping: StoredPumpingEntry = {
        id: "pumping-1",
        babyId: "baby-123",
        side: "left",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 1800,
        volumeMl: 120,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([mockPumping]));

      const result = await PumpingStorageService.getPumpingById("baby-123", "pumping-1");

      expect(result).toEqual(mockPumping);
    });
  });

  describe("addPumping", () => {
    it("should add a new pumping entry with left side", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        side: "left" as const,
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        endedAt: new Date("2024-01-17T13:30:00.000Z"),
        durationSeconds: 1800,
        volumeMl: 120,
      };

      const result = await PumpingStorageService.addPumping(input);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^pumping-/);
      expect(result.babyId).toBe("baby-123");
      expect(result.side).toBe("left");
      expect(result.volumeMl).toBe(120);
      expect(result.durationSeconds).toBe(1800);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should add a new pumping entry with both sides", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        side: "both" as const,
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        endedAt: new Date("2024-01-17T13:45:00.000Z"),
        durationSeconds: 2700,
        volumeMl: 200,
      };

      const result = await PumpingStorageService.addPumping(input);

      expect(result.side).toBe("both");
      expect(result.volumeMl).toBe(200);
    });

    it("should add pumping entry with notes", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        side: "right" as const,
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        durationSeconds: 1200,
        volumeMl: 80,
        notes: "Morning session",
      };

      const result = await PumpingStorageService.addPumping(input);

      expect(result.notes).toBe("Morning session");
    });

    it("should append to existing pumpings", async () => {
      const existingPumping: StoredPumpingEntry = {
        id: "pumping-1",
        babyId: "baby-123",
        side: "left",
        startedAt: "2024-01-17T09:00:00.000Z",
        durationSeconds: 1800,
        volumeMl: 100,
        createdAt: "2024-01-17T09:00:00.000Z",
        updatedAt: "2024-01-17T09:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingPumping]));

      const input = {
        babyId: "baby-123",
        side: "right" as const,
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        durationSeconds: 1500,
        volumeMl: 90,
      };

      await PumpingStorageService.addPumping(input);

      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedPumpings = JSON.parse(setItemCall[1]);
      expect(savedPumpings).toHaveLength(2);
    });
  });

  describe("updatePumping", () => {
    it("should return null when pumping not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await PumpingStorageService.updatePumping(
        "baby-123",
        "pumping-999",
        { notes: "Updated" }
      );

      expect(result).toBeNull();
    });

    it("should update existing pumping", async () => {
      const existingPumping: StoredPumpingEntry = {
        id: "pumping-1",
        babyId: "baby-123",
        side: "left",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 1800,
        volumeMl: 120,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingPumping]));

      const result = await PumpingStorageService.updatePumping(
        "baby-123",
        "pumping-1",
        { notes: "Great output today!" }
      );

      expect(result?.notes).toBe("Great output today!");
      expect(result?.updatedAt).not.toBe(existingPumping.updatedAt);
    });

    it("should update volume", async () => {
      const existingPumping: StoredPumpingEntry = {
        id: "pumping-1",
        babyId: "baby-123",
        side: "left",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 1800,
        volumeMl: 100,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingPumping]));

      const result = await PumpingStorageService.updatePumping(
        "baby-123",
        "pumping-1",
        { volumeMl: 150 }
      );

      expect(result?.volumeMl).toBe(150);
    });

    it("should update end time and duration", async () => {
      const existingPumping: StoredPumpingEntry = {
        id: "pumping-1",
        babyId: "baby-123",
        side: "left",
        startedAt: "2024-01-17T13:00:00.000Z",
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingPumping]));

      const result = await PumpingStorageService.updatePumping(
        "baby-123",
        "pumping-1",
        {
          endedAt: new Date("2024-01-17T13:30:00.000Z"),
          durationSeconds: 1800,
          volumeMl: 120
        }
      );

      expect(result?.endedAt).toBe("2024-01-17T13:30:00.000Z");
      expect(result?.durationSeconds).toBe(1800);
      expect(result?.volumeMl).toBe(120);
    });

    it("should update the start time", async () => {
      const existingPumping: StoredPumpingEntry = {
        id: "pumping-1",
        babyId: "baby-123",
        side: "left",
        startedAt: "2024-01-17T13:00:00.000Z",
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([existingPumping])
      );
      const result = await PumpingStorageService.updatePumping(
        "baby-123",
        "pumping-1",
        { startedAt: new Date("2024-01-17T12:45:00.000Z") }
      );
      expect(result?.startedAt).toBe("2024-01-17T12:45:00.000Z");
    });
  });

  describe("deletePumping", () => {
    it("should return false when pumping not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await PumpingStorageService.deletePumping("baby-123", "pumping-999");

      expect(result).toBe(false);
    });

    it("should delete existing pumping", async () => {
      const existingPumping: StoredPumpingEntry = {
        id: "pumping-1",
        babyId: "baby-123",
        side: "left",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 1800,
        volumeMl: 120,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingPumping]));

      const result = await PumpingStorageService.deletePumping("baby-123", "pumping-1");

      expect(result).toBe(true);
      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedPumpings = JSON.parse(setItemCall[1]);
      expect(savedPumpings).toHaveLength(0);
    });
  });

  describe("getLastPumping", () => {
    it("should return null when no pumpings exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await PumpingStorageService.getLastPumping("baby-123");

      expect(result).toBeNull();
    });

    it("should return the most recent pumping", async () => {
      const pumpings: StoredPumpingEntry[] = [
        {
          id: "pumping-1",
          babyId: "baby-123",
          side: "left",
          startedAt: "2024-01-17T09:00:00.000Z",
          durationSeconds: 1800,
          volumeMl: 100,
          createdAt: "2024-01-17T09:00:00.000Z",
          updatedAt: "2024-01-17T09:30:00.000Z",
        },
        {
          id: "pumping-2",
          babyId: "baby-123",
          side: "right",
          startedAt: "2024-01-17T13:00:00.000Z",
          durationSeconds: 1500,
          volumeMl: 90,
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T13:25:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(pumpings));

      const result = await PumpingStorageService.getLastPumping("baby-123");

      expect(result?.id).toBe("pumping-2");
    });
  });

  describe("getTodaysPumpings", () => {
    it("should return empty array when no pumpings exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await PumpingStorageService.getTodaysPumpings("baby-123");

      expect(result).toEqual([]);
    });

    it("should return only today's pumpings", async () => {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      const todayStr = today.toISOString();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      const pumpings: StoredPumpingEntry[] = [
        {
          id: "pumping-1",
          babyId: "baby-123",
          side: "left",
          startedAt: yesterdayStr,
          durationSeconds: 1800,
          volumeMl: 100,
          createdAt: yesterdayStr,
          updatedAt: yesterdayStr,
        },
        {
          id: "pumping-2",
          babyId: "baby-123",
          side: "right",
          startedAt: todayStr,
          durationSeconds: 1500,
          volumeMl: 90,
          createdAt: todayStr,
          updatedAt: todayStr,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(pumpings));

      const result = await PumpingStorageService.getTodaysPumpings("baby-123");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("pumping-2");
    });
  });

  describe("getTodaysTotalVolume", () => {
    it("should return 0 when no pumpings exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await PumpingStorageService.getTodaysTotalVolume("baby-123");

      expect(result).toBe(0);
    });

    it("should return total volume for today's pumpings", async () => {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      const todayStr = today.toISOString();

      const todayAfternoon = new Date(today);
      todayAfternoon.setHours(14, 0, 0, 0);
      const todayAfternoonStr = todayAfternoon.toISOString();

      const pumpings: StoredPumpingEntry[] = [
        {
          id: "pumping-1",
          babyId: "baby-123",
          side: "left",
          startedAt: todayStr,
          durationSeconds: 1800,
          volumeMl: 100,
          createdAt: todayStr,
          updatedAt: todayStr,
        },
        {
          id: "pumping-2",
          babyId: "baby-123",
          side: "right",
          startedAt: todayAfternoonStr,
          durationSeconds: 1500,
          volumeMl: 90,
          createdAt: todayAfternoonStr,
          updatedAt: todayAfternoonStr,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(pumpings));

      const result = await PumpingStorageService.getTodaysTotalVolume("baby-123");

      expect(result).toBe(190);
    });

    it("should ignore pumpings without volume", async () => {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      const todayStr = today.toISOString();

      const pumpings: StoredPumpingEntry[] = [
        {
          id: "pumping-1",
          babyId: "baby-123",
          side: "left",
          startedAt: todayStr,
          durationSeconds: 1800,
          volumeMl: 100,
          createdAt: todayStr,
          updatedAt: todayStr,
        },
        {
          id: "pumping-2",
          babyId: "baby-123",
          side: "right",
          startedAt: todayStr,
          durationSeconds: 1500,
          createdAt: todayStr,
          updatedAt: todayStr,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(pumpings));

      const result = await PumpingStorageService.getTodaysTotalVolume("baby-123");

      expect(result).toBe(100);
    });
  });

  describe("Active Timer Management", () => {
    describe("getActiveTimer", () => {
      it("should return null when no active timer exists", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

        const result = await PumpingStorageService.getActiveTimer("baby-123");

        expect(result).toBeNull();
        expect(AsyncStorage.getItem).toHaveBeenCalledWith("@active_pumping_timer:baby-123");
      });

      it("should return active timer data when exists", async () => {
        const activeTimer = {
          startedAt: "2024-01-17T13:00:00.000Z",
          side: "left",
        };
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(activeTimer));

        const result = await PumpingStorageService.getActiveTimer("baby-123");

        expect(result).toEqual(activeTimer);
      });
    });

    describe("setActiveTimer", () => {
      it("should save active timer data for left side", async () => {
        const timerData = {
          startedAt: "2024-01-17T13:00:00.000Z",
          side: "left" as const,
        };

        await PumpingStorageService.setActiveTimer("baby-123", timerData);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@active_pumping_timer:baby-123",
          JSON.stringify(timerData)
        );
      });

      it("should save active timer data for both sides", async () => {
        const timerData = {
          startedAt: "2024-01-17T13:00:00.000Z",
          side: "both" as const,
        };

        await PumpingStorageService.setActiveTimer("baby-123", timerData);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@active_pumping_timer:baby-123",
          JSON.stringify(timerData)
        );
      });
    });

    describe("clearActiveTimer", () => {
      it("should remove active timer", async () => {
        await PumpingStorageService.clearActiveTimer("baby-123");

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@active_pumping_timer:baby-123");
      });
    });
  });
});
