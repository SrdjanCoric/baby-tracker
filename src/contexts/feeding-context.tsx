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
import type {
  BreastSide,
  FeedingType,
  BottleContentType,
  SolidAmount,
  SolidReaction,
} from "@/constants/activities";
import { useBaby } from "./baby-context";
import { computeSuggestedSide } from "@/utils/feeding-sessions";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { useActiveTimers } from "./active-timers-context";
import { RemoteChange, tombstonedId, upsertById } from "@/services/sync";
import {
  acquireTimerLock,
  releaseTimerLock,
  updateTimerData,
  queuePendingLockRelease,
} from "@/services/active-timer-service";
import {
  startTimerLiveActivity,
  endTimerLiveActivity,
  endLiveActivityByType,
  updateTimerLiveActivity,
  pauseTimerLiveActivity,
  resumeTimerLiveActivity,
} from "@/services/live-activity-service";
import type { BreastSide as LiveActivityBreastSide } from "@/services/live-activity-service";
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
} from "@/services/timer-lifecycle";
import { createFeedingTimerAdapter } from "@/services/timer-adapters/feeding-timer-adapter";
import { useActivityRangeLoader } from "@/hooks/useActivityRangeLoader";
import type {
  ActivityRangeLoadOptions,
  ActivityRangeStatus,
  UtcActivityRange,
} from "@/services/activity-range-loader";

