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
import { useActiveTimers } from "./active-timers-context";
import { RemoteChange, tombstonedId, upsertById } from "@/services/sync";
import { classifySleepByTimeRange } from "@/utils/sleep-patterns";
import {
  acquireTimerLock,
  releaseTimerLock,
  updateTimerData,
  queuePendingLockRelease,
} from "@/services/active-timer-service";
import {
  fetchWakeWindowPreference,
  upsertWakeWindowPreference,
} from "@/services/push-token-service";
import {
  fetchActivityGoal,
  upsertActivityGoal,
} from "@/services/activity-goal-service";
import {
  SleepAgeGroup,
  GoalSource,
  getSleepGoalInfo,
  getWakeWindowForAge,
  checkSleepMilestoneCrossing,
  getDefaultWakeWindowConfig,
  generateSlotsForNapCount,
  isUnderTwoMonths,
} from "@/utils/sleepGoals";
import type { WakeWindowConfig, NapSlotWindow } from "@/types/wake-windows";
import { isNightTime } from "@/utils/day-night-boundary";
import {
  startTimerLiveActivity,
  endTimerLiveActivity,
  endLiveActivityByType,
  updateTimerLiveActivity,
  pauseTimerLiveActivity,
  resumeTimerLiveActivity,
} from "@/services/live-activity-service";
import {
  processSleepData,
  computeSleepModel,
  getAgeFallbackModel,
  getQualifyingDayCount,
  detectBedtimeDrift,
  detectMorningDrift,
  resolveMorningSleep,
  classifyNewMorningSleep,
  findPendingMorningConfirmations,
  getMorningThreshold,
} from "@/utils/sleepPredictions";
import type {
  SleepPredictionModel,
  DriftDetectionResult,
} from "@/utils/sleepPredictions";
import {
  BabyProviderBinding,
  type BabyProviderBindingToken,
  useBabyProviderBinding,
} from "@/hooks/useBabyProviderBinding";
import { useActivityRangeLoader } from "@/hooks/useActivityRangeLoader";
import type {
  ActivityRangeLoadOptions,
  ActivityRangeStatus,
  UtcActivityRange,
} from "@/services/activity-range-loader";
import { shouldDiscardTimerDuration } from "@/utils/timer-duration";
import {
  acceptTimerCompletion,
  createTimerIdentity,
  markTimerCompletionDurable,
  type TimerIdentity,
} from "@/services/timer-completion-service";
import { type TimerLockReconciliationState } from "@/services/timer-lock-reconciliation";
import { restoreTimerLifecycle } from "@/services/timer-lifecycle";
import { createSleepTimerAdapter } from "@/services/timer-adapters/sleep-timer-adapter";
import {
  MORNING_CLASSIFICATION_VERSION,
  type MorningClassificationState,
} from "@/types/sleep";

export interface ActiveSleepTimer extends TimerIdentity {
  isRunning: boolean;
  lockState: TimerLockReconciliationState;
  isPaused: boolean;
  startTime: Date;
  sleepType: SleepType;
  totalPausedMs: number;
  pausedAt?: Date;
  morningClassification: MorningClassificationState;
  morningClassificationVersion: number;
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
  newbornNapOptIn: boolean;
  sleepPredictionModel: SleepPredictionModel | null;
  isComputingModel: boolean;
  qualifyingDayCount: number;
  predictionBannerDismissed: boolean;
  driftDetection: DriftDetectionResult | null;
  modelRecomputeVersion: number;
  sleepsLoadVersion: number;
}

export type SleepAction =
  | { type: "SET_SLEEPS"; payload: StoredSleepEntry[] }
  | { type: "ADD_SLEEP"; payload: StoredSleepEntry }
  | { type: "UPDATE_SLEEP"; payload: StoredSleepEntry }
  | { type: "DELETE_SLEEP"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | {
      type: "START_TIMER";
      payload: {
        startTime: Date;
        sleepType: SleepType;
        lockState: TimerLockReconciliationState;
        morningClassification: MorningClassificationState;
        morningClassificationVersion: number;
      } & TimerIdentity;
    }
  | { type: "STOP_TIMER" }
  | {
      type: "UPDATE_TIMER_TYPE";
      payload: {
        sleepType: SleepType;
        morningClassification?: MorningClassificationState;
      };
    }
  | { type: "SET_DAILY_GOAL"; payload: number }
  | { type: "SET_GOAL_SOURCE"; payload: GoalSource }
  | { type: "SET_AGE_GROUP"; payload: SleepAgeGroup | null }
  | { type: "SET_WAKE_WINDOW"; payload: number }
  | { type: "SET_SHOW_MILESTONE_SUGGESTION"; payload: boolean }
  | { type: "SET_SUGGESTED_GOAL"; payload: number | null }
  | { type: "SET_WAKE_WINDOW_CONFIG"; payload: WakeWindowConfig | null }
  | { type: "PAUSE_TIMER"; payload: { pausedAt: Date } }
  | { type: "RESUME_TIMER" }
  | { type: "RESTORE_TIMER"; payload: ActiveSleepTimer }
  | { type: "SET_NEWBORN_NAP_OPT_IN"; payload: boolean }
  | { type: "REMOTE_INSERT"; payload: StoredSleepEntry }
  | { type: "REMOTE_UPDATE"; payload: StoredSleepEntry }
  | { type: "REMOTE_DELETE"; payload: string }
  | { type: "SET_PREDICTION_MODEL"; payload: SleepPredictionModel | null }
  | { type: "SET_COMPUTING_MODEL"; payload: boolean }
  | { type: "SET_QUALIFYING_DAY_COUNT"; payload: number }
  | { type: "SET_PREDICTION_BANNER_DISMISSED"; payload: boolean }
  | { type: "SET_DRIFT_DETECTION"; payload: DriftDetectionResult | null };

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
  newbornNapOptIn: false,
  sleepPredictionModel: null,
  isComputingModel: false,
  qualifyingDayCount: 0,
  predictionBannerDismissed: false,
  driftDetection: null,
  modelRecomputeVersion: 0,
  sleepsLoadVersion: 0,
};

export function sleepReducer(
  state: SleepState,
  action: SleepAction
): SleepState {
  switch (action.type) {
    case "SET_SLEEPS":
      return {
        ...state,
        sleeps: action.payload,
        sleepsLoadVersion: state.sleepsLoadVersion + 1,
      };

    case "ADD_SLEEP":
      return {
        ...state,
        sleeps: upsertById(state.sleeps, action.payload),
        modelRecomputeVersion: state.modelRecomputeVersion + 1,
        isComputingModel: true,
      };

    case "UPDATE_SLEEP": {
      const updatedSleeps = state.sleeps.map((s) =>
        s.id === action.payload.id ? action.payload : s
      );
      return {
        ...state,
        sleeps: updatedSleeps,
        modelRecomputeVersion: state.modelRecomputeVersion + 1,
        isComputingModel: true,
      };
    }

    case "DELETE_SLEEP": {
      const filteredSleeps = state.sleeps.filter(
        (s) => s.id !== action.payload
      );
      return {
        ...state,
        sleeps: filteredSleeps,
        modelRecomputeVersion: state.modelRecomputeVersion + 1,
        isComputingModel: true,
      };
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
          sleepType: action.payload.sleepType,
          totalPausedMs: 0,
          morningClassification: action.payload.morningClassification,
          morningClassificationVersion:
            action.payload.morningClassificationVersion,
        },
      };

    case "STOP_TIMER":
      return { ...state, activeTimer: null };

    case "UPDATE_TIMER_TYPE":
      if (!state.activeTimer) return state;
      return {
        ...state,
        activeTimer: {
          ...state.activeTimer,
          sleepType: action.payload.sleepType,
          ...(action.payload.morningClassification && {
            morningClassification: action.payload.morningClassification,
          }),
        },
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

    case "SET_WAKE_WINDOW_CONFIG": {
      const prevStart = state.wakeWindowConfig?.dayStartHour;
      const prevEnd = state.wakeWindowConfig?.dayEndHour;
      const newStart = action.payload?.dayStartHour;
      const newEnd = action.payload?.dayEndHour;
      const boundariesChanged = prevStart !== newStart || prevEnd !== newEnd;
      return {
        ...state,
        wakeWindowConfig: action.payload,
        ...(boundariesChanged
          ? { modelRecomputeVersion: state.modelRecomputeVersion + 1 }
          : {}),
      };
    }

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

    case "SET_NEWBORN_NAP_OPT_IN":
      return { ...state, newbornNapOptIn: action.payload };

    case "REMOTE_INSERT":
      return {
        ...state,
        sleeps: upsertById(state.sleeps, action.payload),
        modelRecomputeVersion: state.modelRecomputeVersion + 1,
        isComputingModel: true,
      };

    case "REMOTE_UPDATE": {
      return {
        ...state,
        sleeps: upsertById(state.sleeps, action.payload),
        modelRecomputeVersion: state.modelRecomputeVersion + 1,
        isComputingModel: true,
      };
    }

    case "REMOTE_DELETE": {
      const filteredSleeps = state.sleeps.filter(
        (s) => s.id !== action.payload
      );
      return {
        ...state,
        sleeps: filteredSleeps,
        modelRecomputeVersion: state.modelRecomputeVersion + 1,
        isComputingModel: true,
      };
    }

    case "SET_PREDICTION_MODEL":
      return { ...state, sleepPredictionModel: action.payload };

    case "SET_COMPUTING_MODEL":
      return { ...state, isComputingModel: action.payload };

    case "SET_QUALIFYING_DAY_COUNT":
      return { ...state, qualifyingDayCount: action.payload };

    case "SET_PREDICTION_BANNER_DISMISSED":
      return { ...state, predictionBannerDismissed: action.payload };

    case "SET_DRIFT_DETECTION":
      return { ...state, driftDetection: action.payload };

    default:
      return state;
  }
}

