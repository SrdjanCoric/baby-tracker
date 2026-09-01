import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useActiveTimers } from "./active-timers-context";
import { RemoteChange, tombstonedId, upsertById } from "@/services/sync";
import {
  acquireTimerLock,
  releaseTimerLockDurably,
  updateTimerData,
  getActiveTimerSnapshotForBaby,
  type ActiveTimerLock as ServerActiveTimerLock,
} from "@/services/active-timer-service";
import {
  startTimerLiveActivity,
  endTimerLiveActivity,
  endLiveActivityByType,
  updateTimerLiveActivity,
  pauseTimerLiveActivity,
  resumeTimerLiveActivity,
} from "@/services/live-activity-service";
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
import {
  editRunningTimerStartTime,
  restoreTimerLifecycle,
  stopRemoteTimerLifecycle,
} from "@/services/timer-lifecycle";
import { createPumpingTimerAdapter } from "@/services/timer-adapters/pumping-timer-adapter";
import { useActivityRangeLoader } from "@/hooks/useActivityRangeLoader";
import type {
  ActivityRangeLoadOptions,
  ActivityRangeStatus,
  UtcActivityRange,
} from "@/services/activity-range-loader";

export interface ActivePumpingTimer extends TimerIdentity {
  isRunning: boolean;
  lockState: TimerLockReconciliationState;
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
  | {
      type: "START_TIMER";
      payload: {
        startTime: Date;
        side: BreastSide;
        lockState: TimerLockReconciliationState;
      } & TimerIdentity;
    }
  | { type: "STOP_TIMER" }
  | { type: "UPDATE_TIMER_SIDE"; payload: BreastSide }
  | { type: "PAUSE_TIMER"; payload: { pausedAt: Date } }
  | { type: "RESUME_TIMER" }
  | {
      type: "SYNC_TIMER_PAUSE";
      payload: { isPaused: boolean; pausedAt?: Date; totalPausedMs: number };
    }
  | { type: "RESTORE_TIMER"; payload: ActivePumpingTimer }
  | { type: "EDIT_TIMER_START"; payload: Date }
  | { type: "REMOTE_INSERT"; payload: StoredPumpingEntry }
  | { type: "REMOTE_UPDATE"; payload: StoredPumpingEntry }
  | { type: "REMOTE_DELETE"; payload: string };

export const initialPumpingState: PumpingState = {
  pumpings: [],
  activeTimer: null,
  isLoading: true,
};

export function pumpingReducer(
  state: PumpingState,
  action: PumpingAction
): PumpingState {
  switch (action.type) {
    case "SET_PUMPINGS":
      return { ...state, pumpings: action.payload };

    case "ADD_PUMPING":
      return { ...state, pumpings: upsertById(state.pumpings, action.payload) };

    case "UPDATE_PUMPING": {
      const updatedPumpings = state.pumpings.map((p) =>
        p.id === action.payload.id ? action.payload : p
      );
      return { ...state, pumpings: updatedPumpings };
    }

    case "DELETE_PUMPING": {
      const filteredPumpings = state.pumpings.filter(
        (p) => p.id !== action.payload
      );
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
          lockState: action.payload.lockState,
          startTime: action.payload.startTime,
          timerInstanceId: action.payload.timerInstanceId,
          activityId: action.payload.activityId,
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

    case "SYNC_TIMER_PAUSE":
      if (!state.activeTimer) return state;
      return {
        ...state,
        activeTimer: {
          ...state.activeTimer,
          isPaused: action.payload.isPaused,
          pausedAt: action.payload.isPaused ? action.payload.pausedAt : undefined,
          totalPausedMs: action.payload.totalPausedMs,
        },
      };

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
      return { ...state, pumpings: upsertById(state.pumpings, action.payload) };

    case "REMOTE_UPDATE": {
      return { ...state, pumpings: upsertById(state.pumpings, action.payload) };
    }

    case "REMOTE_DELETE": {
      const filteredPumpings = state.pumpings.filter(
        (p) => p.id !== action.payload
      );
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
  babyBinding: BabyProviderBinding;
  isStopping: boolean;
  startPumping: (
    side: BreastSide,
    requestedStartTime?: Date,
    requestedIdentity?: TimerIdentity
  ) => Promise<TimerLockResult>;
  stopPumping: (
    volumeMl: number,
    requestedEndTime?: Date
  ) => Promise<StoredPumpingEntry | null>;
  stopRemotePumping: (
    requestedEndTime?: Date
  ) => Promise<StoredPumpingEntry | null>;
  editPumpingStartTime: (startedAt: Date) => Promise<void>;
  changePumpingSide: (side: BreastSide) => void;
  pausePumping: (requestedPauseTime?: Date) => Promise<void>;
  resumePumping: (
    requestedResumeTime?: Date,
    widgetPauseDurationMs?: number
  ) => Promise<void>;
  addPumping: (input: CreatePumpingInput) => Promise<StoredPumpingEntry>;
  updatePumping: (
    pumpingId: string,
    input: UpdatePumpingInput
  ) => Promise<StoredPumpingEntry | null>;
  deletePumping: (pumpingId: string) => Promise<boolean>;
  refreshPumpings: () => Promise<void>;
  loadPumpingRange: (
    range: UtcActivityRange,
    options?: ActivityRangeLoadOptions
  ) => Promise<void>;
  getPumpingRangeStatus: (range: UtcActivityRange) => ActivityRangeStatus;
  getLastPumping: () => StoredPumpingEntry | null;
  getTodaysTotalVolume: () => number;
  getLastSide: () => BreastSide | null;
}

const PumpingContext = createContext<PumpingContextValue | null>(null);

export function PumpingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(pumpingReducer, initialPumpingState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, registerForegroundRefreshLoader } = useSync();
  const { user } = useAuth();
  const {
    locks: activeTimerLocks = [],
    isLoading: activeTimerLocksLoading = true,
    getLockForActivity,
    refreshLocks,
  } = useActiveTimers();
  const liveActivityIdRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);
  const [isStopping, setIsStopping] = useState(false);
  const stopVersionRef = useRef(0);
  const observedOwnedTimerRef = useRef<string | null>(null);
  const {
    babyBinding,
    beginBabyBinding,
    finishBabyBinding,
    isCurrentBabyBinding,
  } = useBabyProviderBinding(selectedBaby?.id ?? null);
  const acceptPumpingRange = useCallback((entries: StoredPumpingEntry[]) => {
    dispatch({ type: "SET_PUMPINGS", payload: entries });
  }, []);
  const { loadRange: loadPumpingRange, getRangeStatus: getPumpingRangeStatus } =
    useActivityRangeLoader({
      table: "pumping_sessions",
      babyId: selectedBaby?.id ?? null,
      authenticated: Boolean(user?.householdId),
      storageScope: `${user?.id ?? "guest"}:${user?.householdId ?? "local"}:${selectedBaby?.id ?? "none"}`,
      acceptEntries: acceptPumpingRange,
    });

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges(
      "pumping_sessions",
      (change: RemoteChange) => {
        if (!selectedBaby) return;
        const data = change.new || change.old;
        if (data && data.baby_id !== selectedBaby.id) return;

        const removeId = tombstonedId(change);
        if (removeId) {
          dispatch({ type: "REMOTE_DELETE", payload: removeId });
          return;
        }

        switch (change.eventType) {
          case "INSERT":
            if (change.new)
              dispatch({
                type: "REMOTE_INSERT",
                payload: transformPumpingFromRemote(change.new),
              });
            break;
          case "UPDATE":
            if (change.new)
              dispatch({
                type: "REMOTE_UPDATE",
                payload: transformPumpingFromRemote(change.new),
              });
            break;
        }
      }
    );
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const restorePumpingTimer = useCallback(
    async (
      pumpings: StoredPumpingEntry[],
      bindingToken: BabyProviderBindingToken,
      stopVersionAtStart: number,
      timerSnapshot?: Promise<readonly ServerActiveTimerLock[]>
    ) => {
      if (!selectedBaby) return;

      const adapter = createPumpingTimerAdapter({
        babyId: selectedBaby.id,
        dispatchRestoreTimer: (restoredTimer) => {
          dispatch({ type: "RESTORE_TIMER", payload: restoredTimer });
        },
      });

      await restoreTimerLifecycle({
        adapter,
        baby: selectedBaby,
        user: user?.id
          ? { id: user.id, householdId: user.householdId ?? undefined }
          : null,
        completedRecords: pumpings,
        stopVersionAtStart,
        currentStopVersion: () => stopVersionRef.current,
        isStopping: () => isStoppingRef.current,
        isCurrentBabyBinding: () => isCurrentBabyBinding(bindingToken),
        liveActivityIdRef,
        refreshLocks,
        persistRecord: (input) =>
          user?.householdId && user.id
            ? createPumpingInDatabase(input, user.id)
            : PumpingStorageService.addPumping(input),
        dispatchStopTimer: () => dispatch({ type: "STOP_TIMER" }),
        dispatchAddRecord: (record) =>
          dispatch({ type: "ADD_PUMPING", payload: record }),
        errorLabel: "[PumpingContext]",
        timerSnapshot,
      });
    },
    [
      isCurrentBabyBinding,
      refreshLocks,
      selectedBaby,
      user?.householdId,
      user?.id,
    ]
  );

  const loadPumpings = useCallback(async (reportFailure = false) => {
    let loadError: unknown;
    const bindingToken = beginBabyBinding(selectedBaby?.id ?? null);
    const isCurrentBinding = () => isCurrentBabyBinding(bindingToken);
    if (!selectedBaby) {
      dispatch({ type: "SET_PUMPINGS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      finishBabyBinding(bindingToken, "ready");
      return;
    }

    const stopVersionAtStart = stopVersionRef.current;
    const timerSnapshot = user?.id && user.householdId
      ? getActiveTimerSnapshotForBaby(selectedBaby.id)
      : undefined;
    void timerSnapshot?.catch(() => undefined);
    let bindingStatus: "ready" | "error" = "ready";
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      let pumpings: StoredPumpingEntry[];

      if (user?.householdId) {
        try {
          pumpings = await fetchPumpingFromDatabase(selectedBaby.id);
        } catch (error) {
          loadError = error;
          if (!isCurrentBinding()) return;
          console.error(
            "[PumpingContext] Failed to fetch from database, using local:",
            error
          );
          pumpings = await PumpingStorageService.getAllPumpings(
            selectedBaby.id
          );
        }
      } else {
        pumpings = await PumpingStorageService.getAllPumpings(selectedBaby.id);
      }

      if (!isCurrentBinding()) return;
      dispatch({ type: "SET_PUMPINGS", payload: pumpings });
      await restorePumpingTimer(pumpings, bindingToken, stopVersionAtStart, timerSnapshot);
    } catch (error) {
      loadError = error;
      if (!isCurrentBinding()) return;
      bindingStatus = "error";
      console.error("[PumpingContext] Failed to load pumpings:", error);
    } finally {
      if (isCurrentBinding()) {
        dispatch({ type: "SET_LOADING", payload: false });
        finishBabyBinding(bindingToken, bindingStatus);
      }
    }
    if (reportFailure && loadError) throw loadError;
  }, [
    beginBabyBinding,
    finishBabyBinding,
    isCurrentBabyBinding,
    restorePumpingTimer,
    selectedBaby,
    user?.householdId,
    user?.id,
  ]);

  useEffect(() => {
    void loadPumpings();
  }, [loadPumpings]);

  useEffect(() => {
    const activeTimer = state.activeTimer;
    if (!selectedBaby || !activeTimer || activeTimer.lockState !== "owned") {
      observedOwnedTimerRef.current = null;
      return;
    }
    if (!user?.id) return;
    if (activeTimerLocksLoading) return;
    const lock = activeTimerLocks.find(
      candidate =>
        candidate.babyId === selectedBaby.id && candidate.activityType === "pumping"
    );
    const serverTimerInstanceId = lock?.timerData?.timerInstanceId;
    const matches =
      lock !== undefined &&
      lock.startedBy === user?.id &&
      (typeof serverTimerInstanceId === "string"
        ? serverTimerInstanceId === activeTimer.timerInstanceId
        : new Date(lock.startedAt).getTime() === activeTimer.startTime.getTime());
    if (matches && lock) {
      observedOwnedTimerRef.current = activeTimer.timerInstanceId;
      const isPaused = lock.timerData?.isPaused === true;
      const totalPausedMs = typeof lock.timerData?.totalPausedMs === "number"
        ? lock.timerData.totalPausedMs
        : 0;
      const pausedAt = isPaused && typeof lock.timerData?.pausedAt === "string"
        ? new Date(lock.timerData.pausedAt)
        : undefined;
      if (
        activeTimer.isPaused !== isPaused ||
        activeTimer.totalPausedMs !== totalPausedMs ||
        activeTimer.pausedAt?.getTime() !== pausedAt?.getTime()
      ) {
        dispatch({
          type: "SYNC_TIMER_PAUSE",
          payload: { isPaused, pausedAt, totalPausedMs },
        });
      }
    } else if (observedOwnedTimerRef.current === activeTimer.timerInstanceId) {
      observedOwnedTimerRef.current = null;
      stopVersionRef.current++;
      void (async () => {
        const endedById = liveActivityIdRef.current
          ? await endTimerLiveActivity(liveActivityIdRef.current)
          : false;
        if (!endedById) await endLiveActivityByType("pumping");
        liveActivityIdRef.current = null;
        dispatch({ type: "STOP_TIMER" });
        await PumpingStorageService.clearActiveTimer(selectedBaby.id);
      })();
    }
  }, [activeTimerLocks, activeTimerLocksLoading, selectedBaby, state.activeTimer, user?.id]);

  useEffect(
    () => registerForegroundRefreshLoader?.("pumping_sessions", () => loadPumpings(true)),
    [loadPumpings, registerForegroundRefreshLoader]
  );

  const startPumping = useCallback(
    async (
      side: BreastSide,
      requestedStartTime?: Date,
      requestedIdentity?: TimerIdentity
    ): Promise<{ success: boolean; lockedByName?: string }> => {
      if (!selectedBaby) return { success: false };

      const startTime = requestedStartTime ?? new Date();
      const identity = requestedIdentity ?? (await createTimerIdentity());
      let lockState: TimerLockReconciliationState = user?.id
        ? "offline"
        : "accountless";
      if (user?.id) {
        try {
          const lockResult = await acquireTimerLock(
            selectedBaby.id,
            "pumping",
            user.id,
            { side, ...identity },
            requestedStartTime
          );
          if (!lockResult.success) {
            return { success: false, lockedByName: lockResult.lockHolderName };
          }
          lockState = "owned";
        } catch (error) {
          console.error(
            "[PumpingContext] Failed to acquire timer lock (proceeding offline):",
            error
          );
        }
      }

      dispatch({
        type: "START_TIMER",
        payload: { startTime, side, lockState, ...identity },
      });

      const activityId = await startTimerLiveActivity(
        "pumping",
        selectedBaby.name,
        side,
        startTime
      );
      if (activityId) {
        liveActivityIdRef.current = activityId;
      }

      await PumpingStorageService.setActiveTimer(selectedBaby.id, {
        ...identity,
        startedAt: startTime.toISOString(),
        side,
        liveActivityId: activityId ?? undefined,
        lockState,
      });

      return { success: true };
    },
    [selectedBaby, user?.id]
  );

  const stopPumping = useCallback(
    async (
      volumeMl: number,
      requestedEndTime?: Date
    ): Promise<StoredPumpingEntry | null> => {
      if (!selectedBaby || !state.activeTimer) return null;
      if (isStoppingRef.current) return null;
      isStoppingRef.current = true;
      setIsStopping(true);
      stopVersionRef.current++;
      const activeTimer = state.activeTimer;

      const finishTimer = async () => {
        dispatch({ type: "STOP_TIMER" });
        // Start the durable lock release immediately so its write-ahead
        // intent is persisted before the app can be suspended mid-cleanup.
        const releaseLockPromise = user?.id
          ? releaseTimerLockDurably(
              selectedBaby.id,
              "pumping",
              user.id,
              activeTimer.timerInstanceId,
              activeTimer.startTime.toISOString()
            )
          : null;
        try {
          await PumpingStorageService.clearActiveTimer(selectedBaby.id);
        } catch (error) {
          console.error(
            "[PumpingContext] Failed to clear completed timer snapshot:",
            error
          );
        }
        try {
          const endedById = liveActivityIdRef.current
            ? await endTimerLiveActivity(liveActivityIdRef.current)
            : false;
          if (!endedById) {
            await endLiveActivityByType("pumping");
          }
          liveActivityIdRef.current = null;
        } catch (error) {
          console.error(
            "[PumpingContext] Failed to end completed Live Activity:",
            error
          );
        }
        if (releaseLockPromise) {
          try {
            await releaseLockPromise;
          } catch (error) {
            console.error(
              "[PumpingContext] Failed to release timer lock, retry stays queued:",
              error
            );
          }
        }
      };

      try {
        const requestedStopTime =
          activeTimer.isPaused && activeTimer.pausedAt
            ? activeTimer.pausedAt
            : (requestedEndTime ?? new Date());
        const requestedDurationSeconds = Math.floor(
          (requestedStopTime.getTime() -
            activeTimer.startTime.getTime()) /
            1000
        );
        const savesVolumeOnly =
          requestedDurationSeconds >= 0 &&
          requestedDurationSeconds < 60 &&
          volumeMl > 0;
        if (requestedDurationSeconds < 60 && !savesVolumeOnly) {
          await finishTimer();
          return null;
        }

        const completion = await acceptTimerCompletion(
          selectedBaby.id,
          "pumping",
          activeTimer.startTime.toISOString(),
          activeTimer,
          requestedStopTime
        );
        const endTime = new Date(completion.stoppedAt);
        if (completion.status === "completed") {
          const existing = await PumpingStorageService.getPumpingById(
            selectedBaby.id,
            completion.activityId
          );
          await finishTimer();
          return existing;
        }

        const adapter = createPumpingTimerAdapter({
          babyId: selectedBaby.id,
          dispatchRestoreTimer: (restoredTimer) => {
            dispatch({ type: "RESTORE_TIMER", payload: restoredTimer });
          },
        });
        const pumpingInput: CreatePumpingInput = savesVolumeOnly
          ? {
              id: completion.activityId,
              babyId: selectedBaby.id,
              side: activeTimer.side,
              startedAt: activeTimer.startTime,
              volumeMl,
            }
          : {
              ...adapter.buildRecord(activeTimer.startTime, endTime, {
                timerInstanceId: activeTimer.timerInstanceId,
                activityId: completion.activityId,
                side: activeTimer.side,
                isPaused: activeTimer.isPaused,
                totalPausedMs: activeTimer.totalPausedMs,
                pausedAt: activeTimer.pausedAt?.toISOString(),
              }),
              volumeMl,
            };

        let pumping: StoredPumpingEntry;
        try {
          if (user?.householdId && user?.id) {
            pumping = await createPumpingInDatabase(pumpingInput, user.id);
          } else {
            pumping = await PumpingStorageService.addPumping(pumpingInput);
          }
        } catch (saveError) {
          console.error(
            "[PumpingContext] Failed to durably complete timer:",
            saveError
          );
          throw saveError;
        }

        await markTimerCompletionDurable(completion);
        dispatch({ type: "ADD_PUMPING", payload: pumping });
        await finishTimer();
        return pumping;
      } finally {
        isStoppingRef.current = false;
        setIsStopping(false);
      }
    },
    [selectedBaby, state.activeTimer, user?.householdId, user?.id]
  );

  const stopRemotePumping = useCallback(
    async (requestedEndTime?: Date): Promise<StoredPumpingEntry | null> => {
      if (!selectedBaby || !user?.id || !user.householdId) return null;
      const lock = getLockForActivity(selectedBaby.id, "pumping");
      if (!lock || lock.startedBy === user.id || isStoppingRef.current) return null;
      isStoppingRef.current = true;
      setIsStopping(true);
      try {
        const adapter = createPumpingTimerAdapter({
          babyId: selectedBaby.id,
          dispatchRestoreTimer: restoredTimer =>
            dispatch({ type: "RESTORE_TIMER", payload: restoredTimer }),
        });
        return await stopRemoteTimerLifecycle({
          adapter,
          babyId: selectedBaby.id,
          userId: user.id,
          lock,
          requestedStopTime: requestedEndTime,
          persistRecord: input => createPumpingInDatabase(input, user.id),
          dispatchAddRecord: record =>
            dispatch({ type: "ADD_PUMPING", payload: record }),
          refreshLocks,
        });
      } finally {
        isStoppingRef.current = false;
        setIsStopping(false);
      }
    },
    [getLockForActivity, refreshLocks, selectedBaby, user?.householdId, user?.id]
  );

  const changePumpingSide = useCallback(
    (side: BreastSide) => {
      if (state.activeTimer?.isPaused) return;
      dispatch({ type: "UPDATE_TIMER_SIDE", payload: side });
      if (selectedBaby && state.activeTimer) {
        PumpingStorageService.setActiveTimer(selectedBaby.id, {
          timerInstanceId: state.activeTimer.timerInstanceId,
          activityId: state.activeTimer.activityId,
          startedAt: state.activeTimer.startTime.toISOString(),
          side,
          liveActivityId: liveActivityIdRef.current ?? undefined,
          isPaused: state.activeTimer.isPaused,
          totalPausedMs: state.activeTimer.totalPausedMs,
          pausedAt: state.activeTimer.pausedAt?.toISOString(),
          lockState: state.activeTimer.lockState,
        });
        if (liveActivityIdRef.current) {
          updateTimerLiveActivity(liveActivityIdRef.current, side);
        }
        if (user?.id) {
          updateTimerData(selectedBaby.id, "pumping", user.id, {
            timerInstanceId: state.activeTimer.timerInstanceId,
            activityId: state.activeTimer.activityId,
            side,
          }).catch((error) =>
            console.error(
              "[PumpingContext] Failed to update timer data:",
              error
            )
          );
        }
      }
    },
    [selectedBaby, state.activeTimer, user?.id]
  );

  const editPumpingStartTime = useCallback(
    async (startedAt: Date) => {
      if (!selectedBaby || !state.activeTimer) return;
      const activeTimer = state.activeTimer;
      const adapter = createPumpingTimerAdapter({
        babyId: selectedBaby.id,
        dispatchRestoreTimer: (restoredTimer) => {
          dispatch({ type: "RESTORE_TIMER", payload: restoredTimer });
        },
      });

      await editRunningTimerStartTime({
        adapter,
        baby: selectedBaby,
        userId: user?.id,
        activeTimer: {
          timerInstanceId: activeTimer.timerInstanceId,
          activityId: activeTimer.activityId,
          startedAt: activeTimer.startTime.toISOString(),
          side: activeTimer.side,
          liveActivityId: liveActivityIdRef.current ?? undefined,
          isPaused: activeTimer.isPaused,
          pausedAt: activeTimer.pausedAt?.toISOString(),
          totalPausedMs: activeTimer.totalPausedMs,
          lockState: activeTimer.lockState,
        },
        payload: {
          timerInstanceId: activeTimer.timerInstanceId,
          activityId: activeTimer.activityId,
          side: activeTimer.side,
          isPaused: activeTimer.isPaused,
          pausedAt: activeTimer.pausedAt?.toISOString(),
          totalPausedMs: activeTimer.totalPausedMs,
        },
        startedAt,
        liveActivityIdRef,
        dispatchEditedStart: (nextStart) => {
          dispatch({ type: "EDIT_TIMER_START", payload: nextStart });
        },
      });
      await refreshLocks();
    },
    [refreshLocks, selectedBaby, state.activeTimer, user?.id]
  );

  const pausePumping = useCallback(
    async (requestedPauseTime?: Date) => {
      if (!selectedBaby || !state.activeTimer || state.activeTimer.isPaused)
        return;

      const now = requestedPauseTime ?? new Date();

      dispatch({ type: "PAUSE_TIMER", payload: { pausedAt: now } });

      if (liveActivityIdRef.current) {
        const activeElapsedSeconds = Math.floor(
          (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
        );
        await pauseTimerLiveActivity(
          liveActivityIdRef.current,
          activeElapsedSeconds
        );
      }

      await PumpingStorageService.setActiveTimer(selectedBaby.id, {
        timerInstanceId: state.activeTimer.timerInstanceId,
        activityId: state.activeTimer.activityId,
        startedAt: state.activeTimer.startTime.toISOString(),
        side: state.activeTimer.side,
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
          await updateTimerData(selectedBaby.id, "pumping", user.id, {
            timerInstanceId: state.activeTimer.timerInstanceId,
            activityId: state.activeTimer.activityId,
            isPaused: true,
            pausedAt: now.toISOString(),
            accumulatedSeconds: totalElapsed,
            totalPausedMs: state.activeTimer.totalPausedMs,
            side: state.activeTimer.side,
          });
        } catch (error) {
          console.error("[PumpingContext] Failed to update timer data:", error);
        }
      }
    },
    [selectedBaby, state.activeTimer, user?.id]
  );

  const resumePumping = useCallback(
    async (requestedResumeTime?: Date, widgetPauseDurationMs?: number) => {
      if (!selectedBaby || !state.activeTimer || !state.activeTimer.isPaused)
        return;

      const now = requestedResumeTime ?? new Date();
      const pauseDuration =
        widgetPauseDurationMs ??
        (state.activeTimer.pausedAt
          ? now.getTime() - state.activeTimer.pausedAt.getTime()
          : 0);
      const newTotalPausedMs = state.activeTimer.totalPausedMs + pauseDuration;

      dispatch({ type: "RESUME_TIMER" });

      if (liveActivityIdRef.current) {
        const activeElapsedSeconds = Math.floor(
          (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
        );
        await resumeTimerLiveActivity(
          liveActivityIdRef.current,
          activeElapsedSeconds
        );
      }

      await PumpingStorageService.setActiveTimer(selectedBaby.id, {
        timerInstanceId: state.activeTimer.timerInstanceId,
        activityId: state.activeTimer.activityId,
        startedAt: state.activeTimer.startTime.toISOString(),
        side: state.activeTimer.side,
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
          await updateTimerData(selectedBaby.id, "pumping", user.id, {
            timerInstanceId: state.activeTimer.timerInstanceId,
            activityId: state.activeTimer.activityId,
            isPaused: false,
            totalPausedMs: newTotalPausedMs,
            side: state.activeTimer.side,
            effectiveStartTime: state.activeTimer.startTime.toISOString(),
            accumulatedSeconds: activeElapsedSeconds,
          });
        } catch (error) {
          console.error("[PumpingContext] Failed to update timer data:", error);
        }
      }
    },
    [selectedBaby, state.activeTimer, user?.id]
  );

  const addPumping = useCallback(
    async (input: CreatePumpingInput): Promise<StoredPumpingEntry> => {
      let pumping: StoredPumpingEntry;

      if (user?.householdId && user?.id) {
        pumping = await createPumpingInDatabase(input, user.id);
      } else {
        pumping = await PumpingStorageService.addPumping(input);
      }

      dispatch({ type: "ADD_PUMPING", payload: pumping });
      return pumping;
    },
    [user?.householdId, user?.id]
  );

  const updatePumping = useCallback(
    async (
      pumpingId: string,
      input: UpdatePumpingInput
    ): Promise<StoredPumpingEntry | null> => {
      if (!selectedBaby) return null;

      let updated: StoredPumpingEntry | null;

      if (user?.householdId) {
        updated = await updatePumpingInDatabase(
          selectedBaby.id,
          pumpingId,
          input
        );
      } else {
        updated = await PumpingStorageService.updatePumping(
          selectedBaby.id,
          pumpingId,
          input
        );
      }

      if (updated) {
        dispatch({ type: "UPDATE_PUMPING", payload: updated });
      }
      return updated;
    },
    [selectedBaby, user?.householdId]
  );

  const deletePumping = useCallback(
    async (pumpingId: string): Promise<boolean> => {
      if (!selectedBaby) return false;

      let result: boolean;

      if (user?.householdId) {
        result = await deletePumpingFromDatabase(selectedBaby.id, pumpingId);
      } else {
        result = await PumpingStorageService.deletePumping(
          selectedBaby.id,
          pumpingId
        );
      }

      if (result) {
        dispatch({ type: "DELETE_PUMPING", payload: pumpingId });
      }
      return result;
    },
    [selectedBaby, user?.householdId]
  );

  const getLastPumping = useCallback((): StoredPumpingEntry | null => {
    if (state.pumpings.length === 0) return null;

    const sorted = [...state.pumpings].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  }, [state.pumpings]);

  const getTodaysTotalVolume = useCallback((): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysPumpings = state.pumpings.filter((p) => {
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

  const value: PumpingContextValue = useMemo(
    () => ({
      ...state,
      babyBinding,
      isStopping,
      startPumping,
      stopPumping,
      stopRemotePumping,
      editPumpingStartTime,
      changePumpingSide,
      pausePumping,
      resumePumping,
      addPumping,
      updatePumping,
      deletePumping,
      refreshPumpings: loadPumpings,
      loadPumpingRange,
      getPumpingRangeStatus,
      getLastPumping,
      getTodaysTotalVolume,
      getLastSide,
    }),
    [
      state,
      babyBinding,
      isStopping,
      startPumping,
      stopPumping,
      stopRemotePumping,
      editPumpingStartTime,
      changePumpingSide,
      pausePumping,
      resumePumping,
      addPumping,
      updatePumping,
      deletePumping,
      loadPumpings,
      loadPumpingRange,
      getPumpingRangeStatus,
      getLastPumping,
      getTodaysTotalVolume,
      getLastSide,
    ]
  );

  return (
    <PumpingContext.Provider value={value}>{children}</PumpingContext.Provider>
  );
}

export function usePumping(): PumpingContextValue {
  const context = useContext(PumpingContext);
  if (!context) {
    throw new Error("usePumping must be used within a PumpingProvider");
  }
  return context;
}

function transformPumpingFromRemote(
  data: Record<string, unknown>
): StoredPumpingEntry {
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
