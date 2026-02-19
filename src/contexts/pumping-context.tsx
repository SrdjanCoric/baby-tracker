import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from "react";
import {
  PumpingStorageService,
  StoredPumpingEntry,
  CreatePumpingInput,
  UpdatePumpingInput,
} from "@/services/pumping-storage";
import {
  fetchPumpingFromDatabase,
  createPumpingInDatabase,
  updatePumpingInDatabase,
  deletePumpingFromDatabase,
} from "@/services/activity-sync-service";
import type { BreastSide } from "@/constants/activities";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange } from "@/services/sync";
import { acquireTimerLock, releaseTimerLock, updateTimerData, getActiveTimerLock } from "@/services/active-timer-service";
import { startTimerLiveActivity, endTimerLiveActivity, endLiveActivityByType, updateTimerLiveActivity, pauseTimerLiveActivity, resumeTimerLiveActivity } from "@/services/live-activity-service";

export interface ActivePumpingTimer {
  isRunning: boolean;
  isPaused: boolean;
  startTime: Date;
  side: BreastSide;
  totalPausedMs: number;
  pausedAt?: Date;
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
  | { type: "PAUSE_TIMER" }
  | { type: "RESUME_TIMER" }
  | { type: "RESTORE_TIMER"; payload: ActivePumpingTimer }
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
          isPaused: false,
          startTime: action.payload.startTime,
          side: action.payload.side,
          totalPausedMs: 0,
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

export interface TimerLockResult {
  success: boolean;
  lockedByName?: string;
}

interface PumpingContextValue extends PumpingState {
  startPumping: (side: BreastSide, requestedStartTime?: Date) => Promise<TimerLockResult>;
  stopPumping: (volumeMl: number, requestedEndTime?: Date) => Promise<StoredPumpingEntry | null>;
  changePumpingSide: (side: BreastSide) => void;
  pausePumping: () => Promise<void>;
  resumePumping: () => Promise<void>;
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
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();
  const liveActivityIdRef = useRef<string | null>(null);

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

    try {
      let pumpings: StoredPumpingEntry[];

      if (user?.householdId) {
        try {
          pumpings = await fetchPumpingFromDatabase(selectedBaby.id);
        } catch (error) {
          console.error("[PumpingContext] Failed to fetch from database, using local:", error);
          pumpings = await PumpingStorageService.getAllPumpings(selectedBaby.id);
        }
      } else {
        pumpings = await PumpingStorageService.getAllPumpings(selectedBaby.id);
      }

      dispatch({ type: "SET_PUMPINGS", payload: pumpings });

      const activeTimer = await PumpingStorageService.getActiveTimer(selectedBaby.id);
      if (activeTimer) {
        dispatch({
          type: "RESTORE_TIMER",
          payload: {
            isRunning: true,
            isPaused: activeTimer.isPaused ?? false,
            startTime: new Date(activeTimer.startedAt),
            side: activeTimer.side,
            totalPausedMs: activeTimer.totalPausedMs ?? 0,
            pausedAt: activeTimer.pausedAt ? new Date(activeTimer.pausedAt) : undefined,
          },
        });

        if (activeTimer.liveActivityId) {
          liveActivityIdRef.current = activeTimer.liveActivityId;
        }
      } else if (user?.id && user?.householdId) {
        try {
          const lock = await getActiveTimerLock(selectedBaby.id, "pumping");
          if (lock && lock.startedBy === user.id) {
            const td = lock.timerData || {};
            const side = (typeof td.side === "string" ? td.side : "both") as BreastSide;
            const isPaused = td.isPaused === true;
            const totalPausedMs = typeof td.totalPausedMs === "number" ? td.totalPausedMs : 0;
            const pausedAt = typeof td.pausedAt === "string" ? td.pausedAt : undefined;

            dispatch({
              type: "RESTORE_TIMER",
              payload: {
                isRunning: true,
                isPaused,
                startTime: new Date(lock.startedAt),
                side,
                totalPausedMs,
                pausedAt: pausedAt ? new Date(pausedAt) : undefined,
              },
            });

            await PumpingStorageService.setActiveTimer(selectedBaby.id, {
              startedAt: lock.startedAt,
              side,
              isPaused,
              totalPausedMs,
              pausedAt,
            });

            if (!isPaused) {
              const activityId = await startTimerLiveActivity("pumping", selectedBaby.name, side, new Date(lock.startedAt));
              if (activityId) liveActivityIdRef.current = activityId;
            }
          }
        } catch (error) {
          console.error("[PumpingContext] Failed to restore from server:", error);
        }
      }
    } catch (error) {
      console.error("[PumpingContext] Failed to load pumpings:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [selectedBaby, user?.householdId, user?.id]);

  useEffect(() => {
    loadPumpings();
  }, [loadPumpings, foregroundRefreshKey]);

  const startPumping = useCallback(async (side: BreastSide, requestedStartTime?: Date): Promise<{ success: boolean; lockedByName?: string }> => {
    if (!selectedBaby) return { success: false };

    if (user?.id) {
      try {
        const lockResult = await acquireTimerLock(selectedBaby.id, "pumping", user.id, { side });
        if (!lockResult.success) {
          return { success: false, lockedByName: lockResult.lockHolderName };
        }
      } catch (error) {
        console.error("[PumpingContext] Failed to acquire timer lock:", error);
      }
    }

    const startTime = requestedStartTime ?? new Date();
    dispatch({ type: "START_TIMER", payload: { startTime, side } });

    const activityId = await startTimerLiveActivity("pumping", selectedBaby.name, side, startTime);
    if (activityId) {
      liveActivityIdRef.current = activityId;
    }

    await PumpingStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: startTime.toISOString(),
      side,
      liveActivityId: activityId ?? undefined,
    });

    return { success: true };
  }, [selectedBaby, user?.id]);

