import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from "react";
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
import { getOppositeSide } from "@/constants/activities";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange } from "@/services/sync";
import { acquireTimerLock, releaseTimerLock } from "@/services/active-timer-service";
import { startTimerLiveActivity, endTimerLiveActivity, endLiveActivityByType, updateTimerLiveActivity } from "@/services/live-activity-service";
import type { BreastSide as LiveActivityBreastSide } from "@/services/live-activity-service";

export interface ActiveTimer {
  isRunning: boolean;
  startTime: Date;
  side?: BreastSide;
  leftAccumulatedSeconds: number;
  rightAccumulatedSeconds: number;
  currentSideStartedAt: Date;
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
  | { type: "START_TIMER"; payload: { startTime: Date; side?: BreastSide } }
  | { type: "RESTORE_TIMER"; payload: ActiveTimer }
  | { type: "STOP_TIMER" }
  | { type: "UPDATE_TIMER_SIDE"; payload: { side: BreastSide; accumulatedSeconds: number } }
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
      const newState = { ...state, feedings: [...state.feedings, action.payload] };
      if (action.payload.type === "breast") {
        const sideForSuggestion = action.payload.lastFinishedSide ?? action.payload.side;
        if (sideForSuggestion) {
          newState.lastBreastSide = sideForSuggestion;
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
          startTime: action.payload.startTime,
          side: action.payload.side,
          leftAccumulatedSeconds: 0,
          rightAccumulatedSeconds: 0,
          currentSideStartedAt: action.payload.startTime,
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

    case "REMOTE_INSERT": {
      const exists = state.feedings.some(f => f.id === action.payload.id);
      if (exists) return state;
      return { ...state, feedings: [...state.feedings, action.payload] };
    }

    case "REMOTE_UPDATE": {
      const updatedFeedings = state.feedings.map(f =>
        f.id === action.payload.id ? action.payload : f
      );
      return { ...state, feedings: updatedFeedings };
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
  startBreastfeeding: (side: BreastSide, requestedStartTime?: Date) => Promise<TimerLockResult>;
  stopBreastfeeding: (requestedEndTime?: Date) => Promise<StoredFeedingEntry | null>;
  changeSide: (side: BreastSide) => void;
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
  const { subscribeToRemoteChanges } = useSync();
  const { user } = useAuth();
  const liveActivityIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('feedings', (change: RemoteChange) => {
      if (!selectedBaby) return;

      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

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

  const loadFeedings = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_FEEDINGS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      let feedings: StoredFeedingEntry[];

      if (user?.householdId) {
        try {
          feedings = await fetchFeedingsFromDatabase(selectedBaby.id);
        } catch (error) {
          console.error("[FeedingContext] Failed to fetch from database, using local:", error);
          feedings = await FeedingStorageService.getAllFeedings(selectedBaby.id);
        }
      } else {
        feedings = await FeedingStorageService.getAllFeedings(selectedBaby.id);
      }

      dispatch({ type: "SET_FEEDINGS", payload: feedings });

      const lastSide = await FeedingStorageService.getLastBreastSide(selectedBaby.id);
      dispatch({ type: "SET_LAST_BREAST_SIDE", payload: lastSide });

      const activeTimer = await FeedingStorageService.getActiveTimer(selectedBaby.id);
      if (activeTimer) {
        dispatch({
          type: "RESTORE_TIMER",
          payload: {
            isRunning: true,
            startTime: new Date(activeTimer.startedAt),
            side: activeTimer.side,
            leftAccumulatedSeconds: activeTimer.leftAccumulatedSeconds ?? 0,
            rightAccumulatedSeconds: activeTimer.rightAccumulatedSeconds ?? 0,
            currentSideStartedAt: activeTimer.currentSideStartedAt
              ? new Date(activeTimer.currentSideStartedAt)
              : new Date(activeTimer.startedAt),
          },
        });

        // Just store the existing Live Activity ID if we have one
        // Don't try to check/restore Live Activities on startup - it can hang after phone restart
        if (activeTimer.liveActivityId) {
          liveActivityIdRef.current = activeTimer.liveActivityId;
        }
      }
    } catch (error) {
      console.error("[FeedingContext] Failed to load feedings:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [selectedBaby, user?.householdId]);

  useEffect(() => {
    loadFeedings();
  }, [loadFeedings]);

  const startBreastfeeding = useCallback(async (side: BreastSide, requestedStartTime?: Date): Promise<{ success: boolean; lockedByName?: string }> => {
    if (!selectedBaby) return { success: false };

    if (user?.id) {
      try {
        const lockResult = await acquireTimerLock(selectedBaby.id, "feeding", user.id);
        if (!lockResult.success) {
          return { success: false, lockedByName: lockResult.lockHolderName };
        }
      } catch (error) {
        console.error("[FeedingContext] Failed to acquire timer lock:", error);
      }
    }

    const startTime = requestedStartTime ?? new Date();
    dispatch({ type: "START_TIMER", payload: { startTime, side } });

    const activityId = await startTimerLiveActivity("feeding", selectedBaby.name, side as LiveActivityBreastSide, startTime);
    if (activityId) {
      liveActivityIdRef.current = activityId;
    }

    await FeedingStorageService.setActiveTimer(selectedBaby.id, {
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

    const endTime = requestedEndTime ?? new Date();
    const durationSeconds = Math.floor(
      (endTime.getTime() - state.activeTimer.startTime.getTime()) / 1000
    );

    const currentSideElapsed = Math.floor(
      (endTime.getTime() - state.activeTimer.currentSideStartedAt.getTime()) / 1000
    );

    let leftDurationSeconds = state.activeTimer.leftAccumulatedSeconds;
    let rightDurationSeconds = state.activeTimer.rightAccumulatedSeconds;

    if (state.activeTimer.side === "left") {
      leftDurationSeconds += currentSideElapsed;
    } else if (state.activeTimer.side === "right") {
      rightDurationSeconds += currentSideElapsed;
    } else if (state.activeTimer.side === "both") {
      leftDurationSeconds += currentSideElapsed;
      rightDurationSeconds += currentSideElapsed;
    }

    const lastSide = leftDurationSeconds >= rightDurationSeconds ? "left" : "right";
    const effectiveSide = leftDurationSeconds > 0 && rightDurationSeconds > 0 ? "both" : lastSide;

    const feedingInput: CreateFeedingInput = {
      babyId: selectedBaby.id,
      type: "breast",
      side: effectiveSide,
      lastFinishedSide: state.activeTimer.side,
      startedAt: state.activeTimer.startTime,
      endedAt: endTime,
      durationSeconds,
      leftDurationSeconds: leftDurationSeconds > 0 ? leftDurationSeconds : undefined,
      rightDurationSeconds: rightDurationSeconds > 0 ? rightDurationSeconds : undefined,
    };

    let feeding: StoredFeedingEntry;

    if (user?.householdId && user?.id) {
      feeding = await createFeedingInDatabase(feedingInput, user.id);
    } else {
      feeding = await FeedingStorageService.addFeeding(feedingInput);
    }

    dispatch({ type: "ADD_FEEDING", payload: feeding });
    dispatch({ type: "STOP_TIMER" });
    await FeedingStorageService.clearActiveTimer(selectedBaby.id);

    if (liveActivityIdRef.current) {
      await endTimerLiveActivity(liveActivityIdRef.current);
      liveActivityIdRef.current = null;
    } else {
      await endLiveActivityByType("feeding");
    }

    if (user?.id) {
      try {
        await releaseTimerLock(selectedBaby.id, "feeding", user.id);
      } catch (error) {
        console.error("[FeedingContext] Failed to release timer lock:", error);
      }
    }

    return feeding;
  }, [selectedBaby, state.activeTimer, user?.householdId, user?.id]);

  const changeSide = useCallback((side: BreastSide) => {
    if (!state.activeTimer) return;

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
        startedAt: state.activeTimer.startTime.toISOString(),
        side,
        type: "breast",
        leftAccumulatedSeconds: leftAccumulated,
        rightAccumulatedSeconds: rightAccumulated,
        currentSideStartedAt: now.toISOString(),
        liveActivityId: liveActivityIdRef.current ?? undefined,
      });

      // Update Live Activity with new side
      if (liveActivityIdRef.current) {
        updateTimerLiveActivity(liveActivityIdRef.current, side as LiveActivityBreastSide);
      }
    }
  }, [selectedBaby, state.activeTimer]);

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

  const suggestedSide: BreastSide = state.lastBreastSide
    ? getOppositeSide(state.lastBreastSide)
    : "left";

  const value: FeedingContextValue = {
    ...state,
    startBreastfeeding,
    stopBreastfeeding,
    changeSide,
    suggestedSide,
    addFeeding,
    updateFeeding,
    deleteFeeding,
    refreshFeedings: loadFeedings,
    getLastFeeding,
  };

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

