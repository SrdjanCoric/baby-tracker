/**
 * TummyTimeStorageService tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TummyTimeStorageService, StoredTummyTimeEntry } from "./tummyTime-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("TummyTimeStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllTummyTimes", () => {
    it("should return empty array when no tummy times exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await TummyTimeStorageService.getAllTummyTimes("baby-123");

      expect(result).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@tummyTimes:baby-123");
    });

    it("should return stored tummy times for a baby", async () => {
      const mockTummyTimes: StoredTummyTimeEntry[] = [
        {
          id: "tt-1",
          babyId: "baby-123",
          startedAt: "2024-01-17T13:00:00.000Z",
          endedAt: "2024-01-17T13:15:00.000Z",
          durationSeconds: 900,
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T13:15:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(mockTummyTimes));

      const result = await TummyTimeStorageService.getAllTummyTimes("baby-123");

      expect(result).toEqual(mockTummyTimes);
    });
  });

  describe("getTummyTimeById", () => {
    it("should return null when tummy time not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await TummyTimeStorageService.getTummyTimeById("baby-123", "tt-999");

      expect(result).toBeNull();
    });

    it("should return tummy time when found", async () => {
      const mockTummyTime: StoredTummyTimeEntry = {
        id: "tt-1",
        babyId: "baby-123",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 900,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:15:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([mockTummyTime]));

      const result = await TummyTimeStorageService.getTummyTimeById("baby-123", "tt-1");

      expect(result).toEqual(mockTummyTime);
    });
  });

  describe("addTummyTime", () => {
    it("should add a new tummy time entry", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        endedAt: new Date("2024-01-17T13:10:00.000Z"),
        durationSeconds: 600,
      };

      const result = await TummyTimeStorageService.addTummyTime(input);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^tummyTime-/);
      expect(result.babyId).toBe("baby-123");
      expect(result.durationSeconds).toBe(600);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should add tummy time entry with notes", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const input = {
        babyId: "baby-123",
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        durationSeconds: 300,
        notes: "Baby enjoyed playing on mat",
      };

      const result = await TummyTimeStorageService.addTummyTime(input);

      expect(result.notes).toBe("Baby enjoyed playing on mat");
    });

    it("should append to existing tummy times", async () => {
      const existingEntry: StoredTummyTimeEntry = {
        id: "tt-1",
        babyId: "baby-123",
        startedAt: "2024-01-17T09:00:00.000Z",
        durationSeconds: 300,
        createdAt: "2024-01-17T09:00:00.000Z",
        updatedAt: "2024-01-17T09:05:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingEntry]));

      const input = {
        babyId: "baby-123",
        startedAt: new Date("2024-01-17T13:00:00.000Z"),
        durationSeconds: 600,
      };

      await TummyTimeStorageService.addTummyTime(input);

      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedTummyTimes = JSON.parse(setItemCall[1]);
      expect(savedTummyTimes).toHaveLength(2);
    });
  });

  describe("updateTummyTime", () => {
    it("should return null when tummy time not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await TummyTimeStorageService.updateTummyTime(
        "baby-123",
        "tt-999",
        { notes: "Updated" }
      );

      expect(result).toBeNull();
    });

    it("should update existing tummy time", async () => {
      const existingEntry: StoredTummyTimeEntry = {
        id: "tt-1",
        babyId: "baby-123",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 600,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:10:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingEntry]));

      const result = await TummyTimeStorageService.updateTummyTime(
        "baby-123",
        "tt-1",
        { notes: "Baby was happy" }
      );

      expect(result?.notes).toBe("Baby was happy");
      expect(result?.updatedAt).not.toBe(existingEntry.updatedAt);
    });

    it("should update end time and duration", async () => {
      const existingEntry: StoredTummyTimeEntry = {
        id: "tt-1",
        babyId: "baby-123",
        startedAt: "2024-01-17T13:00:00.000Z",
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:00:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingEntry]));

      const result = await TummyTimeStorageService.updateTummyTime(
        "baby-123",
        "tt-1",
        {
          endedAt: new Date("2024-01-17T13:10:00.000Z"),
          durationSeconds: 600
        }
      );

      expect(result?.endedAt).toBe("2024-01-17T13:10:00.000Z");
      expect(result?.durationSeconds).toBe(600);
    });
  });

  describe("deleteTummyTime", () => {
    it("should return false when tummy time not found", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await TummyTimeStorageService.deleteTummyTime("baby-123", "tt-999");

      expect(result).toBe(false);
    });

    it("should delete existing tummy time", async () => {
      const existingEntry: StoredTummyTimeEntry = {
        id: "tt-1",
        babyId: "baby-123",
        startedAt: "2024-01-17T13:00:00.000Z",
        durationSeconds: 600,
        createdAt: "2024-01-17T13:00:00.000Z",
        updatedAt: "2024-01-17T13:10:00.000Z",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([existingEntry]));

      const result = await TummyTimeStorageService.deleteTummyTime("baby-123", "tt-1");

      expect(result).toBe(true);
      const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedTummyTimes = JSON.parse(setItemCall[1]);
      expect(savedTummyTimes).toHaveLength(0);
    });
  });

  describe("getLastTummyTime", () => {
    it("should return null when no tummy times exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await TummyTimeStorageService.getLastTummyTime("baby-123");

      expect(result).toBeNull();
    });

    it("should return the most recent tummy time", async () => {
      const tummyTimes: StoredTummyTimeEntry[] = [
        {
          id: "tt-1",
          babyId: "baby-123",
          startedAt: "2024-01-17T09:00:00.000Z",
          durationSeconds: 300,
          createdAt: "2024-01-17T09:00:00.000Z",
          updatedAt: "2024-01-17T09:05:00.000Z",
        },
        {
          id: "tt-2",
          babyId: "baby-123",
          startedAt: "2024-01-17T13:00:00.000Z",
          durationSeconds: 600,
          createdAt: "2024-01-17T13:00:00.000Z",
          updatedAt: "2024-01-17T13:10:00.000Z",
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(tummyTimes));

      const result = await TummyTimeStorageService.getLastTummyTime("baby-123");

      expect(result?.id).toBe("tt-2");
    });
  });

  describe("getTodaysTummyTimes", () => {
    it("should return empty array when no tummy times exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await TummyTimeStorageService.getTodaysTummyTimes("baby-123");

      expect(result).toEqual([]);
    });

    it("should return only today's tummy times", async () => {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      const todayStr = today.toISOString();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      const tummyTimes: StoredTummyTimeEntry[] = [
        {
          id: "tt-1",
          babyId: "baby-123",
          startedAt: yesterdayStr,
          durationSeconds: 300,
          createdAt: yesterdayStr,
          updatedAt: yesterdayStr,
        },
        {
          id: "tt-2",
          babyId: "baby-123",
          startedAt: todayStr,
          durationSeconds: 600,
          createdAt: todayStr,
          updatedAt: todayStr,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(tummyTimes));

      const result = await TummyTimeStorageService.getTodaysTummyTimes("baby-123");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("tt-2");
    });
  });

  describe("Active Timer Management", () => {
    describe("getActiveTimer", () => {
      it("should return null when no active timer exists", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

        const result = await TummyTimeStorageService.getActiveTimer("baby-123");

        expect(result).toBeNull();
        expect(AsyncStorage.getItem).toHaveBeenCalledWith("@active_tummyTime_timer:baby-123");
      });

      it("should return active timer data when exists", async () => {
        const activeTimer = {
          startedAt: "2024-01-17T13:00:00.000Z",
        };
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(activeTimer));

        const result = await TummyTimeStorageService.getActiveTimer("baby-123");

        expect(result).toEqual(activeTimer);
      });
    });

    describe("setActiveTimer", () => {
      it("should save active timer data", async () => {
        const timerData = {
          startedAt: "2024-01-17T13:00:00.000Z",
        };

        await TummyTimeStorageService.setActiveTimer("baby-123", timerData);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@active_tummyTime_timer:baby-123",
          JSON.stringify(timerData)
        );
      });
    });

    describe("clearActiveTimer", () => {
      it("should remove active timer", async () => {
        await TummyTimeStorageService.clearActiveTimer("baby-123");

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@active_tummyTime_timer:baby-123");
      });
    });
  });

  describe("Daily Goal Management", () => {
    describe("getDailyGoal", () => {
      it("should return default goal when not set", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

        const result = await TummyTimeStorageService.getDailyGoal("baby-123");

        expect(result).toBe(1800);
        expect(AsyncStorage.getItem).toHaveBeenCalledWith("@tummyTime_goal:baby-123");
      });

      it("should return saved goal when exists", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue("3600");

        const result = await TummyTimeStorageService.getDailyGoal("baby-123");

        expect(result).toBe(3600);
      });
    });

    describe("setDailyGoal", () => {
      it("should save daily goal", async () => {
        await TummyTimeStorageService.setDailyGoal("baby-123", 2700);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@tummyTime_goal:baby-123",
          "2700"
        );
      });
    });

    describe("hasCustomGoal", () => {
      it("should return false when no custom goal exists", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

        const result = await TummyTimeStorageService.hasCustomGoal("baby-123");

        expect(result).toBe(false);
        expect(AsyncStorage.getItem).toHaveBeenCalledWith("@tummyTime_custom_goal:baby-123");
      });

      it("should return true when custom goal exists", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue("true");

        const result = await TummyTimeStorageService.hasCustomGoal("baby-123");

        expect(result).toBe(true);
      });
    });

    describe("setCustomGoal", () => {
      it("should save custom goal and mark as custom", async () => {
        await TummyTimeStorageService.setCustomGoal("baby-123", 2700);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@tummyTime_goal:baby-123",
          "2700"
        );
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@tummyTime_custom_goal:baby-123",
          "true"
        );
      });
    });

    describe("clearCustomGoal", () => {
      it("should remove custom goal marker", async () => {
        await TummyTimeStorageService.clearCustomGoal("baby-123");

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@tummyTime_custom_goal:baby-123");
      });
    });
  });

  describe("Milestone Suggestion Tracking", () => {
    describe("getLastMilestoneCheckDate", () => {
      it("should return null when not set", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

        const result = await TummyTimeStorageService.getLastMilestoneCheckDate("baby-123");

        expect(result).toBeNull();
        expect(AsyncStorage.getItem).toHaveBeenCalledWith("@tummyTime_milestone_check:baby-123");
      });

      it("should return saved date when exists", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue("2024-01-17T13:00:00.000Z");

        const result = await TummyTimeStorageService.getLastMilestoneCheckDate("baby-123");

        expect(result).toEqual(new Date("2024-01-17T13:00:00.000Z"));
      });
    });

    describe("setLastMilestoneCheckDate", () => {
      it("should save milestone check date", async () => {
        const date = new Date("2024-01-17T13:00:00.000Z");
        await TummyTimeStorageService.setLastMilestoneCheckDate("baby-123", date);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@tummyTime_milestone_check:baby-123",
          "2024-01-17T13:00:00.000Z"
        );
      });
    });

    describe("getDismissedMilestones", () => {
      it("should return empty array when not set", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

        const result = await TummyTimeStorageService.getDismissedMilestones("baby-123");

        expect(result).toEqual([]);
        expect(AsyncStorage.getItem).toHaveBeenCalledWith("@tummyTime_dismissed_milestones:baby-123");
      });

      it("should return saved dismissed milestones", async () => {
        const dismissed = ["1-2 months", "2-3 months"];
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(dismissed));

        const result = await TummyTimeStorageService.getDismissedMilestones("baby-123");

        expect(result).toEqual(dismissed);
      });
    });

    describe("dismissMilestone", () => {
      it("should add milestone to dismissed list", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

        await TummyTimeStorageService.dismissMilestone("baby-123", "1-2 months");

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "@tummyTime_dismissed_milestones:baby-123",
          JSON.stringify(["1-2 months"])
        );
      });

      it("should not duplicate dismissed milestones", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(["1-2 months"]));

        await TummyTimeStorageService.dismissMilestone("baby-123", "1-2 months");

        const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
        const saved = JSON.parse(setItemCall[1]);
        expect(saved).toEqual(["1-2 months"]);
      });

      it("should append to existing dismissed milestones", async () => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(["1-2 months"]));

        await TummyTimeStorageService.dismissMilestone("baby-123", "2-3 months");

        const setItemCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
        const saved = JSON.parse(setItemCall[1]);
        expect(saved).toEqual(["1-2 months", "2-3 months"]);
      });
    });
  });
});