export interface ActiveTimer extends TimerIdentity {
  isRunning: boolean;
  lockState: TimerLockReconciliationState;
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
  | {
      type: "START_TIMER";
      payload: {
        startTime: Date;
        side?: BreastSide;
        lockState: TimerLockReconciliationState;
      } & TimerIdentity;
    }
  | { type: "RESTORE_TIMER"; payload: ActiveTimer }
  | {
      type: "EDIT_TIMER_START";
      payload: {
        startedAt: Date;
        currentSideStartedAt: Date;
        leftAccumulatedSeconds: number;
        rightAccumulatedSeconds: number;
      };
    }
  | { type: "STOP_TIMER" }
  | {
      type: "UPDATE_TIMER_SIDE";
      payload: { side: BreastSide; accumulatedSeconds: number };
    }
  | {
      type: "PAUSE_TIMER";
      payload: { accumulatedSeconds: number; pausedAt: Date };
    }
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

export function feedingReducer(
  state: FeedingState,
  action: FeedingAction
): FeedingState {
  switch (action.type) {
    case "SET_FEEDINGS":
      return { ...state, feedings: action.payload };

    case "ADD_FEEDING": {
      const newFeedings = upsertById(state.feedings, action.payload);
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
      const updatedFeedings = state.feedings.map((f) =>
        f.id === action.payload.id ? action.payload : f
      );
      return { ...state, feedings: updatedFeedings };
    }

    case "DELETE_FEEDING": {
      const filteredFeedings = state.feedings.filter(
        (f) => f.id !== action.payload
      );
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
          lockState: action.payload.lockState,
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

    case "EDIT_TIMER_START":
      if (!state.activeTimer) return state;
      return {
        ...state,
        activeTimer: {
          ...state.activeTimer,
          startTime: action.payload.startedAt,
          currentSideStartedAt: action.payload.currentSideStartedAt,
          leftAccumulatedSeconds: action.payload.leftAccumulatedSeconds,
          rightAccumulatedSeconds: action.payload.rightAccumulatedSeconds,
        },
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
      const { accumulatedSeconds, pausedAt } = action.payload;
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
          pausedAt,
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
      const newFeedings = upsertById(state.feedings, action.payload);
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
      const filteredFeedings = state.feedings.filter(
        (f) => f.id !== action.payload
      );
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
  isStopping: boolean;
  startBreastfeeding: (
    side: BreastSide,
    requestedStartTime?: Date,
    requestedIdentity?: TimerIdentity
  ) => Promise<TimerLockResult>;
  stopBreastfeeding: (
    requestedEndTime?: Date
  ) => Promise<StoredFeedingEntry | null>;
  editBreastfeedingStartTime: (startedAt: Date) => Promise<void>;
  changeSide: (side: BreastSide) => void;
  pauseBreastfeeding: (requestedPauseTime?: Date) => Promise<void>;
  resumeBreastfeeding: (
    requestedResumeTime?: Date,
    widgetPauseDurationMs?: number
  ) => Promise<void>;
  suggestedSide: BreastSide;
  addFeeding: (input: CreateFeedingInput) => Promise<StoredFeedingEntry>;
  updateFeeding: (
    feedingId: string,
    input: UpdateFeedingInput
  ) => Promise<StoredFeedingEntry | null>;
  deleteFeeding: (feedingId: string) => Promise<boolean>;
  refreshFeedings: () => Promise<void>;
  loadFeedingRange: (
    range: UtcActivityRange,
    options?: ActivityRangeLoadOptions
  ) => Promise<void>;
  getFeedingRangeStatus: (range: UtcActivityRange) => ActivityRangeStatus;
  getLastFeeding: () => StoredFeedingEntry | null;
}

const FeedingContext = createContext<FeedingContextValue | null>(null);

export function FeedingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(feedingReducer, initialFeedingState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();
  const { refreshLocks } = useActiveTimers();
  const liveActivityIdRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);
  const [isStopping, setIsStopping] = useState(false);
  const stopVersionRef = useRef(0);
  const {
    babyBinding,
    beginBabyBinding,
    finishBabyBinding,
    isCurrentBabyBinding,
  } = useBabyProviderBinding(selectedBaby?.id ?? null);
  const acceptFeedingRange = useCallback((entries: StoredFeedingEntry[]) => {
    dispatch({ type: "SET_FEEDINGS", payload: entries });
  }, []);
  const { loadRange: loadFeedingRange, getRangeStatus: getFeedingRangeStatus } =
    useActivityRangeLoader({
      table: "feedings",
      babyId: selectedBaby?.id ?? null,
      authenticated: Boolean(user?.householdId),
      storageScope: `${user?.id ?? "guest"}:${user?.householdId ?? "local"}:${selectedBaby?.id ?? "none"}`,
      acceptEntries: acceptFeedingRange,
    });

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges(
      "feedings",
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
            if (change.new) {
              dispatch({
                type: "REMOTE_INSERT",
                payload: transformFeedingFromRemote(change.new),
              });
            }
            break;
          case "UPDATE":
            if (change.new) {
              dispatch({
                type: "REMOTE_UPDATE",
                payload: transformFeedingFromRemote(change.new),
              });
            }
            break;
        }
      }
    );

    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const restoreFeedingTimer = useCallback(
    async (
      feedings: StoredFeedingEntry[],
      bindingToken: BabyProviderBindingToken,
      stopVersionAtStart: number
    ) => {
      if (!selectedBaby) return;

      const adapter = createFeedingTimerAdapter({
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
        completedRecords: feedings,
        stopVersionAtStart,
        currentStopVersion: () => stopVersionRef.current,
        isStopping: () => isStoppingRef.current,
        isCurrentBabyBinding: () => isCurrentBabyBinding(bindingToken),
        liveActivityIdRef,
        refreshLocks,
        persistRecord: (input) =>
          user?.householdId && user.id
            ? createFeedingInDatabase(input, user.id)
            : FeedingStorageService.addFeeding(input),
        dispatchStopTimer: () => dispatch({ type: "STOP_TIMER" }),
        dispatchAddRecord: (record) =>
          dispatch({ type: "ADD_FEEDING", payload: record }),
        errorLabel: "[FeedingContext]",
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

  const loadFeedings = useCallback(async () => {
    const bindingToken = beginBabyBinding(selectedBaby?.id ?? null);
    const isCurrentBinding = () => isCurrentBabyBinding(bindingToken);
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
          console.error(
            "[FeedingContext] Failed to fetch from database, using local:",
            error
          );
          feedings = await FeedingStorageService.getAllFeedings(
            selectedBaby.id
          );
        }
      } else {
        feedings = await FeedingStorageService.getAllFeedings(selectedBaby.id);
      }

      if (!isCurrentBinding()) return;
      dispatch({ type: "SET_FEEDINGS", payload: feedings });

      const suggestedSide = computeSuggestedSide(feedings);
      dispatch({ type: "SET_LAST_BREAST_SIDE", payload: suggestedSide });

      await restoreFeedingTimer(feedings, bindingToken, stopVersionAtStart);
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
  }, [
    beginBabyBinding,
    finishBabyBinding,
    isCurrentBabyBinding,
    restoreFeedingTimer,
    selectedBaby,
    user?.householdId,
  ]);

  useEffect(() => {
    loadFeedings();
  }, [loadFeedings, foregroundRefreshKey]);

  const startBreastfeeding = useCallback(
    async (
      side: BreastSide,
      requestedStartTime?: Date,
      requestedIdentity?: TimerIdentity
    ): Promise<{ success: boolean; lockedByName?: string }> => {
      if (!selectedBaby) return { success: false };

      const startTime = requestedStartTime ?? new Date();
      const identity = requestedIdentity ?? createTimerIdentity();
      let lockState: TimerLockReconciliationState = user?.id
        ? "offline"
        : "accountless";
      if (user?.id) {
        try {
          const lockResult = await acquireTimerLock(
            selectedBaby.id,
            "feeding",
            user.id,
            {
              ...identity,
              side,
              type: "breast",
              leftAccumulatedSeconds: 0,
              rightAccumulatedSeconds: 0,
            },
            requestedStartTime
          );
          if (!lockResult.success) {
            return { success: false, lockedByName: lockResult.lockHolderName };
          }
          lockState = "owned";
        } catch (error) {
          console.error(
            "[FeedingContext] Failed to acquire timer lock (proceeding offline):",
            error
          );
        }
      }

      dispatch({
        type: "START_TIMER",
        payload: { startTime, side, lockState, ...identity },
      });

      const activityId = await startTimerLiveActivity(
        "feeding",
        selectedBaby.name,
        side as LiveActivityBreastSide,
        startTime
      );
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
        lockState,
      });

      return { success: true };
    },
    [selectedBaby, user?.id]
  );

  const stopBreastfeeding = useCallback(
    async (requestedEndTime?: Date): Promise<StoredFeedingEntry | null> => {
      if (!selectedBaby || !state.activeTimer) return null;
      if (isStoppingRef.current) return null;
      isStoppingRef.current = true;
      setIsStopping(true);
      stopVersionRef.current++;
      const activeTimer = state.activeTimer;

      const finishTimer = async () => {
        dispatch({ type: "STOP_TIMER" });
        try {
          await FeedingStorageService.clearActiveTimer(selectedBaby.id);
        } catch (error) {
          console.error(
            "[FeedingContext] Failed to clear completed timer snapshot:",
            error
          );
        }
        try {
          const endedById = liveActivityIdRef.current
            ? await endTimerLiveActivity(liveActivityIdRef.current)
            : false;
          if (!endedById) {
            await endLiveActivityByType("feeding");
          }
          liveActivityIdRef.current = null;
        } catch (error) {
          console.error(
            "[FeedingContext] Failed to end completed Live Activity:",
            error
          );
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
            console.error(
              "[FeedingContext] Failed to release timer lock, queuing retry:",
              error
            );
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
        const requestedStopTime =
          activeTimer.isPaused && activeTimer.pausedAt
            ? activeTimer.pausedAt
            : (requestedEndTime ?? new Date());
        const durationSeconds = Math.floor(
          (requestedStopTime.getTime() -
            activeTimer.startTime.getTime()) /
            1000
        );

        if (durationSeconds < 60) {
          await finishTimer();
          return null;
        }

        const completion = await acceptTimerCompletion(
          selectedBaby.id,
          "feeding",
          activeTimer.startTime.toISOString(),
          activeTimer,
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

        const adapter = createFeedingTimerAdapter({
          babyId: selectedBaby.id,
          dispatchRestoreTimer: (restoredTimer) => {
            dispatch({ type: "RESTORE_TIMER", payload: restoredTimer });
          },
        });
        const feedingInput = adapter.buildRecord(
          activeTimer.startTime,
          endTime,
          {
            timerInstanceId: activeTimer.timerInstanceId,
            activityId: completion.activityId,
            side: activeTimer.side,
            type: "breast",
            leftAccumulatedSeconds: activeTimer.leftAccumulatedSeconds,
            rightAccumulatedSeconds: activeTimer.rightAccumulatedSeconds,
            currentSideStartedAt:
              activeTimer.currentSideStartedAt.toISOString(),
            isPaused: activeTimer.isPaused,
            totalPausedMs: activeTimer.totalPausedMs,
            pausedAt: activeTimer.pausedAt?.toISOString(),
          }
        );

        let feeding: StoredFeedingEntry;
        try {
          if (user?.householdId && user?.id) {
            console.log(
              "[FeedingContext] stopBreastfeeding: saving to database"
            );
            feeding = await createFeedingInDatabase(feedingInput, user.id);
          } else {
            console.log(
              "[FeedingContext] stopBreastfeeding: saving to local storage"
            );
            feeding = await FeedingStorageService.addFeeding(feedingInput);
          }
        } catch (saveError) {
          console.error(
            "[FeedingContext] Failed to durably complete timer:",
            saveError
          );
          throw saveError;
        }

        await markTimerCompletionDurable(completion);
        dispatch({ type: "ADD_FEEDING", payload: feeding });
        await finishTimer();
        return feeding;
      } finally {
        isStoppingRef.current = false;
        setIsStopping(false);
      }
    },
    [selectedBaby, state.activeTimer, user?.householdId, user?.id]
  );

  const changeSide = useCallback(
    (side: BreastSide) => {
      if (!state.activeTimer) return;
      if (state.activeTimer.isPaused) return;

      const now = new Date();
      const accumulatedSeconds = Math.floor(
        (now.getTime() - state.activeTimer.currentSideStartedAt.getTime()) /
          1000
      );

      dispatch({
        type: "UPDATE_TIMER_SIDE",
        payload: { side, accumulatedSeconds },
      });

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
          lockState: state.activeTimer.lockState,
        });

        if (liveActivityIdRef.current) {
          updateTimerLiveActivity(
            liveActivityIdRef.current,
            side as LiveActivityBreastSide
          );
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
          }).catch((error) =>
            console.error(
              "[FeedingContext] Failed to update timer data:",
              error
            )
          );
        }
      }
    },
    [selectedBaby, state.activeTimer, user?.id]
  );

  const editBreastfeedingStartTime = useCallback(
    async (startedAt: Date) => {
      if (!selectedBaby || !state.activeTimer) return;
      const activeTimer = state.activeTimer;
      const adapter = createFeedingTimerAdapter({
        babyId: selectedBaby.id,
        dispatchRestoreTimer: (restoredTimer) => {
          dispatch({ type: "RESTORE_TIMER", payload: restoredTimer });
        },
      });
      const movedPastCurrentSide =
        startedAt.getTime() >= activeTimer.currentSideStartedAt.getTime();
      const currentSideStartedAt = movedPastCurrentSide
        ? startedAt
        : activeTimer.currentSideStartedAt.getTime() ===
            activeTimer.startTime.getTime()
          ? startedAt
          : activeTimer.currentSideStartedAt;
      let leftAccumulatedSeconds = movedPastCurrentSide
        ? 0
        : activeTimer.leftAccumulatedSeconds;
      let rightAccumulatedSeconds = movedPastCurrentSide
        ? 0
        : activeTimer.rightAccumulatedSeconds;
      if (
        !movedPastCurrentSide &&
        activeTimer.currentSideStartedAt.getTime() !==
          activeTimer.startTime.getTime()
      ) {
        const shiftedSeconds = Math.floor(
          (startedAt.getTime() - activeTimer.startTime.getTime()) / 1000
        );
        if (activeTimer.side === "right" || activeTimer.side === "both") {
          leftAccumulatedSeconds = Math.max(
            0,
            leftAccumulatedSeconds - shiftedSeconds
          );
        }
        if (activeTimer.side === "left" || activeTimer.side === "both") {
          rightAccumulatedSeconds = Math.max(
            0,
            rightAccumulatedSeconds - shiftedSeconds
          );
        }
      }

      await editRunningTimerStartTime({
        adapter,
        baby: selectedBaby,
        userId: user?.id,
        activeTimer: {
          timerInstanceId: activeTimer.timerInstanceId,
          activityId: activeTimer.activityId,
          startedAt: activeTimer.startTime.toISOString(),
          side: activeTimer.side,
          type: "breast",
          leftAccumulatedSeconds,
          rightAccumulatedSeconds,
          currentSideStartedAt: currentSideStartedAt.toISOString(),
          liveActivityId: liveActivityIdRef.current ?? undefined,
          isPaused: activeTimer.isPaused,
          pausedAt: activeTimer.pausedAt?.toISOString(),
          totalPausedMs: activeTimer.totalPausedMs,
          lockState: activeTimer.lockState,
        },
        payload: {
          timerInstanceId: activeTimer.timerInstanceId,
          activityId: activeTimer.activityId,
          side: activeTimer.side ?? "left",
          type: "breast",
          leftAccumulatedSeconds,
          rightAccumulatedSeconds,
          currentSideStartedAt: currentSideStartedAt.toISOString(),
          isPaused: activeTimer.isPaused,
          pausedAt: activeTimer.pausedAt?.toISOString(),
          totalPausedMs: activeTimer.totalPausedMs,
        },
        startedAt,
        liveActivityIdRef,
        dispatchEditedStart: (nextStart) => {
          dispatch({
            type: "EDIT_TIMER_START",
            payload: {
              startedAt: nextStart,
              currentSideStartedAt,
              leftAccumulatedSeconds,
              rightAccumulatedSeconds,
            },
          });
        },
      });
      await refreshLocks();
    },
    [refreshLocks, selectedBaby, state.activeTimer, user?.id]
  );

  const pauseBreastfeeding = useCallback(
    async (requestedPauseTime?: Date) => {
      if (!selectedBaby || !state.activeTimer || state.activeTimer.isPaused)
        return;

      const now = requestedPauseTime ?? new Date();
      const accumulatedSeconds = Math.floor(
        (now.getTime() - state.activeTimer.currentSideStartedAt.getTime()) /
          1000
      );

      dispatch({
        type: "PAUSE_TIMER",
        payload: { accumulatedSeconds, pausedAt: now },
      });

      if (liveActivityIdRef.current) {
        const activeElapsedSeconds = Math.floor(
          (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
        );
        await pauseTimerLiveActivity(
          liveActivityIdRef.current,
          activeElapsedSeconds
        );
      }

      const prevSide = state.activeTimer.side;
      let leftAccumulated = state.activeTimer.leftAccumulatedSeconds;
      let rightAccumulated = state.activeTimer.rightAccumulatedSeconds;
      if (prevSide === "left") leftAccumulated += accumulatedSeconds;
      else if (prevSide === "right") rightAccumulated += accumulatedSeconds;
      else if (prevSide === "both") {
        leftAccumulated += accumulatedSeconds;
        rightAccumulated += accumulatedSeconds;
      }

      await FeedingStorageService.setActiveTimer(selectedBaby.id, {
        timerInstanceId: state.activeTimer.timerInstanceId,
        activityId: state.activeTimer.activityId,
        startedAt: state.activeTimer.startTime.toISOString(),
        side: state.activeTimer.side,
        type: "breast",
        leftAccumulatedSeconds: leftAccumulated,
        rightAccumulatedSeconds: rightAccumulated,
        currentSideStartedAt:
          state.activeTimer.currentSideStartedAt.toISOString(),
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
            currentSideStartedAt:
              state.activeTimer.currentSideStartedAt.toISOString(),
          });
        } catch (error) {
          console.error("[FeedingContext] Failed to update timer data:", error);
        }
      }
    },
    [selectedBaby, state.activeTimer, user?.id]
  );

  const resumeBreastfeeding = useCallback(
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
        lockState: state.activeTimer.lockState,
      });

      if (user?.id) {
        try {
          const activeElapsedSeconds = Math.floor(
            (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
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
            effectiveStartTime: state.activeTimer.startTime.toISOString(),
            accumulatedSeconds: activeElapsedSeconds,
          });
        } catch (error) {
          console.error("[FeedingContext] Failed to update timer data:", error);
        }
      }
    },
    [selectedBaby, state.activeTimer, user?.id]
  );

  const addFeeding = useCallback(
    async (input: CreateFeedingInput): Promise<StoredFeedingEntry> => {
      let feeding: StoredFeedingEntry;

      if (user?.householdId && user?.id) {
        feeding = await createFeedingInDatabase(input, user.id);
      } else {
        feeding = await FeedingStorageService.addFeeding(input);
      }

      dispatch({ type: "ADD_FEEDING", payload: feeding });
      return feeding;
    },
    [user?.householdId, user?.id]
  );

  const updateFeeding = useCallback(
    async (
      feedingId: string,
      input: UpdateFeedingInput
    ): Promise<StoredFeedingEntry | null> => {
      if (!selectedBaby) return null;

      let updated: StoredFeedingEntry | null;

      if (user?.householdId) {
        updated = await updateFeedingInDatabase(
          selectedBaby.id,
          feedingId,
          input
        );
      } else {
        updated = await FeedingStorageService.updateFeeding(
          selectedBaby.id,
          feedingId,
          input
        );
      }

      if (updated) {
        dispatch({ type: "UPDATE_FEEDING", payload: updated });
      }
      return updated;
    },
    [selectedBaby, user?.householdId]
  );

  const deleteFeeding = useCallback(
    async (feedingId: string): Promise<boolean> => {
      if (!selectedBaby) return false;

      let result: boolean;

      if (user?.householdId) {
        result = await deleteFeedingFromDatabase(selectedBaby.id, feedingId);
      } else {
        result = await FeedingStorageService.deleteFeeding(
          selectedBaby.id,
          feedingId
        );
      }

      if (result) {
        dispatch({ type: "DELETE_FEEDING", payload: feedingId });
      }
      return result;
    },
    [selectedBaby, user?.householdId]
  );

  const getLastFeeding = useCallback((): StoredFeedingEntry | null => {
    if (state.feedings.length === 0) return null;

    const sorted = [...state.feedings].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  }, [state.feedings]);

  const suggestedSide: BreastSide = state.lastBreastSide ?? "left";

  const value: FeedingContextValue = useMemo(
    () => ({
      ...state,
      babyBinding,
      isStopping,
      startBreastfeeding,
      stopBreastfeeding,
      editBreastfeedingStartTime,
      changeSide,
      pauseBreastfeeding,
      resumeBreastfeeding,
      suggestedSide,
      addFeeding,
      updateFeeding,
      deleteFeeding,
      refreshFeedings: loadFeedings,
      loadFeedingRange,
      getFeedingRangeStatus,
      getLastFeeding,
    }),
    [
      state,
      babyBinding,
      isStopping,
      startBreastfeeding,
      stopBreastfeeding,
      editBreastfeedingStartTime,
      changeSide,
      pauseBreastfeeding,
      resumeBreastfeeding,
      suggestedSide,
      addFeeding,
      updateFeeding,
      deleteFeeding,
      loadFeedings,
      loadFeedingRange,
      getFeedingRangeStatus,
      getLastFeeding,
    ]
  );

  return (
    <FeedingContext.Provider value={value}>{children}</FeedingContext.Provider>
  );
}

export function useFeeding(): FeedingContextValue {
  const context = useContext(FeedingContext);
  if (!context) {
    throw new Error("useFeeding must be used within a FeedingProvider");
  }
  return context;
}

function transformFeedingFromRemote(
  data: Record<string, unknown>
): StoredFeedingEntry {
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
