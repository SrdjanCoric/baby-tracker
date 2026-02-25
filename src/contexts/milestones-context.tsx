import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from "react";
import {
  MilestonesStorageService,
  StoredMilestoneResponse,
  MilestoneState,
} from "@/services/milestones-storage";
import {
  fetchMilestoneResponsesFromDatabase,
  upsertMilestoneResponseInDatabase,
  deleteMilestoneResponseFromDatabase,
} from "@/services/activity-sync-service";
import { AGE_GROUPS, getCurrentAgeGroupKey, getAgeGroupByKey } from "@/constants/milestones";
import type { AgeGroup } from "@/constants/milestones";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange } from "@/services/sync";

interface MilestonesState {
  responses: StoredMilestoneResponse[];
  isLoading: boolean;
}

type MilestonesAction =
  | { type: "SET_RESPONSES"; payload: StoredMilestoneResponse[] }
  | { type: "UPSERT_RESPONSE"; payload: StoredMilestoneResponse }
  | { type: "REMOVE_RESPONSE"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "REMOTE_INSERT"; payload: StoredMilestoneResponse }
  | { type: "REMOTE_UPDATE"; payload: StoredMilestoneResponse }
  | { type: "REMOTE_DELETE"; payload: string };

const initialState: MilestonesState = {
  responses: [],
  isLoading: true,
};

function milestonesReducer(state: MilestonesState, action: MilestonesAction): MilestonesState {
  switch (action.type) {
    case "SET_RESPONSES":
      return { ...state, responses: action.payload };

    case "UPSERT_RESPONSE": {
      const existing = state.responses.find((r) => r.milestoneId === action.payload.milestoneId);
      if (existing) {
        return {
          ...state,
          responses: state.responses.map((r) =>
            r.milestoneId === action.payload.milestoneId ? action.payload : r
          ),
        };
      }
      return { ...state, responses: [...state.responses, action.payload] };
    }

    case "REMOVE_RESPONSE":
      return {
        ...state,
        responses: state.responses.filter((r) => r.milestoneId !== action.payload),
      };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "REMOTE_INSERT": {
      const exists = state.responses.some((r) => r.id === action.payload.id);
      if (exists) return state;
      const existingByMilestone = state.responses.find(
        (r) => r.milestoneId === action.payload.milestoneId
      );
      if (existingByMilestone) {
        return {
          ...state,
          responses: state.responses.map((r) =>
            r.milestoneId === action.payload.milestoneId ? action.payload : r
          ),
        };
      }
      return { ...state, responses: [...state.responses, action.payload] };
    }

    case "REMOTE_UPDATE": {
      const updated = state.responses.map((r) =>
        r.id === action.payload.id ? action.payload : r
      );
      return { ...state, responses: updated };
    }

    case "REMOTE_DELETE":
      return {
        ...state,
        responses: state.responses.filter((r) => r.id !== action.payload),
      };

    default:
      return state;
  }
}

interface MilestonesContextValue extends MilestonesState {
  setMilestoneState: (milestoneId: string, state: MilestoneState) => Promise<void>;
  clearMilestoneState: (milestoneId: string) => Promise<void>;
  getMilestoneState: (milestoneId: string) => "yes" | "not_sure" | "not_yet";
  getYesCountForAge: (ageKey: string) => number;
  getNotSureCountForAge: (ageKey: string) => number;
  getTotalCountForAge: (ageKey: string) => number;
  isAgeCompleted: (ageKey: string) => boolean;
  getStarsEarned: () => number;
  getCurrentAgeGroup: () => AgeGroup | null;
  refreshResponses: () => Promise<void>;
}

const MilestonesContext = createContext<MilestonesContextValue | null>(null);

