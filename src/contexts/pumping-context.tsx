import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import {
  PumpingStorageService,
  StoredPumpingEntry,
  CreatePumpingInput,
  UpdatePumpingInput,
} from "@/services/pumping-storage";
import type { BreastSide } from "@/constants/activities";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange } from "@/services/sync";

export interface ActivePumpingTimer {
  isRunning: boolean;
  startTime: Date;
  side: BreastSide;
}

export interface PumpingState {
  pumpings: StoredPumpingEntry[];
  activeTimer: ActivePumpingTimer | null;
  isLoading: boolean;
}

export type PumpingAction =
  | { type: "SET_PUMPINGS"; payload: StoredPumpingEntry[] }
  | { type: "ADD_PUMPING"; payload: StoredPumpingEntry }
  | { type: "UPDATE_PUMPING"; payload: StoredPumpingEntry }
  | { type: "DELETE_PUMPING"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "START_TIMER"; payload: { startTime: Date; side: BreastSide } }
  | { type: "STOP_TIMER" }
  | { type: "UPDATE_TIMER_SIDE"; payload: BreastSide }
  | { type: "REMOTE_INSERT"; payload: StoredPumpingEntry }
  | { type: "REMOTE_UPDATE"; payload: StoredPumpingEntry }
  | { type: "REMOTE_DELETE"; payload: string };

export const initialPumpingState: PumpingState = {
  pumpings: [],
  activeTimer: null,
  isLoading: true,
};

