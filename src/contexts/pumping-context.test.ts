/**
 * PumpingContext reducer tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect } from "vitest";
import { pumpingReducer, initialPumpingState, PumpingState, PumpingAction } from "./pumping-context";
import type { StoredPumpingEntry } from "@/services/pumping-storage";

const mockPumping: StoredPumpingEntry = {
  id: "pumping-1",
  babyId: "baby-123",
  side: "left",
  startedAt: "2024-01-17T13:00:00.000Z",
  endedAt: "2024-01-17T13:30:00.000Z",
  durationSeconds: 1800,
  volumeMl: 120,
  createdAt: "2024-01-17T13:00:00.000Z",
  updatedAt: "2024-01-17T13:30:00.000Z",
};

describe("pumpingReducer", () => {
  describe("SET_PUMPINGS", () => {
    it("should set pumpings array", () => {
      const pumpings = [mockPumping];
      const action: PumpingAction = { type: "SET_PUMPINGS", payload: pumpings };

      const result = pumpingReducer(initialPumpingState, action);

      expect(result.pumpings).toEqual(pumpings);
    });

    it("should replace existing pumpings", () => {
      const state: PumpingState = {
        ...initialPumpingState,
        pumpings: [mockPumping],
      };
      const newPumpings: StoredPumpingEntry[] = [
        { ...mockPumping, id: "pumping-2" },
        { ...mockPumping, id: "pumping-3" },
      ];
      const action: PumpingAction = { type: "SET_PUMPINGS", payload: newPumpings };

      const result = pumpingReducer(state, action);

      expect(result.pumpings).toHaveLength(2);
      expect(result.pumpings).toEqual(newPumpings);
    });
  });

  describe("ADD_PUMPING", () => {
    it("should add a new pumping to the array", () => {
      const state: PumpingState = {
        ...initialPumpingState,
        pumpings: [],
      };
      const action: PumpingAction = { type: "ADD_PUMPING", payload: mockPumping };

      const result = pumpingReducer(state, action);

      expect(result.pumpings).toHaveLength(1);
      expect(result.pumpings[0]).toEqual(mockPumping);
    });

    it("should append to existing pumpings", () => {
      const existingPumping: StoredPumpingEntry = { ...mockPumping, id: "pumping-existing" };
      const state: PumpingState = {
        ...initialPumpingState,
        pumpings: [existingPumping],
      };
      const action: PumpingAction = { type: "ADD_PUMPING", payload: mockPumping };

      const result = pumpingReducer(state, action);

      expect(result.pumpings).toHaveLength(2);
    });
  });

  describe("UPDATE_PUMPING", () => {
    it("should update an existing pumping", () => {
      const state: PumpingState = {
        ...initialPumpingState,
        pumpings: [mockPumping],
      };
      const updatedPumping: StoredPumpingEntry = {
        ...mockPumping,
        volumeMl: 150,
        notes: "Great output today!",
        updatedAt: "2024-01-17T13:35:00.000Z",
      };
      const action: PumpingAction = { type: "UPDATE_PUMPING", payload: updatedPumping };

      const result = pumpingReducer(state, action);

      expect(result.pumpings[0].volumeMl).toBe(150);
      expect(result.pumpings[0].notes).toBe("Great output today!");
    });

    it("should not modify array if pumping not found", () => {
      const state: PumpingState = {
        ...initialPumpingState,
        pumpings: [mockPumping],
      };
      const nonExistentPumping: StoredPumpingEntry = {
        ...mockPumping,
        id: "pumping-999",
      };
      const action: PumpingAction = { type: "UPDATE_PUMPING", payload: nonExistentPumping };

      const result = pumpingReducer(state, action);

      expect(result.pumpings).toEqual(state.pumpings);
    });
  });

  describe("DELETE_PUMPING", () => {
    it("should remove pumping by id", () => {
      const state: PumpingState = {
        ...initialPumpingState,
        pumpings: [mockPumping],
      };
      const action: PumpingAction = { type: "DELETE_PUMPING", payload: "pumping-1" };

      const result = pumpingReducer(state, action);

      expect(result.pumpings).toHaveLength(0);
    });

    it("should not modify array if pumping not found", () => {
      const state: PumpingState = {
        ...initialPumpingState,
        pumpings: [mockPumping],
      };
      const action: PumpingAction = { type: "DELETE_PUMPING", payload: "pumping-999" };

      const result = pumpingReducer(state, action);

      expect(result.pumpings).toHaveLength(1);
    });

    it("should remove only the specified pumping", () => {
      const anotherPumping: StoredPumpingEntry = { ...mockPumping, id: "pumping-2" };
      const state: PumpingState = {
        ...initialPumpingState,
        pumpings: [mockPumping, anotherPumping],
      };
      const action: PumpingAction = { type: "DELETE_PUMPING", payload: "pumping-1" };

      const result = pumpingReducer(state, action);

      expect(result.pumpings).toHaveLength(1);
      expect(result.pumpings[0].id).toBe("pumping-2");
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading state to true", () => {
      const action: PumpingAction = { type: "SET_LOADING", payload: true };

      const result = pumpingReducer(initialPumpingState, action);

      expect(result.isLoading).toBe(true);
    });

    it("should set loading state to false", () => {
      const state: PumpingState = { ...initialPumpingState, isLoading: true };
      const action: PumpingAction = { type: "SET_LOADING", payload: false };

      const result = pumpingReducer(state, action);

      expect(result.isLoading).toBe(false);
    });
  });

  describe("Timer state management", () => {
    describe("START_TIMER", () => {
      it("should start timer for left side", () => {
        const startTime = new Date("2024-01-17T13:00:00.000Z");
        const action: PumpingAction = {
          type: "START_TIMER",
          payload: { startTime, side: "left" },
        };

        const result = pumpingReducer(initialPumpingState, action);

        expect(result.activeTimer).toEqual({
          isRunning: true,
          startTime,
          side: "left",
        });
      });

      it("should start timer for right side", () => {
        const startTime = new Date("2024-01-17T13:00:00.000Z");
        const action: PumpingAction = {
          type: "START_TIMER",
          payload: { startTime, side: "right" },
        };

        const result = pumpingReducer(initialPumpingState, action);

        expect(result.activeTimer).toEqual({
          isRunning: true,
          startTime,
          side: "right",
        });
      });

      it("should start timer for both sides", () => {
        const startTime = new Date("2024-01-17T13:00:00.000Z");
        const action: PumpingAction = {
          type: "START_TIMER",
          payload: { startTime, side: "both" },
        };

        const result = pumpingReducer(initialPumpingState, action);

        expect(result.activeTimer).toEqual({
          isRunning: true,
          startTime,
          side: "both",
        });
      });
    });

    describe("STOP_TIMER", () => {
      it("should stop timer", () => {
        const state: PumpingState = {
          ...initialPumpingState,
          activeTimer: {
            isRunning: true,
            startTime: new Date("2024-01-17T13:00:00.000Z"),
            side: "left",
          },
        };
        const action: PumpingAction = { type: "STOP_TIMER" };

        const result = pumpingReducer(state, action);

        expect(result.activeTimer).toBeNull();
      });

      it("should handle stopping when timer is already null", () => {
        const action: PumpingAction = { type: "STOP_TIMER" };

        const result = pumpingReducer(initialPumpingState, action);

        expect(result.activeTimer).toBeNull();
      });
    });

    describe("UPDATE_TIMER_SIDE", () => {
      it("should update side when timer is running", () => {
        const state: PumpingState = {
          ...initialPumpingState,
          activeTimer: {
            isRunning: true,
            startTime: new Date("2024-01-17T13:00:00.000Z"),
            side: "left",
          },
        };
        const action: PumpingAction = { type: "UPDATE_TIMER_SIDE", payload: "both" };

        const result = pumpingReducer(state, action);

        expect(result.activeTimer?.side).toBe("both");
      });

      it("should not update if timer is not running", () => {
        const action: PumpingAction = { type: "UPDATE_TIMER_SIDE", payload: "right" };

        const result = pumpingReducer(initialPumpingState, action);

        expect(result.activeTimer).toBeNull();
      });
    });
  });

  describe("default case", () => {
    it("should return current state for unknown action", () => {
      const unknownAction = { type: "UNKNOWN_ACTION" } as unknown as PumpingAction;

      const result = pumpingReducer(initialPumpingState, unknownAction);

      expect(result).toEqual(initialPumpingState);
    });
  });
});
