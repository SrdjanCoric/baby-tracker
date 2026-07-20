import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FeedingStorageService,
  StoredFeedingEntry,
  CreateFeedingInput,
  UpdateFeedingInput,
} from "@/services/feeding-storage";
import {
  fetchFeedingsFromDatabase,
  createFeedingInDatabase,
  updateFeedingInDatabase,
  deleteFeedingFromDatabase,
} from "@/services/activity-sync-service";
import type { BreastSide, FeedingType, BottleContentType, SolidAmount, SolidReaction } from "@/constants/activities";
import { useBaby } from "./baby-context";
import { computeSuggestedSide } from "@/utils/feeding-sessions";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange, tombstonedId, upsertById } from "@/services/sync";
import { acquireTimerLock, releaseTimerLock, updateTimerData, getActiveTimerLock, queuePendingLockRelease } from "@/services/active-timer-service";
import { startTimerLiveActivity, endTimerLiveActivity, endLiveActivityByType, updateTimerLiveActivity, pauseTimerLiveActivity, resumeTimerLiveActivity, isLiveActivityRunningWithTimeout } from "@/services/live-activity-service";
import type { BreastSide as LiveActivityBreastSide } from "@/services/live-activity-service";
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

export interface ActiveTimer extends TimerIdentity {
  isRunning: boolean;
  isPaused: boolean;
  startTime: Date;
  side?: BreastSide;
  leftAccumulatedSeconds: number;
  rightAccumulatedSeconds: number;
  currentSideStartedAt: Date;
  totalPausedMs: number;
  pausedAt?: Date;
}

export interface FeedingState {
  feedings: StoredFeedingEntry[];
  activeTimer: ActiveTimer | null;
  lastBreastSide: BreastSide | null;
  isLoading: boolean;
}

