import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef, useState } from "react";
import {
  TummyTimeStorageService,
  StoredTummyTimeEntry,
  CreateTummyTimeInput,
  UpdateTummyTimeInput,
} from "@/services/tummyTime-storage";
import {
  fetchTummyTimeFromDatabase,
  createTummyTimeInDatabase,
  updateTummyTimeInDatabase,
  deleteTummyTimeFromDatabase,
} from "@/services/activity-sync-service";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { useActiveTimers } from "./active-timers-context";
import { RemoteChange, tombstonedId, upsertById } from "@/services/sync";
import { acquireTimerLock, releaseTimerLock, updateTimerData, queuePendingLockRelease } from "@/services/active-timer-service";
import {
  AgeGroup,
  GoalSource,
  getGoalInfo,
  checkMilestoneCrossing,
} from "@/utils/tummyTimeGoals";
import { fetchActivityGoal, upsertActivityGoal } from "@/services/activity-goal-service";
import { startTimerLiveActivity, endTimerLiveActivity, endLiveActivityByType, pauseTimerLiveActivity, resumeTimerLiveActivity } from "@/services/live-activity-service";
import {
  BabyProviderBinding,
  type BabyProviderBindingToken,
  useBabyProviderBinding,
} from "@/hooks/useBabyProviderBinding";
import {
  acceptTimerCompletion,
  createTimerIdentity,
  markTimerCompletionDurable,
  type TimerIdentity,
} from "@/services/timer-completion-service";
import { type TimerLockReconciliationState } from "@/services/timer-lock-reconciliation";
import { editRunningTimerStartTime, restoreTimerLifecycle } from "@/services/timer-lifecycle";
import { createTummyTimeTimerAdapter } from "@/services/timer-adapters/tummy-time-timer-adapter";
import { useActivityRangeLoader } from "@/hooks/useActivityRangeLoader";
import type { ActivityRangeLoadOptions, ActivityRangeStatus, UtcActivityRange } from "@/services/activity-range-loader";

