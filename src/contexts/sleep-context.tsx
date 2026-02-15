import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from "react";
import {
  SleepStorageService,
  StoredSleepEntry,
  CreateSleepInput,
  UpdateSleepInput,
} from "@/services/sleep-storage";
import {
  fetchSleepFromDatabase,
  createSleepInDatabase,
  updateSleepInDatabase,
  deleteSleepFromDatabase,
} from "@/services/activity-sync-service";
import type { SleepType } from "@/constants/activities";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange } from "@/services/sync";
import { acquireTimerLock, releaseTimerLock, updateTimerData } from "@/services/active-timer-service";
import { fetchWakeWindowPreference } from "@/services/push-token-service";
import {
  SleepAgeGroup,
  GoalSource,
  getSleepGoalInfo,
  getWakeWindowForAge,
  checkSleepMilestoneCrossing,
  getDefaultWakeWindowConfig,
  generateSlotsForNapCount,
} from "@/utils/sleepGoals";
import type { WakeWindowConfig, NapSlotWindow } from "@/types/wake-windows";
import { isNightTime, countNapsWithContinuation } from "@/utils/day-night-boundary";
import { startTimerLiveActivity, endTimerLiveActivity, endLiveActivityByType, updateTimerLiveActivity, pauseTimerLiveActivity, resumeTimerLiveActivity } from "@/services/live-activity-service";

export interface ActiveSleepTimer {
  isRunning: boolean;
  isPaused: boolean;
  startTime: Date;
  sleepType: SleepType;
  totalPausedMs: number;
  pausedAt?: Date;
}

export interface SleepState {
  sleeps: StoredSleepEntry[];
  activeTimer: ActiveSleepTimer | null;
  isLoading: boolean;
  dailyGoalMinutes: number;
  goalSource: GoalSource;
  currentAgeGroup: SleepAgeGroup | null;
  wakeWindowMinutes: number;
  wakeWindowConfig: WakeWindowConfig | null;
  showMilestoneSuggestion: boolean;
  suggestedGoalMinutes: number | null;
}

export type SleepAction =
  | { type: "SET_SLEEPS"; payload: StoredSleepEntry[] }
  | { type: "ADD_SLEEP"; payload: StoredSleepEntry }
  | { type: "UPDATE_SLEEP"; payload: StoredSleepEntry }
  | { type: "DELETE_SLEEP"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "START_TIMER"; payload: { startTime: Date; sleepType: SleepType } }
  | { type: "STOP_TIMER" }
  | { type: "UPDATE_TIMER_TYPE"; payload: SleepType }
  | { type: "SET_DAILY_GOAL"; payload: number }
  | { type: "SET_GOAL_SOURCE"; payload: GoalSource }
  | { type: "SET_AGE_GROUP"; payload: SleepAgeGroup | null }
  | { type: "SET_WAKE_WINDOW"; payload: number }
  | { type: "SET_SHOW_MILESTONE_SUGGESTION"; payload: boolean }
  | { type: "SET_SUGGESTED_GOAL"; payload: number | null }
  | { type: "SET_WAKE_WINDOW_CONFIG"; payload: WakeWindowConfig | null }
  | { type: "PAUSE_TIMER" }
  | { type: "RESUME_TIMER" }
  | { type: "RESTORE_TIMER"; payload: ActiveSleepTimer }
  | { type: "REMOTE_INSERT"; payload: StoredSleepEntry }
  | { type: "REMOTE_UPDATE"; payload: StoredSleepEntry }
  | { type: "REMOTE_DELETE"; payload: string };

const DEFAULT_DAILY_GOAL_MINUTES = 14 * 60; // 14 hours
const DEFAULT_WAKE_WINDOW_MINUTES = 150; // 2.5 hours

