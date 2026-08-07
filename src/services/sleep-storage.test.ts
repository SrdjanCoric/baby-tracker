/**
 * SleepStorageService tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SleepStorageService, StoredSleepEntry } from "./sleep-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("SleepStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllSleeps", () => {
    it("should return empty array when no sleeps exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await SleepStorageService.getAllSleeps("baby-123");

      expect(result).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@sleeps:baby-123");
    });

    it("should return stored sleeps for a baby", async () => {
      const mockSleeps: StoredSleepEntry[] = [
        {
          id: "sleep-1",
          babyId: "baby-123",
          type: "nap",
          startedAt: "2024-01-17T13:00:00.000Z",
          endedAt: "2024-01-17T14:30:00.000Z",
          durationSeconds: 5400,
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T14:30:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(mockSleeps));

      const result = await SleepStorageService.getAllSleeps("baby-123");

      expect(result).toEqual(mockSleeps);
    });
  });

  describe("getSleepById", () => {
    it("should return null when sleep not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await SleepStorageService.getSleepById("baby-123", "sleep-999");

      expect(result).toBeNull();
    });

    it("should return sleep when found", async () => {
      const mockSleep: StoredSleepEntry = {
        id: "sleep-1",
        babyId: "baby-123",
        type: "nap",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 5400,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T14:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([mockSleep]));

      const result = await SleepStorageService.getSleepById("baby-123", "sleep-1");

      expect(result).toEqual(mockSleep);
    });
  });

  describe("addSleep", () => {
    it("should add a new nap entry", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        type: "nap" as const,
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        endedAt: new Date("2024-01-17T14:30:00.000Z"),
        durationSeconds: 5400,
      };

      const result = await SleepStorageService.addSleep(input);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^sleep-/);
      expect(result.babyId).toBe("baby-123");
      expect(result.type).toBe("nap");
      expect(result.durationSeconds).toBe(5400);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should add a new night sleep entry", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        type: "night" as const,
        startedAt: new Date("2024-01-17T20:00:00.000Z"),
        endedAt: new Date("2024-01-18T06:00:00.000Z"),
        durationSeconds: 36000,
      };

      const result = await SleepStorageService.addSleep(input);

      expect(result.type).toBe("night");
      expect(result.durationSeconds).toBe(36000);
    });

    it("should add sleep entry with notes", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        type: "nap" as const,
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        durationSeconds: 3600,
        notes: "Slept well after feeding",
      };

      const result = await SleepStorageService.addSleep(input);

      expect(result.notes).toBe("Slept well after feeding");
    });

    it("persists a versioned unresolved morning classification", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await SleepStorageService.addSleep({
        babyId: "baby-123",
        type: "nap",
        startedAt: new Date("2024-01-18T08:30:00.000Z"),
        endedAt: new Date("2024-01-18T09:35:00.000Z"),
        durationSeconds: 3900,
        morningClassification: "unresolved",
        morningClassificationVersion: 1,
      });

      expect(result.morningClassification).toBe("unresolved");
      expect(result.morningClassificationVersion).toBe(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@sleeps:baby-123",
        expect.stringContaining('"morningClassification":"unresolved"')
      );
    });

    it("should append to existing sleeps", async () => {
      const existingSleep: StoredSleepEntry = {
        id: "sleep-1",
        babyId: "baby-123",
        type: "nap",
        startedAt: "2024-01-17T09:00:00.000Z",
        durationSeconds: 3600,
        createdAt: "2024-01-17T09:00:00.000Z",
        updatedAt: "2024-01-17T10:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingSleep]));

      const input = {
        babyId: "baby-123",
        type: "nap" as const,
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        durationSeconds: 5400,
      };

      await SleepStorageService.addSleep(input);

      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedSleeps = JSON.parse(setItemCall[1]);
      expect(savedSleeps).toHaveLength(2);
    });
  });

  describe("updateSleep", () => {
    it("should return null when sleep not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await SleepStorageService.updateSleep(
        "baby-123",
        "sleep-999",
        { notes: "Updated" }
      );

      expect(result).toBeNull();
    });

    it("should update existing sleep", async () => {
      const existingSleep: StoredSleepEntry = {
        id: "sleep-1",
        babyId: "baby-123",
        type: "nap",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 5400,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T14:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingSleep]));

      const result = await SleepStorageService.updateSleep(
        "baby-123",
        "sleep-1",
        { notes: "Baby woke up happy" }
      );

      expect(result?.notes).toBe("Baby woke up happy");
      expect(result?.updatedAt).not.toBe(existingSleep.updatedAt);
    });

    it("should update end time and duration", async () => {
      const existingSleep: StoredSleepEntry = {
        id: "sleep-1",
        babyId: "baby-123",
        type: "nap",
        startedAt: "2024-01-17T13:00:00.000Z",
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingSleep]));

      const result = await SleepStorageService.updateSleep(
        "baby-123",
        "sleep-1",
        {
          endedAt: new Date("2024-01-17T14:30:00.000Z"),
          durationSeconds: 5400
        }
      );

      expect(result?.endedAt).toBe("2024-01-17T14:30:00.000Z");
      expect(result?.durationSeconds).toBe(5400);
    });

    it("updates the stored start time when a caregiver edits the interval", async () => {
      const existingSleep: StoredSleepEntry = {
        id: "sleep-1",
        babyId: "baby-123",
        type: "nap",
        startedAt: "2024-01-17T13:00:00.000Z",
        endedAt: "2024-01-17T14:30:00.000Z",
        durationSeconds: 5400,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T14:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingSleep]));

      const result = await SleepStorageService.updateSleep("baby-123", "sleep-1", {
        startedAt: new Date("2024-01-17T12:45:00.000Z"),
      });

      expect(result?.startedAt).toBe("2024-01-17T12:45:00.000Z");
    });
  });

  describe("deleteSleep", () => {
    it("should return false when sleep not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await SleepStorageService.deleteSleep("baby-123", "sleep-999");

      expect(result).toBe(false);
    });

    it("should delete existing sleep", async () => {
      const existingSleep: StoredSleepEntry = {
        id: "sleep-1",
        babyId: "baby-123",
        type: "nap",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 5400,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T14:30:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingSleep]));

      const result = await SleepStorageService.deleteSleep("baby-123", "sleep-1");

      expect(result).toBe(true);
      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedSleeps = JSON.parse(setItemCall[1]);
      expect(savedSleeps).toHaveLength(0);
    });
  });

  describe("getLastSleep", () => {
    it("should return null when no sleeps exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await SleepStorageService.getLastSleep("baby-123");

      expect(result).toBeNull();
    });

    it("should return the most recent sleep", async () => {
      const sleeps: StoredSleepEntry[] = [
        {
          id: "sleep-1",
          babyId: "baby-123",
          type: "nap",
          startedAt: "2024-01-17T09:00:00.000Z",
          durationSeconds: 3600,
          createdAt: "2024-01-17T09:00:00.000Z",
          updatedAt: "2024-01-17T10:00:00.000Z",
        },
        {
          id: "sleep-2",
          babyId: "baby-123",
          type: "nap",
          startedAt: "2024-01-17T13:00:00.000Z",
          durationSeconds: 5400,
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T14:30:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(sleeps));

      const result = await SleepStorageService.getLastSleep("baby-123");

      expect(result?.id).toBe("sleep-2");
    });
  });

  describe("getTodaysSleeps", () => {
    it("should return empty array when no sleeps exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await SleepStorageService.getTodaysSleeps("baby-123");

      expect(result).toEqual([]);
    });

    it("should return only today's sleeps", async () => {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      const todayStr = today.toISOString();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      const sleeps: StoredSleepEntry[] = [
        {
          id: "sleep-1",
          babyId: "baby-123",
          type: "nap",
          startedAt: yesterdayStr,
          durationSeconds: 3600,
          createdAt: yesterdayStr,
          updatedAt: yesterdayStr,
        },
        {
          id: "sleep-2",
          babyId: "baby-123",
          type: "nap",
          startedAt: todayStr,
          durationSeconds: 5400,
          createdAt: todayStr,
          updatedAt: todayStr,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(sleeps));

      const result = await SleepStorageService.getTodaysSleeps("baby-123");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("sleep-2");
    });
  });

  describe("wake-window continuation allowance", () => {
    it("defaults missing values to 25 minutes while preserving an existing caregiver value", async () => {
      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce(JSON.stringify({
          enabled: true,
          napCount: 2,
          slots: [],
          source: "custom",
        }))
        .mockResolvedValueOnce(JSON.stringify({
          enabled: true,
          napCount: 2,
          slots: [],
          source: "custom",
          napContinuationMinutes: 15,
        }));

      await expect(SleepStorageService.getWakeWindowConfig("baby-new")).resolves.toEqual(
        expect.objectContaining({ napContinuationMinutes: 25 })
      );
      await expect(SleepStorageService.getWakeWindowConfig("baby-existing")).resolves.toEqual(
        expect.objectContaining({ napContinuationMinutes: 15 })
      );
    });
  });

  describe("Active Timer Management", () => {
    describe("getActiveTimer", () => {
      it("should return null when no active timer exists", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

        const result = await SleepStorageService.getActiveTimer("baby-123");

        expect(result).toBeNull();
        expect(AsyncStorage.getItem).toHaveBeenCalledWith("@active_sleep_timer:baby-123");
      });

      it("should return active timer data when exists", async () => {
        const activeTimer = {
          startedAt: "2024-01-17T13:00:00.000Z",
          type: "nap",
        };
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(activeTimer));

        const result = await SleepStorageService.getActiveTimer("baby-123");

        expect(result).toEqual(activeTimer);
      });
    });

    describe("setActiveTimer", () => {
      it("should save active timer data for nap", async () => {
        const timerData = {
          startedAt: "2024-01-17T13:00:00.000Z",
          type: "nap" as const,
        };

        await SleepStorageService.setActiveTimer("baby-123", timerData);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@active_sleep_timer:baby-123",
          JSON.stringify(timerData)
        );
      });

      it("should save active timer data for night sleep", async () => {
        const timerData = {
          startedAt: "2024-01-17T20:00:00.000Z",
          type: "night" as const,
        };

        await SleepStorageService.setActiveTimer("baby-123", timerData);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@active_sleep_timer:baby-123",
          JSON.stringify(timerData)
        );
      });
    });

    describe("clearActiveTimer", () => {
      it("should remove active timer", async () => {
        await SleepStorageService.clearActiveTimer("baby-123");

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@active_sleep_timer:baby-123");
      });
    });
  });
});
