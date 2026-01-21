/**
 * GrowthContext reducer tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("./sync-context", () => ({
  useSync: () => ({ status: "online", pendingCount: 0 }),
}));

vi.mock("./auth-context", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/services/sync", () => ({}));

import { growthReducer, initialGrowthState, GrowthState, GrowthAction } from "./growth-context";
import type { StoredGrowthEntry } from "@/services/growth-storage";

const mockMeasurement: StoredGrowthEntry = {
  id: "growth-1",
  babyId: "baby-123",
  measuredAt: "2024-01-17T13:00:00.000Z",
  weightKg: 5.5,
  heightCm: 55,
  headCircumferenceCm: 38,
  createdAt: "2024-01-17T13:00:00.000Z",
  updatedAt: "2024-01-17T13:00:00.000Z",
};

const mockWeightOnlyMeasurement: StoredGrowthEntry = {
  id: "growth-2",
  babyId: "baby-123",
  measuredAt: "2024-01-20T10:00:00.000Z",
  weightKg: 5.7,
  createdAt: "2024-01-20T10:00:00.000Z",
  updatedAt: "2024-01-20T10:00:00.000Z",
};

describe("growthReducer", () => {
  describe("SET_MEASUREMENTS", () => {
    it("should set measurements array", () => {
      const measurements = [mockMeasurement];
      const action: GrowthAction = { type: "SET_MEASUREMENTS", payload: measurements };

      const result = growthReducer(initialGrowthState, action);

      expect(result.measurements).toEqual(measurements);
    });

    it("should replace existing measurements", () => {
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [mockMeasurement],
      };
      const newMeasurements: StoredGrowthEntry[] = [
        { ...mockMeasurement, id: "growth-2" },
        { ...mockMeasurement, id: "growth-3" },
      ];
      const action: GrowthAction = { type: "SET_MEASUREMENTS", payload: newMeasurements };

      const result = growthReducer(state, action);

      expect(result.measurements).toHaveLength(2);
      expect(result.measurements).toEqual(newMeasurements);
    });
  });

  describe("ADD_MEASUREMENT", () => {
    it("should add a new measurement to the array", () => {
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [],
      };
      const action: GrowthAction = { type: "ADD_MEASUREMENT", payload: mockMeasurement };

      const result = growthReducer(state, action);

      expect(result.measurements).toHaveLength(1);
      expect(result.measurements[0]).toEqual(mockMeasurement);
    });

    it("should add a weight-only measurement", () => {
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [],
      };
      const action: GrowthAction = { type: "ADD_MEASUREMENT", payload: mockWeightOnlyMeasurement };

      const result = growthReducer(state, action);

      expect(result.measurements).toHaveLength(1);
      expect(result.measurements[0].weightKg).toBe(5.7);
      expect(result.measurements[0].heightCm).toBeUndefined();
    });

    it("should append to existing measurements", () => {
      const existingMeasurement: StoredGrowthEntry = { ...mockMeasurement, id: "growth-existing" };
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [existingMeasurement],
      };
      const action: GrowthAction = { type: "ADD_MEASUREMENT", payload: mockWeightOnlyMeasurement };

      const result = growthReducer(state, action);

      expect(result.measurements).toHaveLength(2);
    });
  });

  describe("UPDATE_MEASUREMENT", () => {
    it("should update an existing measurement", () => {
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [mockMeasurement],
      };
      const updatedMeasurement: StoredGrowthEntry = {
        ...mockMeasurement,
        notes: "Doctor's visit",
        updatedAt: "2024-01-17T14:35:00.000Z",
      };
      const action: GrowthAction = { type: "UPDATE_MEASUREMENT", payload: updatedMeasurement };

      const result = growthReducer(state, action);

      expect(result.measurements[0].notes).toBe("Doctor's visit");
    });

    it("should update weight on an existing measurement", () => {
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [mockMeasurement],
      };
      const updatedMeasurement: StoredGrowthEntry = {
        ...mockMeasurement,
        weightKg: 5.8,
        updatedAt: "2024-01-17T15:00:00.000Z",
      };
      const action: GrowthAction = { type: "UPDATE_MEASUREMENT", payload: updatedMeasurement };

      const result = growthReducer(state, action);

      expect(result.measurements[0].weightKg).toBe(5.8);
    });

    it("should not modify array if measurement not found", () => {
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [mockMeasurement],
      };
      const nonExistentMeasurement: StoredGrowthEntry = {
        ...mockMeasurement,
        id: "growth-999",
      };
      const action: GrowthAction = { type: "UPDATE_MEASUREMENT", payload: nonExistentMeasurement };

      const result = growthReducer(state, action);

      expect(result.measurements).toEqual(state.measurements);
    });
  });

  describe("DELETE_MEASUREMENT", () => {
    it("should remove measurement by id", () => {
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [mockMeasurement],
      };
      const action: GrowthAction = { type: "DELETE_MEASUREMENT", payload: "growth-1" };

      const result = growthReducer(state, action);

      expect(result.measurements).toHaveLength(0);
    });

    it("should not modify array if measurement not found", () => {
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [mockMeasurement],
      };
      const action: GrowthAction = { type: "DELETE_MEASUREMENT", payload: "growth-999" };

      const result = growthReducer(state, action);

      expect(result.measurements).toHaveLength(1);
    });

    it("should remove only the specified measurement", () => {
      const state: GrowthState = {
        ...initialGrowthState,
        measurements: [mockMeasurement, mockWeightOnlyMeasurement],
      };
      const action: GrowthAction = { type: "DELETE_MEASUREMENT", payload: "growth-1" };

      const result = growthReducer(state, action);

      expect(result.measurements).toHaveLength(1);
      expect(result.measurements[0].id).toBe("growth-2");
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading state to true", () => {
      const action: GrowthAction = { type: "SET_LOADING", payload: true };

      const result = growthReducer(initialGrowthState, action);

      expect(result.isLoading).toBe(true);
    });

    it("should set loading state to false", () => {
      const state: GrowthState = { ...initialGrowthState, isLoading: true };
      const action: GrowthAction = { type: "SET_LOADING", payload: false };

      const result = growthReducer(state, action);

      expect(result.isLoading).toBe(false);
    });
  });

  describe("default case", () => {
    it("should return current state for unknown action", () => {
      const unknownAction = { type: "UNKNOWN_ACTION" } as unknown as GrowthAction;

      const result = growthReducer(initialGrowthState, unknownAction);

      expect(result).toEqual(initialGrowthState);
    });
  });
});
