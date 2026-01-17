import { describe, it, expect, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

import {
  babyReducer,
  BabyState,
  BabyAction,
  initialBabyState,
} from "./baby-context";
import type { StoredBabyProfile } from "@/services/baby-storage";

const mockBaby: StoredBabyProfile = {
  id: "baby-1",
  name: "Emma",
  birthDate: "2024-06-15T00:00:00.000Z",
  gender: "female",
  createdAt: "2024-06-15T10:00:00.000Z",
  updatedAt: "2024-06-15T10:00:00.000Z",
};

const mockBaby2: StoredBabyProfile = {
  id: "baby-2",
  name: "Oliver",
  gender: "male",
  createdAt: "2024-06-15T10:00:00.000Z",
  updatedAt: "2024-06-15T10:00:00.000Z",
};

describe("babyReducer", () => {
  describe("SET_BABIES", () => {
    it("should set babies list", () => {
      const action: BabyAction = {
        type: "SET_BABIES",
        payload: [mockBaby, mockBaby2],
      };
      const state = babyReducer(initialBabyState, action);
      expect(state.babies).toHaveLength(2);
      expect(state.babies[0].name).toBe("Emma");
    });
  });

  describe("SET_SELECTED_BABY", () => {
    it("should set selected baby", () => {
      const stateWithBabies: BabyState = {
        ...initialBabyState,
        babies: [mockBaby, mockBaby2],
      };
      const action: BabyAction = {
        type: "SET_SELECTED_BABY",
        payload: mockBaby,
      };
      const state = babyReducer(stateWithBabies, action);
      expect(state.selectedBaby?.id).toBe("baby-1");
    });

    it("should clear selected baby when payload is null", () => {
      const stateWithSelection: BabyState = {
        ...initialBabyState,
        babies: [mockBaby],
        selectedBaby: mockBaby,
      };
      const action: BabyAction = {
        type: "SET_SELECTED_BABY",
        payload: null,
      };
      const state = babyReducer(stateWithSelection, action);
      expect(state.selectedBaby).toBeNull();
    });
  });

  describe("ADD_BABY", () => {
    it("should add baby to list", () => {
      const action: BabyAction = {
        type: "ADD_BABY",
        payload: mockBaby,
      };
      const state = babyReducer(initialBabyState, action);
      expect(state.babies).toHaveLength(1);
      expect(state.babies[0].name).toBe("Emma");
    });
  });

  describe("UPDATE_BABY", () => {
    it("should update existing baby", () => {
      const stateWithBabies: BabyState = {
        ...initialBabyState,
        babies: [mockBaby, mockBaby2],
        selectedBaby: mockBaby,
      };
      const updatedBaby: StoredBabyProfile = {
        ...mockBaby,
        name: "Emma Grace",
      };
      const action: BabyAction = {
        type: "UPDATE_BABY",
        payload: updatedBaby,
      };
      const state = babyReducer(stateWithBabies, action);
      expect(state.babies[0].name).toBe("Emma Grace");
    });

    it("should update selected baby if it was updated", () => {
      const stateWithBabies: BabyState = {
        ...initialBabyState,
        babies: [mockBaby],
        selectedBaby: mockBaby,
      };
      const updatedBaby: StoredBabyProfile = {
        ...mockBaby,
        name: "Emma Grace",
      };
      const action: BabyAction = {
        type: "UPDATE_BABY",
        payload: updatedBaby,
      };
      const state = babyReducer(stateWithBabies, action);
      expect(state.selectedBaby?.name).toBe("Emma Grace");
    });
  });

  describe("DELETE_BABY", () => {
    it("should remove baby from list", () => {
      const stateWithBabies: BabyState = {
        ...initialBabyState,
        babies: [mockBaby, mockBaby2],
      };
      const action: BabyAction = {
        type: "DELETE_BABY",
        payload: "baby-1",
      };
      const state = babyReducer(stateWithBabies, action);
      expect(state.babies).toHaveLength(1);
      expect(state.babies[0].id).toBe("baby-2");
    });

    it("should clear selected baby if deleted", () => {
      const stateWithBabies: BabyState = {
        ...initialBabyState,
        babies: [mockBaby, mockBaby2],
        selectedBaby: mockBaby,
      };
      const action: BabyAction = {
        type: "DELETE_BABY",
        payload: "baby-1",
      };
      const state = babyReducer(stateWithBabies, action);
      expect(state.selectedBaby).toBeNull();
    });

    it("should not clear selected baby if different baby deleted", () => {
      const stateWithBabies: BabyState = {
        ...initialBabyState,
        babies: [mockBaby, mockBaby2],
        selectedBaby: mockBaby,
      };
      const action: BabyAction = {
        type: "DELETE_BABY",
        payload: "baby-2",
      };
      const state = babyReducer(stateWithBabies, action);
      expect(state.selectedBaby?.id).toBe("baby-1");
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading state", () => {
      const action: BabyAction = {
        type: "SET_LOADING",
        payload: true,
      };
      const state = babyReducer(initialBabyState, action);
      expect(state.isLoading).toBe(true);
    });
  });
});
