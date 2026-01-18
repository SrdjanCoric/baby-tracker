import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import {
  SleepStorageService,
  StoredSleepEntry,
  CreateSleepInput,
  UpdateSleepInput,
} from "@/services/sleep-storage";
import type { SleepType } from "@/constants/activities";
import { useBaby } from "./baby-context";

export interface ActiveSleepTimer {
  isRunning: boolean;
  startTime: Date;
  sleepType: SleepType;
}

export interface SleepState {
  sleeps: StoredSleepEntry[];
  activeTimer: ActiveSleepTimer | null;
  isLoading: boolean;
}

export type SleepAction =
  | { type: "SET_SLEEPS"; payload: StoredSleepEntry[] }
  | { type: "ADD_SLEEP"; payload: StoredSleepEntry }
  | { type: "UPDATE_SLEEP"; payload: StoredSleepEntry }
  | { type: "DELETE_SLEEP"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "START_TIMER"; payload: { startTime: Date; sleepType: SleepType } }
  | { type: "STOP_TIMER" }
  | { type: "UPDATE_TIMER_TYPE"; payload: SleepType };

export const initialSleepState: SleepState = {
  sleeps: [],
  activeTimer: null,
  isLoading: true,
};

export function sleepReducer(state: SleepState, action: SleepAction): SleepState {
  switch (action.type) {
    case "SET_SLEEPS":
      return { ...state, sleeps: action.payload };

    case "ADD_SLEEP":
      return { ...state, sleeps: [...state.sleeps, action.payload] };

    case "UPDATE_SLEEP": {
      const updatedSleeps = state.sleeps.map(s =>
        s.id === action.payload.id ? action.payload : s
      );
      return { ...state, sleeps: updatedSleeps };
    }

    case "DELETE_SLEEP": {
      const filteredSleeps = state.sleeps.filter(s => s.id !== action.payload);
      return { ...state, sleeps: filteredSleeps };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "START_TIMER":
      return {
        ...state,
        activeTimer: {
          isRunning: true,
          startTime: action.payload.startTime,
          sleepType: action.payload.sleepType,
        },
      };

    case "STOP_TIMER":
      return { ...state, activeTimer: null };

    case "UPDATE_TIMER_TYPE":
      if (!state.activeTimer) return state;
      return {
        ...state,
        activeTimer: { ...state.activeTimer, sleepType: action.payload },
      };

    default:
      return state;
  }
}

interface SleepContextValue extends SleepState {
  startSleep: (sleepType: SleepType) => Promise<void>;
  stopSleep: () => Promise<StoredSleepEntry | null>;
  changeSleepType: (sleepType: SleepType) => void;
  addSleep: (input: CreateSleepInput) => Promise<StoredSleepEntry>;
  updateSleep: (sleepId: string, input: UpdateSleepInput) => Promise<StoredSleepEntry | null>;
  deleteSleep: (sleepId: string) => Promise<boolean>;
  refreshSleeps: () => Promise<void>;
  getLastSleep: () => StoredSleepEntry | null;
  getTodaysTotalSleepMinutes: () => number;
  getWakeWindowProgress: () => number | undefined;
}

const SleepContext = createContext<SleepContextValue | null>(null);

export function SleepProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sleepReducer, initialSleepState);
  const { selectedBaby } = useBaby();

  const loadSleeps = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_SLEEPS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    const sleeps = await SleepStorageService.getAllSleeps(selectedBaby.id);
    dispatch({ type: "SET_SLEEPS", payload: sleeps });

    const activeTimer = await SleepStorageService.getActiveTimer(selectedBaby.id);
    if (activeTimer) {
      dispatch({
        type: "START_TIMER",
        payload: {
          startTime: new Date(activeTimer.startedAt),
          sleepType: activeTimer.type,
        },
      });
    }

    dispatch({ type: "SET_LOADING", payload: false });
  }, [selectedBaby]);

  useEffect(() => {
    loadSleeps();
  }, [loadSleeps]);

  const startSleep = useCallback(async (sleepType: SleepType) => {
    if (!selectedBaby) return;

    const startTime = new Date();
    dispatch({ type: "START_TIMER", payload: { startTime, sleepType } });

    await SleepStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: startTime.toISOString(),
      type: sleepType,
    });
  }, [selectedBaby]);

  const stopSleep = useCallback(async (): Promise<StoredSleepEntry | null> => {
    if (!selectedBaby || !state.activeTimer) return null;

    const endTime = new Date();
    const durationSeconds = Math.floor(
      (endTime.getTime() - state.activeTimer.startTime.getTime()) / 1000
    );

    const sleep = await SleepStorageService.addSleep({
      babyId: selectedBaby.id,
      type: state.activeTimer.sleepType,
      startedAt: state.activeTimer.startTime,
      endedAt: endTime,
      durationSeconds,
    });

    dispatch({ type: "ADD_SLEEP", payload: sleep });
    dispatch({ type: "STOP_TIMER" });
    await SleepStorageService.clearActiveTimer(selectedBaby.id);

    return sleep;
  }, [selectedBaby, state.activeTimer]);

  const changeSleepType = useCallback((sleepType: SleepType) => {
    dispatch({ type: "UPDATE_TIMER_TYPE", payload: sleepType });
    if (selectedBaby && state.activeTimer) {
      SleepStorageService.setActiveTimer(selectedBaby.id, {
        startedAt: state.activeTimer.startTime.toISOString(),
        type: sleepType,
      });
    }
  }, [selectedBaby, state.activeTimer]);

  const addSleep = useCallback(async (input: CreateSleepInput): Promise<StoredSleepEntry> => {
    const sleep = await SleepStorageService.addSleep(input);
    dispatch({ type: "ADD_SLEEP", payload: sleep });
    return sleep;
  }, []);

  const updateSleep = useCallback(async (
    sleepId: string,
    input: UpdateSleepInput
  ): Promise<StoredSleepEntry | null> => {
    if (!selectedBaby) return null;

    const updated = await SleepStorageService.updateSleep(
      selectedBaby.id,
      sleepId,
      input
    );
    if (updated) {
      dispatch({ type: "UPDATE_SLEEP", payload: updated });
    }
    return updated;
  }, [selectedBaby]);

  const deleteSleep = useCallback(async (sleepId: string): Promise<boolean> => {
    if (!selectedBaby) return false;

    const result = await SleepStorageService.deleteSleep(selectedBaby.id, sleepId);
    if (result) {
      dispatch({ type: "DELETE_SLEEP", payload: sleepId });
    }
    return result;
  }, [selectedBaby]);

  const getLastSleep = useCallback((): StoredSleepEntry | null => {
    if (state.sleeps.length === 0) return null;

    const sorted = [...state.sleeps].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  }, [state.sleeps]);

  const getTodaysTotalSleepMinutes = useCallback((): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysSleeps = state.sleeps.filter(s => {
      const sleepDate = new Date(s.startedAt);
      sleepDate.setHours(0, 0, 0, 0);
      return sleepDate.getTime() === today.getTime();
    });

    const totalSeconds = todaysSleeps.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
    return Math.floor(totalSeconds / 60);
  }, [state.sleeps]);

  const getWakeWindowProgress = useCallback((): number | undefined => {
    const lastSleep = getLastSleep();
    if (!lastSleep || !lastSleep.endedAt) return undefined;

    const awakeMinutes = Math.floor(
      (Date.now() - new Date(lastSleep.endedAt).getTime()) / (1000 * 60)
    );

    // Age-based wake windows (in minutes) - default to 2.5 hours for 4-6 month old
    // This could be enhanced to use baby's actual age from baby-context
    const maxWakeWindow = 150;

    return Math.min(100, Math.round((awakeMinutes / maxWakeWindow) * 100));
  }, [getLastSleep]);

  const value: SleepContextValue = {
    ...state,
    startSleep,
    stopSleep,
    changeSleepType,
    addSleep,
    updateSleep,
    deleteSleep,
    refreshSleeps: loadSleeps,
    getLastSleep,
    getTodaysTotalSleepMinutes,
    getWakeWindowProgress,
  };

  return <SleepContext.Provider value={value}>{children}</SleepContext.Provider>;
}

export function useSleep(): SleepContextValue {
  const context = useContext(SleepContext);
  if (!context) {
    throw new Error("useSleep must be used within a SleepProvider");
  }
  return context;
}
