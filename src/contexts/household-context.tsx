import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "./auth-context";
import { useSync } from "./sync-context";
import { RemoteChange } from "@/services/sync";
import {
  getHousehold,
  getHouseholdMembers,
  regenerateInviteCode,
  joinHouseholdViaInviteCode,
  leaveHousehold as leaveHouseholdService,
  Household,
  HouseholdMember,
  RateLimitInfo,
  type JoinHouseholdError,
} from "@/services/household-service";
import { withRetryResult } from "@/utils/retry";

export interface PartialFailure {
  operation: string;
  babyId?: string;
  error: string;
}

export type JoinHouseholdResult =
  | {
      success: true;
      error: null;
      householdId: string;
      partialFailures?: PartialFailure[];
      rateLimitInfo?: RateLimitInfo;
    }
  | {
      success: false;
      error: JoinHouseholdError;
      rateLimitInfo?: RateLimitInfo;
    };

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
  | { type: "RESET" }
  | { type: "MEMBER_JOINED"; payload: HouseholdMember }
  | { type: "MEMBER_LEFT"; payload: string }
  | { type: "MEMBER_UPDATED"; payload: HouseholdMember }
  | { type: "INVITE_CODE_CHANGED"; payload: string };

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

    case "MEMBER_JOINED": {
      const exists = state.members.some(m => m.id === action.payload.id);
      if (exists) return state;
      return { ...state, members: [...state.members, action.payload] };
    }

    case "MEMBER_LEFT": {
      const filteredMembers = state.members.filter(m => m.id !== action.payload);
      return { ...state, members: filteredMembers };
    }

    case "MEMBER_UPDATED": {
      const updatedMembers = state.members.map(m =>
        m.id === action.payload.id ? action.payload : m
      );
      return { ...state, members: updatedMembers };
    }

    case "INVITE_CODE_CHANGED":
      if (!state.household) return state;
      return {
        ...state,
        household: { ...state.household, inviteCode: action.payload },
      };

    default:
      return state;
  }
}

export interface LeaveHouseholdResult {
  success: boolean;
  error: string | null;
}

