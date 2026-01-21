import { describe, it, expect } from "vitest";

interface Household {
  id: string;
  inviteCode: string;
  createdAt: string;
}

interface HouseholdMember {
  id: string;
  email: string | null;
  displayName: string | null;
}

interface HouseholdState {
  household: Household | null;
  members: HouseholdMember[];
  isLoading: boolean;
  error: string | null;
}

type HouseholdAction =
  | { type: "SET_HOUSEHOLD"; payload: Household | null }
  | { type: "SET_MEMBERS"; payload: HouseholdMember[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "UPDATE_INVITE_CODE"; payload: string }
  | { type: "RESET" };

const initialHouseholdState: HouseholdState = {
  household: null,
  members: [],
  isLoading: true,
  error: null,
};

function householdReducer(
  state: HouseholdState,
  action: HouseholdAction
): HouseholdState {
  switch (action.type) {
    case "SET_HOUSEHOLD":
      return { ...state, household: action.payload };

    case "SET_MEMBERS":
      return { ...state, members: action.payload };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "UPDATE_INVITE_CODE":
      if (!state.household) return state;
      return {
        ...state,
        household: { ...state.household, inviteCode: action.payload },
      };

    case "RESET":
      return initialHouseholdState;

    default:
      return state;
  }
}

describe("HouseholdContext", () => {
  describe("householdReducer", () => {
    const mockHousehold: Household = {
      id: "household-123",
      inviteCode: "ABCD2345",
      createdAt: "2024-01-01T00:00:00Z",
    };

    const mockMembers: HouseholdMember[] = [
      { id: "user-1", email: "user1@test.com", displayName: "User One" },
      { id: "user-2", email: "user2@test.com", displayName: "User Two" },
    ];

    it("should return initial state", () => {
      expect(initialHouseholdState).toEqual({
        household: null,
        members: [],
        isLoading: true,
        error: null,
      });
    });

    it("should handle SET_HOUSEHOLD", () => {
      const action: HouseholdAction = {
        type: "SET_HOUSEHOLD",
        payload: mockHousehold,
      };
      const newState = householdReducer(initialHouseholdState, action);

      expect(newState.household).toEqual(mockHousehold);
      expect(newState.isLoading).toBe(true);
    });

    it("should handle SET_MEMBERS", () => {
      const action: HouseholdAction = {
        type: "SET_MEMBERS",
        payload: mockMembers,
      };
      const newState = householdReducer(initialHouseholdState, action);

      expect(newState.members).toEqual(mockMembers);
    });

    it("should handle SET_LOADING true", () => {
      const state: HouseholdState = {
        ...initialHouseholdState,
        isLoading: false,
      };
      const action: HouseholdAction = { type: "SET_LOADING", payload: true };
      const newState = householdReducer(state, action);

      expect(newState.isLoading).toBe(true);
    });

    it("should handle SET_LOADING false", () => {
      const action: HouseholdAction = { type: "SET_LOADING", payload: false };
      const newState = householdReducer(initialHouseholdState, action);

      expect(newState.isLoading).toBe(false);
    });

    it("should handle SET_ERROR", () => {
      const action: HouseholdAction = {
        type: "SET_ERROR",
        payload: "Something went wrong",
      };
      const newState = householdReducer(initialHouseholdState, action);

      expect(newState.error).toBe("Something went wrong");
    });

    it("should handle CLEAR_ERROR", () => {
      const state: HouseholdState = {
        ...initialHouseholdState,
        error: "Some error",
      };
      const action: HouseholdAction = { type: "CLEAR_ERROR" };
      const newState = householdReducer(state, action);

      expect(newState.error).toBeNull();
    });

    it("should handle UPDATE_INVITE_CODE", () => {
      const state: HouseholdState = {
        ...initialHouseholdState,
        household: mockHousehold,
      };
      const action: HouseholdAction = {
        type: "UPDATE_INVITE_CODE",
        payload: "NEWC5678",
      };
      const newState = householdReducer(state, action);

      expect(newState.household?.inviteCode).toBe("NEWC5678");
    });

    it("should not update invite code if no household exists", () => {
      const action: HouseholdAction = {
        type: "UPDATE_INVITE_CODE",
        payload: "NEWC5678",
      };
      const newState = householdReducer(initialHouseholdState, action);

      expect(newState.household).toBeNull();
    });

    it("should handle RESET to clear all state", () => {
      const state: HouseholdState = {
        household: mockHousehold,
        members: mockMembers,
        isLoading: false,
        error: "Some error",
      };
      const action: HouseholdAction = { type: "RESET" };
      const newState = householdReducer(state, action);

      expect(newState).toEqual(initialHouseholdState);
    });

    it("should return current state for unknown action", () => {
      const state: HouseholdState = {
        ...initialHouseholdState,
        household: mockHousehold,
      };
      const action = { type: "UNKNOWN_ACTION" } as unknown as HouseholdAction;
      const newState = householdReducer(state, action);

      expect(newState).toEqual(state);
    });
  });
});
