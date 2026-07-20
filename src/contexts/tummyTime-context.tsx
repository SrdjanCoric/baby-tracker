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
import { RemoteChange, tombstonedId, upsertById } from "@/services/sync";
import { acquireTimerLock, releaseTimerLock, updateTimerData, getActiveTimerLock, queuePendingLockRelease } from "@/services/active-timer-service";
import {
  AgeGroup,
  GoalSource,
  getGoalInfo,
  checkMilestoneCrossing,
} from "@/utils/tummyTimeGoals";
import { fetchActivityGoal, upsertActivityGoal } from "@/services/activity-goal-service";
import { startTimerLiveActivity, endTimerLiveActivity, endLiveActivityByType, pauseTimerLiveActivity, resumeTimerLiveActivity, isLiveActivityRunningWithTimeout } from "@/services/live-activity-service";
import { isPendingStopForTimer, isTimerRestoreObsolete, readPendingTimerStop } from "@/services/timer-stop-coordinator";
import { BabyProviderBinding, useBabyProviderBinding } from "@/hooks/useBabyProviderBinding";
import {
  acceptTimerCompletion,
  createTimerIdentity,
  isTimerCompletionSecured,
  markTimerCompletionDurable,
  resolveTimerIdentity,
  type TimerIdentity,
} from "@/services/timer-completion-service";

