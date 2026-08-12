import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from "react";
import {
  DiaperStorageService,
  StoredDiaperEntry,
  CreateDiaperInput,
  UpdateDiaperInput,
  DiaperCounts,
} from "@/services/diaper-storage";
import {
  fetchDiapersFromDatabase,
  createDiaperInDatabase,
  updateDiaperInDatabase,
  deleteDiaperFromDatabase,
} from "@/services/activity-sync-service";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange, tombstonedId, upsertById } from "@/services/sync";
import type { DiaperType, StoolColor } from "@/constants/activities";
import { BabyProviderBinding, useBabyProviderBinding } from "@/hooks/useBabyProviderBinding";
import { useActivityRangeLoader } from "@/hooks/useActivityRangeLoader";
import type { ActivityRangeLoadOptions, ActivityRangeStatus, UtcActivityRange } from "@/services/activity-range-loader";

export interface DiaperState {
  diapers: StoredDiaperEntry[];
  isLoading: boolean;
}

export type DiaperAction =
  | { type: "SET_DIAPERS"; payload: StoredDiaperEntry[] }
  | { type: "ADD_DIAPER"; payload: StoredDiaperEntry }
  | { type: "UPDATE_DIAPER"; payload: StoredDiaperEntry }
  | { type: "DELETE_DIAPER"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "REMOTE_INSERT"; payload: StoredDiaperEntry }
  | { type: "REMOTE_UPDATE"; payload: StoredDiaperEntry }
  | { type: "REMOTE_DELETE"; payload: string };

export const initialDiaperState: DiaperState = {
  diapers: [],
  isLoading: true,
};