export type FeedingAction =
  | { type: "SET_FEEDINGS"; payload: StoredFeedingEntry[] }
  | { type: "ADD_FEEDING"; payload: StoredFeedingEntry }
  | { type: "UPDATE_FEEDING"; payload: StoredFeedingEntry }
  | { type: "DELETE_FEEDING"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_LAST_BREAST_SIDE"; payload: BreastSide | null }
  | { type: "START_TIMER"; payload: { startTime: Date; side?: BreastSide } & TimerIdentity }
  | { type: "RESTORE_TIMER"; payload: ActiveTimer }
  | { type: "STOP_TIMER" }
  | { type: "UPDATE_TIMER_SIDE"; payload: { side: BreastSide; accumulatedSeconds: number } }
  | { type: "PAUSE_TIMER"; payload: { accumulatedSeconds: number } }
  | { type: "RESUME_TIMER" }
  | { type: "REMOTE_INSERT"; payload: StoredFeedingEntry }
  | { type: "REMOTE_UPDATE"; payload: StoredFeedingEntry }
  | { type: "REMOTE_DELETE"; payload: string };

export const initialFeedingState: FeedingState = {
  feedings: [],
  activeTimer: null,
  lastBreastSide: null,
  isLoading: true,
};

export function feedingReducer(state: FeedingState, action: FeedingAction): FeedingState {
  switch (action.type) {
    case "SET_FEEDINGS":
      return { ...state, feedings: action.payload };

    case "ADD_FEEDING": {
      const newFeedings = [...state.feedings, action.payload];
      const newState: FeedingState = { ...state, feedings: newFeedings };
      if (action.payload.type === "breast") {
        const suggested = computeSuggestedSide(newFeedings);
        if (suggested !== null) {
          newState.lastBreastSide = suggested;
        }
      }
      return newState;
    }

    case "UPDATE_FEEDING": {
      const updatedFeedings = state.feedings.map(f =>
        f.id === action.payload.id ? action.payload : f
      );
      return { ...state, feedings: updatedFeedings };
    }

    case "DELETE_FEEDING": {
      const filteredFeedings = state.feedings.filter(f => f.id !== action.payload);
      return { ...state, feedings: filteredFeedings };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_LAST_BREAST_SIDE":
      return { ...state, lastBreastSide: action.payload };

    case "START_TIMER":
      return {
        ...state,
        activeTimer: {
          isRunning: true,
          isPaused: false,
          startTime: action.payload.startTime,
          timerInstanceId: action.payload.timerInstanceId,
          activityId: action.payload.activityId,
          side: action.payload.side,
          leftAccumulatedSeconds: 0,
          rightAccumulatedSeconds: 0,
          currentSideStartedAt: action.payload.startTime,
          totalPausedMs: 0,
        },
      };

    case "RESTORE_TIMER":
      return {
        ...state,
        activeTimer: action.payload,
      };

    case "STOP_TIMER":
      return { ...state, activeTimer: null };

    case "UPDATE_TIMER_SIDE": {
      if (!state.activeTimer) return state;
      const { side, accumulatedSeconds } = action.payload;
      const prevSide = state.activeTimer.side;

      let leftAccumulated = state.activeTimer.leftAccumulatedSeconds;
      let rightAccumulated = state.activeTimer.rightAccumulatedSeconds;

      if (prevSide === "left") {
        leftAccumulated += accumulatedSeconds;
      } else if (prevSide === "right") {
        rightAccumulated += accumulatedSeconds;
      } else if (prevSide === "both") {
        leftAccumulated += accumulatedSeconds;
        rightAccumulated += accumulatedSeconds;
      }

      return {
        ...state,
        activeTimer: {
          ...state.activeTimer,
          side,
          leftAccumulatedSeconds: leftAccumulated,
          rightAccumulatedSeconds: rightAccumulated,
          currentSideStartedAt: new Date(),
        },
      };
    }

    case "PAUSE_TIMER": {
      if (!state.activeTimer) return state;
      const { accumulatedSeconds } = action.payload;
      const prevSide = state.activeTimer.side;
      let leftAccumulated = state.activeTimer.leftAccumulatedSeconds;
      let rightAccumulated = state.activeTimer.rightAccumulatedSeconds;

      if (prevSide === "left") {
        leftAccumulated += accumulatedSeconds;
      } else if (prevSide === "right") {
        rightAccumulated += accumulatedSeconds;
      } else if (prevSide === "both") {
        leftAccumulated += accumulatedSeconds;
        rightAccumulated += accumulatedSeconds;
      }

      return {
        ...state,
        activeTimer: {
          ...state.activeTimer,
          isPaused: true,
          pausedAt: new Date(),
          leftAccumulatedSeconds: leftAccumulated,
          rightAccumulatedSeconds: rightAccumulated,
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
          currentSideStartedAt: new Date(),
        },
      };
    }

    case "REMOTE_INSERT": {
      const exists = state.feedings.some(f => f.id === action.payload.id);
      if (exists) return state;
      const newFeedings = [...state.feedings, action.payload];
      const newState: FeedingState = { ...state, feedings: newFeedings };
      if (action.payload.type === "breast") {
        const suggested = computeSuggestedSide(newFeedings);
        if (suggested !== null) {
          newState.lastBreastSide = suggested;
        }
      }
      return newState;
    }

    case "REMOTE_UPDATE": {
      return { ...state, feedings: upsertById(state.feedings, action.payload) };
    }

    case "REMOTE_DELETE": {
      const filteredFeedings = state.feedings.filter(f => f.id !== action.payload);
      return { ...state, feedings: filteredFeedings };
    }

    default:
      return state;
  }
}

export interface TimerLockResult {
  success: boolean;
  lockedByName?: string;
}

interface FeedingContextValue extends FeedingState {
  babyBinding: BabyProviderBinding;
  startBreastfeeding: (side: BreastSide, requestedStartTime?: Date) => Promise<TimerLockResult>;
  stopBreastfeeding: (requestedEndTime?: Date) => Promise<StoredFeedingEntry | null>;
  changeSide: (side: BreastSide) => void;
  pauseBreastfeeding: (requestedPauseTime?: Date) => Promise<void>;
  resumeBreastfeeding: (requestedResumeTime?: Date, widgetPauseDurationMs?: number) => Promise<void>;
  suggestedSide: BreastSide;
  addFeeding: (input: CreateFeedingInput) => Promise<StoredFeedingEntry>;
  updateFeeding: (feedingId: string, input: UpdateFeedingInput) => Promise<StoredFeedingEntry | null>;
  deleteFeeding: (feedingId: string) => Promise<boolean>;
  refreshFeedings: () => Promise<void>;
  getLastFeeding: () => StoredFeedingEntry | null;
}

const FeedingContext = createContext<FeedingContextValue | null>(null);

export function FeedingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(feedingReducer, initialFeedingState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();
  const liveActivityIdRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);
  const stopVersionRef = useRef(0);
  const { babyBinding, beginBabyBinding, finishBabyBinding, isCurrentBabyBinding } =
    useBabyProviderBinding(selectedBaby?.id ?? null);

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('feedings', (change: RemoteChange) => {
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
              payload: transformFeedingFromRemote(change.new),
            });
          }
          break;
        case 'UPDATE':
          if (change.new) {
            dispatch({
              type: "REMOTE_UPDATE",
              payload: transformFeedingFromRemote(change.new),
            });
          }
          break;
      }
    });

    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const loadFeedings = useCallback(async () => {
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
      dispatch({ type: "SET_FEEDINGS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      finishBabyBinding(bindingToken, "ready");
      return;
    }

    const stopVersionAtStart = stopVersionRef.current;
    let bindingStatus: "ready" | "error" = "ready";
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      let feedings: StoredFeedingEntry[];

      if (user?.householdId) {
        try {
          feedings = await fetchFeedingsFromDatabase(selectedBaby.id);
        } catch (error) {
          if (!isCurrentBinding()) return;
          console.error("[FeedingContext] Failed to fetch from database, using local:", error);
          feedings = await FeedingStorageService.getAllFeedings(selectedBaby.id);
        }
      } else {
        feedings = await FeedingStorageService.getAllFeedings(selectedBaby.id);
      }

      if (!isCurrentBinding()) return;
      dispatch({ type: "SET_FEEDINGS", payload: feedings });

      const suggestedSide = computeSuggestedSide(feedings);
      dispatch({ type: "SET_LAST_BREAST_SIDE", payload: suggestedSide });

      if (isTimerRestoreObsolete(stopVersionAtStart, stopVersionRef.current, isStoppingRef.current)) return;

      const activeTimer = await FeedingStorageService.getActiveTimer(selectedBaby.id);
      const pendingStop = activeTimer ? await readPendingTimerStop() : null;
      if (!isCurrentBinding()) return;
      const hasPendingStop = activeTimer
        ? isPendingStopForTimer(pendingStop, "feeding", new Date(activeTimer.startedAt), selectedBaby.id)
        : false;

      if (activeTimer) {
        const identity = await resolveTimerIdentity(
          selectedBaby.id,
          "feeding",
          activeTimer.startedAt,
          activeTimer
        );
        if (await isTimerCompletionSecured(selectedBaby.id, "feeding", identity, feedings)) {
          await FeedingStorageService.clearActiveTimer(selectedBaby.id);
          dispatch({ type: "STOP_TIMER" });
          if (user?.id) {
            try {
              await releaseTimerLock(
                selectedBaby.id,
                "feeding",
                user.id,
                identity.timerInstanceId,
                activeTimer.startedAt
              );
            } catch {
              await queuePendingLockRelease(
                selectedBaby.id,
                "feeding",
                user.id,
                identity.timerInstanceId,
                activeTimer.startedAt
              );
            }
          }
          return;
        }
        if (!activeTimer.timerInstanceId || !activeTimer.activityId) {
          await FeedingStorageService.setActiveTimer(selectedBaby.id, {
            ...activeTimer,
            ...identity,
          });
        }

        let isStale = false;
        if (user?.id && user?.householdId && !hasPendingStop) {
          try {
            const lock = await getActiveTimerLock(selectedBaby.id, "feeding");
            if (!isCurrentBinding()) return;
            if (isTimerRestoreObsolete(stopVersionAtStart, stopVersionRef.current, isStoppingRef.current)) return;
            if (!lock || lock.startedBy !== user.id) {
              isStale = true;
              await FeedingStorageService.clearActiveTimer(selectedBaby.id);
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
              side: activeTimer.side,
              leftAccumulatedSeconds: activeTimer.leftAccumulatedSeconds ?? 0,
              rightAccumulatedSeconds: activeTimer.rightAccumulatedSeconds ?? 0,
              currentSideStartedAt: activeTimer.currentSideStartedAt
                ? new Date(activeTimer.currentSideStartedAt)
                : new Date(activeTimer.startedAt),
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
                "feeding", selectedBaby.name, activeTimer.side as LiveActivityBreastSide, effectiveStartTime
              );
              if (!await acceptStartedLiveActivity(activityId)) return;
            }
          } else if (!hasPendingStop && !(activeTimer.isPaused ?? false)) {
            const totalPausedMs = activeTimer.totalPausedMs ?? 0;
            const effectiveStartTime = totalPausedMs > 0
              ? new Date(new Date(activeTimer.startedAt).getTime() + totalPausedMs)
              : new Date(activeTimer.startedAt);
            const activityId = await startTimerLiveActivity(
              "feeding", selectedBaby.name, activeTimer.side as LiveActivityBreastSide, effectiveStartTime
            );
            if (!await acceptStartedLiveActivity(activityId)) return;
          }
        }
      } else if (user?.id && user?.householdId) {
        try {
          const lock = await getActiveTimerLock(selectedBaby.id, "feeding");
          if (!isCurrentBinding()) return;
          if (
            lock &&
            lock.startedBy === user.id &&
            !isTimerRestoreObsolete(stopVersionAtStart, stopVersionRef.current, isStoppingRef.current)
          ) {
            const td = lock.timerData || {};
            const identity = await resolveTimerIdentity(
              selectedBaby.id,
              "feeding",
              lock.startedAt,
              td
            );
            if (await isTimerCompletionSecured(selectedBaby.id, "feeding", identity, feedings)) {
              try {
                await releaseTimerLock(
                  selectedBaby.id,
                  "feeding",
                  user.id,
                  identity.timerInstanceId,
                  lock.startedAt
                );
              } catch {
                await queuePendingLockRelease(
                  selectedBaby.id,
                  "feeding",
                  user.id,
                  identity.timerInstanceId,
                  lock.startedAt
                );
              }
              return;
            }
            const side = (typeof td.side === "string" ? td.side : undefined) as BreastSide | undefined;
            const isPaused = td.isPaused === true;
            const totalPausedMs = typeof td.totalPausedMs === "number" ? td.totalPausedMs : 0;
            const pausedAt = typeof td.pausedAt === "string" ? td.pausedAt : undefined;
            const leftAccumulatedSeconds = typeof td.leftAccumulatedSeconds === "number" ? td.leftAccumulatedSeconds : 0;
            const rightAccumulatedSeconds = typeof td.rightAccumulatedSeconds === "number" ? td.rightAccumulatedSeconds : 0;
            const currentSideStartedAt = typeof td.currentSideStartedAt === "string"
              ? td.currentSideStartedAt
              : lock.startedAt;

            dispatch({
              type: "RESTORE_TIMER",
              payload: {
                isRunning: true,
                isPaused,
                startTime: new Date(lock.startedAt),
                ...identity,
                side,
                leftAccumulatedSeconds,
                rightAccumulatedSeconds,
                currentSideStartedAt: new Date(currentSideStartedAt),
                totalPausedMs,
                pausedAt: pausedAt ? new Date(pausedAt) : undefined,
              },
            });

            await FeedingStorageService.setActiveTimer(selectedBaby.id, {
              startedAt: lock.startedAt,
              ...identity,
              side,
              type: "breast",
              leftAccumulatedSeconds,
              rightAccumulatedSeconds,
              currentSideStartedAt,
              isPaused,
              totalPausedMs,
              pausedAt,
            });
            if (!isCurrentBinding()) return;

            if (!isPaused) {
              const effectiveStartTime = totalPausedMs > 0
                ? new Date(new Date(lock.startedAt).getTime() + totalPausedMs)
                : new Date(lock.startedAt);
              const activityId = await startTimerLiveActivity(
                "feeding", selectedBaby.name, side as LiveActivityBreastSide, effectiveStartTime
              );
              if (!await acceptStartedLiveActivity(activityId)) return;
            }
          }
        } catch (error) {
          if (!isCurrentBinding()) return;
          console.error("[FeedingContext] Failed to restore from server:", error);
        }
      }
    } catch (error) {
      if (!isCurrentBinding()) return;
      bindingStatus = "error";
      console.error("[FeedingContext] Failed to load feedings:", error);
    } finally {
      if (isCurrentBinding()) {
        dispatch({ type: "SET_LOADING", payload: false });
        finishBabyBinding(bindingToken, bindingStatus);
      }
    }
  }, [beginBabyBinding, finishBabyBinding, isCurrentBabyBinding, selectedBaby, user?.householdId, user?.id]);

  useEffect(() => {
    loadFeedings();
  }, [loadFeedings, foregroundRefreshKey]);

  const startBreastfeeding = useCallback(async (side: BreastSide, requestedStartTime?: Date): Promise<{ success: boolean; lockedByName?: string }> => {
    if (!selectedBaby) return { success: false };

    const startTime = requestedStartTime ?? new Date();
    const identity = createTimerIdentity();
    if (user?.id) {
      try {
        const lockResult = await acquireTimerLock(selectedBaby.id, "feeding", user.id, {
          ...identity,
          side,
          type: "breast",
          leftAccumulatedSeconds: 0,
          rightAccumulatedSeconds: 0,
        }, startTime);
        if (!lockResult.success) {
          return { success: false, lockedByName: lockResult.lockHolderName };
        }
      } catch (error) {
        console.error("[FeedingContext] Failed to acquire timer lock (proceeding offline):", error);
      }
    }

    dispatch({ type: "START_TIMER", payload: { startTime, side, ...identity } });

    const activityId = await startTimerLiveActivity("feeding", selectedBaby.name, side as LiveActivityBreastSide, startTime);
    if (activityId) {
      liveActivityIdRef.current = activityId;
    }

    await FeedingStorageService.setActiveTimer(selectedBaby.id, {
      ...identity,
      startedAt: startTime.toISOString(),
      side,
      type: "breast",
      leftAccumulatedSeconds: 0,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: startTime.toISOString(),
      liveActivityId: activityId ?? undefined,
    });

    return { success: true };
  }, [selectedBaby, user?.id]);

  const stopBreastfeeding = useCallback(async (requestedEndTime?: Date): Promise<StoredFeedingEntry | null> => {
    if (!selectedBaby || !state.activeTimer) return null;
    if (isStoppingRef.current) return null;
    isStoppingRef.current = true;
    stopVersionRef.current++;
    const activeTimer = state.activeTimer;

    const finishTimer = async () => {
      dispatch({ type: "STOP_TIMER" });
      try {
        await FeedingStorageService.clearActiveTimer(selectedBaby.id);
      } catch (error) {
        console.error("[FeedingContext] Failed to clear completed timer snapshot:", error);
      }
      try {
        if (liveActivityIdRef.current) {
          await endTimerLiveActivity(liveActivityIdRef.current);
          liveActivityIdRef.current = null;
        } else {
          await endLiveActivityByType("feeding");
        }
      } catch (error) {
        console.error("[FeedingContext] Failed to end completed Live Activity:", error);
      }
      if (user?.id) {
        try {
          await releaseTimerLock(
            selectedBaby.id,
            "feeding",
            user.id,
            activeTimer.timerInstanceId,
            activeTimer.startTime.toISOString()
          );
        } catch (error) {
          console.error("[FeedingContext] Failed to release timer lock, queuing retry:", error);
          await queuePendingLockRelease(
            selectedBaby.id,
            "feeding",
            user.id,
            activeTimer.timerInstanceId,
            activeTimer.startTime.toISOString()
          );
        }
      }
    };

    try {
      const requestedStopTime = requestedEndTime ?? new Date();
      const durationSeconds = Math.floor(
        (requestedStopTime.getTime() - state.activeTimer.startTime.getTime() - state.activeTimer.totalPausedMs) / 1000
      );

      if (durationSeconds < 60) {
        await finishTimer();
        return null;
      }

      const completion = await acceptTimerCompletion(
        selectedBaby.id,
        "feeding",
        state.activeTimer.startTime.toISOString(),
        state.activeTimer,
        requestedStopTime
      );
      const endTime = new Date(completion.stoppedAt);

      if (completion.status === "completed") {
        const existing = await FeedingStorageService.getFeedingById(
          selectedBaby.id,
          completion.activityId
        );
        await finishTimer();
        return existing;
      }

      let leftDurationSeconds = state.activeTimer.leftAccumulatedSeconds;
      let rightDurationSeconds = state.activeTimer.rightAccumulatedSeconds;

      if (!state.activeTimer.isPaused) {
        const currentSideElapsed = Math.floor(
          (endTime.getTime() - state.activeTimer.currentSideStartedAt.getTime()) / 1000
        );
        if (state.activeTimer.side === "left") {
          leftDurationSeconds += currentSideElapsed;
        } else if (state.activeTimer.side === "right") {
          rightDurationSeconds += currentSideElapsed;
        } else if (state.activeTimer.side === "both") {
          leftDurationSeconds += currentSideElapsed;
          rightDurationSeconds += currentSideElapsed;
        }
      }

      const acceptedDurationSeconds = Math.floor(
        (endTime.getTime() - state.activeTimer.startTime.getTime() - state.activeTimer.totalPausedMs) / 1000
      );
      const lastSide = leftDurationSeconds >= rightDurationSeconds ? "left" : "right";
      const effectiveSide = leftDurationSeconds > 0 && rightDurationSeconds > 0 ? "both" : lastSide;
      const feedingInput: CreateFeedingInput = {
        id: completion.activityId,
        babyId: selectedBaby.id,
        type: "breast",
        side: effectiveSide,
        lastFinishedSide: state.activeTimer.side,
        startedAt: state.activeTimer.startTime,
        endedAt: endTime,
        durationSeconds: acceptedDurationSeconds,
        leftDurationSeconds: leftDurationSeconds > 0 ? leftDurationSeconds : undefined,
        rightDurationSeconds: rightDurationSeconds > 0 ? rightDurationSeconds : undefined,
      };

      let feeding: StoredFeedingEntry;
      try {
        if (user?.householdId && user?.id) {
          console.log("[FeedingContext] stopBreastfeeding: saving to database");
          feeding = await createFeedingInDatabase(feedingInput, user.id);
        } else {
          console.log("[FeedingContext] stopBreastfeeding: saving to local storage");
          feeding = await FeedingStorageService.addFeeding(feedingInput);
        }
      } catch (saveError) {
        console.error("[FeedingContext] Failed to durably complete timer:", saveError);
        throw saveError;
      }

      await markTimerCompletionDurable(completion);
      dispatch({ type: "ADD_FEEDING", payload: feeding });
      await finishTimer();
      return feeding;
    } finally {
      isStoppingRef.current = false;
    }
  }, [selectedBaby, state.activeTimer, user?.householdId, user?.id]);

  const changeSide = useCallback((side: BreastSide) => {
    if (!state.activeTimer) return;
    if (state.activeTimer.isPaused) return;

    const now = new Date();
    const accumulatedSeconds = Math.floor(
      (now.getTime() - state.activeTimer.currentSideStartedAt.getTime()) / 1000
    );

    dispatch({ type: "UPDATE_TIMER_SIDE", payload: { side, accumulatedSeconds } });

    if (selectedBaby) {
      const prevSide = state.activeTimer.side;
      let leftAccumulated = state.activeTimer.leftAccumulatedSeconds;
      let rightAccumulated = state.activeTimer.rightAccumulatedSeconds;

      if (prevSide === "left") {
        leftAccumulated += accumulatedSeconds;
      } else if (prevSide === "right") {
        rightAccumulated += accumulatedSeconds;
      } else if (prevSide === "both") {
        leftAccumulated += accumulatedSeconds;
        rightAccumulated += accumulatedSeconds;
      }

      FeedingStorageService.setActiveTimer(selectedBaby.id, {
        timerInstanceId: state.activeTimer.timerInstanceId,
        activityId: state.activeTimer.activityId,
        startedAt: state.activeTimer.startTime.toISOString(),
        side,
        type: "breast",
        leftAccumulatedSeconds: leftAccumulated,
        rightAccumulatedSeconds: rightAccumulated,
        currentSideStartedAt: now.toISOString(),
        liveActivityId: liveActivityIdRef.current ?? undefined,
        isPaused: state.activeTimer.isPaused,
        totalPausedMs: state.activeTimer.totalPausedMs,
        pausedAt: state.activeTimer.pausedAt?.toISOString(),
      });

      if (liveActivityIdRef.current) {
        updateTimerLiveActivity(liveActivityIdRef.current, side as LiveActivityBreastSide);
      }
      if (user?.id) {
        updateTimerData(selectedBaby.id, "feeding", user.id, {
          timerInstanceId: state.activeTimer.timerInstanceId,
          activityId: state.activeTimer.activityId,
          side,
          type: "breast",
          leftAccumulatedSeconds: leftAccumulated,
          rightAccumulatedSeconds: rightAccumulated,
          currentSideStartedAt: now.toISOString(),
        }).catch(
          (error) => console.error("[FeedingContext] Failed to update timer data:", error)
        );
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const pauseBreastfeeding = useCallback(async (requestedPauseTime?: Date) => {
    if (!selectedBaby || !state.activeTimer || state.activeTimer.isPaused) return;

    const now = requestedPauseTime ?? new Date();
    const accumulatedSeconds = Math.floor(
      (now.getTime() - state.activeTimer.currentSideStartedAt.getTime()) / 1000
    );

    dispatch({ type: "PAUSE_TIMER", payload: { accumulatedSeconds } });

    if (liveActivityIdRef.current) {
      const activeElapsedSeconds = Math.floor(
        (now.getTime() - state.activeTimer.startTime.getTime() - state.activeTimer.totalPausedMs) / 1000
      );
      await pauseTimerLiveActivity(liveActivityIdRef.current, activeElapsedSeconds);
    }

    const prevSide = state.activeTimer.side;
    let leftAccumulated = state.activeTimer.leftAccumulatedSeconds;
    let rightAccumulated = state.activeTimer.rightAccumulatedSeconds;
    if (prevSide === "left") leftAccumulated += accumulatedSeconds;
    else if (prevSide === "right") rightAccumulated += accumulatedSeconds;
    else if (prevSide === "both") { leftAccumulated += accumulatedSeconds; rightAccumulated += accumulatedSeconds; }

    await FeedingStorageService.setActiveTimer(selectedBaby.id, {
      timerInstanceId: state.activeTimer.timerInstanceId,
      activityId: state.activeTimer.activityId,
      startedAt: state.activeTimer.startTime.toISOString(),
      side: state.activeTimer.side,
      type: "breast",
      leftAccumulatedSeconds: leftAccumulated,
      rightAccumulatedSeconds: rightAccumulated,
      currentSideStartedAt: state.activeTimer.currentSideStartedAt.toISOString(),
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
        await updateTimerData(selectedBaby.id, "feeding", user.id, {
          timerInstanceId: state.activeTimer.timerInstanceId,
          activityId: state.activeTimer.activityId,
          isPaused: true,
          pausedAt: now.toISOString(),
          accumulatedSeconds: totalElapsed,
          totalPausedMs: state.activeTimer.totalPausedMs,
          side: state.activeTimer.side,
          type: "breast",
          leftAccumulatedSeconds: leftAccumulated,
          rightAccumulatedSeconds: rightAccumulated,
          currentSideStartedAt: state.activeTimer.currentSideStartedAt.toISOString(),
        });
      } catch (error) {
        console.error("[FeedingContext] Failed to update timer data:", error);
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const resumeBreastfeeding = useCallback(async (requestedResumeTime?: Date, widgetPauseDurationMs?: number) => {
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

    await FeedingStorageService.setActiveTimer(selectedBaby.id, {
      timerInstanceId: state.activeTimer.timerInstanceId,
      activityId: state.activeTimer.activityId,
      startedAt: state.activeTimer.startTime.toISOString(),
      side: state.activeTimer.side,
      type: "breast",
      leftAccumulatedSeconds: state.activeTimer.leftAccumulatedSeconds,
      rightAccumulatedSeconds: state.activeTimer.rightAccumulatedSeconds,
      currentSideStartedAt: now.toISOString(),
      liveActivityId: liveActivityIdRef.current ?? undefined,
      isPaused: false,
      totalPausedMs: newTotalPausedMs,
    });

    if (user?.id) {
      try {
        const activeElapsedSeconds = Math.floor(
          (now.getTime() - state.activeTimer.startTime.getTime() - newTotalPausedMs) / 1000
        );
        await updateTimerData(selectedBaby.id, "feeding", user.id, {
          timerInstanceId: state.activeTimer.timerInstanceId,
          activityId: state.activeTimer.activityId,
          isPaused: false,
          totalPausedMs: newTotalPausedMs,
          side: state.activeTimer.side,
          type: "breast",
          leftAccumulatedSeconds: state.activeTimer.leftAccumulatedSeconds,
          rightAccumulatedSeconds: state.activeTimer.rightAccumulatedSeconds,
          currentSideStartedAt: now.toISOString(),
          effectiveStartTime: new Date(now.getTime() - activeElapsedSeconds * 1000).toISOString(),
          accumulatedSeconds: activeElapsedSeconds,
        });
      } catch (error) {
        console.error("[FeedingContext] Failed to update timer data:", error);
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const addFeeding = useCallback(async (input: CreateFeedingInput): Promise<StoredFeedingEntry> => {
    let feeding: StoredFeedingEntry;

    if (user?.householdId && user?.id) {
      feeding = await createFeedingInDatabase(input, user.id);
    } else {
      feeding = await FeedingStorageService.addFeeding(input);
    }

    dispatch({ type: "ADD_FEEDING", payload: feeding });
    return feeding;
  }, [user?.householdId, user?.id]);

  const updateFeeding = useCallback(async (
    feedingId: string,
    input: UpdateFeedingInput
  ): Promise<StoredFeedingEntry | null> => {
    if (!selectedBaby) return null;

    let updated: StoredFeedingEntry | null;

    if (user?.householdId) {
      updated = await updateFeedingInDatabase(selectedBaby.id, feedingId, input);
    } else {
      updated = await FeedingStorageService.updateFeeding(selectedBaby.id, feedingId, input);
    }

    if (updated) {
      dispatch({ type: "UPDATE_FEEDING", payload: updated });
    }
    return updated;
  }, [selectedBaby, user?.householdId]);

  const deleteFeeding = useCallback(async (feedingId: string): Promise<boolean> => {
    if (!selectedBaby) return false;

    let result: boolean;

    if (user?.householdId) {
      result = await deleteFeedingFromDatabase(selectedBaby.id, feedingId);
    } else {
      result = await FeedingStorageService.deleteFeeding(selectedBaby.id, feedingId);
    }

    if (result) {
      dispatch({ type: "DELETE_FEEDING", payload: feedingId });
    }
    return result;
  }, [selectedBaby, user?.householdId]);

  const getLastFeeding = useCallback((): StoredFeedingEntry | null => {
    if (state.feedings.length === 0) return null;

    const sorted = [...state.feedings].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  }, [state.feedings]);

  const suggestedSide: BreastSide = state.lastBreastSide ?? "left";

  const value: FeedingContextValue = useMemo(() => ({
    ...state,
    babyBinding,
    startBreastfeeding,
    stopBreastfeeding,
    changeSide,
    pauseBreastfeeding,
    resumeBreastfeeding,
    suggestedSide,
    addFeeding,
    updateFeeding,
    deleteFeeding,
    refreshFeedings: loadFeedings,
    getLastFeeding,
  }), [state, babyBinding, startBreastfeeding, stopBreastfeeding, changeSide, pauseBreastfeeding, resumeBreastfeeding, suggestedSide, addFeeding, updateFeeding, deleteFeeding, loadFeedings, getLastFeeding]);

  return <FeedingContext.Provider value={value}>{children}</FeedingContext.Provider>;
}

export function useFeeding(): FeedingContextValue {
  const context = useContext(FeedingContext);
  if (!context) {
    throw new Error("useFeeding must be used within a FeedingProvider");
  }
  return context;
}

function transformFeedingFromRemote(data: Record<string, unknown>): StoredFeedingEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    type: data.type as FeedingType,
    side: data.side as BreastSide | undefined,
    lastFinishedSide: data.last_finished_side as BreastSide | undefined,
    startedAt: data.started_at as string,
    endedAt: data.ended_at as string | undefined,
    durationSeconds: data.duration_seconds as number | undefined,
    leftDurationSeconds: data.left_duration_seconds as number | undefined,
    rightDurationSeconds: data.right_duration_seconds as number | undefined,
    amountMl: data.amount_ml as number | undefined,
    contentType: data.content_type as BottleContentType | undefined,
    foodType: data.food_type as string | undefined,
    amount: data.amount as SolidAmount | undefined,
    reaction: data.reaction as SolidReaction | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}