export const initialSleepState: SleepState = {
  sleeps: [],
  activeTimer: null,
  isLoading: true,
  dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
  goalSource: "age_based",
  currentAgeGroup: null,
  wakeWindowMinutes: DEFAULT_WAKE_WINDOW_MINUTES,
  wakeWindowConfig: null,
  showMilestoneSuggestion: false,
  suggestedGoalMinutes: null,
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
          isPaused: false,
          startTime: action.payload.startTime,
          sleepType: action.payload.sleepType,
          totalPausedMs: 0,
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

    case "SET_DAILY_GOAL":
      return { ...state, dailyGoalMinutes: action.payload };

    case "SET_GOAL_SOURCE":
      return { ...state, goalSource: action.payload };

    case "SET_AGE_GROUP":
      return { ...state, currentAgeGroup: action.payload };

    case "SET_WAKE_WINDOW":
      return { ...state, wakeWindowMinutes: action.payload };

    case "SET_SHOW_MILESTONE_SUGGESTION":
      return { ...state, showMilestoneSuggestion: action.payload };

    case "SET_SUGGESTED_GOAL":
      return { ...state, suggestedGoalMinutes: action.payload };

    case "SET_WAKE_WINDOW_CONFIG":
      return { ...state, wakeWindowConfig: action.payload };

    case "PAUSE_TIMER": {
      if (!state.activeTimer) return state;
      return {
        ...state,
        activeTimer: {
          ...state.activeTimer,
          isPaused: true,
          pausedAt: new Date(),
        },
      };
    }

    case "RESUME_TIMER": {
      if (!state.activeTimer || !state.activeTimer.pausedAt) return state;
      const pauseDuration = Date.now() - state.activeTimer.pausedAt.getTime();
      return {
        ...state,
        activeTimer: {
          ...state.activeTimer,
          isPaused: false,
          pausedAt: undefined,
          totalPausedMs: state.activeTimer.totalPausedMs + pauseDuration,
        },
      };
    }

    case "RESTORE_TIMER":
      return {
        ...state,
        activeTimer: action.payload,
      };

    case "REMOTE_INSERT": {
      const exists = state.sleeps.some(s => s.id === action.payload.id);
      if (exists) return state;
      return { ...state, sleeps: [...state.sleeps, action.payload] };
    }

    case "REMOTE_UPDATE": {
      const updatedSleeps = state.sleeps.map(s =>
        s.id === action.payload.id ? action.payload : s
      );
      return { ...state, sleeps: updatedSleeps };
    }

    case "REMOTE_DELETE": {
      const filteredSleeps = state.sleeps.filter(s => s.id !== action.payload);
      return { ...state, sleeps: filteredSleeps };
    }

    default:
      return state;
  }
}

export interface TimerLockResult {
  success: boolean;
  lockedByName?: string;
}

interface SleepContextValue extends SleepState {
  startSleep: (sleepType: SleepType, customStartTime?: Date) => Promise<TimerLockResult>;
  stopSleep: (requestedEndTime?: Date) => Promise<StoredSleepEntry | null>;
  changeSleepType: (sleepType: SleepType) => void;
  pauseSleep: () => Promise<void>;
  resumeSleep: () => Promise<void>;
  addSleep: (input: CreateSleepInput) => Promise<StoredSleepEntry>;
  updateSleep: (sleepId: string, input: UpdateSleepInput) => Promise<StoredSleepEntry | null>;
  deleteSleep: (sleepId: string) => Promise<boolean>;
  refreshSleeps: () => Promise<void>;
  getLastSleep: () => StoredSleepEntry | null;
  getTodaysTotalSleepMinutes: () => number;
  getWakeWindowProgress: () => number | undefined;
  getDailyProgress: () => number;
  setCustomGoal: (goalMinutes: number) => Promise<void>;
  resetToAgeBasedGoal: () => Promise<void>;
  dismissMilestoneSuggestion: (permanent?: boolean) => Promise<void>;
  acceptMilestoneSuggestion: () => Promise<void>;
  getCompletedNapsSinceNightSleep: () => number;
  getCurrentNapSlot: () => NapSlotWindow | null;
  setWakeWindowConfig: (config: WakeWindowConfig) => Promise<void>;
  setCustomWakeWindows: (slots: NapSlotWindow[]) => Promise<void>;
  resetToAgeBasedWakeWindows: () => Promise<void>;
  setNapCount: (count: number) => Promise<void>;
  isCurrentlyNightTime: () => boolean;
  setDayNightBoundary: (dayStartHour: number, dayEndHour: number) => Promise<void>;
  setNapContinuationMinutes: (minutes: number) => Promise<void>;
}

const SleepContext = createContext<SleepContextValue | null>(null);

