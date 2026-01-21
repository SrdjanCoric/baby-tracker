import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { useAuth } from "./auth-context";
import {
  getHousehold,
  getHouseholdMembers,
  regenerateInviteCode,
  Household,
  HouseholdMember,
} from "@/services/household-service";

export interface HouseholdState {
  household: Household | null;
  members: HouseholdMember[];
  isLoading: boolean;
  error: string | null;
}

export type HouseholdAction =
  | { type: "SET_HOUSEHOLD"; payload: Household | null }
  | { type: "SET_MEMBERS"; payload: HouseholdMember[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "UPDATE_INVITE_CODE"; payload: string }
  | { type: "RESET" };

export const initialHouseholdState: HouseholdState = {
  household: null,
  members: [],
  isLoading: true,
  error: null,
};

export function householdReducer(
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

interface HouseholdContextValue extends HouseholdState {
  refreshHousehold: () => Promise<void>;
  regenerateCode: () => Promise<boolean>;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(householdReducer, initialHouseholdState);

  const householdId = user?.householdId ?? null;

  const loadHousehold = useCallback(async () => {
    if (!householdId) {
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });

    const [householdResult, membersResult] = await Promise.all([
      getHousehold(householdId),
      getHouseholdMembers(householdId),
    ]);

    if (householdResult.error) {
      dispatch({ type: "SET_ERROR", payload: householdResult.error });
    } else {
      dispatch({ type: "SET_HOUSEHOLD", payload: householdResult.data });
    }

    if (membersResult.data) {
      dispatch({ type: "SET_MEMBERS", payload: membersResult.data });
    }

    dispatch({ type: "SET_LOADING", payload: false });
  }, [householdId]);

  useEffect(() => {
    if (householdId) {
      loadHousehold();
    } else {
      dispatch({ type: "RESET" });
    }
  }, [householdId, loadHousehold]);

  const refreshHousehold = useCallback(async () => {
    await loadHousehold();
  }, [loadHousehold]);

  const regenerateCode = useCallback(async (): Promise<boolean> => {
    if (!householdId) return false;

    const result = await regenerateInviteCode(householdId);

    if (result.error) {
      dispatch({ type: "SET_ERROR", payload: result.error });
      return false;
    }

    if (result.data) {
      dispatch({ type: "UPDATE_INVITE_CODE", payload: result.data });
    }

    return true;
  }, [householdId]);

  const value: HouseholdContextValue = {
    ...state,
    refreshHousehold,
    regenerateCode,
  };

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold(): HouseholdContextValue {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error("useHousehold must be used within a HouseholdProvider");
  }
  return context;
}