export function pumpingReducer(state: PumpingState, action: PumpingAction): PumpingState {
  switch (action.type) {
    case "SET_PUMPINGS":
      return { ...state, pumpings: action.payload };

    case "ADD_PUMPING":
      return { ...state, pumpings: [...state.pumpings, action.payload] };

    case "UPDATE_PUMPING": {
      const updatedPumpings = state.pumpings.map(p =>
        p.id === action.payload.id ? action.payload : p
      );
      return { ...state, pumpings: updatedPumpings };
    }

    case "DELETE_PUMPING": {
      const filteredPumpings = state.pumpings.filter(p => p.id !== action.payload);
      return { ...state, pumpings: filteredPumpings };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "START_TIMER":
      return {
        ...state,
        activeTimer: {
          isRunning: true,
          startTime: action.payload.startTime,
          side: action.payload.side,
        },
      };

    case "STOP_TIMER":
      return { ...state, activeTimer: null };

    case "UPDATE_TIMER_SIDE":
      if (!state.activeTimer) return state;
      return {
        ...state,
        activeTimer: { ...state.activeTimer, side: action.payload },
      };

    case "REMOTE_INSERT": {
      const exists = state.pumpings.some(p => p.id === action.payload.id);
      if (exists) return state;
      return { ...state, pumpings: [...state.pumpings, action.payload] };
    }

    case "REMOTE_UPDATE": {
      const updatedPumpings = state.pumpings.map(p =>
        p.id === action.payload.id ? action.payload : p
      );
      return { ...state, pumpings: updatedPumpings };
    }

    case "REMOTE_DELETE": {
      const filteredPumpings = state.pumpings.filter(p => p.id !== action.payload);
      return { ...state, pumpings: filteredPumpings };
    }

    default:
      return state;
  }
}

interface PumpingContextValue extends PumpingState {
  startPumping: (side: BreastSide) => Promise<void>;
  stopPumping: (volumeMl: number) => Promise<StoredPumpingEntry | null>;
  changePumpingSide: (side: BreastSide) => void;
  addPumping: (input: CreatePumpingInput) => Promise<StoredPumpingEntry>;
  updatePumping: (pumpingId: string, input: UpdatePumpingInput) => Promise<StoredPumpingEntry | null>;
  deletePumping: (pumpingId: string) => Promise<boolean>;
  refreshPumpings: () => Promise<void>;
  getLastPumping: () => StoredPumpingEntry | null;
  getTodaysTotalVolume: () => number;
  getLastSide: () => BreastSide | null;
}

const PumpingContext = createContext<PumpingContextValue | null>(null);

export function PumpingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(pumpingReducer, initialPumpingState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, enqueueOperation } = useSync();
  const { user: _user } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('pumping_sessions', (change: RemoteChange) => {
      if (!selectedBaby) return;
      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

      switch (change.eventType) {
        case 'INSERT':
          if (change.new) dispatch({ type: "REMOTE_INSERT", payload: transformPumpingFromRemote(change.new) });
          break;
        case 'UPDATE':
          if (change.new) dispatch({ type: "REMOTE_UPDATE", payload: transformPumpingFromRemote(change.new) });
          break;
        case 'DELETE':
          if (change.old?.id) dispatch({ type: "REMOTE_DELETE", payload: change.old.id as string });
          break;
      }
    });
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const loadPumpings = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_PUMPINGS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    const pumpings = await PumpingStorageService.getAllPumpings(selectedBaby.id);
    dispatch({ type: "SET_PUMPINGS", payload: pumpings });

    const activeTimer = await PumpingStorageService.getActiveTimer(selectedBaby.id);
    if (activeTimer) {
      dispatch({
        type: "START_TIMER",
        payload: {
          startTime: new Date(activeTimer.startedAt),
          side: activeTimer.side,
        },
      });
    }

    dispatch({ type: "SET_LOADING", payload: false });
  }, [selectedBaby]);

  useEffect(() => {
    loadPumpings();
  }, [loadPumpings]);

  const startPumping = useCallback(async (side: BreastSide) => {
    if (!selectedBaby) return;

    const startTime = new Date();
    dispatch({ type: "START_TIMER", payload: { startTime, side } });

    await PumpingStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: startTime.toISOString(),
      side,
    });
  }, [selectedBaby]);

  const stopPumping = useCallback(async (volumeMl: number): Promise<StoredPumpingEntry | null> => {
    if (!selectedBaby || !state.activeTimer) return null;

    const endTime = new Date();
    const durationSeconds = Math.floor(
      (endTime.getTime() - state.activeTimer.startTime.getTime()) / 1000
    );

    const pumping = await PumpingStorageService.addPumping({
      babyId: selectedBaby.id,
      side: state.activeTimer.side,
      startedAt: state.activeTimer.startTime,
      endedAt: endTime,
      durationSeconds,
      volumeMl,
    });

    dispatch({ type: "ADD_PUMPING", payload: pumping });
    dispatch({ type: "STOP_TIMER" });
    await PumpingStorageService.clearActiveTimer(selectedBaby.id);

    return pumping;
  }, [selectedBaby, state.activeTimer]);

  const changePumpingSide = useCallback((side: BreastSide) => {
    dispatch({ type: "UPDATE_TIMER_SIDE", payload: side });
    if (selectedBaby && state.activeTimer) {
      PumpingStorageService.setActiveTimer(selectedBaby.id, {
        startedAt: state.activeTimer.startTime.toISOString(),
        side,
      });
    }
  }, [selectedBaby, state.activeTimer]);

  const addPumping = useCallback(async (input: CreatePumpingInput): Promise<StoredPumpingEntry> => {
    const pumping = await PumpingStorageService.addPumping(input);
    dispatch({ type: "ADD_PUMPING", payload: pumping });
    await enqueueOperation({ type: 'CREATE', table: 'pumping_sessions', entityId: pumping.id, data: transformPumpingToSync(pumping) });
    return pumping;
  }, [enqueueOperation]);

  const updatePumping = useCallback(async (
    pumpingId: string,
    input: UpdatePumpingInput
  ): Promise<StoredPumpingEntry | null> => {
    if (!selectedBaby) return null;

    const updated = await PumpingStorageService.updatePumping(
      selectedBaby.id,
      pumpingId,
      input
    );
    if (updated) {
      dispatch({ type: "UPDATE_PUMPING", payload: updated });
      await enqueueOperation({ type: 'UPDATE', table: 'pumping_sessions', entityId: pumpingId, data: transformPumpingToSync(updated) });
    }
    return updated;
  }, [selectedBaby, enqueueOperation]);

  const deletePumping = useCallback(async (pumpingId: string): Promise<boolean> => {
    if (!selectedBaby) return false;

    const result = await PumpingStorageService.deletePumping(selectedBaby.id, pumpingId);
    if (result) {
      dispatch({ type: "DELETE_PUMPING", payload: pumpingId });
      await enqueueOperation({ type: 'DELETE', table: 'pumping_sessions', entityId: pumpingId, data: null });
    }
    return result;
  }, [selectedBaby, enqueueOperation]);

  const getLastPumping = useCallback((): StoredPumpingEntry | null => {
    if (state.pumpings.length === 0) return null;

    const sorted = [...state.pumpings].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  }, [state.pumpings]);

  const getTodaysTotalVolume = useCallback((): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysPumpings = state.pumpings.filter(p => {
      const pumpingDate = new Date(p.startedAt);
      pumpingDate.setHours(0, 0, 0, 0);
      return pumpingDate.getTime() === today.getTime();
    });

    return todaysPumpings.reduce((sum, p) => sum + (p.volumeMl ?? 0), 0);
  }, [state.pumpings]);

  const getLastSide = useCallback((): BreastSide | null => {
    const lastPumping = getLastPumping();
    return lastPumping?.side ?? null;
  }, [getLastPumping]);

  const value: PumpingContextValue = {
    ...state,
    startPumping,
    stopPumping,
    changePumpingSide,
    addPumping,
    updatePumping,
    deletePumping,
    refreshPumpings: loadPumpings,
    getLastPumping,
    getTodaysTotalVolume,
    getLastSide,
  };

  return <PumpingContext.Provider value={value}>{children}</PumpingContext.Provider>;
}

export function usePumping(): PumpingContextValue {
  const context = useContext(PumpingContext);
  if (!context) {
    throw new Error("usePumping must be used within a PumpingProvider");
  }
  return context;
}

function transformPumpingFromRemote(data: Record<string, unknown>): StoredPumpingEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    side: data.side as BreastSide,
    startedAt: data.started_at as string,
    endedAt: data.ended_at as string | undefined,
    durationSeconds: data.duration_seconds as number | undefined,
    volumeMl: data.volume_ml as number | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

function transformPumpingToSync(pumping: StoredPumpingEntry): Record<string, unknown> {
  return {
    id: pumping.id,
    baby_id: pumping.babyId,
    side: pumping.side,
    started_at: pumping.startedAt,
    ended_at: pumping.endedAt,
    duration_seconds: pumping.durationSeconds,
    amount_ml: pumping.volumeMl,
    notes: pumping.notes,
    logged_by: pumping.loggedBy,
  };
}
