import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import {
  TummyTimeStorageService,
  StoredTummyTimeEntry,
  CreateTummyTimeInput,
  UpdateTummyTimeInput,
} from "@/services/tummyTime-storage";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange } from "@/services/sync";
import {
  AgeGroup,
  GoalSource,
  getGoalInfo,
  checkMilestoneCrossing,
} from "@/utils/tummyTimeGoals";

export interface ActiveTummyTimeTimer {
  isRunning: boolean;
  startTime: Date;
}

export interface TummyTimeState {
  tummyTimes: StoredTummyTimeEntry[];
  activeTimer: ActiveTummyTimeTimer | null;
  isLoading: boolean;
  dailyGoalSeconds: number;
  goalSource: GoalSource;
  currentAgeGroup: AgeGroup | null;
  showMilestoneSuggestion: boolean;
  suggestedGoalSeconds: number | null;
}

export type TummyTimeAction =
  | { type: "SET_TUMMY_TIMES"; payload: StoredTummyTimeEntry[] }
  | { type: "ADD_TUMMY_TIME"; payload: StoredTummyTimeEntry }
  | { type: "UPDATE_TUMMY_TIME"; payload: StoredTummyTimeEntry }
  | { type: "DELETE_TUMMY_TIME"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_DAILY_GOAL"; payload: number }
  | { type: "SET_GOAL_SOURCE"; payload: GoalSource }
  | { type: "SET_AGE_GROUP"; payload: AgeGroup | null }
  | { type: "SET_SHOW_MILESTONE_SUGGESTION"; payload: boolean }
  | { type: "SET_SUGGESTED_GOAL"; payload: number | null }
  | { type: "START_TIMER"; payload: { startTime: Date } }
  | { type: "STOP_TIMER" }
  | { type: "REMOTE_INSERT"; payload: StoredTummyTimeEntry }
  | { type: "REMOTE_UPDATE"; payload: StoredTummyTimeEntry }
  | { type: "REMOTE_DELETE"; payload: string };

const DEFAULT_DAILY_GOAL_SECONDS = 1800;

export const initialTummyTimeState: TummyTimeState = {
  tummyTimes: [],
  activeTimer: null,
  isLoading: true,
  dailyGoalSeconds: DEFAULT_DAILY_GOAL_SECONDS,
  goalSource: "age_based",
  currentAgeGroup: null,
  showMilestoneSuggestion: false,
  suggestedGoalSeconds: null,
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

    case "SET_GOAL_SOURCE":
      return { ...state, goalSource: action.payload };

    case "SET_AGE_GROUP":
      return { ...state, currentAgeGroup: action.payload };

    case "SET_SHOW_MILESTONE_SUGGESTION":
      return { ...state, showMilestoneSuggestion: action.payload };

    case "SET_SUGGESTED_GOAL":
      return { ...state, suggestedGoalSeconds: action.payload };

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

    case "REMOTE_INSERT": {
      const exists = state.tummyTimes.some(t => t.id === action.payload.id);
      if (exists) return state;
      return { ...state, tummyTimes: [...state.tummyTimes, action.payload] };
    }

    case "REMOTE_UPDATE": {
      const updatedTummyTimes = state.tummyTimes.map(t =>
        t.id === action.payload.id ? action.payload : t
      );
      return { ...state, tummyTimes: updatedTummyTimes };
    }

    case "REMOTE_DELETE": {
      const filteredTummyTimes = state.tummyTimes.filter(t => t.id !== action.payload);
      return { ...state, tummyTimes: filteredTummyTimes };
    }

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
  getTodaysSessionCount: () => number;
  setDailyGoal: (goalSeconds: number) => Promise<void>;
  setCustomGoal: (goalSeconds: number) => Promise<void>;
  resetToAgeBasedGoal: () => Promise<void>;
  dismissMilestoneSuggestion: () => Promise<void>;
  acceptMilestoneSuggestion: () => Promise<void>;
}

const TummyTimeContext = createContext<TummyTimeContextValue | null>(null);

export function TummyTimeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tummyTimeReducer, initialTummyTimeState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, enqueueOperation } = useSync();
  const { user: _user } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('tummy_time_sessions', (change: RemoteChange) => {
      if (!selectedBaby) return;
      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

      switch (change.eventType) {
        case 'INSERT':
          if (change.new) dispatch({ type: "REMOTE_INSERT", payload: transformTummyTimeFromRemote(change.new) });
          break;
        case 'UPDATE':
          if (change.new) dispatch({ type: "REMOTE_UPDATE", payload: transformTummyTimeFromRemote(change.new) });
          break;
        case 'DELETE':
          if (change.old?.id) dispatch({ type: "REMOTE_DELETE", payload: change.old.id as string });
          break;
      }
    });
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const loadTummyTimes = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_TUMMY_TIMES", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    const tummyTimes = await TummyTimeStorageService.getAllTummyTimes(selectedBaby.id);
    dispatch({ type: "SET_TUMMY_TIMES", payload: tummyTimes });

    const hasCustomGoal = await TummyTimeStorageService.hasCustomGoal(selectedBaby.id);
    const storedGoal = await TummyTimeStorageService.getDailyGoal(selectedBaby.id);

    const birthDate = selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined;
    const goalInfo = getGoalInfo(
      birthDate,
      hasCustomGoal ? storedGoal : null
    );

    dispatch({ type: "SET_DAILY_GOAL", payload: goalInfo.goalSeconds });
    dispatch({ type: "SET_GOAL_SOURCE", payload: goalInfo.source });
    dispatch({ type: "SET_AGE_GROUP", payload: goalInfo.ageGroup });

    if (birthDate && !hasCustomGoal) {
      const lastCheckDate = await TummyTimeStorageService.getLastMilestoneCheckDate(selectedBaby.id);
      const dismissedMilestones = await TummyTimeStorageService.getDismissedMilestones(selectedBaby.id);

      if (lastCheckDate) {
        const milestoneCrossing = checkMilestoneCrossing(birthDate, lastCheckDate);
        if (
          milestoneCrossing?.shouldSuggestGoalUpdate &&
          !dismissedMilestones.includes(milestoneCrossing.newGroup.label)
        ) {
          dispatch({ type: "SET_SUGGESTED_GOAL", payload: milestoneCrossing.newGroup.defaultGoalSeconds });
          dispatch({ type: "SET_SHOW_MILESTONE_SUGGESTION", payload: true });
        }
      }

      await TummyTimeStorageService.setLastMilestoneCheckDate(selectedBaby.id, new Date());
    }

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
      await enqueueOperation({ type: 'CREATE', table: 'tummy_time_sessions', entityId: tummyTime.id, data: transformTummyTimeToSync(tummyTime) });
      return tummyTime;
    },
    [enqueueOperation]
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
        await enqueueOperation({ type: 'UPDATE', table: 'tummy_time_sessions', entityId: tummyTimeId, data: transformTummyTimeToSync(updated) });
      }
      return updated;
    },
    [selectedBaby, enqueueOperation]
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
        await enqueueOperation({ type: 'DELETE', table: 'tummy_time_sessions', entityId: tummyTimeId, data: null });
      }
      return result;
    },
    [selectedBaby, enqueueOperation]
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

  const getTodaysSessionCount = useCallback((): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return state.tummyTimes.filter(t => {
      const tummyTimeDate = new Date(t.startedAt);
      tummyTimeDate.setHours(0, 0, 0, 0);
      return tummyTimeDate.getTime() === today.getTime();
    }).length;
  }, [state.tummyTimes]);

  const setDailyGoalCallback = useCallback(
    async (goalSeconds: number): Promise<void> => {
      if (!selectedBaby) return;
      await TummyTimeStorageService.setDailyGoal(selectedBaby.id, goalSeconds);
      dispatch({ type: "SET_DAILY_GOAL", payload: goalSeconds });
    },
    [selectedBaby]
  );

  const setCustomGoal = useCallback(
    async (goalSeconds: number): Promise<void> => {
      if (!selectedBaby) return;
      await TummyTimeStorageService.setCustomGoal(selectedBaby.id, goalSeconds);
      dispatch({ type: "SET_DAILY_GOAL", payload: goalSeconds });
      dispatch({ type: "SET_GOAL_SOURCE", payload: "custom" });
    },
    [selectedBaby]
  );

  const resetToAgeBasedGoal = useCallback(async (): Promise<void> => {
    if (!selectedBaby) return;

    await TummyTimeStorageService.clearCustomGoal(selectedBaby.id);

    const birthDate = selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined;
    const goalInfo = getGoalInfo(birthDate, null);

    await TummyTimeStorageService.setDailyGoal(selectedBaby.id, goalInfo.goalSeconds);
    dispatch({ type: "SET_DAILY_GOAL", payload: goalInfo.goalSeconds });
    dispatch({ type: "SET_GOAL_SOURCE", payload: "age_based" });
    dispatch({ type: "SET_AGE_GROUP", payload: goalInfo.ageGroup });
  }, [selectedBaby]);

  const dismissMilestoneSuggestion = useCallback(async (): Promise<void> => {
    if (!selectedBaby || !state.currentAgeGroup) return;

    await TummyTimeStorageService.dismissMilestone(selectedBaby.id, state.currentAgeGroup.label);
    dispatch({ type: "SET_SHOW_MILESTONE_SUGGESTION", payload: false });
    dispatch({ type: "SET_SUGGESTED_GOAL", payload: null });
  }, [selectedBaby, state.currentAgeGroup]);

  const acceptMilestoneSuggestion = useCallback(async (): Promise<void> => {
    if (!selectedBaby || !state.suggestedGoalSeconds) return;

    await TummyTimeStorageService.setDailyGoal(selectedBaby.id, state.suggestedGoalSeconds);
    dispatch({ type: "SET_DAILY_GOAL", payload: state.suggestedGoalSeconds });
    dispatch({ type: "SET_SHOW_MILESTONE_SUGGESTION", payload: false });
    dispatch({ type: "SET_SUGGESTED_GOAL", payload: null });
  }, [selectedBaby, state.suggestedGoalSeconds]);

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
    getTodaysSessionCount,
    setDailyGoal: setDailyGoalCallback,
    setCustomGoal,
    resetToAgeBasedGoal,
    dismissMilestoneSuggestion,
    acceptMilestoneSuggestion,
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

function transformTummyTimeFromRemote(data: Record<string, unknown>): StoredTummyTimeEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    startedAt: data.started_at as string,
    endedAt: data.ended_at as string | undefined,
    durationSeconds: data.duration_seconds as number | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

function transformTummyTimeToSync(tummyTime: StoredTummyTimeEntry): Record<string, unknown> {
  return {
    id: tummyTime.id,
    baby_id: tummyTime.babyId,
    started_at: tummyTime.startedAt,
    ended_at: tummyTime.endedAt,
    duration_seconds: tummyTime.durationSeconds,
    notes: tummyTime.notes,
    logged_by: tummyTime.loggedBy,
  };
}
