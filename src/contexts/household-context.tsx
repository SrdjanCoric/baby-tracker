import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { useAuth } from "./auth-context";
import {
  getHousehold,
  getHouseholdMembers,
  regenerateInviteCode,
  joinHouseholdViaInviteCode,
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
  | { type: "JOIN_HOUSEHOLD"; payload: Household }
  | { type: "RESET" };

export const initialHouseholdState: HouseholdState = {
  household: null,
  members: [],
  isLoading: false,
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

    case "JOIN_HOUSEHOLD":
      return {
        ...state,
        household: action.payload,
        members: [],
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
  joinHousehold: (inviteCode: string) => Promise<{ success: boolean; error: string | null }>;
  clearError: () => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUserProfile } = useAuth();
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

  const joinHousehold = useCallback(async (inviteCode: string): Promise<{ success: boolean; error: string | null }> => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });

    const result = await joinHouseholdViaInviteCode(inviteCode);

    if (result.error) {
      dispatch({ type: "SET_ERROR", payload: result.error });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: result.error };
    }

    if (result.data) {
      dispatch({ type: "JOIN_HOUSEHOLD", payload: result.data });

      // Refresh user profile to update householdId in auth context
      await refreshUserProfile();

      const membersResult = await getHouseholdMembers(result.data.id);
      if (membersResult.data) {
        dispatch({ type: "SET_MEMBERS", payload: membersResult.data });
      }
    }

    dispatch({ type: "SET_LOADING", payload: false });
    return { success: true, error: null };
  }, [refreshUserProfile]);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const value: HouseholdContextValue = {
    ...state,
    refreshHousehold,
    regenerateCode,
    joinHousehold,
    clearError,
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
