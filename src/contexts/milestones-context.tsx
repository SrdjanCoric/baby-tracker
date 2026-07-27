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
  retainRemoteMilestoneResponse,
} from "@/services/activity-sync-service";
import { AGE_GROUPS, getCurrentAgeGroupKey, getAgeGroupByKey } from "@/constants/milestones";
import type { AgeGroup } from "@/constants/milestones";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange, tombstonedId } from "@/services/sync";

export interface MilestonesState {
  responses: StoredMilestoneResponse[];
  isLoading: boolean;
}

export type MilestonesAction =
  | { type: "SET_RESPONSES"; payload: StoredMilestoneResponse[] }
  | { type: "UPSERT_RESPONSE"; payload: StoredMilestoneResponse }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "REMOTE_INSERT"; payload: StoredMilestoneResponse }
  | { type: "REMOTE_UPDATE"; payload: StoredMilestoneResponse }
  | { type: "REMOTE_DELETE"; payload: string };

export const initialMilestonesState: MilestonesState = {
  responses: [],
  isLoading: true,
};

function upsertMilestoneResponse(
  responses: StoredMilestoneResponse[],
  response: StoredMilestoneResponse
): StoredMilestoneResponse[] {
  const existingIndex = responses.findIndex(
    (item) => item.milestoneId === response.milestoneId
  );
  if (existingIndex === -1) return [...responses, response];
  return responses.flatMap((item, index) => {
    if (item.milestoneId !== response.milestoneId) return [item];
    return index === existingIndex ? [response] : [];
  });
}

export function milestonesReducer(state: MilestonesState, action: MilestonesAction): MilestonesState {
  switch (action.type) {
    case "SET_RESPONSES":
      return { ...state, responses: action.payload };

    case "UPSERT_RESPONSE":
      return {
        ...state,
        responses: upsertMilestoneResponse(state.responses, action.payload),
      };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "REMOTE_INSERT":
      return {
        ...state,
        responses: upsertMilestoneResponse(state.responses, action.payload),
      };

    case "REMOTE_UPDATE": {
      return {
        ...state,
        responses: upsertMilestoneResponse(state.responses, action.payload),
      };
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

interface MilestonesContextValue {
  responses: StoredMilestoneResponse[];
  isLoading: boolean;
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
  const [state, dispatch] = useReducer(milestonesReducer, initialMilestonesState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('milestone_responses', async (change: RemoteChange) => {
      if (!selectedBaby) return;
      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

      const retainAndDispatch = async (
        type: "REMOTE_INSERT" | "REMOTE_UPDATE",
        row: Record<string, unknown>
      ) => {
        let response = transformFromRemote(row);
        try {
          response = await retainRemoteMilestoneResponse(row);
        } catch (error) {
          console.error("[MilestonesContext] Failed to retain remote response:", error);
        }
        dispatch({ type, payload: response });
      };

      if (change.new?.deleted === true) {
        await retainAndDispatch("REMOTE_UPDATE", change.new);
        return;
      }

      const removeId = tombstonedId(change);
      if (removeId) {
        dispatch({ type: "REMOTE_DELETE", payload: removeId });
        return;
      }

      switch (change.eventType) {
        case 'INSERT':
          if (change.new) await retainAndDispatch("REMOTE_INSERT", change.new);
          break;
        case 'UPDATE':
          if (change.new) await retainAndDispatch("REMOTE_UPDATE", change.new);
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

      if (existing) {
        dispatch({
          type: "UPSERT_RESPONSE",
          payload: { ...existing, deleted: true, updatedAt: new Date().toISOString() },
        });
      }
    },
    [selectedBaby, user?.householdId, state.responses]
  );

  const getMilestoneState = useCallback(
    (milestoneId: string): "yes" | "not_sure" | "not_yet" => {
      const response = state.responses.find(
        (item) => item.milestoneId === milestoneId && !item.deleted
      );
      return response?.state ?? "not_yet";
    },
    [state.responses]
  );

  const getYesCountForAge = useCallback(
    (ageKey: string): number => {
      const group = getAgeGroupByKey(ageKey);
      if (!group) return 0;
      return group.milestones.filter((m) => {
        const r = state.responses.find(
          (response) => response.milestoneId === m.id && !response.deleted
        );
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
        const r = state.responses.find(
          (response) => response.milestoneId === m.id && !response.deleted
        );
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

  const visibleResponses = useMemo(
    () => state.responses.filter((response) => !response.deleted),
    [state.responses]
  );

  const value: MilestonesContextValue = useMemo(
    () => ({
      responses: visibleResponses,
      isLoading: state.isLoading,
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
      visibleResponses,
      state.isLoading,
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
    deleted: data.deleted === true,
    respondedAt: data.responded_at as string,
    respondedBy: data.responded_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}
