/**
 * SleepContext reducer tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect } from "vitest";
import { sleepReducer, initialSleepState, SleepState, SleepAction } from "./sleep-context";
import type { StoredSleepEntry } from "@/services/sleep-storage";

const mockSleep: StoredSleepEntry = {
  id: "sleep-1",
  babyId: "baby-123",
  type: "nap",
  startedAt: "2024-01-17T13:00:00.000Z",
  endedAt: "2024-01-17T14:30:00.000Z",
  durationSeconds: 5400,
  createdAt: "2024-01-17T13:00:00.000Z",
  updatedAt: "2024-01-17T14:30:00.000Z",
};

describe("sleepReducer", () => {
  describe("SET_SLEEPS", () => {
    it("should set sleeps array", () => {
      const sleeps = [mockSleep];
      const action: SleepAction = { type: "SET_SLEEPS", payload: sleeps };

      const result = sleepReducer(initialSleepState, action);

      expect(result.sleeps).toEqual(sleeps);
    });

    it("should replace existing sleeps", () => {
      const state: SleepState = {
        ...initialSleepState,
        sleeps: [mockSleep],
      };
      const newSleeps: StoredSleepEntry[] = [
        { ...mockSleep, id: "sleep-2" },
        { ...mockSleep, id: "sleep-3" },
      ];
      const action: SleepAction = { type: "SET_SLEEPS", payload: newSleeps };

      const result = sleepReducer(state, action);

      expect(result.sleeps).toHaveLength(2);
      expect(result.sleeps).toEqual(newSleeps);
    });
  });

  describe("ADD_SLEEP", () => {
    it("should add a new sleep to the array", () => {
      const state: SleepState = {
        ...initialSleepState,
        sleeps: [],
      };
      const action: SleepAction = { type: "ADD_SLEEP", payload: mockSleep };

      const result = sleepReducer(state, action);

      expect(result.sleeps).toHaveLength(1);
      expect(result.sleeps[0]).toEqual(mockSleep);
    });

    it("should append to existing sleeps", () => {
      const existingSleep: StoredSleepEntry = { ...mockSleep, id: "sleep-existing" };
      const state: SleepState = {
        ...initialSleepState,
        sleeps: [existingSleep],
      };
      const action: SleepAction = { type: "ADD_SLEEP", payload: mockSleep };

      const result = sleepReducer(state, action);

      expect(result.sleeps).toHaveLength(2);
    });
  });

  describe("UPDATE_SLEEP", () => {
    it("should update an existing sleep", () => {
      const state: SleepState = {
        ...initialSleepState,
        sleeps: [mockSleep],
      };
      const updatedSleep: StoredSleepEntry = {
        ...mockSleep,
        notes: "Baby woke up happy",
        updatedAt: "2024-01-17T14:35:00.000Z",
      };
      const action: SleepAction = { type: "UPDATE_SLEEP", payload: updatedSleep };

      const result = sleepReducer(state, action);

      expect(result.sleeps[0].notes).toBe("Baby woke up happy");
    });

    it("should not modify array if sleep not found", () => {
      const state: SleepState = {
        ...initialSleepState,
        sleeps: [mockSleep],
      };
      const nonExistentSleep: StoredSleepEntry = {
        ...mockSleep,
        id: "sleep-999",
      };
      const action: SleepAction = { type: "UPDATE_SLEEP", payload: nonExistentSleep };

      const result = sleepReducer(state, action);

      expect(result.sleeps).toEqual(state.sleeps);
    });
  });

  describe("DELETE_SLEEP", () => {
    it("should remove sleep by id", () => {
      const state: SleepState = {
        ...initialSleepState,
        sleeps: [mockSleep],
      };
      const action: SleepAction = { type: "DELETE_SLEEP", payload: "sleep-1" };

      const result = sleepReducer(state, action);

      expect(result.sleeps).toHaveLength(0);
    });

    it("should not modify array if sleep not found", () => {
      const state: SleepState = {
        ...initialSleepState,
        sleeps: [mockSleep],
      };
      const action: SleepAction = { type: "DELETE_SLEEP", payload: "sleep-999" };

      const result = sleepReducer(state, action);

      expect(result.sleeps).toHaveLength(1);
    });

    it("should remove only the specified sleep", () => {
      const anotherSleep: StoredSleepEntry = { ...mockSleep, id: "sleep-2" };
      const state: SleepState = {
        ...initialSleepState,
        sleeps: [mockSleep, anotherSleep],
      };
      const action: SleepAction = { type: "DELETE_SLEEP", payload: "sleep-1" };

      const result = sleepReducer(state, action);

      expect(result.sleeps).toHaveLength(1);
      expect(result.sleeps[0].id).toBe("sleep-2");
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading state to true", () => {
      const action: SleepAction = { type: "SET_LOADING", payload: true };

      const result = sleepReducer(initialSleepState, action);

      expect(result.isLoading).toBe(true);
    });

    it("should set loading state to false", () => {
      const state: SleepState = { ...initialSleepState, isLoading: true };
      const action: SleepAction = { type: "SET_LOADING", payload: false };

      const result = sleepReducer(state, action);

      expect(result.isLoading).toBe(false);
    });
  });

  describe("Timer state management", () => {
    describe("START_TIMER", () => {
      it("should start timer for nap", () => {
        const startTime = new Date("2024-01-17T13:00:00.000Z");
        const action: SleepAction = {
          type: "START_TIMER",
          payload: { startTime, sleepType: "nap" },
        };

        const result = sleepReducer(initialSleepState, action);

        expect(result.activeTimer).toEqual({
          isRunning: true,
          startTime,
          sleepType: "nap",
        });
      });

      it("should start timer for night sleep", () => {
        const startTime = new Date("2024-01-17T20:00:00.000Z");
        const action: SleepAction = {
          type: "START_TIMER",
          payload: { startTime, sleepType: "night" },
        };

        const result = sleepReducer(initialSleepState, action);

        expect(result.activeTimer).toEqual({
          isRunning: true,
          startTime,
          sleepType: "night",
        });
      });
    });

    describe("STOP_TIMER", () => {
      it("should stop timer", () => {
        const state: SleepState = {
          ...initialSleepState,
          activeTimer: {
            isRunning: true,
            startTime: new Date("2024-01-17T13:00:00.000Z"),
            sleepType: "nap",
          },
        };
        const action: SleepAction = { type: "STOP_TIMER" };

        const result = sleepReducer(state, action);

        expect(result.activeTimer).toBeNull();
      });

      it("should handle stopping when timer is already null", () => {
        const action: SleepAction = { type: "STOP_TIMER" };

        const result = sleepReducer(initialSleepState, action);

        expect(result.activeTimer).toBeNull();
      });
    });

    describe("UPDATE_TIMER_TYPE", () => {
      it("should update sleep type when timer is running", () => {
        const state: SleepState = {
          ...initialSleepState,
          activeTimer: {
            isRunning: true,
            startTime: new Date("2024-01-17T13:00:00.000Z"),
            sleepType: "nap",
          },
        };
        const action: SleepAction = { type: "UPDATE_TIMER_TYPE", payload: "night" };

        const result = sleepReducer(state, action);

        expect(result.activeTimer?.sleepType).toBe("night");
      });

      it("should not update if timer is not running", () => {
        const action: SleepAction = { type: "UPDATE_TIMER_TYPE", payload: "night" };

        const result = sleepReducer(initialSleepState, action);

        expect(result.activeTimer).toBeNull();
      });
    });
  });

  describe("default case", () => {
    it("should return current state for unknown action", () => {
      const unknownAction = { type: "UNKNOWN_ACTION" } as unknown as SleepAction;

      const result = sleepReducer(initialSleepState, unknownAction);

      expect(result).toEqual(initialSleepState);
    });
  });
});