  const stopPumping = useCallback(async (volumeMl: number, requestedEndTime?: Date): Promise<StoredPumpingEntry | null> => {
    if (!selectedBaby || !state.activeTimer) return null;

    const endTime = requestedEndTime ?? new Date();
    const durationSeconds = Math.floor(
      (endTime.getTime() - state.activeTimer.startTime.getTime() - state.activeTimer.totalPausedMs) / 1000
    );

    if (durationSeconds < 60) {
      dispatch({ type: "STOP_TIMER" });
      await PumpingStorageService.clearActiveTimer(selectedBaby.id);
      if (liveActivityIdRef.current) {
        await endTimerLiveActivity(liveActivityIdRef.current);
        liveActivityIdRef.current = null;
      } else {
        await endLiveActivityByType("pumping");
      }
      if (user?.id) {
        try { await releaseTimerLock(selectedBaby.id, "pumping", user.id); } catch { /* ignore */ }
      }
      return null;
    }

    const pumpingInput: CreatePumpingInput = {
      babyId: selectedBaby.id,
      side: state.activeTimer.side,
      startedAt: state.activeTimer.startTime,
      endedAt: endTime,
      durationSeconds,
      volumeMl,
    };

    let pumping: StoredPumpingEntry;

    if (user?.householdId && user?.id) {
      pumping = await createPumpingInDatabase(pumpingInput, user.id);
    } else {
      pumping = await PumpingStorageService.addPumping(pumpingInput);
    }

    dispatch({ type: "ADD_PUMPING", payload: pumping });
    dispatch({ type: "STOP_TIMER" });
    await PumpingStorageService.clearActiveTimer(selectedBaby.id);

    if (liveActivityIdRef.current) {
      await endTimerLiveActivity(liveActivityIdRef.current);
      liveActivityIdRef.current = null;
    } else {
      await endLiveActivityByType("pumping");
    }

    if (user?.id) {
      try {
        await releaseTimerLock(selectedBaby.id, "pumping", user.id);
      } catch (error) {
        console.error("[PumpingContext] Failed to release timer lock:", error);
      }
    }

    return pumping;
  }, [selectedBaby, state.activeTimer, user?.householdId, user?.id]);