export interface TimerLockResult {
  success: boolean;
  lockedByName?: string;
}

interface SleepContextValue extends SleepState {
  babyBinding: BabyProviderBinding;
  isStopping: boolean;
  startSleep: (
    sleepType: SleepType,
    customStartTime?: Date,
    requestedIdentity?: TimerIdentity
  ) => Promise<TimerLockResult>;
  stopSleep: (requestedEndTime?: Date) => Promise<StoredSleepEntry | null>;
  changeSleepType: (sleepType: SleepType) => void;
  pauseSleep: (requestedPauseTime?: Date) => Promise<void>;
  resumeSleep: (
    requestedResumeTime?: Date,
    widgetPauseDurationMs?: number
  ) => Promise<void>;
  addSleep: (input: CreateSleepInput) => Promise<StoredSleepEntry>;
  updateSleep: (
    sleepId: string,
    input: UpdateSleepInput
  ) => Promise<StoredSleepEntry | null>;
  deleteSleep: (sleepId: string) => Promise<boolean>;
  refreshSleeps: () => Promise<void>;
  loadSleepRange: (
    range: UtcActivityRange,
    options?: ActivityRangeLoadOptions
  ) => Promise<void>;
  getSleepRangeStatus: (range: UtcActivityRange) => ActivityRangeStatus;
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
  setDayNightBoundary: (
    dayStartHour: number,
    dayEndHour: number
  ) => Promise<void>;
  setNapContinuationMinutes: (minutes: number) => Promise<void>;
  setWakeWindowsEnabled: (enabled: boolean) => Promise<void>;
  setNewbornNapOptIn: (optIn: boolean) => Promise<void>;
  dismissPredictionBanner: () => Promise<void>;
  dismissDrift: () => Promise<void>;
  acceptDrift: () => Promise<void>;
  pendingMorningConfirmations: StoredSleepEntry[];
  confirmMorningSleep: (
    sleepId: string,
    answer: "first_nap" | "night_continuation"
  ) => Promise<void>;
}

const SleepContext = createContext<SleepContextValue | null>(null);

