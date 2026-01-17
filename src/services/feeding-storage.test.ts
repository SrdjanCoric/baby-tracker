/**
 * FeedingStorageService tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FeedingStorageService, StoredFeedingEntry } from "./feeding-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("FeedingStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllFeedings", () => {
    it("should return empty array when no feedings exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await FeedingStorageService.getAllFeedings("baby-123");

      expect(result).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@feedings:baby-123");
    });

    it("should return stored feedings for a baby", async () => {
      const mockFeedings: StoredFeedingEntry[] = [
        {
          id: "feeding-1",
          babyId: "baby-123",
          type: "breast",
          side: "left",
          startedAt: "2024-01-17T10:00:00.000Z",
          endedAt: "2024-01-17T10:15:00.000Z",
          durationSeconds: 900,
          createdAt: "2024-01-17T10:00:00.000Z",
          updatedAt: "2024-01-17T10:15:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(mockFeedings));

      const result = await FeedingStorageService.getAllFeedings("baby-123");

      expect(result).toEqual(mockFeedings);
    });
  });

  describe("getFeedingById", () => {
    it("should return null when feeding not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await FeedingStorageService.getFeedingById("baby-123", "feeding-999");

      expect(result).toBeNull();
    });

    it("should return feeding when found", async () => {
      const mockFeeding: StoredFeedingEntry = {
        id: "feeding-1",
        babyId: "baby-123",
        type: "breast",
        side: "left",
        startedAt: "2024-01-17T10:00:00.000Z",
        durationSeconds: 900,
        createdAt: "2024-01-17T10:00:00.000Z",
        updatedAt: "2024-01-17T10:15:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([mockFeeding]));

      const result = await FeedingStorageService.getFeedingById("baby-123", "feeding-1");

      expect(result).toEqual(mockFeeding);
    });
  });

  describe("addFeeding", () => {
    it("should add a new breastfeeding entry", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        type: "breast" as const,
        side: "left" as const,
        startedAt: new Date("2024-01-17T10:00:00.000Z"),
        endedAt: new Date("2024-01-17T10:15:00.000Z"),
        durationSeconds: 900,
      };

      const result = await FeedingStorageService.addFeeding(input);

      expect(result.id).toBeDefined();
      expect(result.babyId).toBe("baby-123");
      expect(result.type).toBe("breast");
      expect(result.side).toBe("left");
      expect(result.durationSeconds).toBe(900);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should add a new bottle feeding entry", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        type: "bottle" as const,
        startedAt: new Date("2024-01-17T10:00:00.000Z"),
        amountMl: 120,
      };

      const result = await FeedingStorageService.addFeeding(input);

      expect(result.type).toBe("bottle");
      expect(result.amountMl).toBe(120);
      expect(result.side).toBeUndefined();
    });

    it("should append to existing feedings", async () => {
      const existingFeeding: StoredFeedingEntry = {
        id: "feeding-1",
        babyId: "baby-123",
        type: "breast",
        side: "right",
        startedAt: "2024-01-17T09:00:00.000Z",
        durationSeconds: 600,
        createdAt: "2024-01-17T09:00:00.000Z",
        updatedAt: "2024-01-17T09:10:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingFeeding]));

      const input = {
        babyId: "baby-123",
        type: "breast" as const,
        side: "left" as const,
        startedAt: new Date("2024-01-17T10:00:00.000Z"),
        durationSeconds: 900,
      };

      await FeedingStorageService.addFeeding(input);

      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedFeedings = JSON.parse(setItemCall[1]);
      expect(savedFeedings).toHaveLength(2);
    });
  });

  describe("updateFeeding", () => {
    it("should return null when feeding not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await FeedingStorageService.updateFeeding(
        "baby-123",
        "feeding-999",
        { notes: "Updated" }
      );

      expect(result).toBeNull();
    });

    it("should update existing feeding", async () => {
      const existingFeeding: StoredFeedingEntry = {
        id: "feeding-1",
        babyId: "baby-123",
        type: "breast",
        side: "left",
        startedAt: "2024-01-17T10:00:00.000Z",
        durationSeconds: 900,
        createdAt: "2024-01-17T10:00:00.000Z",
        updatedAt: "2024-01-17T10:15:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingFeeding]));

      const result = await FeedingStorageService.updateFeeding(
        "baby-123",
        "feeding-1",
        { notes: "Baby was fussy" }
      );

      expect(result?.notes).toBe("Baby was fussy");
      expect(result?.updatedAt).not.toBe(existingFeeding.updatedAt);
    });
  });

  describe("deleteFeeding", () => {
    it("should return false when feeding not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await FeedingStorageService.deleteFeeding("baby-123", "feeding-999");

      expect(result).toBe(false);
    });

    it("should delete existing feeding", async () => {
      const existingFeeding: StoredFeedingEntry = {
        id: "feeding-1",
        babyId: "baby-123",
        type: "breast",
        side: "left",
        startedAt: "2024-01-17T10:00:00.000Z",
        durationSeconds: 900,
        createdAt: "2024-01-17T10:00:00.000Z",
        updatedAt: "2024-01-17T10:15:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingFeeding]));

      const result = await FeedingStorageService.deleteFeeding("baby-123", "feeding-1");

      expect(result).toBe(true);
      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedFeedings = JSON.parse(setItemCall[1]);
      expect(savedFeedings).toHaveLength(0);
    });
  });

  describe("getLastFeeding", () => {
    it("should return null when no feedings exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await FeedingStorageService.getLastFeeding("baby-123");

      expect(result).toBeNull();
    });

    it("should return the most recent feeding", async () => {
      const feedings: StoredFeedingEntry[] = [
        {
          id: "feeding-1",
          babyId: "baby-123",
          type: "breast",
          side: "left",
          startedAt: "2024-01-17T09:00:00.000Z",
          durationSeconds: 600,
          createdAt: "2024-01-17T09:00:00.000Z",
          updatedAt: "2024-01-17T09:10:00.000Z",
        },
        {
          id: "feeding-2",
          babyId: "baby-123",
          type: "breast",
          side: "right",
          startedAt: "2024-01-17T11:00:00.000Z",
          durationSeconds: 900,
          createdAt: "2024-01-17T11:00:00.000Z",
          updatedAt: "2024-01-17T11:15:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(feedings));

      const result = await FeedingStorageService.getLastFeeding("baby-123");

      expect(result?.id).toBe("feeding-2");
    });
  });

  describe("getLastBreastSide", () => {
    it("should return null when no breast feedings exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await FeedingStorageService.getLastBreastSide("baby-123");

      expect(result).toBeNull();
    });

    it("should return null when only bottle feedings exist", async () => {
      const feedings: StoredFeedingEntry[] = [
        {
          id: "feeding-1",
          babyId: "baby-123",
          type: "bottle",
          startedAt: "2024-01-17T09:00:00.000Z",
          amountMl: 120,
          createdAt: "2024-01-17T09:00:00.000Z",
          updatedAt: "2024-01-17T09:10:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(feedings));

      const result = await FeedingStorageService.getLastBreastSide("baby-123");

      expect(result).toBeNull();
    });

    it("should return the last used breast side", async () => {
      const feedings: StoredFeedingEntry[] = [
        {
          id: "feeding-1",
          babyId: "baby-123",
          type: "breast",
          side: "left",
          startedAt: "2024-01-17T09:00:00.000Z",
          durationSeconds: 600,
          createdAt: "2024-01-17T09:00:00.000Z",
          updatedAt: "2024-01-17T09:10:00.000Z",
        },
        {
          id: "feeding-2",
          babyId: "baby-123",
          type: "breast",
          side: "right",
          startedAt: "2024-01-17T11:00:00.000Z",
          durationSeconds: 900,
          createdAt: "2024-01-17T11:00:00.000Z",
          updatedAt: "2024-01-17T11:15:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(feedings));

      const result = await FeedingStorageService.getLastBreastSide("baby-123");

      expect(result).toBe("right");
    });
  });

  describe("Active Timer Management", () => {
    describe("getActiveTimer", () => {
      it("should return null when no active timer exists", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

        const result = await FeedingStorageService.getActiveTimer("baby-123");

        expect(result).toBeNull();
        expect(AsyncStorage.getItem).toHaveBeenCalledWith("@active_feeding_timer:baby-123");
      });

      it("should return active timer data when exists", async () => {
        const activeTimer = {
          startedAt: "2024-01-17T10:00:00.000Z",
          side: "left",
          type: "breast",
        };
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(activeTimer));

        const result = await FeedingStorageService.getActiveTimer("baby-123");

        expect(result).toEqual(activeTimer);
      });
    });

    describe("setActiveTimer", () => {
      it("should save active timer data", async () => {
        const timerData = {
          startedAt: "2024-01-17T10:00:00.000Z",
          side: "left" as const,
          type: "breast" as const,
        };

        await FeedingStorageService.setActiveTimer("baby-123", timerData);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@active_feeding_timer:baby-123",
          JSON.stringify(timerData)
        );
      });
    });

    describe("clearActiveTimer", () => {
      it("should remove active timer", async () => {
        await FeedingStorageService.clearActiveTimer("baby-123");

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@active_feeding_timer:baby-123");
      });
    });
  });
});
