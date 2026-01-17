/**
 * FeedingContext reducer tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect } from "vitest";
import { feedingReducer, initialFeedingState, FeedingState, FeedingAction } from "./feeding-context";
import type { StoredFeedingEntry } from "@/services/feeding-storage";

const mockFeeding: StoredFeedingEntry = {
  id: "feeding-1",
  babyId: "baby-123",
  type: "breast",
  side: "left",
  startedAt: "2024-01-17T10:00:00.000Z",
  endedAt: "2024-01-17T10:15:00.000Z",
  durationSeconds: 900,
  createdAt: "2024-01-17T10:00:00.000Z",
  updatedAt: "2024-01-17T10:15:00.000Z",
};

describe("feedingReducer", () => {
  describe("SET_FEEDINGS", () => {
    it("should set feedings array", () => {
      const feedings = [mockFeeding];
      const action: FeedingAction = { type: "SET_FEEDINGS", payload: feedings };

      const result = feedingReducer(initialFeedingState, action);

      expect(result.feedings).toEqual(feedings);
    });
  });

  describe("ADD_FEEDING", () => {
    it("should add a new feeding to the array", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        feedings: [],
      };
      const action: FeedingAction = { type: "ADD_FEEDING", payload: mockFeeding };

      const result = feedingReducer(state, action);

      expect(result.feedings).toHaveLength(1);
      expect(result.feedings[0]).toEqual(mockFeeding);
    });

    it("should update lastBreastSide when adding breast feeding", () => {
      const action: FeedingAction = { type: "ADD_FEEDING", payload: mockFeeding };

      const result = feedingReducer(initialFeedingState, action);

      expect(result.lastBreastSide).toBe("left");
    });

    it("should not update lastBreastSide when adding bottle feeding", () => {
      const bottleFeeding: StoredFeedingEntry = {
        ...mockFeeding,
        type: "bottle",
        side: undefined,
      };
      const action: FeedingAction = { type: "ADD_FEEDING", payload: bottleFeeding };
      const state: FeedingState = { ...initialFeedingState, lastBreastSide: "right" };

      const result = feedingReducer(state, action);

      expect(result.lastBreastSide).toBe("right");
    });
  });

  describe("UPDATE_FEEDING", () => {
    it("should update an existing feeding", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        feedings: [mockFeeding],
      };
      const updatedFeeding: StoredFeedingEntry = {
        ...mockFeeding,
        notes: "Baby was hungry",
        updatedAt: "2024-01-17T10:20:00.000Z",
      };
      const action: FeedingAction = { type: "UPDATE_FEEDING", payload: updatedFeeding };

      const result = feedingReducer(state, action);

      expect(result.feedings[0].notes).toBe("Baby was hungry");
    });

    it("should not modify array if feeding not found", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        feedings: [mockFeeding],
      };
      const nonExistentFeeding: StoredFeedingEntry = {
        ...mockFeeding,
        id: "feeding-999",
      };
      const action: FeedingAction = { type: "UPDATE_FEEDING", payload: nonExistentFeeding };

      const result = feedingReducer(state, action);

      expect(result.feedings).toEqual(state.feedings);
    });
  });

  describe("DELETE_FEEDING", () => {
    it("should remove feeding by id", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        feedings: [mockFeeding],
      };
      const action: FeedingAction = { type: "DELETE_FEEDING", payload: "feeding-1" };

      const result = feedingReducer(state, action);

      expect(result.feedings).toHaveLength(0);
    });

    it("should not modify array if feeding not found", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        feedings: [mockFeeding],
      };
      const action: FeedingAction = { type: "DELETE_FEEDING", payload: "feeding-999" };

      const result = feedingReducer(state, action);

      expect(result.feedings).toHaveLength(1);
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading state to true", () => {
      const action: FeedingAction = { type: "SET_LOADING", payload: true };

      const result = feedingReducer(initialFeedingState, action);

      expect(result.isLoading).toBe(true);
    });

    it("should set loading state to false", () => {
      const state: FeedingState = { ...initialFeedingState, isLoading: true };
      const action: FeedingAction = { type: "SET_LOADING", payload: false };

      const result = feedingReducer(state, action);

      expect(result.isLoading).toBe(false);
    });
  });

  describe("SET_LAST_BREAST_SIDE", () => {
    it("should set last breast side", () => {
      const action: FeedingAction = { type: "SET_LAST_BREAST_SIDE", payload: "right" };

      const result = feedingReducer(initialFeedingState, action);

      expect(result.lastBreastSide).toBe("right");
    });

    it("should handle null value", () => {
      const state: FeedingState = { ...initialFeedingState, lastBreastSide: "left" };
      const action: FeedingAction = { type: "SET_LAST_BREAST_SIDE", payload: null };

      const result = feedingReducer(state, action);

      expect(result.lastBreastSide).toBeNull();
    });
  });

  describe("Timer state management", () => {
    describe("START_TIMER", () => {
      it("should start timer with side", () => {
        const startTime = new Date("2024-01-17T10:00:00.000Z");
        const action: FeedingAction = {
          type: "START_TIMER",
          payload: { startTime, side: "left" },
        };

        const result = feedingReducer(initialFeedingState, action);

        expect(result.activeTimer).toEqual({
          isRunning: true,
          startTime,
          side: "left",
        });
      });

      it("should start timer without side", () => {
        const startTime = new Date("2024-01-17T10:00:00.000Z");
        const action: FeedingAction = {
          type: "START_TIMER",
          payload: { startTime },
        };

        const result = feedingReducer(initialFeedingState, action);

        expect(result.activeTimer).toEqual({
          isRunning: true,
          startTime,
          side: undefined,
        });
      });
    });

    describe("STOP_TIMER", () => {
      it("should stop timer", () => {
        const state: FeedingState = {
          ...initialFeedingState,
          activeTimer: {
            isRunning: true,
            startTime: new Date("2024-01-17T10:00:00.000Z"),
            side: "left",
          },
        };
        const action: FeedingAction = { type: "STOP_TIMER" };

        const result = feedingReducer(state, action);

        expect(result.activeTimer).toBeNull();
      });
    });

    describe("UPDATE_TIMER_SIDE", () => {
      it("should update timer side when timer is running", () => {
        const state: FeedingState = {
          ...initialFeedingState,
          activeTimer: {
            isRunning: true,
            startTime: new Date("2024-01-17T10:00:00.000Z"),
            side: "left",
          },
        };
        const action: FeedingAction = { type: "UPDATE_TIMER_SIDE", payload: "right" };

        const result = feedingReducer(state, action);

        expect(result.activeTimer?.side).toBe("right");
      });

      it("should not update if timer is not running", () => {
        const action: FeedingAction = { type: "UPDATE_TIMER_SIDE", payload: "right" };

        const result = feedingReducer(initialFeedingState, action);

        expect(result.activeTimer).toBeNull();
      });
    });
  });

  describe("default case", () => {
    it("should return current state for unknown action", () => {
      const unknownAction = { type: "UNKNOWN_ACTION" } as unknown as FeedingAction;

      const result = feedingReducer(initialFeedingState, unknownAction);

      expect(result).toEqual(initialFeedingState);
    });
  });
});
