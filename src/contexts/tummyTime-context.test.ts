/**
 * TummyTimeContext reducer tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect } from "vitest";
import {
  tummyTimeReducer,
  initialTummyTimeState,
  TummyTimeState,
  TummyTimeAction,
} from "./tummyTime-context";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";

const mockTummyTime: StoredTummyTimeEntry = {
  id: "tt-1",
  babyId: "baby-123",
  startedAt: "2024-01-17T13:00:00.000Z",
  endedAt: "2024-01-17T13:10:00.000Z",
  durationSeconds: 600,
  createdAt: "2024-01-17T13:00:00.000Z",
  updatedAt: "2024-01-17T13:10:00.000Z",
};

describe("tummyTimeReducer", () => {
  describe("SET_TUMMY_TIMES", () => {
    it("should set tummy times array", () => {
      const tummyTimes = [mockTummyTime];
      const action: TummyTimeAction = { type: "SET_TUMMY_TIMES", payload: tummyTimes };

      const result = tummyTimeReducer(initialTummyTimeState, action);

      expect(result.tummyTimes).toEqual(tummyTimes);
    });

    it("should replace existing tummy times", () => {
      const state: TummyTimeState = {
        ...initialTummyTimeState,
        tummyTimes: [mockTummyTime],
      };
      const newTummyTimes: StoredTummyTimeEntry[] = [
        { ...mockTummyTime, id: "tt-2" },
        { ...mockTummyTime, id: "tt-3" },
      ];
      const action: TummyTimeAction = { type: "SET_TUMMY_TIMES", payload: newTummyTimes };

      const result = tummyTimeReducer(state, action);

      expect(result.tummyTimes).toHaveLength(2);
      expect(result.tummyTimes).toEqual(newTummyTimes);
    });
  });

  describe("ADD_TUMMY_TIME", () => {
    it("should add a new tummy time to the array", () => {
      const state: TummyTimeState = {
        ...initialTummyTimeState,
        tummyTimes: [],
      };
      const action: TummyTimeAction = { type: "ADD_TUMMY_TIME", payload: mockTummyTime };

      const result = tummyTimeReducer(state, action);

      expect(result.tummyTimes).toHaveLength(1);
      expect(result.tummyTimes[0]).toEqual(mockTummyTime);
    });

    it("should append to existing tummy times", () => {
      const existingTummyTime: StoredTummyTimeEntry = { ...mockTummyTime, id: "tt-existing" };
      const state: TummyTimeState = {
        ...initialTummyTimeState,
        tummyTimes: [existingTummyTime],
      };
      const action: TummyTimeAction = { type: "ADD_TUMMY_TIME", payload: mockTummyTime };

      const result = tummyTimeReducer(state, action);

      expect(result.tummyTimes).toHaveLength(2);
    });
  });

  describe("UPDATE_TUMMY_TIME", () => {
    it("should update an existing tummy time", () => {
      const state: TummyTimeState = {
        ...initialTummyTimeState,
        tummyTimes: [mockTummyTime],
      };
      const updatedTummyTime: StoredTummyTimeEntry = {
        ...mockTummyTime,
        notes: "Baby enjoyed it",
        updatedAt: "2024-01-17T13:15:00.000Z",
      };
      const action: TummyTimeAction = { type: "UPDATE_TUMMY_TIME", payload: updatedTummyTime };

      const result = tummyTimeReducer(state, action);

      expect(result.tummyTimes[0].notes).toBe("Baby enjoyed it");
    });

    it("should not modify array if tummy time not found", () => {
      const state: TummyTimeState = {
        ...initialTummyTimeState,
        tummyTimes: [mockTummyTime],
      };
      const nonExistentTummyTime: StoredTummyTimeEntry = {
        ...mockTummyTime,
        id: "tt-999",
      };
      const action: TummyTimeAction = { type: "UPDATE_TUMMY_TIME", payload: nonExistentTummyTime };

      const result = tummyTimeReducer(state, action);

      expect(result.tummyTimes).toEqual(state.tummyTimes);
    });
  });

  describe("DELETE_TUMMY_TIME", () => {
    it("should remove tummy time by id", () => {
      const state: TummyTimeState = {
        ...initialTummyTimeState,
        tummyTimes: [mockTummyTime],
      };
      const action: TummyTimeAction = { type: "DELETE_TUMMY_TIME", payload: "tt-1" };

      const result = tummyTimeReducer(state, action);

      expect(result.tummyTimes).toHaveLength(0);
    });

    it("should not modify array if tummy time not found", () => {
      const state: TummyTimeState = {
        ...initialTummyTimeState,
        tummyTimes: [mockTummyTime],
      };
      const action: TummyTimeAction = { type: "DELETE_TUMMY_TIME", payload: "tt-999" };

      const result = tummyTimeReducer(state, action);

      expect(result.tummyTimes).toHaveLength(1);
    });

    it("should remove only the specified tummy time", () => {
      const anotherTummyTime: StoredTummyTimeEntry = { ...mockTummyTime, id: "tt-2" };
      const state: TummyTimeState = {
        ...initialTummyTimeState,
        tummyTimes: [mockTummyTime, anotherTummyTime],
      };
      const action: TummyTimeAction = { type: "DELETE_TUMMY_TIME", payload: "tt-1" };

      const result = tummyTimeReducer(state, action);

      expect(result.tummyTimes).toHaveLength(1);
      expect(result.tummyTimes[0].id).toBe("tt-2");
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading state to true", () => {
      const action: TummyTimeAction = { type: "SET_LOADING", payload: true };

      const result = tummyTimeReducer(initialTummyTimeState, action);

      expect(result.isLoading).toBe(true);
    });

    it("should set loading state to false", () => {
      const state: TummyTimeState = { ...initialTummyTimeState, isLoading: true };
      const action: TummyTimeAction = { type: "SET_LOADING", payload: false };

      const result = tummyTimeReducer(state, action);

      expect(result.isLoading).toBe(false);
    });
  });

  describe("SET_DAILY_GOAL", () => {
    it("should set daily goal in seconds", () => {
      const action: TummyTimeAction = { type: "SET_DAILY_GOAL", payload: 2700 };

      const result = tummyTimeReducer(initialTummyTimeState, action);

      expect(result.dailyGoalSeconds).toBe(2700);
    });
  });

  describe("SET_GOAL_SOURCE", () => {
    it("should set goal source to age_based", () => {
      const action: TummyTimeAction = { type: "SET_GOAL_SOURCE", payload: "age_based" };

      const result = tummyTimeReducer(initialTummyTimeState, action);

      expect(result.goalSource).toBe("age_based");
    });

    it("should set goal source to custom", () => {
      const action: TummyTimeAction = { type: "SET_GOAL_SOURCE", payload: "custom" };

      const result = tummyTimeReducer(initialTummyTimeState, action);

      expect(result.goalSource).toBe("custom");
    });
  });

  describe("SET_AGE_GROUP", () => {
    it("should set current age group", () => {
      const ageGroup = {
        label: "1-2 months",
        minAgeDays: 29,
        maxAgeDays: 60,
        defaultGoalSeconds: 30 * 60,
        rationale: "WHO baseline",
      };
      const action: TummyTimeAction = { type: "SET_AGE_GROUP", payload: ageGroup };

      const result = tummyTimeReducer(initialTummyTimeState, action);

      expect(result.currentAgeGroup).toEqual(ageGroup);
    });

    it("should set age group to null", () => {
      const state: TummyTimeState = {
        ...initialTummyTimeState,
        currentAgeGroup: {
          label: "0-4 weeks",
          minAgeDays: 0,
          maxAgeDays: 28,
          defaultGoalSeconds: 15 * 60,
          rationale: "Realistic for newborns",
        },
      };
      const action: TummyTimeAction = { type: "SET_AGE_GROUP", payload: null };

      const result = tummyTimeReducer(state, action);

      expect(result.currentAgeGroup).toBeNull();
    });
  });

  describe("SET_SHOW_MILESTONE_SUGGESTION", () => {
    it("should set show milestone suggestion to true", () => {
      const action: TummyTimeAction = { type: "SET_SHOW_MILESTONE_SUGGESTION", payload: true };

      const result = tummyTimeReducer(initialTummyTimeState, action);

      expect(result.showMilestoneSuggestion).toBe(true);
    });

    it("should set show milestone suggestion to false", () => {
      const state: TummyTimeState = { ...initialTummyTimeState, showMilestoneSuggestion: true };
      const action: TummyTimeAction = { type: "SET_SHOW_MILESTONE_SUGGESTION", payload: false };

      const result = tummyTimeReducer(state, action);

      expect(result.showMilestoneSuggestion).toBe(false);
    });
  });

  describe("SET_SUGGESTED_GOAL", () => {
    it("should set suggested goal seconds", () => {
      const action: TummyTimeAction = { type: "SET_SUGGESTED_GOAL", payload: 2700 };

      const result = tummyTimeReducer(initialTummyTimeState, action);

      expect(result.suggestedGoalSeconds).toBe(2700);
    });

    it("should set suggested goal to null", () => {
      const state: TummyTimeState = { ...initialTummyTimeState, suggestedGoalSeconds: 2700 };
      const action: TummyTimeAction = { type: "SET_SUGGESTED_GOAL", payload: null };

      const result = tummyTimeReducer(state, action);

      expect(result.suggestedGoalSeconds).toBeNull();
    });
  });

  describe("Timer state management", () => {
    describe("START_TIMER", () => {
      it("should start timer", () => {
        const startTime = new Date("2024-01-17T13:00:00.000Z");
        const action: TummyTimeAction = {
          type: "START_TIMER",
          payload: { startTime },
        };

        const result = tummyTimeReducer(initialTummyTimeState, action);

        expect(result.activeTimer).toEqual({
          isRunning: true,
          startTime,
        });
      });
    });

    describe("STOP_TIMER", () => {
      it("should stop timer", () => {
        const state: TummyTimeState = {
          ...initialTummyTimeState,
          activeTimer: {
            isRunning: true,
            startTime: new Date("2024-01-17T13:00:00.000Z"),
          },
        };
        const action: TummyTimeAction = { type: "STOP_TIMER" };

        const result = tummyTimeReducer(state, action);

        expect(result.activeTimer).toBeNull();
      });

      it("should handle stopping when timer is already null", () => {
        const action: TummyTimeAction = { type: "STOP_TIMER" };

        const result = tummyTimeReducer(initialTummyTimeState, action);

        expect(result.activeTimer).toBeNull();
      });
    });
  });

  describe("default case", () => {
    it("should return current state for unknown action", () => {
      const unknownAction = { type: "UNKNOWN_ACTION" } as unknown as TummyTimeAction;

      const result = tummyTimeReducer(initialTummyTimeState, unknownAction);

      expect(result).toEqual(initialTummyTimeState);
    });
  });
});
