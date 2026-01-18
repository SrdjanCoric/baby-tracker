import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import {
  TummyTimeStorageService,
  StoredTummyTimeEntry,
  CreateTummyTimeInput,
  UpdateTummyTimeInput,
} from "@/services/tummyTime-storage";
import { useBaby } from "./baby-context";

export interface ActiveTummyTimeTimer {
  isRunning: boolean;
  startTime: Date;
}

export interface TummyTimeState {
  tummyTimes: StoredTummyTimeEntry[];
  activeTimer: ActiveTummyTimeTimer | null;
  isLoading: boolean;
  dailyGoalSeconds: number;
}

export type TummyTimeAction =
  | { type: "SET_TUMMY_TIMES"; payload: StoredTummyTimeEntry[] }
  | { type: "ADD_TUMMY_TIME"; payload: StoredTummyTimeEntry }
  | { type: "UPDATE_TUMMY_TIME"; payload: StoredTummyTimeEntry }
  | { type: "DELETE_TUMMY_TIME"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_DAILY_GOAL"; payload: number }
  | { type: "START_TIMER"; payload: { startTime: Date } }
  | { type: "STOP_TIMER" };

const DEFAULT_DAILY_GOAL_SECONDS = 1800;

export const initialTummyTimeState: TummyTimeState = {
  tummyTimes: [],
  activeTimer: null,
  isLoading: true,
  dailyGoalSeconds: DEFAULT_DAILY_GOAL_SECONDS,
};

export function tummyTimeReducer(
  state: TummyTimeState,
  action: TummyTimeAction
): TummyTimeState {
  switch (action.type) {
    case "SET_TUMMY_TIMES":
      return { ...state, tummyTimes: action.payload };

    case "ADD_TUMMY_TIME":
      return { ...state, tummyTimes: [...state.tummyTimes, action.payload] };

    case "UPDATE_TUMMY_TIME": {
      const updatedTummyTimes = state.tummyTimes.map(t =>
        t.id === action.payload.id ? action.payload : t
      );
      return { ...state, tummyTimes: updatedTummyTimes };
    }

    case "DELETE_TUMMY_TIME": {
      const filteredTummyTimes = state.tummyTimes.filter(t => t.id !== action.payload);
      return { ...state, tummyTimes: filteredTummyTimes };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_DAILY_GOAL":
      return { ...state, dailyGoalSeconds: action.payload };

    case "START_TIMER":
      return {
        ...state,
        activeTimer: {
          isRunning: true,
          startTime: action.payload.startTime,
        },
      };

    case "STOP_TIMER":
      return { ...state, activeTimer: null };

    default:
      return state;
  }
}

interface TummyTimeContextValue extends TummyTimeState {
  startTummyTime: () => Promise<void>;
  stopTummyTime: () => Promise<StoredTummyTimeEntry | null>;
  addTummyTime: (input: CreateTummyTimeInput) => Promise<StoredTummyTimeEntry>;
  updateTummyTime: (
    tummyTimeId: string,
    input: UpdateTummyTimeInput
  ) => Promise<StoredTummyTimeEntry | null>;
  deleteTummyTime: (tummyTimeId: string) => Promise<boolean>;
  refreshTummyTimes: () => Promise<void>;
  getLastTummyTime: () => StoredTummyTimeEntry | null;
  getTodaysTotalSeconds: () => number;
  getDailyProgress: () => number;
  setDailyGoal: (goalSeconds: number) => Promise<void>;
}

const TummyTimeContext = createContext<TummyTimeContextValue | null>(null);

export function TummyTimeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tummyTimeReducer, initialTummyTimeState);
  const { selectedBaby } = useBaby();

  const loadTummyTimes = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_TUMMY_TIMES", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    const tummyTimes = await TummyTimeStorageService.getAllTummyTimes(selectedBaby.id);
    dispatch({ type: "SET_TUMMY_TIMES", payload: tummyTimes });

    const dailyGoal = await TummyTimeStorageService.getDailyGoal(selectedBaby.id);
    dispatch({ type: "SET_DAILY_GOAL", payload: dailyGoal });

    const activeTimer = await TummyTimeStorageService.getActiveTimer(selectedBaby.id);
    if (activeTimer) {
      dispatch({
        type: "START_TIMER",
        payload: {
          startTime: new Date(activeTimer.startedAt),
        },
      });
    }

    dispatch({ type: "SET_LOADING", payload: false });
  }, [selectedBaby]);

  useEffect(() => {
    loadTummyTimes();
  }, [loadTummyTimes]);

  const startTummyTime = useCallback(async () => {
    if (!selectedBaby) return;

    const startTime = new Date();
    dispatch({ type: "START_TIMER", payload: { startTime } });

    await TummyTimeStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: startTime.toISOString(),
    });
  }, [selectedBaby]);

  const stopTummyTime = useCallback(async (): Promise<StoredTummyTimeEntry | null> => {
    if (!selectedBaby || !state.activeTimer) return null;

    const endTime = new Date();
    const durationSeconds = Math.floor(
      (endTime.getTime() - state.activeTimer.startTime.getTime()) / 1000
    );

    const tummyTime = await TummyTimeStorageService.addTummyTime({
      babyId: selectedBaby.id,
      startedAt: state.activeTimer.startTime,
      endedAt: endTime,
      durationSeconds,
    });

    dispatch({ type: "ADD_TUMMY_TIME", payload: tummyTime });
    dispatch({ type: "STOP_TIMER" });
    await TummyTimeStorageService.clearActiveTimer(selectedBaby.id);

    return tummyTime;
  }, [selectedBaby, state.activeTimer]);

  const addTummyTime = useCallback(
    async (input: CreateTummyTimeInput): Promise<StoredTummyTimeEntry> => {
      const tummyTime = await TummyTimeStorageService.addTummyTime(input);
      dispatch({ type: "ADD_TUMMY_TIME", payload: tummyTime });
      return tummyTime;
    },
    []
  );

  const updateTummyTime = useCallback(
    async (
      tummyTimeId: string,
      input: UpdateTummyTimeInput
    ): Promise<StoredTummyTimeEntry | null> => {
      if (!selectedBaby) return null;

      const updated = await TummyTimeStorageService.updateTummyTime(
        selectedBaby.id,
        tummyTimeId,
        input
      );
      if (updated) {
        dispatch({ type: "UPDATE_TUMMY_TIME", payload: updated });
      }
      return updated;
    },
    [selectedBaby]
  );

  const deleteTummyTime = useCallback(
    async (tummyTimeId: string): Promise<boolean> => {
      if (!selectedBaby) return false;

      const result = await TummyTimeStorageService.deleteTummyTime(
        selectedBaby.id,
        tummyTimeId
      );
      if (result) {
        dispatch({ type: "DELETE_TUMMY_TIME", payload: tummyTimeId });
      }
      return result;
    },
    [selectedBaby]
  );

  const getLastTummyTime = useCallback((): StoredTummyTimeEntry | null => {
    if (state.tummyTimes.length === 0) return null;

    const sorted = [...state.tummyTimes].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  }, [state.tummyTimes]);

  const getTodaysTotalSeconds = useCallback((): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysTummyTimes = state.tummyTimes.filter(t => {
      const tummyTimeDate = new Date(t.startedAt);
      tummyTimeDate.setHours(0, 0, 0, 0);
      return tummyTimeDate.getTime() === today.getTime();
    });

    return todaysTummyTimes.reduce((sum, t) => sum + (t.durationSeconds ?? 0), 0);
  }, [state.tummyTimes]);

  const getDailyProgress = useCallback((): number => {
    const totalSeconds = getTodaysTotalSeconds();
    if (state.dailyGoalSeconds <= 0) return 100;
    const percentage = (totalSeconds / state.dailyGoalSeconds) * 100;
    return Math.min(100, Math.round(percentage));
  }, [getTodaysTotalSeconds, state.dailyGoalSeconds]);

  const setDailyGoalCallback = useCallback(
    async (goalSeconds: number): Promise<void> => {
      if (!selectedBaby) return;
      await TummyTimeStorageService.setDailyGoal(selectedBaby.id, goalSeconds);
      dispatch({ type: "SET_DAILY_GOAL", payload: goalSeconds });
    },
    [selectedBaby]
  );

  const value: TummyTimeContextValue = {
    ...state,
    startTummyTime,
    stopTummyTime,
    addTummyTime,
    updateTummyTime,
    deleteTummyTime,
    refreshTummyTimes: loadTummyTimes,
    getLastTummyTime,
    getTodaysTotalSeconds,
    getDailyProgress,
    setDailyGoal: setDailyGoalCallback,
  };

  return (
    <TummyTimeContext.Provider value={value}>{children}</TummyTimeContext.Provider>
  );
}

export function useTummyTime(): TummyTimeContextValue {
  const context = useContext(TummyTimeContext);
  if (!context) {
    throw new Error("useTummyTime must be used within a TummyTimeProvider");
  }
  return context;
}
