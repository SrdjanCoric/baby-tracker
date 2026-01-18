/**
 * DiaperContext reducer tests
 * TDD: Write tests FIRST before implementation
 */
import { describe, it, expect } from "vitest";
import { diaperReducer, initialDiaperState, DiaperState, DiaperAction } from "./diaper-context";
import type { StoredDiaperEntry } from "@/services/diaper-storage";

const mockDiaper: StoredDiaperEntry = {
  id: "diaper-1",
  babyId: "baby-123",
  type: "wet",
  changedAt: "2024-01-17T13:00:00.000Z",
  createdAt: "2024-01-17T13:00:00.000Z",
  updatedAt: "2024-01-17T13:00:00.000Z",
};

const mockDirtyDiaper: StoredDiaperEntry = {
  id: "diaper-2",
  babyId: "baby-123",
  type: "dirty",
  stoolColor: "brown",
  changedAt: "2024-01-17T14:00:00.000Z",
  createdAt: "2024-01-17T14:00:00.000Z",
  updatedAt: "2024-01-17T14:00:00.000Z",
};

describe("diaperReducer", () => {
  describe("SET_DIAPERS", () => {
    it("should set diapers array", () => {
      const diapers = [mockDiaper];
      const action: DiaperAction = { type: "SET_DIAPERS", payload: diapers };

      const result = diaperReducer(initialDiaperState, action);

      expect(result.diapers).toEqual(diapers);
    });

    it("should replace existing diapers", () => {
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [mockDiaper],
      };
      const newDiapers: StoredDiaperEntry[] = [
        { ...mockDiaper, id: "diaper-2" },
        { ...mockDiaper, id: "diaper-3" },
      ];
      const action: DiaperAction = { type: "SET_DIAPERS", payload: newDiapers };

      const result = diaperReducer(state, action);

      expect(result.diapers).toHaveLength(2);
      expect(result.diapers).toEqual(newDiapers);
    });
  });

  describe("ADD_DIAPER", () => {
    it("should add a new wet diaper to the array", () => {
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [],
      };
      const action: DiaperAction = { type: "ADD_DIAPER", payload: mockDiaper };

      const result = diaperReducer(state, action);

      expect(result.diapers).toHaveLength(1);
      expect(result.diapers[0]).toEqual(mockDiaper);
    });

    it("should add a dirty diaper with stool color", () => {
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [],
      };
      const action: DiaperAction = { type: "ADD_DIAPER", payload: mockDirtyDiaper };

      const result = diaperReducer(state, action);

      expect(result.diapers).toHaveLength(1);
      expect(result.diapers[0].stoolColor).toBe("brown");
    });

    it("should append to existing diapers", () => {
      const existingDiaper: StoredDiaperEntry = { ...mockDiaper, id: "diaper-existing" };
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [existingDiaper],
      };
      const action: DiaperAction = { type: "ADD_DIAPER", payload: mockDirtyDiaper };

      const result = diaperReducer(state, action);

      expect(result.diapers).toHaveLength(2);
    });
  });

  describe("UPDATE_DIAPER", () => {
    it("should update an existing diaper", () => {
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [mockDiaper],
      };
      const updatedDiaper: StoredDiaperEntry = {
        ...mockDiaper,
        notes: "Diaper was very full",
        updatedAt: "2024-01-17T14:35:00.000Z",
      };
      const action: DiaperAction = { type: "UPDATE_DIAPER", payload: updatedDiaper };

      const result = diaperReducer(state, action);

      expect(result.diapers[0].notes).toBe("Diaper was very full");
    });

    it("should update stool color on an existing dirty diaper", () => {
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [mockDirtyDiaper],
      };
      const updatedDiaper: StoredDiaperEntry = {
        ...mockDirtyDiaper,
        stoolColor: "green",
        updatedAt: "2024-01-17T15:00:00.000Z",
      };
      const action: DiaperAction = { type: "UPDATE_DIAPER", payload: updatedDiaper };

      const result = diaperReducer(state, action);

      expect(result.diapers[0].stoolColor).toBe("green");
    });

    it("should not modify array if diaper not found", () => {
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [mockDiaper],
      };
      const nonExistentDiaper: StoredDiaperEntry = {
        ...mockDiaper,
        id: "diaper-999",
      };
      const action: DiaperAction = { type: "UPDATE_DIAPER", payload: nonExistentDiaper };

      const result = diaperReducer(state, action);

      expect(result.diapers).toEqual(state.diapers);
    });
  });

  describe("DELETE_DIAPER", () => {
    it("should remove diaper by id", () => {
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [mockDiaper],
      };
      const action: DiaperAction = { type: "DELETE_DIAPER", payload: "diaper-1" };

      const result = diaperReducer(state, action);

      expect(result.diapers).toHaveLength(0);
    });

    it("should not modify array if diaper not found", () => {
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [mockDiaper],
      };
      const action: DiaperAction = { type: "DELETE_DIAPER", payload: "diaper-999" };

      const result = diaperReducer(state, action);

      expect(result.diapers).toHaveLength(1);
    });

    it("should remove only the specified diaper", () => {
      const state: DiaperState = {
        ...initialDiaperState,
        diapers: [mockDiaper, mockDirtyDiaper],
      };
      const action: DiaperAction = { type: "DELETE_DIAPER", payload: "diaper-1" };

      const result = diaperReducer(state, action);

      expect(result.diapers).toHaveLength(1);
      expect(result.diapers[0].id).toBe("diaper-2");
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading state to true", () => {
      const action: DiaperAction = { type: "SET_LOADING", payload: true };

      const result = diaperReducer(initialDiaperState, action);

      expect(result.isLoading).toBe(true);
    });

    it("should set loading state to false", () => {
      const state: DiaperState = { ...initialDiaperState, isLoading: true };
      const action: DiaperAction = { type: "SET_LOADING", payload: false };

      const result = diaperReducer(state, action);

      expect(result.isLoading).toBe(false);
    });
  });

  describe("default case", () => {
    it("should return current state for unknown action", () => {
      const unknownAction = { type: "UNKNOWN_ACTION" } as unknown as DiaperAction;

      const result = diaperReducer(initialDiaperState, unknownAction);

      expect(result).toEqual(initialDiaperState);
    });
  });
});