export function diaperReducer(state: DiaperState, action: DiaperAction): DiaperState {
  switch (action.type) {
    case "SET_DIAPERS":
      return { ...state, diapers: action.payload };

    case "ADD_DIAPER":
      return { ...state, diapers: upsertById(state.diapers, action.payload) };

    case "UPDATE_DIAPER": {
      const updatedDiapers = state.diapers.map(d =>
        d.id === action.payload.id ? action.payload : d
      );
      return { ...state, diapers: updatedDiapers };
    }

    case "DELETE_DIAPER": {
      const filteredDiapers = state.diapers.filter(d => d.id !== action.payload);
      return { ...state, diapers: filteredDiapers };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "REMOTE_INSERT":
      return { ...state, diapers: upsertById(state.diapers, action.payload) };

    case "REMOTE_UPDATE": {
      return { ...state, diapers: upsertById(state.diapers, action.payload) };
    }

    case "REMOTE_DELETE": {
      const filteredDiapers = state.diapers.filter(d => d.id !== action.payload);
      return { ...state, diapers: filteredDiapers };
    }

    default:
      return state;
  }
}

interface DiaperContextValue extends DiaperState {
  babyBinding: BabyProviderBinding;
  addDiaper: (input: CreateDiaperInput) => Promise<StoredDiaperEntry>;
  updateDiaper: (diaperId: string, input: UpdateDiaperInput) => Promise<StoredDiaperEntry | null>;
  deleteDiaper: (diaperId: string) => Promise<boolean>;
  refreshDiapers: () => Promise<void>;
  loadDiaperRange: (
    range: UtcActivityRange,
    options?: ActivityRangeLoadOptions
  ) => Promise<void>;
  getDiaperRangeStatus: (range: UtcActivityRange) => ActivityRangeStatus;
  getLastDiaper: () => StoredDiaperEntry | null;
  getTodaysCounts: () => DiaperCounts;
}

const DiaperContext = createContext<DiaperContextValue | null>(null);

export function DiaperProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(diaperReducer, initialDiaperState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, registerForegroundRefreshLoader } = useSync();
  const { user } = useAuth();
  const {
    babyBinding,
    beginBabyBinding,
    finishBabyBinding,
    isCurrentBabyBinding,
  } = useBabyProviderBinding(selectedBaby?.id ?? null);
  const acceptDiaperRange = useCallback((entries: StoredDiaperEntry[]) => {
    dispatch({ type: "SET_DIAPERS", payload: entries });
  }, []);
  const {
    loadRange: loadDiaperRange,
    getRangeStatus: getDiaperRangeStatus,
  } = useActivityRangeLoader({
    table: "diapers",
    babyId: selectedBaby?.id ?? null,
    authenticated: Boolean(user?.householdId),
    storageScope: `${user?.id ?? "guest"}:${user?.householdId ?? "local"}:${selectedBaby?.id ?? "none"}`,
    acceptEntries: acceptDiaperRange,
  });

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('diapers', (change: RemoteChange) => {
      if (!selectedBaby) return;

      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

      const removeId = tombstonedId(change);
      if (removeId) {
        dispatch({ type: "REMOTE_DELETE", payload: removeId });
        return;
      }

      switch (change.eventType) {
        case 'INSERT':
          if (change.new) {
            dispatch({
              type: "REMOTE_INSERT",
              payload: transformDiaperFromRemote(change.new),
            });
          }
          break;
        case 'UPDATE':
          if (change.new) {
            dispatch({
              type: "REMOTE_UPDATE",
              payload: transformDiaperFromRemote(change.new),
            });
          }
          break;
      }
    });

    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const loadDiapers = useCallback(async (reportFailure = false) => {
    let loadError: unknown;
    const bindingToken = beginBabyBinding(selectedBaby?.id ?? null);
    if (!selectedBaby) {
      dispatch({ type: "SET_DIAPERS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      finishBabyBinding(bindingToken, "ready");
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    let bindingStatus: "ready" | "error" = "ready";

    try {
      let diapers: StoredDiaperEntry[];

      if (user?.householdId) {
        try {
          diapers = await fetchDiapersFromDatabase(selectedBaby.id);
        } catch (error) {
          loadError = error;
          if (!isCurrentBabyBinding(bindingToken)) return;
          console.error("[DiaperContext] Failed to fetch from database, using local:", error);
          diapers = await DiaperStorageService.getAllDiapers(selectedBaby.id);
        }
      } else {
        diapers = await DiaperStorageService.getAllDiapers(selectedBaby.id);
      }

      if (!isCurrentBabyBinding(bindingToken)) return;
      dispatch({ type: "SET_DIAPERS", payload: diapers });
    } catch (error) {
      loadError = error;
      if (!isCurrentBabyBinding(bindingToken)) return;
      bindingStatus = "error";
      console.error("[DiaperContext] Failed to load diapers:", error);
    } finally {
      if (isCurrentBabyBinding(bindingToken)) {
        dispatch({ type: "SET_LOADING", payload: false });
        finishBabyBinding(bindingToken, bindingStatus);
      }
    }
    if (reportFailure && loadError) throw loadError;
  }, [beginBabyBinding, finishBabyBinding, isCurrentBabyBinding, selectedBaby, user?.householdId]);

  useEffect(() => {
    void loadDiapers();
  }, [loadDiapers]);

  useEffect(
    () => registerForegroundRefreshLoader?.("diapers", () => loadDiapers(true)),
    [loadDiapers, registerForegroundRefreshLoader]
  );

  const addDiaper = useCallback(async (input: CreateDiaperInput): Promise<StoredDiaperEntry> => {
    let diaper: StoredDiaperEntry;

    if (user?.householdId && user?.id) {
      diaper = await createDiaperInDatabase(input, user.id);
    } else {
      diaper = await DiaperStorageService.addDiaper(input);
    }

    dispatch({ type: "ADD_DIAPER", payload: diaper });
    return diaper;
  }, [user?.householdId, user?.id]);

  const updateDiaper = useCallback(async (
    diaperId: string,
    input: UpdateDiaperInput
  ): Promise<StoredDiaperEntry | null> => {
    if (!selectedBaby) return null;

    let updated: StoredDiaperEntry | null;

    if (user?.householdId) {
      updated = await updateDiaperInDatabase(selectedBaby.id, diaperId, input);
    } else {
      updated = await DiaperStorageService.updateDiaper(selectedBaby.id, diaperId, input);
    }

    if (updated) {
      dispatch({ type: "UPDATE_DIAPER", payload: updated });
    }
    return updated;
  }, [selectedBaby, user?.householdId]);

  const deleteDiaper = useCallback(async (diaperId: string): Promise<boolean> => {
    if (!selectedBaby) return false;

    let result: boolean;

    if (user?.householdId) {
      result = await deleteDiaperFromDatabase(selectedBaby.id, diaperId);
    } else {
      result = await DiaperStorageService.deleteDiaper(selectedBaby.id, diaperId);
    }

    if (result) {
      dispatch({ type: "DELETE_DIAPER", payload: diaperId });
    }
    return result;
  }, [selectedBaby, user?.householdId]);

  const getLastDiaper = useCallback((): StoredDiaperEntry | null => {
    if (state.diapers.length === 0) return null;

    const sorted = [...state.diapers].sort((a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
    return sorted[0];
  }, [state.diapers]);

  const getTodaysCounts = useCallback((): DiaperCounts => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysDiapers = state.diapers.filter(d => {
      const diaperDate = new Date(d.changedAt);
      diaperDate.setHours(0, 0, 0, 0);
      return diaperDate.getTime() === today.getTime();
    });

    const counts: DiaperCounts = {
      wet: 0,
      dirty: 0,
      mixed: 0,
      dry: 0,
      total: todaysDiapers.length,
    };

    for (const diaper of todaysDiapers) {
      counts[diaper.type]++;
    }

    return counts;
  }, [state.diapers]);

  const value: DiaperContextValue = useMemo(() => ({
    ...state,
    babyBinding,
    addDiaper,
    updateDiaper,
    deleteDiaper,
    refreshDiapers: loadDiapers,
    loadDiaperRange,
    getDiaperRangeStatus,
    getLastDiaper,
    getTodaysCounts,
  }), [state, babyBinding, addDiaper, updateDiaper, deleteDiaper, loadDiapers, loadDiaperRange, getDiaperRangeStatus, getLastDiaper, getTodaysCounts]);

  return <DiaperContext.Provider value={value}>{children}</DiaperContext.Provider>;
}

export function useDiaper(): DiaperContextValue {
  const context = useContext(DiaperContext);
  if (!context) {
    throw new Error("useDiaper must be used within a DiaperProvider");
  }
  return context;
}

function transformDiaperFromRemote(data: Record<string, unknown>): StoredDiaperEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    type: data.type as DiaperType,
    stoolColor: data.stool_color as StoolColor | undefined,
    changedAt: data.changed_at as string,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}