export function SleepProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sleepReducer, initialSleepState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();
  const liveActivityIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('sleep_sessions', (change: RemoteChange) => {
      if (!selectedBaby) return;
      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

      switch (change.eventType) {
        case 'INSERT':
          if (change.new) dispatch({ type: "REMOTE_INSERT", payload: transformSleepFromRemote(change.new) });
          break;
        case 'UPDATE':
          if (change.new) dispatch({ type: "REMOTE_UPDATE", payload: transformSleepFromRemote(change.new) });
          break;
        case 'DELETE':
          if (change.old?.id) dispatch({ type: "REMOTE_DELETE", payload: change.old.id as string });
          break;
      }
    });
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('wake_window_preferences', (change: RemoteChange) => {
      if (!selectedBaby) return;
      const data = change.new;
      if (!data || data.baby_id !== selectedBaby.id) return;

      if (change.eventType === 'INSERT' || change.eventType === 'UPDATE') {
        const config: WakeWindowConfig = {
          napCount: data.nap_count as number,
          slots: data.wake_window_slots as NapSlotWindow[],
          source: data.source as "age_based" | "custom",
          dayStartHour: (data.day_start_hour as number | undefined) ?? 6,
          dayEndHour: (data.day_end_hour as number | undefined) ?? 19,
          napContinuationMinutes: (data.nap_continuation_minutes as number | undefined) ?? 15,
        };
        dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
        SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
      }
    });
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const loadSleeps = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_SLEEPS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      let sleeps: StoredSleepEntry[];

      if (user?.householdId) {
        try {
          sleeps = await fetchSleepFromDatabase(selectedBaby.id);
        } catch (error) {
          console.error("[SleepContext] Failed to fetch from database, using local:", error);
          sleeps = await SleepStorageService.getAllSleeps(selectedBaby.id);
        }
      } else {
        sleeps = await SleepStorageService.getAllSleeps(selectedBaby.id);
      }

      dispatch({ type: "SET_SLEEPS", payload: sleeps });

      const hasCustomGoal = await SleepStorageService.hasCustomGoal(selectedBaby.id);
      const storedGoal = await SleepStorageService.getDailyGoal(selectedBaby.id);

      const birthDate = selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined;
      const goalInfo = getSleepGoalInfo(
        birthDate,
        hasCustomGoal ? storedGoal : null
      );

      dispatch({ type: "SET_DAILY_GOAL", payload: goalInfo.targetMinutes });
      dispatch({ type: "SET_GOAL_SOURCE", payload: goalInfo.source });
      dispatch({ type: "SET_AGE_GROUP", payload: goalInfo.ageGroup });

      if (birthDate) {
        const wakeWindowInfo = getWakeWindowForAge(birthDate);
        dispatch({ type: "SET_WAKE_WINDOW", payload: wakeWindowInfo.targetMinutes });
      }

      let wakeConfig: WakeWindowConfig | null = null;

      if (user?.householdId) {
        try {
          const { data: dbPref } = await fetchWakeWindowPreference(selectedBaby.id);
          if (dbPref) {
            wakeConfig = {
              napCount: dbPref.nap_count,
              slots: dbPref.wake_window_slots,
              source: dbPref.source as "age_based" | "custom",
              dayStartHour: dbPref.day_start_hour ?? 6,
              dayEndHour: dbPref.day_end_hour ?? 19,
              napContinuationMinutes: dbPref.nap_continuation_minutes ?? 15,
            };
            await SleepStorageService.setWakeWindowConfig(selectedBaby.id, wakeConfig);
          }
        } catch (error) {
          console.error("[SleepContext] Failed to fetch wake window prefs from DB:", error);
        }
      }

      if (!wakeConfig) {
        wakeConfig = await SleepStorageService.getWakeWindowConfig(selectedBaby.id);
      }

      if (wakeConfig) {
        dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: wakeConfig });
      } else if (birthDate) {
        const defaultConfig = getDefaultWakeWindowConfig(birthDate);
        dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: defaultConfig });
        await SleepStorageService.setWakeWindowConfig(selectedBaby.id, defaultConfig);
      }

      if (birthDate && !hasCustomGoal) {
        const lastCheckDate = await SleepStorageService.getLastMilestoneCheckDate(selectedBaby.id);
        const dismissedMilestones = await SleepStorageService.getDismissedMilestones(selectedBaby.id);

        if (lastCheckDate) {
          const milestoneCrossing = checkSleepMilestoneCrossing(birthDate, lastCheckDate);
          if (
            milestoneCrossing?.shouldSuggestGoalUpdate &&
            !dismissedMilestones.includes(milestoneCrossing.newGroup.label)
          ) {
            const newGoalMinutes =
              ((milestoneCrossing.newGroup.totalSleepHoursMin +
                milestoneCrossing.newGroup.totalSleepHoursMax) /
                2) *
              60;
            dispatch({ type: "SET_SUGGESTED_GOAL", payload: newGoalMinutes });
            dispatch({ type: "SET_SHOW_MILESTONE_SUGGESTION", payload: true });
          }
        }

        await SleepStorageService.setLastMilestoneCheckDate(selectedBaby.id, new Date());
      }

      const activeTimer = await SleepStorageService.getActiveTimer(selectedBaby.id);
      if (activeTimer) {
        dispatch({
          type: "RESTORE_TIMER",
          payload: {
            isRunning: true,
            isPaused: activeTimer.isPaused ?? false,
            startTime: new Date(activeTimer.startedAt),
            sleepType: activeTimer.type,
            totalPausedMs: activeTimer.totalPausedMs ?? 0,
            pausedAt: activeTimer.pausedAt ? new Date(activeTimer.pausedAt) : undefined,
          },
        });

        if (activeTimer.liveActivityId) {
          liveActivityIdRef.current = activeTimer.liveActivityId;
        }
      }
    } catch (error) {
      console.error("[SleepContext] Failed to load sleeps:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [selectedBaby, user?.householdId]);

  useEffect(() => {
    loadSleeps();
  }, [loadSleeps, foregroundRefreshKey]);

  const startSleep = useCallback(async (sleepType: SleepType, customStartTime?: Date): Promise<{ success: boolean; lockedByName?: string }> => {
    if (!selectedBaby) return { success: false };

    if (user?.id) {
      try {
        const lockResult = await acquireTimerLock(selectedBaby.id, "sleep", user.id);
        if (!lockResult.success) {
          return { success: false, lockedByName: lockResult.lockHolderName };
        }
      } catch (error) {
        console.error("[SleepContext] Failed to acquire timer lock:", error);
      }
    }

    const startTime = customStartTime ?? new Date();
    dispatch({ type: "START_TIMER", payload: { startTime, sleepType } });

    const activityId = await startTimerLiveActivity("sleep", selectedBaby.name, sleepType, startTime);
    if (activityId) {
      liveActivityIdRef.current = activityId;
    }

    await SleepStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: startTime.toISOString(),
      type: sleepType,
      liveActivityId: activityId ?? undefined,
    });

    return { success: true };
  }, [selectedBaby, user?.id]);

  const stopSleep = useCallback(async (requestedEndTime?: Date): Promise<StoredSleepEntry | null> => {
    if (!selectedBaby || !state.activeTimer) return null;

    const endTime = requestedEndTime ?? new Date();
    const durationSeconds = Math.floor(
      (endTime.getTime() - state.activeTimer.startTime.getTime() - state.activeTimer.totalPausedMs) / 1000
    );

    if (durationSeconds < 60) {
      dispatch({ type: "STOP_TIMER" });
      await SleepStorageService.clearActiveTimer(selectedBaby.id);
      if (liveActivityIdRef.current) {
        await endTimerLiveActivity(liveActivityIdRef.current);
        liveActivityIdRef.current = null;
      } else {
        await endLiveActivityByType("sleep");
      }
      if (user?.id) {
        try { await releaseTimerLock(selectedBaby.id, "sleep", user.id); } catch {}
      }
      return null;
    }

    const sleepInput: CreateSleepInput = {
      babyId: selectedBaby.id,
      type: state.activeTimer.sleepType,
      startedAt: state.activeTimer.startTime,
      endedAt: endTime,
      durationSeconds,
    };

    let sleep: StoredSleepEntry;

    if (user?.householdId && user?.id) {
      sleep = await createSleepInDatabase(sleepInput, user.id);
    } else {
      sleep = await SleepStorageService.addSleep(sleepInput);
    }

    dispatch({ type: "ADD_SLEEP", payload: sleep });
    dispatch({ type: "STOP_TIMER" });
    await SleepStorageService.clearActiveTimer(selectedBaby.id);

    if (liveActivityIdRef.current) {
      await endTimerLiveActivity(liveActivityIdRef.current);
      liveActivityIdRef.current = null;
    } else {
      await endLiveActivityByType("sleep");
    }

    if (user?.id) {
      try {
        await releaseTimerLock(selectedBaby.id, "sleep", user.id);
      } catch (error) {
        console.error("[SleepContext] Failed to release timer lock:", error);
      }
    }

    return sleep;
  }, [selectedBaby, state.activeTimer, user?.householdId, user?.id]);

  const changeSleepType = useCallback((sleepType: SleepType) => {
    if (state.activeTimer?.isPaused) return;
    dispatch({ type: "UPDATE_TIMER_TYPE", payload: sleepType });
    if (selectedBaby && state.activeTimer) {
      SleepStorageService.setActiveTimer(selectedBaby.id, {
        startedAt: state.activeTimer.startTime.toISOString(),
        type: sleepType,
        liveActivityId: liveActivityIdRef.current ?? undefined,
        isPaused: state.activeTimer.isPaused,
        totalPausedMs: state.activeTimer.totalPausedMs,
        pausedAt: state.activeTimer.pausedAt?.toISOString(),
      });
      if (liveActivityIdRef.current) {
        updateTimerLiveActivity(liveActivityIdRef.current, sleepType);
      }
    }
  }, [selectedBaby, state.activeTimer]);

  const pauseSleep = useCallback(async () => {
    if (!selectedBaby || !state.activeTimer || state.activeTimer.isPaused) return;

    dispatch({ type: "PAUSE_TIMER" });

    if (liveActivityIdRef.current) {
      await pauseTimerLiveActivity(liveActivityIdRef.current);
    }

    await SleepStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: state.activeTimer.startTime.toISOString(),
      type: state.activeTimer.sleepType,
      liveActivityId: liveActivityIdRef.current ?? undefined,
      isPaused: true,
      pausedAt: new Date().toISOString(),
      totalPausedMs: state.activeTimer.totalPausedMs,
    });

    if (user?.id) {
      try {
        await updateTimerData(selectedBaby.id, "sleep", user.id, { isPaused: true });
      } catch (error) {
        console.error("[SleepContext] Failed to update timer data:", error);
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const resumeSleep = useCallback(async () => {
    if (!selectedBaby || !state.activeTimer || !state.activeTimer.isPaused) return;

    const now = new Date();
    const pauseDuration = state.activeTimer.pausedAt
      ? now.getTime() - state.activeTimer.pausedAt.getTime()
      : 0;
    const newTotalPausedMs = state.activeTimer.totalPausedMs + pauseDuration;

    dispatch({ type: "RESUME_TIMER" });

    if (liveActivityIdRef.current) {
      const activeElapsedSeconds = Math.floor(
        (now.getTime() - state.activeTimer.startTime.getTime() - newTotalPausedMs) / 1000
      );
      await resumeTimerLiveActivity(liveActivityIdRef.current, activeElapsedSeconds);
    }

    await SleepStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: state.activeTimer.startTime.toISOString(),
      type: state.activeTimer.sleepType,
      liveActivityId: liveActivityIdRef.current ?? undefined,
      isPaused: false,
      totalPausedMs: newTotalPausedMs,
    });

    if (user?.id) {
      try {
        await updateTimerData(selectedBaby.id, "sleep", user.id, { isPaused: false });
      } catch (error) {
        console.error("[SleepContext] Failed to update timer data:", error);
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const addSleep = useCallback(async (input: CreateSleepInput): Promise<StoredSleepEntry> => {
    let sleep: StoredSleepEntry;

    if (user?.householdId && user?.id) {
      sleep = await createSleepInDatabase(input, user.id);
    } else {
      sleep = await SleepStorageService.addSleep(input);
    }

    dispatch({ type: "ADD_SLEEP", payload: sleep });
    return sleep;
  }, [user?.householdId, user?.id]);

  const updateSleep = useCallback(async (
    sleepId: string,
    input: UpdateSleepInput
  ): Promise<StoredSleepEntry | null> => {
    if (!selectedBaby) return null;

    let updated: StoredSleepEntry | null;

    if (user?.householdId) {
      updated = await updateSleepInDatabase(selectedBaby.id, sleepId, input);
    } else {
      updated = await SleepStorageService.updateSleep(selectedBaby.id, sleepId, input);
    }

    if (updated) {
      dispatch({ type: "UPDATE_SLEEP", payload: updated });
    }
    return updated;
  }, [selectedBaby, user?.householdId]);

  const deleteSleep = useCallback(async (sleepId: string): Promise<boolean> => {
    if (!selectedBaby) return false;

    let result: boolean;

    if (user?.householdId) {
      result = await deleteSleepFromDatabase(selectedBaby.id, sleepId);
    } else {
      result = await SleepStorageService.deleteSleep(selectedBaby.id, sleepId);
    }

    if (result) {
      dispatch({ type: "DELETE_SLEEP", payload: sleepId });
    }
    return result;
  }, [selectedBaby, user?.householdId]);

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

    return Math.min(100, Math.round((awakeMinutes / state.wakeWindowMinutes) * 100));
  }, [getLastSleep, state.wakeWindowMinutes]);

  const getDailyProgress = useCallback((): number => {
    const totalMinutes = getTodaysTotalSleepMinutes();
    if (state.dailyGoalMinutes <= 0) return 100;
    const percentage = (totalMinutes / state.dailyGoalMinutes) * 100;
    return Math.min(100, Math.round(percentage));
  }, [getTodaysTotalSleepMinutes, state.dailyGoalMinutes]);

  const setCustomGoal = useCallback(
    async (goalMinutes: number): Promise<void> => {
      if (!selectedBaby) return;
      await SleepStorageService.setCustomGoal(selectedBaby.id, goalMinutes);
      dispatch({ type: "SET_DAILY_GOAL", payload: goalMinutes });
      dispatch({ type: "SET_GOAL_SOURCE", payload: "custom" });
    },
    [selectedBaby]
  );

  const resetToAgeBasedGoal = useCallback(async (): Promise<void> => {
    if (!selectedBaby) return;

    await SleepStorageService.clearCustomGoal(selectedBaby.id);

    const birthDate = selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined;
    const goalInfo = getSleepGoalInfo(birthDate, null);

    await SleepStorageService.setDailyGoal(selectedBaby.id, goalInfo.targetMinutes);
    dispatch({ type: "SET_DAILY_GOAL", payload: goalInfo.targetMinutes });
    dispatch({ type: "SET_GOAL_SOURCE", payload: "age_based" });
    dispatch({ type: "SET_AGE_GROUP", payload: goalInfo.ageGroup });
  }, [selectedBaby]);

  const dismissMilestoneSuggestion = useCallback(async (permanent = false): Promise<void> => {
    if (!selectedBaby || !state.currentAgeGroup) return;

    if (permanent) {
      await SleepStorageService.dismissMilestone(selectedBaby.id, state.currentAgeGroup.label);
    }
    dispatch({ type: "SET_SHOW_MILESTONE_SUGGESTION", payload: false });
    dispatch({ type: "SET_SUGGESTED_GOAL", payload: null });
  }, [selectedBaby, state.currentAgeGroup]);

  const acceptMilestoneSuggestion = useCallback(async (): Promise<void> => {
    if (!selectedBaby || !state.suggestedGoalMinutes) return;

    await SleepStorageService.setDailyGoal(selectedBaby.id, state.suggestedGoalMinutes);
    dispatch({ type: "SET_DAILY_GOAL", payload: state.suggestedGoalMinutes });
    dispatch({ type: "SET_SHOW_MILESTONE_SUGGESTION", payload: false });
    dispatch({ type: "SET_SUGGESTED_GOAL", payload: null });
  }, [selectedBaby, state.suggestedGoalMinutes]);

  const getCompletedNapsSinceNightSleep = useCallback((): number => {
    const nightSleeps = state.sleeps
      .filter(s => s.type === "night" && s.endedAt)
      .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime());

    const lastNightEnd = nightSleeps.length > 0
      ? new Date(nightSleeps[0].endedAt!)
      : new Date(new Date().setHours(0, 0, 0, 0));

    const napsSinceNight = state.sleeps.filter(
      s => s.type === "nap" && s.endedAt && new Date(s.startedAt) >= lastNightEnd
    );

    const threshold = state.wakeWindowConfig?.napContinuationMinutes ?? 15;
    return countNapsWithContinuation(napsSinceNight, threshold);
  }, [state.sleeps, state.wakeWindowConfig?.napContinuationMinutes]);

  const getCurrentNapSlot = useCallback((): NapSlotWindow | null => {
    if (!state.wakeWindowConfig) return null;
    const { slots } = state.wakeWindowConfig;
    if (slots.length === 0) return null;

    const dayStart = state.wakeWindowConfig.dayStartHour ?? 6;
    const dayEnd = state.wakeWindowConfig.dayEndHour ?? 19;
    if (isNightTime(new Date(), dayStart, dayEnd)) return null;

    const napsDone = getCompletedNapsSinceNightSleep();
    const slotIndex = Math.min(napsDone, slots.length - 1);
    return slots[slotIndex];
  }, [state.wakeWindowConfig, getCompletedNapsSinceNightSleep]);

  const setWakeWindowConfigMethod = useCallback(async (config: WakeWindowConfig): Promise<void> => {
    if (!selectedBaby) return;
    dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
    await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
  }, [selectedBaby]);

  const setCustomWakeWindows = useCallback(async (slots: NapSlotWindow[]): Promise<void> => {
    if (!selectedBaby || !state.wakeWindowConfig) return;
    const config: WakeWindowConfig = {
      ...state.wakeWindowConfig,
      slots,
      source: "custom",
    };
    dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
    await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
  }, [selectedBaby, state.wakeWindowConfig]);

  const resetToAgeBasedWakeWindows = useCallback(async (): Promise<void> => {
    if (!selectedBaby) return;
    const birthDate = selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined;
    if (!birthDate) return;
    const config = getDefaultWakeWindowConfig(birthDate);
    dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
    await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
  }, [selectedBaby]);

  const isCurrentlyNightTime = useCallback((): boolean => {
    const dayStart = state.wakeWindowConfig?.dayStartHour ?? 6;
    const dayEnd = state.wakeWindowConfig?.dayEndHour ?? 19;
    return isNightTime(new Date(), dayStart, dayEnd);
  }, [state.wakeWindowConfig?.dayStartHour, state.wakeWindowConfig?.dayEndHour]);

  const setDayNightBoundary = useCallback(async (dayStartHour: number, dayEndHour: number): Promise<void> => {
    if (!selectedBaby) return;
    const config: WakeWindowConfig = {
      ...(state.wakeWindowConfig ?? { napCount: 2, slots: [], source: "age_based" }),
      dayStartHour,
      dayEndHour,
    };
    dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
    await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
  }, [selectedBaby, state.wakeWindowConfig]);

  const setNapContinuationMinutes = useCallback(async (minutes: number): Promise<void> => {
    if (!selectedBaby) return;
    const config: WakeWindowConfig = {
      ...(state.wakeWindowConfig ?? { napCount: 2, slots: [], source: "age_based" }),
      napContinuationMinutes: minutes,
    };
    dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
    await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
  }, [selectedBaby, state.wakeWindowConfig]);

  const setNapCount = useCallback(async (count: number): Promise<void> => {
    if (!selectedBaby) return;
    const birthDate = selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined;
    if (!birthDate) return;

    const slots = generateSlotsForNapCount(count, birthDate);
    const config: WakeWindowConfig = {
      ...state.wakeWindowConfig,
      napCount: count,
      slots,
      source: "age_based",
    };
    dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
    await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
  }, [selectedBaby, state.wakeWindowConfig]);

  const value: SleepContextValue = {
    ...state,
    startSleep,
    stopSleep,
    changeSleepType,
    pauseSleep,
    resumeSleep,
    addSleep,
    updateSleep,
    deleteSleep,
    refreshSleeps: loadSleeps,
    getLastSleep,
    getTodaysTotalSleepMinutes,
    getWakeWindowProgress,
    getDailyProgress,
    setCustomGoal,
    resetToAgeBasedGoal,
    dismissMilestoneSuggestion,
    acceptMilestoneSuggestion,
    getCompletedNapsSinceNightSleep,
    getCurrentNapSlot,
    setWakeWindowConfig: setWakeWindowConfigMethod,
    setCustomWakeWindows,
    resetToAgeBasedWakeWindows,
    setNapCount,
    isCurrentlyNightTime,
    setDayNightBoundary,
    setNapContinuationMinutes,
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

function transformSleepFromRemote(data: Record<string, unknown>): StoredSleepEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    type: data.type as SleepType,
    startedAt: data.started_at as string,
    endedAt: data.ended_at as string | undefined,
    durationSeconds: data.duration_seconds as number | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