interface HouseholdContextValue extends HouseholdState {
  refreshHousehold: (householdIdOverride?: string) => Promise<void>;
  regenerateCode: () => Promise<boolean>;
  joinHousehold: (inviteCode: string) => Promise<JoinHouseholdResult>;
  leaveHousehold: () => Promise<LeaveHouseholdResult>;
  clearError: () => void;
  isOwner: boolean;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUserProfile } = useAuth();
  const { subscribeToRemoteChanges } = useSync();
  const [state, dispatch] = useReducer(householdReducer, initialHouseholdState);

  const householdId = user?.householdId ?? null;
  const renderedHouseholdIdRef = useRef(householdId);
  const activeLoadTargetRef = useRef(householdId);
  if (renderedHouseholdIdRef.current !== householdId) {
    renderedHouseholdIdRef.current = householdId;
    activeLoadTargetRef.current = householdId;
  }

  useEffect(() => {
    if (!householdId || !user?.id) return;

    const unsubUsers = subscribeToRemoteChanges('users', (change: RemoteChange) => {
      const newData = change.new;
      const oldData = change.old;

      // Check if THIS user was removed from the household
      const isCurrentUserRemoved = oldData &&
        oldData.id === user.id &&
        oldData.household_id === householdId &&
        newData &&
        newData.household_id !== householdId;

      if (isCurrentUserRemoved) {
        // Current user was removed - reset state and refresh profile to get new household
        dispatch({ type: "RESET" });
        dispatch({ type: "SET_LOADING", payload: true });
        refreshUserProfile().then(() => {
          // Profile refreshed - the useEffect watching householdId will load the new household
        });
        return;
      }

      const isJoining = newData && newData.household_id === householdId &&
        (!oldData || oldData.household_id !== householdId);
      const isLeaving = oldData && oldData.household_id === householdId &&
        (!newData || newData.household_id !== householdId);
      const isUpdating = newData && oldData &&
        newData.household_id === householdId &&
        oldData.household_id === householdId;

      if (isJoining && newData) {
        dispatch({
          type: "MEMBER_JOINED",
          payload: transformUserToMember(newData),
        });
      } else if (isLeaving && oldData) {
        dispatch({
          type: "MEMBER_LEFT",
          payload: oldData.id as string,
        });
      } else if (isUpdating && newData) {
        dispatch({
          type: "MEMBER_UPDATED",
          payload: transformUserToMember(newData),
        });
      }
    });

    const unsubHouseholds = subscribeToRemoteChanges('households', (change: RemoteChange) => {
      if (change.eventType !== 'UPDATE') return;
      if (!change.new || change.new.id !== householdId) return;

      const newInviteCode = change.new.invite_code as string;
      if (newInviteCode && newInviteCode !== state.household?.inviteCode) {
        dispatch({
          type: "INVITE_CODE_CHANGED",
          payload: newInviteCode,
        });
      }
    });

    return () => {
      unsubUsers();
      unsubHouseholds();
    };
  }, [householdId, user?.id, subscribeToRemoteChanges, state.household?.inviteCode, refreshUserProfile]);

  const loadHousehold = useCallback(async (
    householdIdOverride?: string,
    requireCompleteRefresh = false
  ) => {
    const targetHouseholdId = householdIdOverride ?? householdId;
    if (householdIdOverride) {
      activeLoadTargetRef.current = householdIdOverride;
    }
    if (!targetHouseholdId) {
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });

    const [householdResult, membersResult] = await Promise.all([
      getHousehold(targetHouseholdId),
      getHouseholdMembers(targetHouseholdId),
    ]);

    if (activeLoadTargetRef.current !== targetHouseholdId) return;

    if (householdResult.error) {
      dispatch({ type: "SET_ERROR", payload: householdResult.error });
    } else {
      dispatch({ type: "SET_HOUSEHOLD", payload: householdResult.data });
    }

    if (membersResult.data) {
      dispatch({ type: "SET_MEMBERS", payload: membersResult.data });
    }

    dispatch({ type: "SET_LOADING", payload: false });

    if (requireCompleteRefresh && (householdResult.error || membersResult.error)) {
      throw new Error("Failed to refresh joined household");
    }
  }, [householdId]);

  useEffect(() => {
    if (householdId) {
      loadHousehold();
    } else {
      activeLoadTargetRef.current = null;
      dispatch({ type: "RESET" });
    }
  }, [householdId, loadHousehold]);

  const refreshHousehold = useCallback(async (householdIdOverride?: string) => {
    await loadHousehold(householdIdOverride, householdIdOverride !== undefined);
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

  const joinHousehold = useCallback(async (
    inviteCode: string
  ): Promise<JoinHouseholdResult> => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });

    const retryConfig = { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000 };
    const partialFailures: PartialFailure[] = [];

    let directResult;
    try {
      directResult = await joinHouseholdViaInviteCode(inviteCode);
    } catch {
      dispatch({ type: "SET_ERROR", payload: "offline" });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: "offline" };
    }

    if (directResult.error) {
      dispatch({ type: "SET_ERROR", payload: directResult.error });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: directResult.error, rateLimitInfo: directResult.rateLimitInfo };
    }

    const householdData = directResult.data;
    if (!householdData) {
      dispatch({ type: "SET_ERROR", payload: "joinFailed" });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: "joinFailed" };
    }

    activeLoadTargetRef.current = householdData.id;
    dispatch({ type: "JOIN_HOUSEHOLD", payload: householdData });

    const profileResult = await withRetryResult(
      () => refreshUserProfile(),
      retryConfig
    );
    if (!profileResult.success) {
      partialFailures.push({
        operation: 'refreshUserProfile',
        error: profileResult.error?.message || 'Failed to refresh profile',
      });
    }

    const membersResult = await withRetryResult(
      () => getHouseholdMembers(householdData.id),
      retryConfig
    );
    if (membersResult.success && membersResult.data?.data) {
      dispatch({ type: "SET_MEMBERS", payload: membersResult.data.data });
    } else {
      partialFailures.push({
        operation: 'getHouseholdMembers',
        error: membersResult.error?.message || 'Failed to fetch members',
      });
    }

    dispatch({ type: "SET_LOADING", payload: false });

    return {
      success: true,
      error: null,
      householdId: householdData.id,
      partialFailures: partialFailures.length > 0 ? partialFailures : undefined,
    };
  }, [refreshUserProfile]);

  const leaveHousehold = useCallback(async (): Promise<LeaveHouseholdResult> => {
    dispatch({ type: "SET_LOADING", payload: true });

    const result = await leaveHouseholdService();

    if (result.error) {
      dispatch({ type: "SET_ERROR", payload: result.error });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: result.error };
    }

    if (result.data) {
      dispatch({ type: "SET_HOUSEHOLD", payload: result.data });
      dispatch({ type: "SET_MEMBERS", payload: [] });
    }

    await refreshUserProfile();
    dispatch({ type: "SET_LOADING", payload: false });

    return { success: true, error: null };
  }, [refreshUserProfile]);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const isOwner = user?.isOwner ?? false;

  const value: HouseholdContextValue = useMemo(() => ({
    ...state,
    refreshHousehold,
    regenerateCode,
    joinHousehold,
    leaveHousehold,
    clearError,
    isOwner,
  }), [state, refreshHousehold, regenerateCode, joinHousehold, leaveHousehold, clearError, isOwner]);

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

function transformUserToMember(data: Record<string, unknown>): HouseholdMember {
  return {
    id: data.id as string,
    email: (data.email as string | null) ?? null,
    displayName: (data.display_name as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    role: (data.role as 'owner' | 'member') || 'member',
    joinedAt: (data.joined_at as string | null) ?? null,
  };
}
