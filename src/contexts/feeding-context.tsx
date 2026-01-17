import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import {
  FeedingStorageService,
  StoredFeedingEntry,
  CreateFeedingInput,
  UpdateFeedingInput,
} from "@/services/feeding-storage";
import type { BreastSide } from "@/constants/activities";
import { getOppositeSide } from "@/constants/activities";
import { useBaby } from "./baby-context";

export interface ActiveTimer {
  isRunning: boolean;
  startTime: Date;
  side?: BreastSide;
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
  | { type: "STOP_TIMER" }
  | { type: "UPDATE_TIMER_SIDE"; payload: BreastSide };

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
      if (action.payload.type === "breast" && action.payload.side) {
        newState.lastBreastSide = action.payload.side;
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

    default:
      return state;
  }
}

interface FeedingContextValue extends FeedingState {
  startBreastfeeding: (side: BreastSide) => Promise<void>;
  stopBreastfeeding: () => Promise<StoredFeedingEntry | null>;
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

  const loadFeedings = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_FEEDINGS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    const feedings = await FeedingStorageService.getAllFeedings(selectedBaby.id);
    dispatch({ type: "SET_FEEDINGS", payload: feedings });

    const lastSide = await FeedingStorageService.getLastBreastSide(selectedBaby.id);
    dispatch({ type: "SET_LAST_BREAST_SIDE", payload: lastSide });

    const activeTimer = await FeedingStorageService.getActiveTimer(selectedBaby.id);
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
    loadFeedings();
  }, [loadFeedings]);

  const startBreastfeeding = useCallback(async (side: BreastSide) => {
    if (!selectedBaby) return;

    const startTime = new Date();
    dispatch({ type: "START_TIMER", payload: { startTime, side } });

    await FeedingStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: startTime.toISOString(),
      side,
      type: "breast",
    });
  }, [selectedBaby]);

  const stopBreastfeeding = useCallback(async (): Promise<StoredFeedingEntry | null> => {
    if (!selectedBaby || !state.activeTimer) return null;

    const endTime = new Date();
    const durationSeconds = Math.floor(
      (endTime.getTime() - state.activeTimer.startTime.getTime()) / 1000
    );

    const feeding = await FeedingStorageService.addFeeding({
      babyId: selectedBaby.id,
      type: "breast",
      side: state.activeTimer.side,
      startedAt: state.activeTimer.startTime,
      endedAt: endTime,
      durationSeconds,
    });

    dispatch({ type: "ADD_FEEDING", payload: feeding });
    dispatch({ type: "STOP_TIMER" });
    await FeedingStorageService.clearActiveTimer(selectedBaby.id);

    return feeding;
  }, [selectedBaby, state.activeTimer]);

  const changeSide = useCallback((side: BreastSide) => {
    dispatch({ type: "UPDATE_TIMER_SIDE", payload: side });
    if (selectedBaby && state.activeTimer) {
      FeedingStorageService.setActiveTimer(selectedBaby.id, {
        startedAt: state.activeTimer.startTime.toISOString(),
        side,
        type: "breast",
      });
    }
  }, [selectedBaby, state.activeTimer]);

  const addFeeding = useCallback(async (input: CreateFeedingInput): Promise<StoredFeedingEntry> => {
    const feeding = await FeedingStorageService.addFeeding(input);
    dispatch({ type: "ADD_FEEDING", payload: feeding });
    return feeding;
  }, []);

  const updateFeeding = useCallback(async (
    feedingId: string,
    input: UpdateFeedingInput
  ): Promise<StoredFeedingEntry | null> => {
    if (!selectedBaby) return null;

    const updated = await FeedingStorageService.updateFeeding(
      selectedBaby.id,
      feedingId,
      input
    );
    if (updated) {
      dispatch({ type: "UPDATE_FEEDING", payload: updated });
    }
    return updated;
  }, [selectedBaby]);

  const deleteFeeding = useCallback(async (feedingId: string): Promise<boolean> => {
    if (!selectedBaby) return false;

    const result = await FeedingStorageService.deleteFeeding(selectedBaby.id, feedingId);
    if (result) {
      dispatch({ type: "DELETE_FEEDING", payload: feedingId });
    }
    return result;
  }, [selectedBaby]);

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