export function SleepProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sleepReducer, initialSleepState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();
  const { removeLock, refreshLocks } = useActiveTimers();
  const liveActivityIdRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);
  const [isStopping, setIsStopping] = useState(false);
  const stopVersionRef = useRef(0);
  const activeMorningConfirmationRef = useRef<{
    activityId: string;
    sleepType: SleepType;
    morningClassification: MorningClassificationState;
  } | null>(null);
  const {
    babyBinding,
    beginBabyBinding,
    finishBabyBinding,
    isCurrentBabyBinding,
  } = useBabyProviderBinding(selectedBaby?.id ?? null);
  const acceptSleepRange = useCallback((entries: StoredSleepEntry[]) => {
    dispatch({ type: "SET_SLEEPS", payload: entries });
  }, []);
  const { loadRange: loadSleepRange, getRangeStatus: getSleepRangeStatus } =
    useActivityRangeLoader({
      table: "sleep_sessions",
      babyId: selectedBaby?.id ?? null,
      authenticated: Boolean(user?.householdId),
      storageScope: `${user?.id ?? "guest"}:${user?.householdId ?? "local"}:${selectedBaby?.id ?? "none"}`,
      acceptEntries: acceptSleepRange,
    });

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges(
      "sleep_sessions",
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
                payload: transformSleepFromRemote(change.new),
              });
            break;
          case "UPDATE":
            if (change.new)
              dispatch({
                type: "REMOTE_UPDATE",
                payload: transformSleepFromRemote(change.new),
              });
            break;
        }
      }
    );
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges(
      "wake_window_preferences",
      (change: RemoteChange) => {
        if (!selectedBaby) return;
        const data = change.new;
        if (!data || data.baby_id !== selectedBaby.id) return;

        if (change.eventType === "INSERT" || change.eventType === "UPDATE") {
          const source = data.source as "age_based" | "custom";
          const config: WakeWindowConfig = {
            enabled:
              (data.enabled as boolean | undefined) ?? source === "custom",
            napCount: data.nap_count as number,
            slots: data.wake_window_slots as NapSlotWindow[],
            source,
            dayStartHour: (data.day_start_hour as number | undefined) ?? 6,
            dayEndHour: (data.day_end_hour as number | undefined) ?? 19,
            dayBoundariesConfigured:
              data.day_start_hour != null && data.day_end_hour != null,
            napContinuationMinutes:
              (data.nap_continuation_minutes as number | undefined) ?? 25,
            driftDismissed:
              (data.drift_dismissed as {
                type: string;
                suggestedHour: number;
              } | null) ?? null,
          };
          dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
          SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
          if (config.driftDismissed) {
            driftDismissedRef.current = config.driftDismissed;
            dispatch({ type: "SET_DRIFT_DETECTION", payload: null });
          } else {
            driftDismissedRef.current = null;
          }
        }
      }
    );
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges(
      "activity_goals",
      (change: RemoteChange) => {
        if (!selectedBaby) return;
        const data = change.new;
        if (
          !data ||
          data.baby_id !== selectedBaby.id ||
          data.goal_type !== "sleep"
        )
          return;

        if (change.eventType === "INSERT" || change.eventType === "UPDATE") {
          const targetMinutes = data.target_value as number;
          const source = data.source as GoalSource;
          dispatch({ type: "SET_DAILY_GOAL", payload: targetMinutes });
          dispatch({ type: "SET_GOAL_SOURCE", payload: source });
          SleepStorageService.setDailyGoal(selectedBaby.id, targetMinutes);
          if (source === "custom") {
            SleepStorageService.setCustomGoal(selectedBaby.id, targetMinutes);
          } else {
            SleepStorageService.clearCustomGoal(selectedBaby.id);
          }
        }
      }
    );
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const restoreSleepTimer = useCallback(
    async (
      sleeps: StoredSleepEntry[],
      bindingToken: BabyProviderBindingToken,
      stopVersionAtStart: number,
      wakeConfig: WakeWindowConfig | null
    ) => {
      if (!selectedBaby) return;

      const adapter = createSleepTimerAdapter({
        babyId: selectedBaby.id,
        resolveMorningClassification: (startedAt, stored) =>
          stored ??
          classifyNewMorningSleep(
            sleeps,
            { startedAt },
            wakeConfig?.dayStartHour ?? 6,
            wakeConfig?.napContinuationMinutes ?? 25,
            new Date(Math.max(Date.now(), new Date(startedAt).getTime()))
          ),
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
        completedRecords: sleeps,
        stopVersionAtStart,
        currentStopVersion: () => stopVersionRef.current,
        isStopping: () => isStoppingRef.current,
        isCurrentBabyBinding: () => isCurrentBabyBinding(bindingToken),
        liveActivityIdRef,
        refreshLocks,
        persistRecord: (input) =>
          user?.householdId && user.id
            ? createSleepInDatabase(input, user.id)
            : SleepStorageService.addSleep(input),
        dispatchStopTimer: () => dispatch({ type: "STOP_TIMER" }),
        dispatchAddRecord: (record) =>
          dispatch({ type: "ADD_SLEEP", payload: record }),
        onCompletionSecured: () => removeLock(selectedBaby.id, "sleep"),
        errorLabel: "[SleepContext]",
      });
    },
    [
      isCurrentBabyBinding,
      refreshLocks,
      removeLock,
      selectedBaby,
      user?.householdId,
      user?.id,
    ]
  );

  const loadSleeps = useCallback(async () => {
    const bindingToken = beginBabyBinding(selectedBaby?.id ?? null);
    const isCurrentBinding = () => isCurrentBabyBinding(bindingToken);
    if (!selectedBaby) {
      dispatch({ type: "SET_SLEEPS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      finishBabyBinding(bindingToken, "ready");
      return;
    }

    const stopVersionAtStart = stopVersionRef.current;
    let bindingStatus: "ready" | "error" = "ready";

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      let sleeps: StoredSleepEntry[];

      if (user?.householdId) {
        try {
          sleeps = await fetchSleepFromDatabase(selectedBaby.id);
        } catch (error) {
          if (!isCurrentBinding()) return;
          console.error(
            "[SleepContext] Failed to fetch from database, using local:",
            error
          );
          sleeps = await SleepStorageService.getAllSleeps(selectedBaby.id);
        }
      } else {
        sleeps = await SleepStorageService.getAllSleeps(selectedBaby.id);
      }

      if (!isCurrentBinding()) return;
      dispatch({ type: "SET_SLEEPS", payload: sleeps });

      const hasCustomGoal = await SleepStorageService.hasCustomGoal(
        selectedBaby.id
      );
      const storedGoal = await SleepStorageService.getDailyGoal(
        selectedBaby.id
      );
      if (!isCurrentBinding()) return;

      const birthDate = selectedBaby.birthDate
        ? new Date(selectedBaby.birthDate)
        : undefined;
      const goalInfo = getSleepGoalInfo(
        birthDate,
        hasCustomGoal ? storedGoal : null
      );

      dispatch({ type: "SET_DAILY_GOAL", payload: goalInfo.targetMinutes });
      dispatch({ type: "SET_GOAL_SOURCE", payload: goalInfo.source });
      dispatch({ type: "SET_AGE_GROUP", payload: goalInfo.ageGroup });

      if (user?.householdId) {
        try {
          const { data: dbGoal } = await fetchActivityGoal(
            selectedBaby.id,
            "sleep"
          );
          if (!isCurrentBinding()) return;
          if (dbGoal) {
            dispatch({ type: "SET_DAILY_GOAL", payload: dbGoal.target_value });
            dispatch({
              type: "SET_GOAL_SOURCE",
              payload: dbGoal.source as GoalSource,
            });
            await SleepStorageService.setDailyGoal(
              selectedBaby.id,
              dbGoal.target_value
            );
            if (!isCurrentBinding()) return;
            if (dbGoal.source === "custom") {
              await SleepStorageService.setCustomGoal(
                selectedBaby.id,
                dbGoal.target_value
              );
            } else {
              await SleepStorageService.clearCustomGoal(selectedBaby.id);
            }
            if (!isCurrentBinding()) return;
          }
        } catch (error) {
          if (!isCurrentBinding()) return;
          console.error(
            "[SleepContext] Failed to fetch activity goal from DB:",
            error
          );
        }
      }

      if (birthDate) {
        const wakeWindowInfo = getWakeWindowForAge(birthDate);
        dispatch({
          type: "SET_WAKE_WINDOW",
          payload: wakeWindowInfo.targetMinutes,
        });
      }

      let wakeConfig: WakeWindowConfig | null = null;

      if (user?.householdId) {
        try {
          const { data: dbPref } = await fetchWakeWindowPreference(
            selectedBaby.id
          );
          if (!isCurrentBinding()) return;
          if (dbPref) {
            const source = dbPref.source as "age_based" | "custom";
            wakeConfig = {
              enabled: dbPref.enabled ?? source === "custom",
              napCount: dbPref.nap_count,
              slots: dbPref.wake_window_slots,
              source,
              dayStartHour: dbPref.day_start_hour ?? 6,
              dayEndHour: dbPref.day_end_hour ?? 19,
              dayBoundariesConfigured:
                dbPref.day_start_hour != null && dbPref.day_end_hour != null,
              napContinuationMinutes: dbPref.nap_continuation_minutes ?? 25,
              driftDismissed: dbPref.drift_dismissed ?? null,
            };
            await SleepStorageService.setWakeWindowConfig(
              selectedBaby.id,
              wakeConfig
            );
            if (!isCurrentBinding()) return;
          }
        } catch (error) {
          if (!isCurrentBinding()) return;
          console.error(
            "[SleepContext] Failed to fetch wake window prefs from DB:",
            error
          );
        }
      }

      if (!wakeConfig) {
        wakeConfig = await SleepStorageService.getWakeWindowConfig(
          selectedBaby.id
        );
        if (!isCurrentBinding()) return;
        if (wakeConfig && wakeConfig.enabled === undefined) {
          wakeConfig = {
            ...wakeConfig,
            enabled: wakeConfig.source === "custom",
          };
        }
      }

      if (wakeConfig) {
        dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: wakeConfig });
      } else if (birthDate) {
        const defaultConfig = getDefaultWakeWindowConfig(birthDate);
        dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: defaultConfig });
        await SleepStorageService.setWakeWindowConfig(
          selectedBaby.id,
          defaultConfig
        );
        if (!isCurrentBinding()) return;
      }

      const newbornOptIn = await SleepStorageService.getNewbornNapOptIn(
        selectedBaby.id
      );
      if (!isCurrentBinding()) return;
      dispatch({ type: "SET_NEWBORN_NAP_OPT_IN", payload: newbornOptIn });

      const cachedModel = await SleepStorageService.getSleepPredictionModel(
        selectedBaby.id
      );
      if (!isCurrentBinding()) return;
      if (cachedModel) {
        dispatch({
          type: "SET_PREDICTION_MODEL",
          payload: cachedModel as unknown as SleepPredictionModel,
        });
      }

      const bannerDismissed =
        await SleepStorageService.getPredictionBannerDismissed(selectedBaby.id);
      if (!isCurrentBinding()) return;
      dispatch({
        type: "SET_PREDICTION_BANNER_DISMISSED",
        payload: bannerDismissed,
      });

      if (wakeConfig?.driftDismissed) {
        driftDismissedRef.current = wakeConfig.driftDismissed;
      } else {
        const driftDismissed = await SleepStorageService.getDriftDismissed(
          selectedBaby.id
        );
        if (!isCurrentBinding()) return;
        driftDismissedRef.current = driftDismissed;
      }

      if (birthDate && !hasCustomGoal) {
        const lastCheckDate =
          await SleepStorageService.getLastMilestoneCheckDate(selectedBaby.id);
        const dismissedMilestones =
          await SleepStorageService.getDismissedMilestones(selectedBaby.id);
        if (!isCurrentBinding()) return;

        if (lastCheckDate) {
          const milestoneCrossing = checkSleepMilestoneCrossing(
            birthDate,
            lastCheckDate
          );
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

        await SleepStorageService.setLastMilestoneCheckDate(
          selectedBaby.id,
          new Date()
        );
        if (!isCurrentBinding()) return;
      }

      await restoreSleepTimer(
        sleeps,
        bindingToken,
        stopVersionAtStart,
        wakeConfig
      );
    } catch (error) {
      if (!isCurrentBinding()) return;
      bindingStatus = "error";
      console.error("[SleepContext] Failed to load sleeps:", error);
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
    restoreSleepTimer,
    selectedBaby,
    user?.householdId,
  ]);

  useEffect(() => {
    loadSleeps();
  }, [loadSleeps, foregroundRefreshKey]);

  const computingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driftDismissedRef = useRef<{
    suggestedHour: number;
    type: string;
  } | null>(null);
  const lastRecomputeVersionRef = useRef(0);

  useEffect(
    () => () => {
      if (computingTimerRef.current) {
        clearTimeout(computingTimerRef.current);
      }
    },
    []
  );

  const runModelComputation = useCallback(
    (showComputing: boolean) => {
      if (!selectedBaby || state.sleeps.length === 0) return;

      if (showComputing) {
        dispatch({ type: "SET_COMPUTING_MODEL", payload: true });
      }

      const computeStart = Date.now();

      const dayStartHour = state.wakeWindowConfig?.dayStartHour ?? 6;
      const dayEndHour = state.wakeWindowConfig?.dayEndHour ?? 19;
      const birthDate = selectedBaby.birthDate
        ? new Date(selectedBaby.birthDate)
        : undefined;
      const continuationAllowance =
        state.wakeWindowConfig?.napContinuationMinutes ?? 25;
      const hasUnresolvedMorning =
        findPendingMorningConfirmations(
          state.sleeps,
          dayStartHour,
          continuationAllowance
        ).length > 0;
      const babyAgeMonths = birthDate
        ? Math.floor(
            (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
          )
        : 0;

      const processed = processSleepData(state.sleeps, continuationAllowance);
      const qualifyingCount = hasUnresolvedMorning
        ? 0
        : getQualifyingDayCount(
            processed,
            dayStartHour,
            dayEndHour,
            babyAgeMonths,
            continuationAllowance
          );

      let model: SleepPredictionModel | null = null;

      if (hasUnresolvedMorning) {
        model = null;
      } else if (qualifyingCount >= 5) {
        model = computeSleepModel(
          processed,
          dayStartHour,
          dayEndHour,
          babyAgeMonths,
          continuationAllowance
        );
      } else if (birthDate) {
        model = getAgeFallbackModel(birthDate);
      }

      let drift: DriftDetectionResult | null = null;
      const isCustomWakeWindows = state.wakeWindowConfig?.source === "custom";
      if (!hasUnresolvedMorning && !isCustomWakeWindows) {
        const bedtimeDrift =
          qualifyingCount >= 5
            ? detectBedtimeDrift(
                processed,
                dayStartHour,
                dayEndHour,
                continuationAllowance
              )
            : null;
        drift =
          bedtimeDrift ??
          (birthDate
            ? detectMorningDrift(
                processed,
                dayStartHour,
                dayEndHour,
                birthDate,
                new Date(),
                continuationAllowance
              )
            : null);

        if (drift && driftDismissedRef.current) {
          const dismissed = driftDismissedRef.current;
          if (
            dismissed.type === drift.type &&
            Math.abs(dismissed.suggestedHour - drift.suggestedHour) < 0.5
          ) {
            drift = null;
          }
        }
      }

      const applyModel = () => {
        dispatch({ type: "SET_PREDICTION_MODEL", payload: model });
        dispatch({
          type: "SET_QUALIFYING_DAY_COUNT",
          payload: qualifyingCount,
        });
        dispatch({ type: "SET_DRIFT_DETECTION", payload: drift });
        if (showComputing) {
          dispatch({ type: "SET_COMPUTING_MODEL", payload: false });
        }
      };

      if (showComputing) {
        const elapsed = Date.now() - computeStart;
        const minDisplayMs = 2000;
        const remaining = Math.max(0, minDisplayMs - elapsed);
        if (computingTimerRef.current) clearTimeout(computingTimerRef.current);
        computingTimerRef.current = setTimeout(applyModel, remaining);
      } else {
        applyModel();
      }

      if (model && selectedBaby) {
        SleepStorageService.setSleepPredictionModel(
          selectedBaby.id,
          model as unknown as Record<string, unknown>
        ).catch(() => {});
      }
    },
    [
      state.sleeps,
      selectedBaby,
      state.wakeWindowConfig?.dayStartHour,
      state.wakeWindowConfig?.dayEndHour,
      state.wakeWindowConfig?.napContinuationMinutes,
      state.wakeWindowConfig?.source,
    ]
  );

  // Silent recompute on bulk load (SET_SLEEPS) — skip until wake window config is loaded
  const lastSleepsLoadVersionRef = useRef(0);
  useEffect(() => {
    if (!selectedBaby || state.sleeps.length === 0) return;
    if (!state.wakeWindowConfig) return;
    if (state.sleepsLoadVersion === lastSleepsLoadVersionRef.current) return;
    lastSleepsLoadVersionRef.current = state.sleepsLoadVersion;
    runModelComputation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.sleepsLoadVersion,
    selectedBaby,
    state.wakeWindowConfig,
    runModelComputation,
  ]);

  // Animated recompute on mutations (ADD_SLEEP, UPDATE_SLEEP, DELETE_SLEEP, REMOTE_*)
  useEffect(() => {
    if (state.modelRecomputeVersion === 0) return;
    if (state.modelRecomputeVersion === lastRecomputeVersionRef.current) return;
    lastRecomputeVersionRef.current = state.modelRecomputeVersion;
    runModelComputation(true);
  }, [state.modelRecomputeVersion, runModelComputation]);

  // Silent recompute at day boundary transitions (dayStartHour / dayEndHour)
  useEffect(() => {
    const dayStartHour = state.wakeWindowConfig?.dayStartHour ?? 6;
    const dayEndHour = state.wakeWindowConfig?.dayEndHour ?? 19;

    const getNextBoundaryMs = (): number | null => {
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;

      let nextBoundaryHour: number;
      if (currentHour < dayStartHour) {
        nextBoundaryHour = dayStartHour;
      } else if (currentHour < dayEndHour) {
        nextBoundaryHour = dayEndHour;
      } else {
        nextBoundaryHour = dayStartHour + 24;
      }

      const target = new Date(now);
      const h = Math.floor(nextBoundaryHour % 24);
      const m = Math.round((nextBoundaryHour % 1) * 60);
      target.setHours(h, m, 0, 0);
      if (nextBoundaryHour >= 24) {
        target.setDate(target.getDate() + 1);
      }

      return target.getTime() - now.getTime();
    };

    const scheduleNext = () => {
      const ms = getNextBoundaryMs();
      if (ms === null) return;
      return setTimeout(() => {
        if (!state.activeTimer) {
          runModelComputation(false);
        }
        boundaryTimerRef.current = scheduleNext() ?? null;
      }, ms);
    };

    const boundaryTimerRef = { current: scheduleNext() ?? null };

    return () => {
      if (boundaryTimerRef.current) clearTimeout(boundaryTimerRef.current);
    };
  }, [
    state.wakeWindowConfig?.dayStartHour,
    state.wakeWindowConfig?.dayEndHour,
    state.activeTimer,
    runModelComputation,
  ]);

  const startSleep = useCallback(
    async (
      sleepType: SleepType,
      customStartTime?: Date,
      requestedIdentity?: TimerIdentity
    ): Promise<{ success: boolean; lockedByName?: string }> => {
      if (!selectedBaby) return { success: false };

      const startTime = customStartTime ?? new Date();
      const identity = requestedIdentity ?? createTimerIdentity();
      activeMorningConfirmationRef.current = null;
      const morningClassification = classifyNewMorningSleep(
        state.sleeps,
        { startedAt: startTime },
        state.wakeWindowConfig?.dayStartHour ?? 6,
        state.wakeWindowConfig?.napContinuationMinutes ?? 25,
        new Date(Math.max(Date.now(), startTime.getTime()))
      );
      let lockState: TimerLockReconciliationState = "offline";
      if (user?.id) {
        try {
          const lockResult = await acquireTimerLock(
            selectedBaby.id,
            "sleep",
            user.id,
            {
              type: sleepType,
              ...identity,
              morningClassification,
              morningClassificationVersion: MORNING_CLASSIFICATION_VERSION,
            },
            startTime
          );
          if (!lockResult.success) {
            return { success: false, lockedByName: lockResult.lockHolderName };
          }
          lockState = "owned";
        } catch (error) {
          console.error(
            "[SleepContext] Failed to acquire timer lock (proceeding offline):",
            error
          );
        }
      }

      dispatch({
        type: "START_TIMER",
        payload: {
          startTime,
          sleepType,
          lockState,
          ...identity,
          morningClassification,
          morningClassificationVersion: MORNING_CLASSIFICATION_VERSION,
        },
      });

      const activityId = await startTimerLiveActivity(
        "sleep",
        selectedBaby.name,
        sleepType,
        startTime
      );
      if (activityId) {
        liveActivityIdRef.current = activityId;
      }

      await SleepStorageService.setActiveTimer(selectedBaby.id, {
        ...identity,
        startedAt: startTime.toISOString(),
        type: sleepType,
        liveActivityId: activityId ?? undefined,
        lockState,
        morningClassification,
        morningClassificationVersion: MORNING_CLASSIFICATION_VERSION,
      });

      return { success: true };
    },
    [
      selectedBaby,
      user?.id,
      state.sleeps,
      state.wakeWindowConfig?.dayStartHour,
      state.wakeWindowConfig?.napContinuationMinutes,
    ]
  );

  const stopSleep = useCallback(
    async (requestedEndTime?: Date): Promise<StoredSleepEntry | null> => {
      if (!selectedBaby || !state.activeTimer) return null;
      if (isStoppingRef.current) return null;
      isStoppingRef.current = true;
      setIsStopping(true);

      const activeTimer = state.activeTimer;
      const timerStartTime = activeTimer.startTime;
      const babyId = selectedBaby.id;
      const getEffectiveTimer = (): ActiveSleepTimer => {
        const confirmation = activeMorningConfirmationRef.current;
        if (
          !confirmation ||
          confirmation.activityId !== activeTimer.activityId
        ) {
          return activeTimer;
        }
        return {
          ...activeTimer,
          sleepType: confirmation.sleepType,
          morningClassification: confirmation.morningClassification,
        };
      };
      const finishTimer = async () => {
        dispatch({ type: "STOP_TIMER" });
        stopVersionRef.current++;
        if (
          activeMorningConfirmationRef.current?.activityId ===
          activeTimer.activityId
        ) {
          activeMorningConfirmationRef.current = null;
        }
        removeLock(babyId, "sleep");
        try {
          await SleepStorageService.clearActiveTimer(babyId);
        } catch (error) {
          console.error(
            "[SleepContext] Failed to clear completed timer snapshot:",
            error
          );
        }
        try {
          const endedById = liveActivityIdRef.current
            ? await endTimerLiveActivity(liveActivityIdRef.current)
            : false;
          if (!endedById) {
            await endLiveActivityByType("sleep");
          }
          liveActivityIdRef.current = null;
        } catch (error) {
          console.error(
            "[SleepContext] Failed to end completed Live Activity:",
            error
          );
        }
        if (user?.id) {
          try {
            await releaseTimerLock(
              babyId,
              "sleep",
              user.id,
              activeTimer.timerInstanceId,
              activeTimer.startTime.toISOString()
            );
          } catch (error) {
            console.error(
              "[SleepContext] Failed to release timer lock, queuing retry:",
              error
            );
            await queuePendingLockRelease(
              babyId,
              "sleep",
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
        const requestedDurationSeconds = Math.floor(
          (requestedStopTime.getTime() - timerStartTime.getTime()) /
            1000
        );
        if (shouldDiscardTimerDuration(requestedDurationSeconds)) {
          await finishTimer();
          return null;
        }

        const completion = await acceptTimerCompletion(
          babyId,
          "sleep",
          timerStartTime.toISOString(),
          getEffectiveTimer(),
          requestedStopTime
        );
        const endTime = new Date(completion.stoppedAt);
        if (completion.status === "completed") {
          const existing = await SleepStorageService.getSleepById(
            babyId,
            completion.activityId
          );
          await finishTimer();
          return existing;
        }

        const effectiveTimer = getEffectiveTimer();
        const sleepType =
          effectiveTimer.morningClassification === "confirmed_first_nap"
            ? "nap"
            : effectiveTimer.morningClassification ===
                "confirmed_night_continuation"
              ? "night"
              : classifySleepByTimeRange(
                  timerStartTime,
                  endTime,
                  state.wakeWindowConfig?.dayStartHour ?? 6,
                  state.wakeWindowConfig?.dayEndHour ?? 19
                );
        const adapter = createSleepTimerAdapter({
          babyId,
          resolveMorningClassification: (_startedAt, stored) =>
            stored ?? effectiveTimer.morningClassification,
          dispatchRestoreTimer: (restoredTimer) => {
            dispatch({ type: "RESTORE_TIMER", payload: restoredTimer });
          },
        });
        const sleepInput = adapter.buildRecord(timerStartTime, endTime, {
          timerInstanceId: effectiveTimer.timerInstanceId,
          activityId: completion.activityId,
          type: sleepType,
          isPaused: effectiveTimer.isPaused,
          totalPausedMs: effectiveTimer.totalPausedMs,
          pausedAt: effectiveTimer.pausedAt?.toISOString(),
          morningClassification: effectiveTimer.morningClassification,
          morningClassificationVersion:
            effectiveTimer.morningClassificationVersion,
        });

        let lastSleep: StoredSleepEntry;
        try {
          if (user?.householdId && user?.id) {
            lastSleep = await createSleepInDatabase(sleepInput, user.id);
          } else {
            lastSleep = await SleepStorageService.addSleep(sleepInput);
          }
        } catch (saveError) {
          console.error(
            "[SleepContext] Failed to durably complete timer:",
            saveError
          );
          throw saveError;
        }

        await markTimerCompletionDurable(completion);
        dispatch({ type: "ADD_SLEEP", payload: lastSleep });
        await finishTimer();
        return lastSleep;
      } finally {
        isStoppingRef.current = false;
        setIsStopping(false);
      }
    },
    [
      selectedBaby,
      state.activeTimer,
      state.wakeWindowConfig?.dayStartHour,
      state.wakeWindowConfig?.dayEndHour,
      user?.householdId,
      user?.id,
      removeLock,
    ]
  );

  const changeSleepType = useCallback(
    (sleepType: SleepType) => {
      if (state.activeTimer?.isPaused) return;
      dispatch({ type: "UPDATE_TIMER_TYPE", payload: { sleepType } });
      if (selectedBaby && state.activeTimer) {
        SleepStorageService.setActiveTimer(selectedBaby.id, {
          timerInstanceId: state.activeTimer.timerInstanceId,
          activityId: state.activeTimer.activityId,
          startedAt: state.activeTimer.startTime.toISOString(),
          type: sleepType,
          liveActivityId: liveActivityIdRef.current ?? undefined,
          isPaused: state.activeTimer.isPaused,
          totalPausedMs: state.activeTimer.totalPausedMs,
          pausedAt: state.activeTimer.pausedAt?.toISOString(),
          lockState: state.activeTimer.lockState,
          morningClassification: state.activeTimer.morningClassification,
          morningClassificationVersion:
            state.activeTimer.morningClassificationVersion,
        });
        if (liveActivityIdRef.current) {
          updateTimerLiveActivity(liveActivityIdRef.current, sleepType);
        }
        if (user?.id) {
          updateTimerData(selectedBaby.id, "sleep", user.id, {
            timerInstanceId: state.activeTimer.timerInstanceId,
            activityId: state.activeTimer.activityId,
            type: sleepType,
            morningClassification: state.activeTimer.morningClassification,
            morningClassificationVersion:
              state.activeTimer.morningClassificationVersion,
          }).catch((error) =>
            console.error("[SleepContext] Failed to update timer data:", error)
          );
        }
      }
    },
    [selectedBaby, state.activeTimer, user?.id]
  );

  const pauseSleep = useCallback(
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

      await SleepStorageService.setActiveTimer(selectedBaby.id, {
        timerInstanceId: state.activeTimer.timerInstanceId,
        activityId: state.activeTimer.activityId,
        startedAt: state.activeTimer.startTime.toISOString(),
        type: state.activeTimer.sleepType,
        liveActivityId: liveActivityIdRef.current ?? undefined,
        isPaused: true,
        pausedAt: now.toISOString(),
        totalPausedMs: state.activeTimer.totalPausedMs,
        lockState: state.activeTimer.lockState,
        morningClassification: state.activeTimer.morningClassification,
        morningClassificationVersion:
          state.activeTimer.morningClassificationVersion,
      });

      if (user?.id) {
        try {
          const totalElapsed = Math.floor(
            (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
          );
          await updateTimerData(selectedBaby.id, "sleep", user.id, {
            timerInstanceId: state.activeTimer.timerInstanceId,
            activityId: state.activeTimer.activityId,
            isPaused: true,
            pausedAt: now.toISOString(),
            accumulatedSeconds: totalElapsed,
            totalPausedMs: state.activeTimer.totalPausedMs,
            type: state.activeTimer.sleepType,
            morningClassification: state.activeTimer.morningClassification,
            morningClassificationVersion:
              state.activeTimer.morningClassificationVersion,
          });
        } catch (error) {
          console.error("[SleepContext] Failed to update timer data:", error);
        }
      }
    },
    [selectedBaby, state.activeTimer, user?.id]
  );

  const resumeSleep = useCallback(
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

      await SleepStorageService.setActiveTimer(selectedBaby.id, {
        timerInstanceId: state.activeTimer.timerInstanceId,
        activityId: state.activeTimer.activityId,
        startedAt: state.activeTimer.startTime.toISOString(),
        type: state.activeTimer.sleepType,
        liveActivityId: liveActivityIdRef.current ?? undefined,
        isPaused: false,
        totalPausedMs: newTotalPausedMs,
        lockState: state.activeTimer.lockState,
        morningClassification: state.activeTimer.morningClassification,
        morningClassificationVersion:
          state.activeTimer.morningClassificationVersion,
      });

      if (user?.id) {
        try {
          const activeElapsedSeconds = Math.floor(
            (now.getTime() - state.activeTimer.startTime.getTime()) / 1000
          );
          await updateTimerData(selectedBaby.id, "sleep", user.id, {
            timerInstanceId: state.activeTimer.timerInstanceId,
            activityId: state.activeTimer.activityId,
            isPaused: false,
            totalPausedMs: newTotalPausedMs,
            type: state.activeTimer.sleepType,
            effectiveStartTime: state.activeTimer.startTime.toISOString(),
            accumulatedSeconds: activeElapsedSeconds,
            morningClassification: state.activeTimer.morningClassification,
            morningClassificationVersion:
              state.activeTimer.morningClassificationVersion,
          });
        } catch (error) {
          console.error("[SleepContext] Failed to update timer data:", error);
        }
      }
    },
    [selectedBaby, state.activeTimer, user?.id]
  );

  const addSleep = useCallback(
    async (input: CreateSleepInput): Promise<StoredSleepEntry> => {
      const morningClassification =
        input.morningClassification ??
        classifyNewMorningSleep(
          state.sleeps,
          { startedAt: input.startedAt, endedAt: input.endedAt },
          state.wakeWindowConfig?.dayStartHour ?? 6,
          state.wakeWindowConfig?.napContinuationMinutes ?? 25,
          input.endedAt ??
            new Date(Math.max(Date.now(), input.startedAt.getTime()))
        );
      const versionedInput: CreateSleepInput = {
        ...input,
        morningClassification,
        morningClassificationVersion:
          input.morningClassificationVersion ?? MORNING_CLASSIFICATION_VERSION,
      };
      let sleep: StoredSleepEntry;

      if (user?.householdId && user?.id) {
        sleep = await createSleepInDatabase(versionedInput, user.id);
      } else {
        sleep = await SleepStorageService.addSleep(versionedInput);
      }

      dispatch({ type: "ADD_SLEEP", payload: sleep });
      return sleep;
    },
    [
      user?.householdId,
      user?.id,
      state.sleeps,
      state.wakeWindowConfig?.dayStartHour,
      state.wakeWindowConfig?.napContinuationMinutes,
    ]
  );

  const updateSleep = useCallback(
    async (
      sleepId: string,
      input: UpdateSleepInput
    ): Promise<StoredSleepEntry | null> => {
      if (!selectedBaby) return null;

      const existing = state.sleeps.find((sleep) => sleep.id === sleepId);
      const dayStartHour = state.wakeWindowConfig?.dayStartHour ?? 6;
      const start = existing ? new Date(existing.startedAt) : null;
      const startHour = start
        ? start.getHours() + start.getMinutes() / 60 + start.getSeconds() / 3600
        : null;
      const isApplicableMorningEdit =
        input.type !== undefined &&
        startHour !== null &&
        startHour >= getMorningThreshold(dayStartHour) &&
        startHour < dayStartHour;
      const effectiveInput: UpdateSleepInput = isApplicableMorningEdit
        ? {
            ...input,
            morningClassification:
              input.type === "nap"
                ? "confirmed_first_nap"
                : "confirmed_night_continuation",
            morningClassificationVersion: MORNING_CLASSIFICATION_VERSION,
          }
        : input;

      let updated: StoredSleepEntry | null;

      if (user?.householdId) {
        updated = await updateSleepInDatabase(
          selectedBaby.id,
          sleepId,
          effectiveInput
        );
      } else {
        updated = await SleepStorageService.updateSleep(
          selectedBaby.id,
          sleepId,
          effectiveInput
        );
      }

      if (updated) {
        dispatch({ type: "UPDATE_SLEEP", payload: updated });
      }
      return updated;
    },
    [
      selectedBaby,
      user?.householdId,
      state.sleeps,
      state.wakeWindowConfig?.dayStartHour,
    ]
  );

  const pendingMorningConfirmations = useMemo(
    () =>
      findPendingMorningConfirmations(
        state.sleeps,
        state.wakeWindowConfig?.dayStartHour ?? 6,
        state.wakeWindowConfig?.napContinuationMinutes ?? 25
      ),
    [
      state.sleeps,
      state.wakeWindowConfig?.dayStartHour,
      state.wakeWindowConfig?.napContinuationMinutes,
    ]
  );

  const confirmMorningSleep = useCallback(
    async (
      sleepId: string,
      answer: "first_nap" | "night_continuation"
    ): Promise<void> => {
      const sleepType: SleepType = answer === "first_nap" ? "nap" : "night";
      const morningClassification: MorningClassificationState =
        answer === "first_nap"
          ? "confirmed_first_nap"
          : "confirmed_night_continuation";

      if (selectedBaby && state.activeTimer?.activityId === sleepId) {
        const activeTimer = state.activeTimer;
        const stopVersionAtStart = stopVersionRef.current;
        activeMorningConfirmationRef.current = {
          activityId: sleepId,
          sleepType,
          morningClassification,
        };
        dispatch({
          type: "UPDATE_TIMER_TYPE",
          payload: { sleepType, morningClassification },
        });
        await SleepStorageService.setActiveTimer(selectedBaby.id, {
          timerInstanceId: activeTimer.timerInstanceId,
          activityId: activeTimer.activityId,
          startedAt: activeTimer.startTime.toISOString(),
          type: sleepType,
          liveActivityId: liveActivityIdRef.current ?? undefined,
          isPaused: activeTimer.isPaused,
          totalPausedMs: activeTimer.totalPausedMs,
          pausedAt: activeTimer.pausedAt?.toISOString(),
          lockState: activeTimer.lockState,
          morningClassification,
          morningClassificationVersion: MORNING_CLASSIFICATION_VERSION,
        });
        if (stopVersionRef.current !== stopVersionAtStart) {
          await SleepStorageService.clearActiveTimer(selectedBaby.id);
          await updateSleep(sleepId, {
            type: sleepType,
            morningClassification,
            morningClassificationVersion: MORNING_CLASSIFICATION_VERSION,
          });
          return;
        }
        if (liveActivityIdRef.current) {
          try {
            await updateTimerLiveActivity(liveActivityIdRef.current, sleepType);
          } catch (error) {
            console.error(
              "[SleepContext] Failed to update morning confirmation Live Activity:",
              error
            );
          }
        }
        if (user?.id) {
          try {
            await updateTimerData(selectedBaby.id, "sleep", user.id, {
              timerInstanceId: activeTimer.timerInstanceId,
              activityId: activeTimer.activityId,
              type: sleepType,
              morningClassification,
              morningClassificationVersion: MORNING_CLASSIFICATION_VERSION,
            });
          } catch (error) {
            console.error(
              "[SleepContext] Failed to sync active morning confirmation:",
              error
            );
          }
        }
        return;
      }

      await updateSleep(sleepId, {
        type: sleepType,
        morningClassification,
        morningClassificationVersion: MORNING_CLASSIFICATION_VERSION,
      });
    },
    [selectedBaby, state.activeTimer, updateSleep, user?.id]
  );

  const deleteSleep = useCallback(
    async (sleepId: string): Promise<boolean> => {
      if (!selectedBaby) return false;

      let result: boolean;

      if (user?.householdId) {
        result = await deleteSleepFromDatabase(selectedBaby.id, sleepId);
      } else {
        result = await SleepStorageService.deleteSleep(
          selectedBaby.id,
          sleepId
        );
      }

      if (result) {
        dispatch({ type: "DELETE_SLEEP", payload: sleepId });
      }
      return result;
    },
    [selectedBaby, user?.householdId]
  );

  const getLastSleep = useCallback((): StoredSleepEntry | null => {
    if (state.sleeps.length === 0) return null;

    const sorted = [...state.sleeps].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  }, [state.sleeps]);

  const getTodaysTotalSleepMinutes = useCallback((): number => {
    const now = new Date();
    const dayStart = state.wakeWindowConfig?.dayStartHour ?? 6;
    const windowStart = new Date(now);
    windowStart.setHours(dayStart, 0, 0, 0);
    if (now.getHours() < dayStart) {
      windowStart.setDate(windowStart.getDate() - 1);
    }
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 1);

    let totalSeconds = 0;
    for (const s of state.sleeps) {
      const start = new Date(s.startedAt);
      const end = s.endedAt ? new Date(s.endedAt) : now;

      if (end <= windowStart || start >= windowEnd) continue;

      const clampedStart = start < windowStart ? windowStart : start;
      const clampedEnd = end > windowEnd ? windowEnd : end;
      totalSeconds += Math.floor(
        (clampedEnd.getTime() - clampedStart.getTime()) / 1000
      );
    }

    return Math.floor(totalSeconds / 60);
  }, [state.sleeps, state.wakeWindowConfig?.dayStartHour]);

  const getWakeWindowProgress = useCallback((): number | undefined => {
    const lastSleep = getLastSleep();
    if (!lastSleep || !lastSleep.endedAt) return undefined;

    const awakeMinutes = Math.floor(
      (Date.now() - new Date(lastSleep.endedAt).getTime()) / (1000 * 60)
    );

    return Math.min(
      100,
      Math.round((awakeMinutes / state.wakeWindowMinutes) * 100)
    );
  }, [getLastSleep, state.wakeWindowMinutes]);

  const getDailyProgress = useCallback((): number => {
    const totalMinutes = getTodaysTotalSleepMinutes();
    if (state.dailyGoalMinutes <= 0) return 100;
    const percentage = (totalMinutes / state.dailyGoalMinutes) * 100;
    return Math.min(100, Math.floor(percentage));
  }, [getTodaysTotalSleepMinutes, state.dailyGoalMinutes]);

  const setCustomGoal = useCallback(
    async (goalMinutes: number): Promise<void> => {
      if (!selectedBaby) return;
      await SleepStorageService.setCustomGoal(selectedBaby.id, goalMinutes);
      dispatch({ type: "SET_DAILY_GOAL", payload: goalMinutes });
      dispatch({ type: "SET_GOAL_SOURCE", payload: "custom" });
      if (user?.householdId) {
        upsertActivityGoal(
          selectedBaby.id,
          "sleep",
          goalMinutes,
          "custom"
        ).catch((error) =>
          console.error("[SleepContext] Failed to sync goal:", error)
        );
      }
    },
    [selectedBaby, user?.householdId]
  );

  const resetToAgeBasedGoal = useCallback(async (): Promise<void> => {
    if (!selectedBaby) return;

    await SleepStorageService.clearCustomGoal(selectedBaby.id);

    const birthDate = selectedBaby.birthDate
      ? new Date(selectedBaby.birthDate)
      : undefined;
    const goalInfo = getSleepGoalInfo(birthDate, null);

    await SleepStorageService.setDailyGoal(
      selectedBaby.id,
      goalInfo.targetMinutes
    );
    dispatch({ type: "SET_DAILY_GOAL", payload: goalInfo.targetMinutes });
    dispatch({ type: "SET_GOAL_SOURCE", payload: "age_based" });
    dispatch({ type: "SET_AGE_GROUP", payload: goalInfo.ageGroup });
    if (user?.householdId) {
      upsertActivityGoal(
        selectedBaby.id,
        "sleep",
        goalInfo.targetMinutes,
        "age_based"
      ).catch((error) =>
        console.error("[SleepContext] Failed to sync goal:", error)
      );
    }
  }, [selectedBaby, user?.householdId]);

  const dismissMilestoneSuggestion = useCallback(
    async (permanent = false): Promise<void> => {
      if (!selectedBaby || !state.currentAgeGroup) return;

      if (permanent) {
        await SleepStorageService.dismissMilestone(
          selectedBaby.id,
          state.currentAgeGroup.label
        );
      }
      dispatch({ type: "SET_SHOW_MILESTONE_SUGGESTION", payload: false });
      dispatch({ type: "SET_SUGGESTED_GOAL", payload: null });
    },
    [selectedBaby, state.currentAgeGroup]
  );

  const acceptMilestoneSuggestion = useCallback(async (): Promise<void> => {
    if (!selectedBaby || !state.suggestedGoalMinutes) return;

    await SleepStorageService.setDailyGoal(
      selectedBaby.id,
      state.suggestedGoalMinutes
    );
    dispatch({ type: "SET_DAILY_GOAL", payload: state.suggestedGoalMinutes });
    dispatch({ type: "SET_SHOW_MILESTONE_SUGGESTION", payload: false });
    dispatch({ type: "SET_SUGGESTED_GOAL", payload: null });
    if (user?.householdId) {
      upsertActivityGoal(
        selectedBaby.id,
        "sleep",
        state.suggestedGoalMinutes,
        "age_based"
      ).catch((error) =>
        console.error("[SleepContext] Failed to sync goal:", error)
      );
    }
  }, [selectedBaby, state.suggestedGoalMinutes, user?.householdId]);

  const getCompletedNapsSinceNightSleep = useCallback((): number => {
    const now = new Date();
    const dayStartHour = state.wakeWindowConfig?.dayStartHour ?? 6;
    const dayEndHour = state.wakeWindowConfig?.dayEndHour ?? 19;
    const morning = resolveMorningSleep(
      state.sleeps,
      dayStartHour,
      now,
      state.wakeWindowConfig?.napContinuationMinutes ?? 25
    );
    if (!morning.morningWakeTime) return 0;

    const dayEnd = new Date(now);
    dayEnd.setHours(
      Math.floor(dayEndHour),
      Math.round((dayEndHour % 1) * 60),
      0,
      0
    );

    const completedNaps = state.sleeps.filter((sleep) => {
      if (!sleep.endedAt || morning.continuations.includes(sleep)) return false;
      const startedAt = new Date(sleep.startedAt);
      const endedAt = new Date(sleep.endedAt);
      return (
        startedAt.getTime() > morning.morningWakeTime!.getTime() &&
        startedAt.getTime() < dayEnd.getTime() &&
        endedAt.getTime() <= now.getTime()
      );
    });

    return processSleepData(
      completedNaps,
      state.wakeWindowConfig?.napContinuationMinutes ?? 25
    ).length;
  }, [
    state.sleeps,
    state.wakeWindowConfig?.dayStartHour,
    state.wakeWindowConfig?.dayEndHour,
    state.wakeWindowConfig?.napContinuationMinutes,
  ]);

  const getCurrentNapSlot = useCallback((): NapSlotWindow | null => {
    if (!state.wakeWindowConfig) return null;
    if (!state.wakeWindowConfig.enabled) return null;
    if (state.wakeWindowConfig.source !== "custom") return null;

    if (isUnderTwoMonths(selectedBaby?.birthDate) && !state.newbornNapOptIn)
      return null;

    const { slots } = state.wakeWindowConfig;
    if (slots.length === 0) return null;

    const dayStart = state.wakeWindowConfig.dayStartHour ?? 6;
    const dayEnd = state.wakeWindowConfig.dayEndHour ?? 19;
    if (isNightTime(new Date(), dayStart, dayEnd)) return null;

    const napsDone = getCompletedNapsSinceNightSleep();
    const slotIndex = Math.min(napsDone, slots.length - 1);
    return slots[slotIndex];
  }, [
    state.wakeWindowConfig,
    getCompletedNapsSinceNightSleep,
    selectedBaby?.birthDate,
    state.newbornNapOptIn,
  ]);

  const setWakeWindowConfigMethod = useCallback(
    async (config: WakeWindowConfig): Promise<void> => {
      if (!selectedBaby) return;
      dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
      await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
    },
    [selectedBaby]
  );

  const setCustomWakeWindows = useCallback(
    async (slots: NapSlotWindow[]): Promise<void> => {
      if (!selectedBaby || !state.wakeWindowConfig) return;
      const config: WakeWindowConfig = {
        ...state.wakeWindowConfig,
        slots,
        source: "custom",
      };
      dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
      await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
    },
    [selectedBaby, state.wakeWindowConfig]
  );

  const resetToAgeBasedWakeWindows = useCallback(async (): Promise<void> => {
    if (!selectedBaby) return;
    const birthDate = selectedBaby.birthDate
      ? new Date(selectedBaby.birthDate)
      : undefined;
    if (!birthDate) return;
    const config = getDefaultWakeWindowConfig(birthDate);
    dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
    await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
  }, [selectedBaby]);

  const isCurrentlyNightTime = useCallback((): boolean => {
    const dayStart = state.wakeWindowConfig?.dayStartHour ?? 6;
    const dayEnd = state.wakeWindowConfig?.dayEndHour ?? 19;
    return isNightTime(new Date(), dayStart, dayEnd);
  }, [
    state.wakeWindowConfig?.dayStartHour,
    state.wakeWindowConfig?.dayEndHour,
  ]);

  const syncWakeConfigToSupabase = useCallback(
    (babyId: string, config: WakeWindowConfig) => {
      if (!user?.householdId) return;
      upsertWakeWindowPreference(
        babyId,
        config.enabled,
        config.napCount,
        config.slots,
        config.source,
        config.dayStartHour,
        config.dayEndHour,
        config.napContinuationMinutes,
        config.driftDismissed
      ).catch(() => {});
    },
    [user?.householdId]
  );

  const setDayNightBoundary = useCallback(
    async (dayStartHour: number, dayEndHour: number): Promise<void> => {
      if (!selectedBaby) return;
      const config: WakeWindowConfig = {
        ...(state.wakeWindowConfig ?? {
          enabled: false,
          napCount: 2,
          slots: [],
          source: "age_based" as const,
        }),
        dayStartHour,
        dayEndHour,
        dayBoundariesConfigured: true,
        driftDismissed: null,
      };
      dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
      await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
      syncWakeConfigToSupabase(selectedBaby.id, config);
    },
    [selectedBaby, state.wakeWindowConfig, syncWakeConfigToSupabase]
  );

  const setNapContinuationMinutes = useCallback(
    async (minutes: number): Promise<void> => {
      if (!selectedBaby) return;
      const config: WakeWindowConfig = {
        ...(state.wakeWindowConfig ?? {
          enabled: false,
          napCount: 2,
          slots: [],
          source: "age_based" as const,
        }),
        napContinuationMinutes: minutes,
      };
      dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
      await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
      syncWakeConfigToSupabase(selectedBaby.id, config);
    },
    [selectedBaby, state.wakeWindowConfig, syncWakeConfigToSupabase]
  );

  const setWakeWindowsEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (!selectedBaby) return;
      const config: WakeWindowConfig = {
        ...(state.wakeWindowConfig ?? {
          enabled: false,
          napCount: 2,
          slots: [],
          source: "age_based" as const,
        }),
        enabled,
      };
      dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
      await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
      syncWakeConfigToSupabase(selectedBaby.id, config);
    },
    [selectedBaby, state.wakeWindowConfig, syncWakeConfigToSupabase]
  );

  const setNewbornNapOptInMethod = useCallback(
    async (optIn: boolean): Promise<void> => {
      if (!selectedBaby) return;
      dispatch({ type: "SET_NEWBORN_NAP_OPT_IN", payload: optIn });
      await SleepStorageService.setNewbornNapOptIn(selectedBaby.id, optIn);
    },
    [selectedBaby]
  );

  const dismissPredictionBanner = useCallback(async (): Promise<void> => {
    if (!selectedBaby) return;
    dispatch({ type: "SET_PREDICTION_BANNER_DISMISSED", payload: true });
    await SleepStorageService.setPredictionBannerDismissed(
      selectedBaby.id,
      true
    );
  }, [selectedBaby]);

  const dismissDrift = useCallback(async (): Promise<void> => {
    if (!selectedBaby || !state.driftDetection) return;
    const { type, suggestedHour } = state.driftDetection;
    const dismissed = { type, suggestedHour };
    driftDismissedRef.current = dismissed;
    dispatch({ type: "SET_DRIFT_DETECTION", payload: null });
    await SleepStorageService.setDriftDismissed(selectedBaby.id, dismissed);
    const config: WakeWindowConfig = {
      ...(state.wakeWindowConfig ?? {
        enabled: false,
        napCount: 2,
        slots: [],
        source: "age_based" as const,
      }),
      driftDismissed: dismissed,
    };
    dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
    await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
    syncWakeConfigToSupabase(selectedBaby.id, config);
  }, [
    selectedBaby,
    state.driftDetection,
    state.wakeWindowConfig,
    syncWakeConfigToSupabase,
  ]);

  const acceptDrift = useCallback(async (): Promise<void> => {
    if (!selectedBaby || !state.driftDetection) return;
    const { type, suggestedHour } = state.driftDetection;
    driftDismissedRef.current = null;
    dispatch({ type: "SET_DRIFT_DETECTION", payload: null });
    await SleepStorageService.clearDriftDismissed(selectedBaby.id);
    if (type === "bedtime") {
      await setDayNightBoundary(
        state.wakeWindowConfig?.dayStartHour ?? 6,
        suggestedHour
      );
    } else {
      await setDayNightBoundary(
        suggestedHour,
        state.wakeWindowConfig?.dayEndHour ?? 19
      );
    }
  }, [
    selectedBaby,
    state.driftDetection,
    state.wakeWindowConfig,
    setDayNightBoundary,
  ]);

  const setNapCount = useCallback(
    async (count: number): Promise<void> => {
      if (!selectedBaby) return;
      const birthDate = selectedBaby.birthDate
        ? new Date(selectedBaby.birthDate)
        : undefined;
      if (!birthDate) return;

      const slots = generateSlotsForNapCount(count, birthDate);
      const config: WakeWindowConfig = {
        ...(state.wakeWindowConfig ?? {
          enabled: false,
          napCount: 2,
          slots: [],
          source: "age_based" as const,
        }),
        napCount: count,
        slots,
        source: "age_based",
      };
      dispatch({ type: "SET_WAKE_WINDOW_CONFIG", payload: config });
      await SleepStorageService.setWakeWindowConfig(selectedBaby.id, config);
    },
    [selectedBaby, state.wakeWindowConfig]
  );

  const value: SleepContextValue = useMemo(
    () => ({
      ...state,
      babyBinding,
      isStopping,
      startSleep,
      stopSleep,
      changeSleepType,
      pauseSleep,
      resumeSleep,
      addSleep,
      updateSleep,
      deleteSleep,
      refreshSleeps: loadSleeps,
      loadSleepRange,
      getSleepRangeStatus,
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
      setWakeWindowsEnabled,
      setNewbornNapOptIn: setNewbornNapOptInMethod,
      dismissPredictionBanner,
      dismissDrift,
      acceptDrift,
      pendingMorningConfirmations,
      confirmMorningSleep,
    }),
    [
      state,
      babyBinding,
      isStopping,
      startSleep,
      stopSleep,
      changeSleepType,
      pauseSleep,
      resumeSleep,
      addSleep,
      updateSleep,
      deleteSleep,
      loadSleeps,
      loadSleepRange,
      getSleepRangeStatus,
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
      setWakeWindowConfigMethod,
      setCustomWakeWindows,
      resetToAgeBasedWakeWindows,
      setNapCount,
      isCurrentlyNightTime,
      setDayNightBoundary,
      setNapContinuationMinutes,
      setWakeWindowsEnabled,
      setNewbornNapOptInMethod,
      dismissPredictionBanner,
      dismissDrift,
      acceptDrift,
      pendingMorningConfirmations,
      confirmMorningSleep,
    ]
  );

  return (
    <SleepContext.Provider value={value}>{children}</SleepContext.Provider>
  );
}

export function useSleep(): SleepContextValue {
  const context = useContext(SleepContext);
  if (!context) {
    throw new Error("useSleep must be used within a SleepProvider");
  }
  return context;
}

function transformSleepFromRemote(
  data: Record<string, unknown>
): StoredSleepEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    type: data.type as SleepType,
    startedAt: data.started_at as string,
    endedAt: data.ended_at as string | undefined,
    durationSeconds: data.duration_seconds as number | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    morningClassification:
      data.morning_classification as StoredSleepEntry["morningClassification"],
    morningClassificationVersion: data.morning_classification_version as
      | number
      | null
      | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}