export function MilestonesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(milestonesReducer, initialState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('milestone_responses', (change: RemoteChange) => {
      if (!selectedBaby) return;
      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

      switch (change.eventType) {
        case 'INSERT':
          if (change.new) dispatch({ type: "REMOTE_INSERT", payload: transformFromRemote(change.new) });
          break;
        case 'UPDATE':
          if (change.new) dispatch({ type: "REMOTE_UPDATE", payload: transformFromRemote(change.new) });
          break;
        case 'DELETE':
          if (change.old?.id) dispatch({ type: "REMOTE_DELETE", payload: change.old.id as string });
          break;
      }
    });
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const loadResponses = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_RESPONSES", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      let responses: StoredMilestoneResponse[];

      if (user?.householdId) {
        try {
          responses = await fetchMilestoneResponsesFromDatabase(selectedBaby.id);
        } catch (error) {
          console.error("[MilestonesContext] Failed to fetch from database, using local:", error);
          responses = await MilestonesStorageService.getResponses(selectedBaby.id);
        }
      } else {
        responses = await MilestonesStorageService.getResponses(selectedBaby.id);
      }

      dispatch({ type: "SET_RESPONSES", payload: responses });
    } catch (error) {
      console.error("[MilestonesContext] Failed to load responses:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [selectedBaby, user?.householdId]);

  useEffect(() => {
    loadResponses();
  }, [loadResponses, foregroundRefreshKey]);

  const setMilestoneStateAction = useCallback(
    async (milestoneId: string, milestoneState: MilestoneState) => {
      if (!selectedBaby) return;

      const existing = state.responses.find((r) => r.milestoneId === milestoneId);

      let response: StoredMilestoneResponse;

      if (user?.householdId && user?.id) {
        response = await upsertMilestoneResponseInDatabase(
          {
            babyId: selectedBaby.id,
            milestoneId,
            state: milestoneState,
            respondedBy: user.id,
          },
          existing?.id
        );
      } else {
        response = await MilestonesStorageService.setMilestoneState({
          babyId: selectedBaby.id,
          milestoneId,
          state: milestoneState,
          respondedBy: user?.id,
        });
      }

      dispatch({ type: "UPSERT_RESPONSE", payload: response });
    },
    [selectedBaby, user?.householdId, user?.id, state.responses]
  );

  const clearMilestoneStateAction = useCallback(
    async (milestoneId: string) => {
      if (!selectedBaby) return;

      const existing = state.responses.find((r) => r.milestoneId === milestoneId);

      if (user?.householdId && existing?.id) {
        await deleteMilestoneResponseFromDatabase(selectedBaby.id, existing.id, milestoneId);
      } else {
        await MilestonesStorageService.clearMilestoneState(selectedBaby.id, milestoneId);
      }

      dispatch({ type: "REMOVE_RESPONSE", payload: milestoneId });
    },
    [selectedBaby, user?.householdId, state.responses]
  );

  const getMilestoneState = useCallback(
    (milestoneId: string): "yes" | "not_sure" | "not_yet" => {
      const response = state.responses.find((r) => r.milestoneId === milestoneId);
      return response?.state ?? "not_yet";
    },
    [state.responses]
  );

  const getYesCountForAge = useCallback(
    (ageKey: string): number => {
      const group = getAgeGroupByKey(ageKey);
      if (!group) return 0;
      return group.milestones.filter((m) => {
        const r = state.responses.find((resp) => resp.milestoneId === m.id);
        return r?.state === "yes";
      }).length;
    },
    [state.responses]
  );

  const getNotSureCountForAge = useCallback(
    (ageKey: string): number => {
      const group = getAgeGroupByKey(ageKey);
      if (!group) return 0;
      return group.milestones.filter((m) => {
        const r = state.responses.find((resp) => resp.milestoneId === m.id);
        return r?.state === "not_sure";
      }).length;
    },
    [state.responses]
  );

  const getTotalCountForAge = useCallback(
    (ageKey: string): number => {
      const group = getAgeGroupByKey(ageKey);
      return group?.milestones.length ?? 0;
    },
    []
  );

  const isAgeCompleted = useCallback(
    (ageKey: string): boolean => {
      const total = getTotalCountForAge(ageKey);
      if (total === 0) return false;
      return getYesCountForAge(ageKey) === total;
    },
    [getYesCountForAge, getTotalCountForAge]
  );

  const getStarsEarned = useCallback((): number => {
    return AGE_GROUPS.filter((group) => isAgeCompleted(group.key)).length;
  }, [isAgeCompleted]);

  const getCurrentAgeGroup = useCallback((): AgeGroup | null => {
    if (!selectedBaby?.birthDate) return null;
    const key = getCurrentAgeGroupKey(new Date(selectedBaby.birthDate));
    if (!key) return null;
    return getAgeGroupByKey(key) ?? null;
  }, [selectedBaby?.birthDate]);

  const value: MilestonesContextValue = useMemo(
    () => ({
      ...state,
      setMilestoneState: setMilestoneStateAction,
      clearMilestoneState: clearMilestoneStateAction,
      getMilestoneState,
      getYesCountForAge,
      getNotSureCountForAge,
      getTotalCountForAge,
      isAgeCompleted,
      getStarsEarned,
      getCurrentAgeGroup,
      refreshResponses: loadResponses,
    }),
    [
      state,
      setMilestoneStateAction,
      clearMilestoneStateAction,
      getMilestoneState,
      getYesCountForAge,
      getNotSureCountForAge,
      getTotalCountForAge,
      isAgeCompleted,
      getStarsEarned,
      getCurrentAgeGroup,
      loadResponses,
    ]
  );

  return <MilestonesContext.Provider value={value}>{children}</MilestonesContext.Provider>;
}

export function useMilestones(): MilestonesContextValue {
  const context = useContext(MilestonesContext);
  if (!context) {
    throw new Error("useMilestones must be used within a MilestonesProvider");
  }
  return context;
}

function transformFromRemote(data: Record<string, unknown>): StoredMilestoneResponse {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    milestoneId: data.milestone_id as string,
    state: data.state as MilestoneState,
    respondedAt: data.responded_at as string,
    respondedBy: data.responded_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}