export interface ActiveTummyTimeTimer extends TimerIdentity {
  isRunning: boolean;
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
  | { type: "START_TIMER"; payload: { startTime: Date } & TimerIdentity }
  | { type: "STOP_TIMER" }
  | { type: "PAUSE_TIMER" }
  | { type: "RESUME_TIMER" }
  | { type: "RESTORE_TIMER"; payload: ActiveTummyTimeTimer }
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
  startTummyTime: (requestedStartTime?: Date) => Promise<TimerLockResult>;
  stopTummyTime: (requestedEndTime?: Date) => Promise<StoredTummyTimeEntry | null>;
  pauseTummyTime: (requestedPauseTime?: Date) => Promise<void>;
  resumeTummyTime: (requestedResumeTime?: Date, widgetPauseDurationMs?: number) => Promise<void>;
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
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();
  const liveActivityIdRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);
  const [isStopping, setIsStopping] = useState(false);
  const stopVersionRef = useRef(0);
  const { babyBinding, beginBabyBinding, finishBabyBinding, isCurrentBabyBinding } =
    useBabyProviderBinding(selectedBaby?.id ?? null);

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

  const loadTummyTimes = useCallback(async () => {
    const bindingToken = beginBabyBinding(selectedBaby?.id ?? null);
    const isCurrentBinding = () => isCurrentBabyBinding(bindingToken);
    const acceptStartedLiveActivity = async (activityId: string | null) => {
      if (!isCurrentBinding()) {
        if (activityId) await endTimerLiveActivity(activityId);
        return false;
      }
      if (activityId) liveActivityIdRef.current = activityId;
      return true;
    };
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

      if (isTimerRestoreObsolete(stopVersionAtStart, stopVersionRef.current, isStoppingRef.current)) return;

      const activeTimer = await TummyTimeStorageService.getActiveTimer(selectedBaby.id);
      const pendingStop = activeTimer ? await readPendingTimerStop() : null;
      if (!isCurrentBinding()) return;
      const hasPendingStop = activeTimer
        ? isPendingStopForTimer(pendingStop, "tummy_time", new Date(activeTimer.startedAt), selectedBaby.id)
        : false;

      if (activeTimer) {
        const identity = await resolveTimerIdentity(
          selectedBaby.id,
          "tummy_time",
          activeTimer.startedAt,
          activeTimer
        );
        if (await isTimerCompletionSecured(selectedBaby.id, "tummy_time", identity, tummyTimes)) {
          await TummyTimeStorageService.clearActiveTimer(selectedBaby.id);
          dispatch({ type: "STOP_TIMER" });
          if (user?.id) {
            try {
              await releaseTimerLock(
                selectedBaby.id,
                "tummy_time",
                user.id,
                identity.timerInstanceId,
                activeTimer.startedAt
              );
            } catch {
              await queuePendingLockRelease(
                selectedBaby.id,
                "tummy_time",
                user.id,
                identity.timerInstanceId,
                activeTimer.startedAt
              );
            }
          }
          return;
        }
        if (!activeTimer.timerInstanceId || !activeTimer.activityId) {
          await TummyTimeStorageService.setActiveTimer(selectedBaby.id, {
            ...activeTimer,
            ...identity,
          });
        }

        let isStale = false;
        if (user?.id && user?.householdId && !hasPendingStop) {
          try {
            const lock = await getActiveTimerLock(selectedBaby.id, "tummy_time");
            if (!isCurrentBinding()) return;
            if (isTimerRestoreObsolete(stopVersionAtStart, stopVersionRef.current, isStoppingRef.current)) return;
            if (!lock || lock.startedBy !== user.id) {
              isStale = true;
              await TummyTimeStorageService.clearActiveTimer(selectedBaby.id);
              if (!isCurrentBinding()) return;
            }
          } catch {
            // ignore
          }
        }

        if (!isStale && !isTimerRestoreObsolete(stopVersionAtStart, stopVersionRef.current, isStoppingRef.current)) {
          dispatch({
            type: "RESTORE_TIMER",
            payload: {
              isRunning: true,
              isPaused: activeTimer.isPaused ?? false,
              startTime: new Date(activeTimer.startedAt),
              ...identity,
              totalPausedMs: activeTimer.totalPausedMs ?? 0,
              pausedAt: activeTimer.pausedAt ? new Date(activeTimer.pausedAt) : undefined,
            },
          });

          if (!hasPendingStop && activeTimer.liveActivityId) {
            const isRunning = await isLiveActivityRunningWithTimeout(activeTimer.liveActivityId);
            if (!isCurrentBinding()) return;
            if (isRunning) {
              liveActivityIdRef.current = activeTimer.liveActivityId;
            } else if (!(activeTimer.isPaused ?? false)) {
              const totalPausedMs = activeTimer.totalPausedMs ?? 0;
              const effectiveStartTime = totalPausedMs > 0
                ? new Date(new Date(activeTimer.startedAt).getTime() + totalPausedMs)
                : new Date(activeTimer.startedAt);
              const activityId = await startTimerLiveActivity(
                "tummyTime", selectedBaby.name, undefined, effectiveStartTime
              );
              if (!await acceptStartedLiveActivity(activityId)) return;
            }
          } else if (!hasPendingStop && !(activeTimer.isPaused ?? false)) {
            const totalPausedMs = activeTimer.totalPausedMs ?? 0;
            const effectiveStartTime = totalPausedMs > 0
              ? new Date(new Date(activeTimer.startedAt).getTime() + totalPausedMs)
              : new Date(activeTimer.startedAt);
            const activityId = await startTimerLiveActivity(
              "tummyTime", selectedBaby.name, undefined, effectiveStartTime
            );
            if (!await acceptStartedLiveActivity(activityId)) return;
          }
        }
      } else if (user?.id && user?.householdId) {
        try {
          const lock = await getActiveTimerLock(selectedBaby.id, "tummy_time");
          if (!isCurrentBinding()) return;
          if (
            lock &&
            lock.startedBy === user.id &&
            !isTimerRestoreObsolete(stopVersionAtStart, stopVersionRef.current, isStoppingRef.current)
          ) {
            const td = lock.timerData || {};
            const identity = await resolveTimerIdentity(
              selectedBaby.id,
              "tummy_time",
              lock.startedAt,
              td
            );
            if (await isTimerCompletionSecured(selectedBaby.id, "tummy_time", identity, tummyTimes)) {
              try {
                await releaseTimerLock(
                  selectedBaby.id,
                  "tummy_time",
                  user.id,
                  identity.timerInstanceId,
                  lock.startedAt
                );
              } catch {
                await queuePendingLockRelease(
                  selectedBaby.id,
                  "tummy_time",
                  user.id,
                  identity.timerInstanceId,
                  lock.startedAt
                );
              }
              return;
            }
            const isPaused = td.isPaused === true;
            const totalPausedMs = typeof td.totalPausedMs === "number" ? td.totalPausedMs : 0;
            const pausedAt = typeof td.pausedAt === "string" ? td.pausedAt : undefined;

            dispatch({
              type: "RESTORE_TIMER",
              payload: {
                isRunning: true,
                isPaused,
                startTime: new Date(lock.startedAt),
                ...identity,
                totalPausedMs,
                pausedAt: pausedAt ? new Date(pausedAt) : undefined,
              },
            });

            await TummyTimeStorageService.setActiveTimer(selectedBaby.id, {
              startedAt: lock.startedAt,
              ...identity,
              isPaused,
              totalPausedMs,
              pausedAt,
            });
            if (!isCurrentBinding()) return;

            if (!isPaused) {
              const effectiveStartTime = totalPausedMs > 0
                ? new Date(new Date(lock.startedAt).getTime() + totalPausedMs)
                : new Date(lock.startedAt);
              const activityId = await startTimerLiveActivity("tummyTime", selectedBaby.name, undefined, effectiveStartTime);
              if (!await acceptStartedLiveActivity(activityId)) return;
            }
          }
        } catch (error) {
          if (!isCurrentBinding()) return;
          console.error("[TummyTimeContext] Failed to restore from server:", error);
        }
      }
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
  }, [beginBabyBinding, finishBabyBinding, isCurrentBabyBinding, selectedBaby, user?.householdId, user?.id]);

  useEffect(() => {
    loadTummyTimes();
  }, [loadTummyTimes, foregroundRefreshKey]);

  const startTummyTime = useCallback(async (requestedStartTime?: Date): Promise<{ success: boolean; lockedByName?: string }> => {
    if (!selectedBaby) return { success: false };

    const startTime = requestedStartTime ?? new Date();
    const identity = createTimerIdentity();
    if (user?.id) {
      try {
        const lockResult = await acquireTimerLock(
          selectedBaby.id,
          "tummy_time",
          user.id,
          { ...identity },
          startTime
        );
        if (!lockResult.success) {
          return { success: false, lockedByName: lockResult.lockHolderName };
        }
      } catch (error) {
        console.error("[TummyTimeContext] Failed to acquire timer lock (proceeding offline):", error);
      }
    }

    dispatch({ type: "START_TIMER", payload: { startTime, ...identity } });

    const activityId = await startTimerLiveActivity("tummyTime", selectedBaby.name, undefined, startTime);
    if (activityId) {
      liveActivityIdRef.current = activityId;
    }

    await TummyTimeStorageService.setActiveTimer(selectedBaby.id, {
      ...identity,
      startedAt: startTime.toISOString(),
      liveActivityId: activityId ?? undefined,
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
        if (liveActivityIdRef.current) {
          await endTimerLiveActivity(liveActivityIdRef.current);
          liveActivityIdRef.current = null;
        } else {
          await endLiveActivityByType("tummyTime");
        }
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
      const completion = await acceptTimerCompletion(
        selectedBaby.id,
        "tummy_time",
        state.activeTimer.startTime.toISOString(),
        state.activeTimer,
        requestedEndTime ?? new Date()
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

      const durationSeconds = Math.floor(
        (endTime.getTime() - state.activeTimer.startTime.getTime() - state.activeTimer.totalPausedMs) / 1000
      );
      const tummyTimeInput: CreateTummyTimeInput = {
        id: completion.activityId,
        babyId: selectedBaby.id,
        startedAt: state.activeTimer.startTime,
        endedAt: endTime,
        durationSeconds,
      };

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

  const pauseTummyTime = useCallback(async (requestedPauseTime?: Date) => {
    if (!selectedBaby || !state.activeTimer || state.activeTimer.isPaused) return;

    const now = requestedPauseTime ?? new Date();

    dispatch({ type: "PAUSE_TIMER" });

    if (liveActivityIdRef.current) {
      const activeElapsedSeconds = Math.floor(
        (now.getTime() - state.activeTimer.startTime.getTime() - state.activeTimer.totalPausedMs) / 1000
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
    });

    if (user?.id) {
      try {
        const totalElapsed = Math.floor(
          (now.getTime() - state.activeTimer.startTime.getTime() - state.activeTimer.totalPausedMs) / 1000
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
        (now.getTime() - state.activeTimer.startTime.getTime() - newTotalPausedMs) / 1000
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
    });

    if (user?.id) {
      try {
        const activeElapsedSeconds = Math.floor(
          (now.getTime() - state.activeTimer.startTime.getTime() - newTotalPausedMs) / 1000
        );
        await updateTimerData(selectedBaby.id, "tummy_time", user.id, {
          timerInstanceId: state.activeTimer.timerInstanceId,
          activityId: state.activeTimer.activityId,
          isPaused: false,
          totalPausedMs: newTotalPausedMs,
          effectiveStartTime: new Date(now.getTime() - activeElapsedSeconds * 1000).toISOString(),
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
    pauseTummyTime,
    resumeTummyTime,
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
  }), [state, babyBinding, isStopping, startTummyTime, stopTummyTime, pauseTummyTime, resumeTummyTime, addTummyTime, updateTummyTime, deleteTummyTime, loadTummyTimes, getLastTummyTime, getTodaysTotalSeconds, getDailyProgress, getTodaysSessionCount, setDailyGoalCallback, setCustomGoal, resetToAgeBasedGoal, dismissMilestoneSuggestion, acceptMilestoneSuggestion]);

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