export interface ActiveTummyTimeTimer extends TimerIdentity {
  isRunning: boolean;
  lockState: TimerLockReconciliationState;
  isPaused: boolean;
  startTime: Date;
  totalPausedMs: number;
  pausedAt?: Date;
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
  | { type: "START_TIMER"; payload: { startTime: Date; lockState: TimerLockReconciliationState } & TimerIdentity }
  | { type: "STOP_TIMER" }
  | { type: "PAUSE_TIMER"; payload: { pausedAt: Date } }
  | { type: "RESUME_TIMER" }
  | { type: "RESTORE_TIMER"; payload: ActiveTummyTimeTimer }
  | { type: "EDIT_TIMER_START"; payload: Date }
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
      return { ...state, tummyTimes: upsertById(state.tummyTimes, action.payload) };

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
          isPaused: false,
          lockState: action.payload.lockState,
          startTime: action.payload.startTime,
          timerInstanceId: action.payload.timerInstanceId,
          activityId: action.payload.activityId,
          totalPausedMs: 0,
        },
      };

    case "STOP_TIMER":
      return { ...state, activeTimer: null };

    case "PAUSE_TIMER": {
      if (!state.activeTimer) return state;
      return {
        ...state,
        activeTimer: {
          ...state.activeTimer,
          isPaused: true,
          pausedAt: action.payload.pausedAt,
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

    case "EDIT_TIMER_START":
      if (!state.activeTimer) return state;
      return {
        ...state,
        activeTimer: { ...state.activeTimer, startTime: action.payload },
      };

    case "REMOTE_INSERT":
      return { ...state, tummyTimes: upsertById(state.tummyTimes, action.payload) };

    case "REMOTE_UPDATE": {
      return { ...state, tummyTimes: upsertById(state.tummyTimes, action.payload) };
    }

    case "REMOTE_DELETE": {
      const filteredTummyTimes = state.tummyTimes.filter(t => t.id !== action.payload);
      return { ...state, tummyTimes: filteredTummyTimes };
    }

    default:
      return state;
  }
}

export interface TimerLockResult {
  success: boolean;
  lockedByName?: string;
}

interface TummyTimeContextValue extends TummyTimeState {
  babyBinding: BabyProviderBinding;
  isStopping: boolean;
  startTummyTime: (requestedStartTime?: Date, requestedIdentity?: TimerIdentity) => Promise<TimerLockResult>;
  stopTummyTime: (requestedEndTime?: Date) => Promise<StoredTummyTimeEntry | null>;
  editTummyTimeStartTime: (startedAt: Date) => Promise<void>;
  pauseTummyTime: (requestedPauseTime?: Date) => Promise<void>;
  resumeTummyTime: (requestedResumeTime?: Date, widgetPauseDurationMs?: number) => Promise<void>;
  addTummyTime: (input: CreateTummyTimeInput) => Promise<StoredTummyTimeEntry>;
  updateTummyTime: (
    tummyTimeId: string,
    input: UpdateTummyTimeInput
  ) => Promise<StoredTummyTimeEntry | null>;
  deleteTummyTime: (tummyTimeId: string) => Promise<boolean>;
  refreshTummyTimes: () => Promise<void>;
  loadTummyTimeRange: (
    range: UtcActivityRange,
    options?: ActivityRangeLoadOptions
  ) => Promise<void>;
  getTummyTimeRangeStatus: (range: UtcActivityRange) => ActivityRangeStatus;
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
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();
  const userId = user?.id;
  const householdId = user?.householdId ?? undefined;
  const { refreshLocks } = useActiveTimers();
  const liveActivityIdRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);
  const [isStopping, setIsStopping] = useState(false);
  const stopVersionRef = useRef(0);
  const { babyBinding, beginBabyBinding, finishBabyBinding, isCurrentBabyBinding } =
    useBabyProviderBinding(selectedBaby?.id ?? null);
  const acceptTummyTimeRange = useCallback((entries: StoredTummyTimeEntry[]) => {
    dispatch({ type: "SET_TUMMY_TIMES", payload: entries });
  }, []);
  const {
    loadRange: loadTummyTimeRange,
    getRangeStatus: getTummyTimeRangeStatus,
  } = useActivityRangeLoader({
    table: "tummy_time_sessions",
    babyId: selectedBaby?.id ?? null,
    authenticated: Boolean(user?.householdId),
    storageScope: `${user?.id ?? "guest"}:${user?.householdId ?? "local"}:${selectedBaby?.id ?? "none"}`,
    acceptEntries: acceptTummyTimeRange,
  });

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('tummy_time_sessions', (change: RemoteChange) => {
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
          if (change.new) dispatch({ type: "REMOTE_INSERT", payload: transformTummyTimeFromRemote(change.new) });
          break;
        case 'UPDATE':
          if (change.new) dispatch({ type: "REMOTE_UPDATE", payload: transformTummyTimeFromRemote(change.new) });
          break;
      }
    });
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('activity_goals', (change: RemoteChange) => {
      if (!selectedBaby) return;
      const data = change.new;
      if (!data || data.baby_id !== selectedBaby.id || data.goal_type !== 'tummy_time') return;

      if (change.eventType === 'INSERT' || change.eventType === 'UPDATE') {
        const targetSeconds = data.target_value as number;
        const source = data.source as GoalSource;
        dispatch({ type: "SET_DAILY_GOAL", payload: targetSeconds });
        dispatch({ type: "SET_GOAL_SOURCE", payload: source });
        TummyTimeStorageService.setDailyGoal(selectedBaby.id, targetSeconds);
        if (source === 'custom') {
          TummyTimeStorageService.setCustomGoal(selectedBaby.id, targetSeconds);
        } else {
          TummyTimeStorageService.clearCustomGoal(selectedBaby.id);
        }
      }
    });
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const restoreTummyTimeTimer = useCallback(async (
    tummyTimes: StoredTummyTimeEntry[],
    bindingToken: BabyProviderBindingToken,
    stopVersionAtStart: number
  ) => {
    if (!selectedBaby) return;

    const adapter = createTummyTimeTimerAdapter({
      babyId: selectedBaby.id,
      dispatchRestoreTimer: restoredTimer => {
        dispatch({ type: "RESTORE_TIMER", payload: restoredTimer });
      },
    });

    await restoreTimerLifecycle({
      adapter,
      baby: selectedBaby,
      user: userId ? { id: userId, householdId } : null,
      completedRecords: tummyTimes,
      stopVersionAtStart,
      currentStopVersion: () => stopVersionRef.current,
      isStopping: () => isStoppingRef.current,
      isCurrentBabyBinding: () => isCurrentBabyBinding(bindingToken),
      liveActivityIdRef,
      refreshLocks,
      persistRecord: input =>
        householdId && userId
          ? createTummyTimeInDatabase(input, userId)
          : TummyTimeStorageService.addTummyTime(input),
      dispatchStopTimer: () => dispatch({ type: "STOP_TIMER" }),
      dispatchAddRecord: record => dispatch({ type: "ADD_TUMMY_TIME", payload: record }),
      errorLabel: "[TummyTimeContext]",
    });
  }, [householdId, isCurrentBabyBinding, refreshLocks, selectedBaby, userId]);

  const loadTummyTimes = useCallback(async () => {
    const bindingToken = beginBabyBinding(selectedBaby?.id ?? null);
    const isCurrentBinding = () => isCurrentBabyBinding(bindingToken);
    if (!selectedBaby) {
      dispatch({ type: "SET_TUMMY_TIMES", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      finishBabyBinding(bindingToken, "ready");
      return;
    }

    const stopVersionAtStart = stopVersionRef.current;
    let bindingStatus: "ready" | "error" = "ready";
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      let tummyTimes: StoredTummyTimeEntry[];

      if (user?.householdId) {
        try {
          tummyTimes = await fetchTummyTimeFromDatabase(selectedBaby.id);
        } catch (error) {
          if (!isCurrentBinding()) return;
          console.error("[TummyTimeContext] Failed to fetch from database, using local:", error);
          tummyTimes = await TummyTimeStorageService.getAllTummyTimes(selectedBaby.id);
        }
      } else {
        tummyTimes = await TummyTimeStorageService.getAllTummyTimes(selectedBaby.id);
      }

      if (!isCurrentBinding()) return;
      dispatch({ type: "SET_TUMMY_TIMES", payload: tummyTimes });

      const hasCustomGoal = await TummyTimeStorageService.hasCustomGoal(selectedBaby.id);
      const storedGoal = await TummyTimeStorageService.getDailyGoal(selectedBaby.id);
      if (!isCurrentBinding()) return;

      const birthDate = selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined;
      const goalInfo = getGoalInfo(
        birthDate,
        hasCustomGoal ? storedGoal : null
      );

      dispatch({ type: "SET_DAILY_GOAL", payload: goalInfo.goalSeconds });
      dispatch({ type: "SET_GOAL_SOURCE", payload: goalInfo.source });
      dispatch({ type: "SET_AGE_GROUP", payload: goalInfo.ageGroup });

      if (user?.householdId) {
        try {
          const { data: dbGoal } = await fetchActivityGoal(selectedBaby.id, 'tummy_time');
          if (!isCurrentBinding()) return;
          if (dbGoal) {
            dispatch({ type: "SET_DAILY_GOAL", payload: dbGoal.target_value });
            dispatch({ type: "SET_GOAL_SOURCE", payload: dbGoal.source as GoalSource });
            await TummyTimeStorageService.setDailyGoal(selectedBaby.id, dbGoal.target_value);
            if (!isCurrentBinding()) return;
            if (dbGoal.source === 'custom') {
              await TummyTimeStorageService.setCustomGoal(selectedBaby.id, dbGoal.target_value);
            } else {
              await TummyTimeStorageService.clearCustomGoal(selectedBaby.id);
            }
            if (!isCurrentBinding()) return;
          }
        } catch (error) {
          if (!isCurrentBinding()) return;
          console.error("[TummyTimeContext] Failed to fetch activity goal from DB:", error);
        }
      }

      if (birthDate && !hasCustomGoal) {
        const lastCheckDate = await TummyTimeStorageService.getLastMilestoneCheckDate(selectedBaby.id);
        const dismissedMilestones = await TummyTimeStorageService.getDismissedMilestones(selectedBaby.id);
        if (!isCurrentBinding()) return;

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
        if (!isCurrentBinding()) return;
      }

      await restoreTummyTimeTimer(tummyTimes, bindingToken, stopVersionAtStart);
    } catch (error) {
      if (!isCurrentBinding()) return;
      bindingStatus = "error";
      console.error("[TummyTimeContext] Failed to load tummy times:", error);
    } finally {
      if (isCurrentBinding()) {
        dispatch({ type: "SET_LOADING", payload: false });
        finishBabyBinding(bindingToken, bindingStatus);
      }
    }
  }, [beginBabyBinding, finishBabyBinding, isCurrentBabyBinding, restoreTummyTimeTimer, selectedBaby, user?.householdId]);

  useEffect(() => {
    loadTummyTimes();
  }, [loadTummyTimes, foregroundRefreshKey]);

  const startTummyTime = useCallback(async (requestedStartTime?: Date, requestedIdentity?: TimerIdentity): Promise<{ success: boolean; lockedByName?: string }> => {
    if (!selectedBaby) return { success: false };

    const startTime = requestedStartTime ?? new Date();
    const identity = requestedIdentity ?? createTimerIdentity();
    let lockState: TimerLockReconciliationState = "offline";
    if (user?.id) {
      try {
        const lockResult = await acquireTimerLock(
          selectedBaby.id,
          "tummy_time",
          user.id,
          { ...identity },
          requestedStartTime
        );
        if (!lockResult.success) {
          return { success: false, lockedByName: lockResult.lockHolderName };
        }
        lockState = "owned";
      } catch (error) {
        console.error("[TummyTimeContext] Failed to acquire timer lock (proceeding offline):", error);
      }
    }

    dispatch({ type: "START_TIMER", payload: { startTime, lockState, ...identity } });

    const activityId = await startTimerLiveActivity("tummyTime", selectedBaby.name, undefined, startTime);
    if (activityId) {
      liveActivityIdRef.current = activityId;
    }

    await TummyTimeStorageService.setActiveTimer(selectedBaby.id, {
      ...identity,
      startedAt: startTime.toISOString(),
      liveActivityId: activityId ?? undefined,
      lockState,
    });

    return { success: true };
  }, [selectedBaby, user?.id]);

  const stopTummyTime = useCallback(async (requestedEndTime?: Date): Promise<StoredTummyTimeEntry | null> => {
    if (!selectedBaby || !state.activeTimer) return null;
    if (isStoppingRef.current) return null;
    isStoppingRef.current = true;
    setIsStopping(true);
    stopVersionRef.current++;
    const activeTimer = state.activeTimer;

    const finishTimer = async () => {
      dispatch({ type: "STOP_TIMER" });
      try {
        await TummyTimeStorageService.clearActiveTimer(selectedBaby.id);
      } catch (error) {
        console.error("[TummyTimeContext] Failed to clear completed timer snapshot:", error);
      }
      try {
        const endedById = liveActivityIdRef.current
          ? await endTimerLiveActivity(liveActivityIdRef.current)
          : false;
        if (!endedById) {
          await endLiveActivityByType("tummyTime");
        }
        liveActivityIdRef.current = null;
      } catch (error) {
        console.error("[TummyTimeContext] Failed to end completed Live Activity:", error);
      }
      if (user?.id) {
        try {
          await releaseTimerLock(
            selectedBaby.id,
            "tummy_time",
            user.id,
            activeTimer.timerInstanceId,
            activeTimer.startTime.toISOString()
          );
        } catch (error) {
          console.error("[TummyTimeContext] Failed to release timer lock, queuing retry:", error);
          await queuePendingLockRelease(
            selectedBaby.id,
            "tummy_time",
            user.id,
            activeTimer.timerInstanceId,
            activeTimer.startTime.toISOString()
          );
        }
      }
    };

    try {
      const requestedStopTime =
        activeTimer.isPaused && activeTimer.pausedAt
          ? activeTimer.pausedAt
          : (requestedEndTime ?? new Date());
      const completion = await acceptTimerCompletion(
        selectedBaby.id,
        "tummy_time",
        activeTimer.startTime.toISOString(),
        activeTimer,
        requestedStopTime
      );
      const endTime = new Date(completion.stoppedAt);
      if (completion.status === "completed") {
        const existing = await TummyTimeStorageService.getTummyTimeById(
          selectedBaby.id,
          completion.activityId
        );
        await finishTimer();
        return existing;
      }

      const adapter = createTummyTimeTimerAdapter({
        babyId: selectedBaby.id,
        dispatchRestoreTimer: restoredTimer => {
          dispatch({ type: "RESTORE_TIMER", payload: restoredTimer });
        },
      });
      const tummyTimeInput = adapter.buildRecord(
        activeTimer.startTime,
        endTime,
        {
          timerInstanceId: activeTimer.timerInstanceId,
          activityId: activeTimer.activityId,
          isPaused: activeTimer.isPaused,
          totalPausedMs: activeTimer.totalPausedMs,
          pausedAt: activeTimer.pausedAt?.toISOString(),
        }
      );

      let tummyTime: StoredTummyTimeEntry;
      try {
        if (user?.householdId && user?.id) {
          tummyTime = await createTummyTimeInDatabase(tummyTimeInput, user.id);
        } else {
          tummyTime = await TummyTimeStorageService.addTummyTime(tummyTimeInput);
        }
      } catch (saveError) {
        console.error("[TummyTimeContext] Failed to durably complete timer:", saveError);
        throw saveError;
      }

      await markTimerCompletionDurable(completion);
      dispatch({ type: "ADD_TUMMY_TIME", payload: tummyTime });
      await finishTimer();
      return tummyTime;
    } finally {
      isStoppingRef.current = false;
      setIsStopping(false);
    }
  }, [selectedBaby, state.activeTimer, user?.householdId, user?.id]);

  const editTummyTimeStartTime = useCallback(async (startedAt: Date) => {
    if (!selectedBaby || !user?.id || !state.activeTimer) return;
    const activeTimer = state.activeTimer;
    const adapter = createTummyTimeTimerAdapter({
      babyId: selectedBaby.id,
      dispatchRestoreTimer: restoredTimer => {
        dispatch({ type: "RESTORE_TIMER", payload: restoredTimer });
      },
    });

    await editRunningTimerStartTime({
      adapter,
      baby: selectedBaby,
      userId: user.id,
      activeTimer: {
        timerInstanceId: activeTimer.timerInstanceId,
        activityId: activeTimer.activityId,
        startedAt: activeTimer.startTime.toISOString(),
        liveActivityId: liveActivityIdRef.current ?? undefined,
        isPaused: activeTimer.isPaused,
        pausedAt: activeTimer.pausedAt?.toISOString(),
        totalPausedMs: activeTimer.totalPausedMs,
        lockState: activeTimer.lockState,
      },
      payload: {
        timerInstanceId: activeTimer.timerInstanceId,
        activityId: activeTimer.activityId,
        isPaused: activeTimer.isPaused,
        pausedAt: activeTimer.pausedAt?.toISOString(),
        totalPausedMs: activeTimer.totalPausedMs,
      },
      startedAt,
      liveActivityIdRef,
      dispatchEditedStart: nextStart => {
        dispatch({ type: "EDIT_TIMER_START", payload: nextStart });
      },
    });
    await refreshLocks();
  }, [refreshLocks, selectedBaby, state.activeTimer, user?.id]);

  const pauseTummyTime = useCallback(async (requestedPauseTime?: Date) => {
    if (!selectedBaby || !state.activeTimer || state.activeTimer.isPaused) return;

    const now = requestedPauseTime ?? new Date();

    dispatch({ type: "PAUSE_TIMER", payload: { pausedAt: now } });

    if (liveActivityIdRef.current) {
      const activeElapsedSeconds = Math.floor(
        (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
      );
      await pauseTimerLiveActivity(liveActivityIdRef.current, activeElapsedSeconds);
    }

    await TummyTimeStorageService.setActiveTimer(selectedBaby.id, {
      timerInstanceId: state.activeTimer.timerInstanceId,
      activityId: state.activeTimer.activityId,
      startedAt: state.activeTimer.startTime.toISOString(),
      liveActivityId: liveActivityIdRef.current ?? undefined,
      isPaused: true,
      pausedAt: now.toISOString(),
      totalPausedMs: state.activeTimer.totalPausedMs,
      lockState: state.activeTimer.lockState,
    });

    if (user?.id) {
      try {
        const totalElapsed = Math.floor(
          (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
        );
        await updateTimerData(selectedBaby.id, "tummy_time", user.id, {
          timerInstanceId: state.activeTimer.timerInstanceId,
          activityId: state.activeTimer.activityId,
          isPaused: true,
          pausedAt: now.toISOString(),
          accumulatedSeconds: totalElapsed,
          totalPausedMs: state.activeTimer.totalPausedMs,
        });
      } catch (error) {
        console.error("[TummyTimeContext] Failed to update timer data:", error);
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const resumeTummyTime = useCallback(async (requestedResumeTime?: Date, widgetPauseDurationMs?: number) => {
    if (!selectedBaby || !state.activeTimer || !state.activeTimer.isPaused) return;

    const now = requestedResumeTime ?? new Date();
    const pauseDuration = widgetPauseDurationMs ?? (state.activeTimer.pausedAt
      ? now.getTime() - state.activeTimer.pausedAt.getTime()
      : 0);
    const newTotalPausedMs = state.activeTimer.totalPausedMs + pauseDuration;

    dispatch({ type: "RESUME_TIMER" });

    if (liveActivityIdRef.current) {
      const activeElapsedSeconds = Math.floor(
        (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
      );
      await resumeTimerLiveActivity(liveActivityIdRef.current, activeElapsedSeconds);
    }

    await TummyTimeStorageService.setActiveTimer(selectedBaby.id, {
      timerInstanceId: state.activeTimer.timerInstanceId,
      activityId: state.activeTimer.activityId,
      startedAt: state.activeTimer.startTime.toISOString(),
      liveActivityId: liveActivityIdRef.current ?? undefined,
      isPaused: false,
      totalPausedMs: newTotalPausedMs,
      lockState: state.activeTimer.lockState,
    });

    if (user?.id) {
      try {
        const activeElapsedSeconds = Math.floor(
          (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
        );
        await updateTimerData(selectedBaby.id, "tummy_time", user.id, {
          timerInstanceId: state.activeTimer.timerInstanceId,
          activityId: state.activeTimer.activityId,
          isPaused: false,
          totalPausedMs: newTotalPausedMs,
          effectiveStartTime: state.activeTimer.startTime.toISOString(),
          accumulatedSeconds: activeElapsedSeconds,
        });
      } catch (error) {
        console.error("[TummyTimeContext] Failed to update timer data:", error);
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const addTummyTime = useCallback(
    async (input: CreateTummyTimeInput): Promise<StoredTummyTimeEntry> => {
      let tummyTime: StoredTummyTimeEntry;

      if (user?.householdId && user?.id) {
        tummyTime = await createTummyTimeInDatabase(input, user.id);
      } else {
        tummyTime = await TummyTimeStorageService.addTummyTime(input);
      }

      dispatch({ type: "ADD_TUMMY_TIME", payload: tummyTime });
      return tummyTime;
    },
    [user?.householdId, user?.id]
  );

  const updateTummyTime = useCallback(
    async (
      tummyTimeId: string,
      input: UpdateTummyTimeInput
    ): Promise<StoredTummyTimeEntry | null> => {
      if (!selectedBaby) return null;

      let updated: StoredTummyTimeEntry | null;

      if (user?.householdId) {
        updated = await updateTummyTimeInDatabase(selectedBaby.id, tummyTimeId, input);
      } else {
        updated = await TummyTimeStorageService.updateTummyTime(
          selectedBaby.id,
          tummyTimeId,
          input
        );
      }

      if (updated) {
        dispatch({ type: "UPDATE_TUMMY_TIME", payload: updated });
      }
      return updated;
    },
    [selectedBaby, user?.householdId]
  );

  const deleteTummyTime = useCallback(
    async (tummyTimeId: string): Promise<boolean> => {
      if (!selectedBaby) return false;

      let result: boolean;

      if (user?.householdId) {
        result = await deleteTummyTimeFromDatabase(selectedBaby.id, tummyTimeId);
      } else {
        result = await TummyTimeStorageService.deleteTummyTime(
          selectedBaby.id,
          tummyTimeId
        );
      }

      if (result) {
        dispatch({ type: "DELETE_TUMMY_TIME", payload: tummyTimeId });
      }
      return result;
    },
    [selectedBaby, user?.householdId]
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
      if (user?.householdId) {
        upsertActivityGoal(selectedBaby.id, 'tummy_time', goalSeconds, state.goalSource).catch(
          (error) => console.error("[TummyTimeContext] Failed to sync goal:", error)
        );
      }
    },
    [selectedBaby, user?.householdId, state.goalSource]
  );

  const setCustomGoal = useCallback(
    async (goalSeconds: number): Promise<void> => {
      if (!selectedBaby) return;
      await TummyTimeStorageService.setCustomGoal(selectedBaby.id, goalSeconds);
      dispatch({ type: "SET_DAILY_GOAL", payload: goalSeconds });
      dispatch({ type: "SET_GOAL_SOURCE", payload: "custom" });
      if (user?.householdId) {
        upsertActivityGoal(selectedBaby.id, 'tummy_time', goalSeconds, 'custom').catch(
          (error) => console.error("[TummyTimeContext] Failed to sync goal:", error)
        );
      }
    },
    [selectedBaby, user?.householdId]
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
    if (user?.householdId) {
      upsertActivityGoal(selectedBaby.id, 'tummy_time', goalInfo.goalSeconds, 'age_based').catch(
        (error) => console.error("[TummyTimeContext] Failed to sync goal:", error)
      );
    }
  }, [selectedBaby, user?.householdId]);

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
    if (user?.householdId) {
      upsertActivityGoal(selectedBaby.id, 'tummy_time', state.suggestedGoalSeconds, 'age_based').catch(
        (error) => console.error("[TummyTimeContext] Failed to sync goal:", error)
      );
    }
  }, [selectedBaby, state.suggestedGoalSeconds, user?.householdId]);

  const value: TummyTimeContextValue = useMemo(() => ({
    ...state,
    babyBinding,
    isStopping,
    startTummyTime,
    stopTummyTime,
    editTummyTimeStartTime,
    pauseTummyTime,
    resumeTummyTime,
    addTummyTime,
    updateTummyTime,
    deleteTummyTime,
    refreshTummyTimes: loadTummyTimes,
    loadTummyTimeRange,
    getTummyTimeRangeStatus,
    getLastTummyTime,
    getTodaysTotalSeconds,
    getDailyProgress,
    getTodaysSessionCount,
    setDailyGoal: setDailyGoalCallback,
    setCustomGoal,
    resetToAgeBasedGoal,
    dismissMilestoneSuggestion,
    acceptMilestoneSuggestion,
  }), [state, babyBinding, isStopping, startTummyTime, stopTummyTime, editTummyTimeStartTime, pauseTummyTime, resumeTummyTime, addTummyTime, updateTummyTime, deleteTummyTime, loadTummyTimes, loadTummyTimeRange, getTummyTimeRangeStatus, getLastTummyTime, getTodaysTotalSeconds, getDailyProgress, getTodaysSessionCount, setDailyGoalCallback, setCustomGoal, resetToAgeBasedGoal, dismissMilestoneSuggestion, acceptMilestoneSuggestion]);

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