  const changePumpingSide = useCallback((side: BreastSide) => {
    if (state.activeTimer?.isPaused) return;
    dispatch({ type: "UPDATE_TIMER_SIDE", payload: side });
    if (selectedBaby && state.activeTimer) {
      PumpingStorageService.setActiveTimer(selectedBaby.id, {
        startedAt: state.activeTimer.startTime.toISOString(),
        side,
        liveActivityId: liveActivityIdRef.current ?? undefined,
        isPaused: state.activeTimer.isPaused,
        totalPausedMs: state.activeTimer.totalPausedMs,
        pausedAt: state.activeTimer.pausedAt?.toISOString(),
      });
      if (liveActivityIdRef.current) {
        updateTimerLiveActivity(liveActivityIdRef.current, side);
      }
      if (user?.id) {
        updateTimerData(selectedBaby.id, "pumping", user.id, { side }).catch(
          (error) => console.error("[PumpingContext] Failed to update timer data:", error)
        );
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const pausePumping = useCallback(async () => {
    if (!selectedBaby || !state.activeTimer || state.activeTimer.isPaused) return;

    dispatch({ type: "PAUSE_TIMER" });

    if (liveActivityIdRef.current) {
      await pauseTimerLiveActivity(liveActivityIdRef.current);
    }

    await PumpingStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: state.activeTimer.startTime.toISOString(),
      side: state.activeTimer.side,
      liveActivityId: liveActivityIdRef.current ?? undefined,
      isPaused: true,
      pausedAt: new Date().toISOString(),
      totalPausedMs: state.activeTimer.totalPausedMs,
    });

    if (user?.id) {
      try {
        await updateTimerData(selectedBaby.id, "pumping", user.id, {
          isPaused: true,
          pausedAt: new Date().toISOString(),
          totalPausedMs: state.activeTimer.totalPausedMs,
          side: state.activeTimer.side,
        });
      } catch (error) {
        console.error("[PumpingContext] Failed to update timer data:", error);
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const resumePumping = useCallback(async () => {
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

    await PumpingStorageService.setActiveTimer(selectedBaby.id, {
      startedAt: state.activeTimer.startTime.toISOString(),
      side: state.activeTimer.side,
      liveActivityId: liveActivityIdRef.current ?? undefined,
      isPaused: false,
      totalPausedMs: newTotalPausedMs,
    });

    if (user?.id) {
      try {
        await updateTimerData(selectedBaby.id, "pumping", user.id, {
          isPaused: false,
          totalPausedMs: newTotalPausedMs,
          side: state.activeTimer.side,
        });
      } catch (error) {
        console.error("[PumpingContext] Failed to update timer data:", error);
      }
    }
  }, [selectedBaby, state.activeTimer, user?.id]);

  const addPumping = useCallback(async (input: CreatePumpingInput): Promise<StoredPumpingEntry> => {
    let pumping: StoredPumpingEntry;

    if (user?.householdId && user?.id) {
      pumping = await createPumpingInDatabase(input, user.id);
    } else {
      pumping = await PumpingStorageService.addPumping(input);
    }

    dispatch({ type: "ADD_PUMPING", payload: pumping });
    return pumping;
  }, [user?.householdId, user?.id]);

  const updatePumping = useCallback(async (
    pumpingId: string,
    input: UpdatePumpingInput
  ): Promise<StoredPumpingEntry | null> => {
    if (!selectedBaby) return null;

    let updated: StoredPumpingEntry | null;

    if (user?.householdId) {
      updated = await updatePumpingInDatabase(selectedBaby.id, pumpingId, input);
    } else {
      updated = await PumpingStorageService.updatePumping(selectedBaby.id, pumpingId, input);
    }

    if (updated) {
      dispatch({ type: "UPDATE_PUMPING", payload: updated });
    }
    return updated;
  }, [selectedBaby, user?.householdId]);

  const deletePumping = useCallback(async (pumpingId: string): Promise<boolean> => {
    if (!selectedBaby) return false;

    let result: boolean;

    if (user?.householdId) {
      result = await deletePumpingFromDatabase(selectedBaby.id, pumpingId);
    } else {
      result = await PumpingStorageService.deletePumping(selectedBaby.id, pumpingId);
    }

    if (result) {
      dispatch({ type: "DELETE_PUMPING", payload: pumpingId });
    }
    return result;
  }, [selectedBaby, user?.householdId]);

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
    pausePumping,
    resumePumping,
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
    volumeMl: data.amount_ml as number | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

