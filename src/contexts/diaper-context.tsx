import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import {
  DiaperStorageService,
  StoredDiaperEntry,
  CreateDiaperInput,
  UpdateDiaperInput,
  DiaperCounts,
} from "@/services/diaper-storage";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange } from "@/services/sync";
import type { DiaperType, StoolColor } from "@/constants/activities";

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
      return { ...state, diapers: [...state.diapers, action.payload] };

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

    case "REMOTE_INSERT": {
      const exists = state.diapers.some(d => d.id === action.payload.id);
      if (exists) return state;
      return { ...state, diapers: [...state.diapers, action.payload] };
    }

    case "REMOTE_UPDATE": {
      const updatedDiapers = state.diapers.map(d =>
        d.id === action.payload.id ? action.payload : d
      );
      return { ...state, diapers: updatedDiapers };
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
  addDiaper: (input: CreateDiaperInput) => Promise<StoredDiaperEntry>;
  updateDiaper: (diaperId: string, input: UpdateDiaperInput) => Promise<StoredDiaperEntry | null>;
  deleteDiaper: (diaperId: string) => Promise<boolean>;
  refreshDiapers: () => Promise<void>;
  getLastDiaper: () => StoredDiaperEntry | null;
  getTodaysCounts: () => DiaperCounts;
}

const DiaperContext = createContext<DiaperContextValue | null>(null);

export function DiaperProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(diaperReducer, initialDiaperState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, enqueueOperation } = useSync();
  const { user: _user } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('diapers', (change: RemoteChange) => {
      if (!selectedBaby) return;

      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

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
        case 'DELETE':
          if (change.old && change.old.id) {
            dispatch({
              type: "REMOTE_DELETE",
              payload: change.old.id as string,
            });
          }
          break;
      }
    });

    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const loadDiapers = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_DIAPERS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    const diapers = await DiaperStorageService.getAllDiapers(selectedBaby.id);
    dispatch({ type: "SET_DIAPERS", payload: diapers });

    dispatch({ type: "SET_LOADING", payload: false });
  }, [selectedBaby]);

  useEffect(() => {
    loadDiapers();
  }, [loadDiapers]);

  const addDiaper = useCallback(async (input: CreateDiaperInput): Promise<StoredDiaperEntry> => {
    const diaper = await DiaperStorageService.addDiaper(input);
    dispatch({ type: "ADD_DIAPER", payload: diaper });

    await enqueueOperation({
      type: 'CREATE',
      table: 'diapers',
      entityId: diaper.id,
      data: transformDiaperToSync(diaper),
    });

    return diaper;
  }, [enqueueOperation]);

  const updateDiaper = useCallback(async (
    diaperId: string,
    input: UpdateDiaperInput
  ): Promise<StoredDiaperEntry | null> => {
    if (!selectedBaby) return null;

    const updated = await DiaperStorageService.updateDiaper(
      selectedBaby.id,
      diaperId,
      input
    );
    if (updated) {
      dispatch({ type: "UPDATE_DIAPER", payload: updated });

      await enqueueOperation({
        type: 'UPDATE',
        table: 'diapers',
        entityId: diaperId,
        data: transformDiaperToSync(updated),
      });
    }
    return updated;
  }, [selectedBaby, enqueueOperation]);

  const deleteDiaper = useCallback(async (diaperId: string): Promise<boolean> => {
    if (!selectedBaby) return false;

    const result = await DiaperStorageService.deleteDiaper(selectedBaby.id, diaperId);
    if (result) {
      dispatch({ type: "DELETE_DIAPER", payload: diaperId });

      await enqueueOperation({
        type: 'DELETE',
        table: 'diapers',
        entityId: diaperId,
        data: null,
      });
    }
    return result;
  }, [selectedBaby, enqueueOperation]);

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

  const value: DiaperContextValue = {
    ...state,
    addDiaper,
    updateDiaper,
    deleteDiaper,
    refreshDiapers: loadDiapers,
    getLastDiaper,
    getTodaysCounts,
  };

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

function transformDiaperToSync(diaper: StoredDiaperEntry): Record<string, unknown> {
  return {
    id: diaper.id,
    baby_id: diaper.babyId,
    type: diaper.type,
    stool_color: diaper.stoolColor,
    changed_at: diaper.changedAt,
    notes: diaper.notes,
    logged_by: diaper.loggedBy,
  };
}
