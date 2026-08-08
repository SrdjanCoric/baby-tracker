import React, { createContext, useContext, useEffect, useCallback, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useBaby } from "./baby-context";
import { useFeeding } from "./feeding-context";
import { useSleep } from "./sleep-context";
import { useDiaper } from "./diaper-context";
import { usePumping } from "./pumping-context";
import { useGrowth } from "./growth-context";
import { useTummyTime } from "./tummyTime-context";
import { useActiveTimers } from "./active-timers-context";
import { useAuth } from "./auth-context";
import { countFeedingSessions } from "@/utils/feeding-sessions";
import {
  updateWidgetData,
  writeAuthToAppGroup,
  writeSupabaseConfigToAppGroup,
  readPendingWidgetPauseToggle,
  readLiveActivityPushToken,
  readPushToStartToken,
  type WidgetData,
  type WidgetActivityData,
  type ActiveTimerData,
  type WatchAuthContext,
} from "@/services/widget-data-service";
import { syncWidgetPushToken } from "@/services/widget-push-token-service";
import {
  acknowledgeExternalTimerCommand,
  readExternalTimerCommands,
} from "@/services/external-timer-command-service";
import { registerPushToStart } from "@/services/live-activity-service";
import type { BreastSide, DiaperType, SleepType } from "@/constants/activities";
import type { TimerActivityType } from "@/services/active-timer-service";

interface WidgetContextValue {
  refreshWidgetData: () => Promise<void>;
  getWidgetDataJson: () => string | null;
}

const WidgetContext = createContext<WidgetContextValue | null>(null);

function getStartOfDay(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

const ACTIVITY_TYPE_MAP: Record<TimerActivityType, ActiveTimerData["type"]> = {
  feeding: "feeding",
  sleep: "sleep",
  pumping: "pumping",
  tummy_time: "tummyTime",
};

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  const { selectedBaby } = useBaby();
  const { feedings, activeTimer: feedingTimer, getLastFeeding } = useFeeding();
  const {
    sleeps,
    activeTimer: sleepTimer,
    dailyGoalMinutes: sleepGoal,
    getCurrentNapSlot,
    getCompletedNapsSinceNightSleep,
    pendingMorningConfirmations,
    newbornNapOptIn,
    babyBinding: sleepBabyBinding,
  } = useSleep();
  const { getTodaysCounts, getLastDiaper } = useDiaper();
  const { pumpings, activeTimer: pumpingTimer } = usePumping();
  const { measurements } = useGrowth();
  const { tummyTimes, activeTimer: tummyTimeTimer, dailyGoalSeconds: tummyTimeGoalSeconds } = useTummyTime();
  const { locks } = useActiveTimers();
  const { user, session } = useAuth();

  const lastUpdateRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const buildWidgetData = useCallback((): WidgetData | null => {
    if (!selectedBaby) return null;

    const startOfDay = getStartOfDay();

    const lastFeeding = getLastFeeding();
    const todayFeedings = feedings.filter(
      f => new Date(f.startedAt) >= startOfDay
    );

    const todaySleeps = sleeps.filter(s => new Date(s.startedAt) >= startOfDay);
    const todaySleepMinutes = todaySleeps.reduce((acc, s) => {
      return acc + Math.floor((s.durationSeconds || 0) / 60);
    }, 0);
    const lastSleep = [...sleeps]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

    const diaperCounts = getTodaysCounts();
    const lastDiaperEntry = getLastDiaper();

    const todayPumpings = pumpings.filter(
      p => new Date(p.startedAt) >= startOfDay
    );
    const todayPumpingVolume = todayPumpings.reduce(
      (acc, p) => acc + (p.volumeMl || 0),
      0
    );
    const lastPumping = [...pumpings]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

    const lastMeasurement = [...measurements]
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0];

    const todayTummyTime = tummyTimes.filter(
      t => new Date(t.startedAt) >= startOfDay
    );
    const todayTummyTimeMinutes = todayTummyTime.reduce((acc: number, t) => {
      return acc + Math.floor((t.durationSeconds || 0) / 60);
    }, 0);
    const lastTummyTime = [...tummyTimes]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

    const activities: WidgetActivityData = {
      feeding: {
        lastTime: lastFeeding?.startedAt || lastFeeding?.endedAt || null,
        todayCount: countFeedingSessions(todayFeedings),
        lastType: lastFeeding?.type || null,
        lastSide: (lastFeeding?.side as BreastSide) || null,
      },
      sleep: (() => {
        const currentSlot = getCurrentNapSlot();
        const lastEndedSleep = [...sleeps]
          .filter(s => s.endedAt)
          .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime())[0];
        return {
          lastTime: lastSleep?.endedAt || lastSleep?.startedAt || null,
          todayMinutes: todaySleepMinutes,
          goalMinutes: sleepGoal,
          lastDurationMinutes: lastSleep ? Math.floor((lastSleep.durationSeconds || 0) / 60) : null,
          isActive: sleepTimer?.isRunning || false,
          sleepType: (lastSleep?.type as SleepType) || null,
          wakeWindowMinutes: currentSlot?.durationMinutes ?? null,
          wakeWindowSlotLabel: currentSlot?.label ?? null,
          lastSleepEndedAt: lastEndedSleep?.endedAt ?? null,
          napCountToday: getCompletedNapsSinceNightSleep(),
          morningConfirmationPending: pendingMorningConfirmations.length > 0
            || sleepTimer?.morningClassification === "unresolved",
        };
      })(),
      diaper: {
        lastTime: lastDiaperEntry?.changedAt || null,
        todayCounts: diaperCounts,
        lastType: (lastDiaperEntry?.type as DiaperType) || null,
      },
      pumping: {
        lastTime: lastPumping?.startedAt || lastPumping?.endedAt || null,
        todayVolumeMl: todayPumpingVolume,
        sessionCount: todayPumpings.length,
        lastSide: (lastPumping?.side as BreastSide) || null,
      },
      growth: {
        lastMeasurement: lastMeasurement
          ? {
              date: lastMeasurement.measuredAt,
              weightKg: lastMeasurement.weightKg,
              heightCm: lastMeasurement.heightCm,
              headCircumferenceCm: lastMeasurement.headCircumferenceCm,
            }
          : null,
      },
      tummyTime: {
        lastTime: lastTummyTime?.startedAt || lastTummyTime?.endedAt || null,
        todayMinutes: todayTummyTimeMinutes,
        goalMinutes: Math.floor(tummyTimeGoalSeconds / 60),
        lastDurationMinutes: lastTummyTime
          ? Math.floor((lastTummyTime.durationSeconds || 0) / 60)
          : null,
      },
    };

    const activeTimers: WidgetData["activeTimers"] = [];

    if (feedingTimer?.isRunning) {
      const feedingEntry: WidgetData["activeTimers"][number] = {
        type: "feeding",
        startTime: feedingTimer.startTime.toISOString(),
        timerInstanceId: feedingTimer.timerInstanceId,
        context: feedingTimer.side,
        isPaused: feedingTimer.isPaused || undefined,
      };
      if (feedingTimer.isPaused) {
        const elapsed = feedingTimer.pausedAt
          ? Math.floor((feedingTimer.pausedAt.getTime() - feedingTimer.startTime.getTime()) / 1000)
          : 0;
        feedingEntry.accumulatedSeconds = elapsed;
      }
      activeTimers.push(feedingEntry);
    }
    if (sleepTimer?.isRunning) {
      const sleepEntry: WidgetData["activeTimers"][number] = {
        type: "sleep",
        startTime: sleepTimer.startTime.toISOString(),
        timerInstanceId: sleepTimer.timerInstanceId,
        context: sleepTimer.sleepType,
        isPaused: sleepTimer.isPaused || undefined,
      };
      if (sleepTimer.isPaused) {
        const elapsed = sleepTimer.pausedAt
          ? Math.floor((sleepTimer.pausedAt.getTime() - sleepTimer.startTime.getTime()) / 1000)
          : 0;
        sleepEntry.accumulatedSeconds = elapsed;
      }
      activeTimers.push(sleepEntry);
    }
    if (pumpingTimer?.isRunning) {
      const pumpingEntry: WidgetData["activeTimers"][number] = {
        type: "pumping",
        startTime: pumpingTimer.startTime.toISOString(),
        timerInstanceId: pumpingTimer.timerInstanceId,
        context: pumpingTimer.side,
        isPaused: pumpingTimer.isPaused || undefined,
      };
      if (pumpingTimer.isPaused) {
        const elapsed = pumpingTimer.pausedAt
          ? Math.floor((pumpingTimer.pausedAt.getTime() - pumpingTimer.startTime.getTime()) / 1000)
          : 0;
        pumpingEntry.accumulatedSeconds = elapsed;
      }
      activeTimers.push(pumpingEntry);
    }
    if (tummyTimeTimer?.isRunning) {
      const tummyEntry: WidgetData["activeTimers"][number] = {
        type: "tummyTime",
        startTime: tummyTimeTimer.startTime.toISOString(),
        timerInstanceId: tummyTimeTimer.timerInstanceId,
        isPaused: tummyTimeTimer.isPaused || undefined,
      };
      if (tummyTimeTimer.isPaused) {
        const elapsed = tummyTimeTimer.pausedAt
          ? Math.floor((tummyTimeTimer.pausedAt.getTime() - tummyTimeTimer.startTime.getTime()) / 1000)
          : 0;
        tummyEntry.accumulatedSeconds = elapsed;
      }
      activeTimers.push(tummyEntry);
    }

    const remoteLocks = locks.filter(
      (lock) => lock.startedBy !== user?.id && lock.babyId === selectedBaby.id
    );
    for (const lock of remoteLocks) {
      const widgetType = ACTIVITY_TYPE_MAP[lock.activityType];
      if (widgetType) {
        const isPaused = lock.timerData?.isPaused === true;
        const pausedAt = typeof lock.timerData?.pausedAt === "string"
          ? new Date(lock.timerData.pausedAt).getTime()
          : Number.NaN;
        const startedAt = new Date(lock.startedAt).getTime();
        const accumulatedSeconds = isPaused
          && Number.isFinite(pausedAt)
          && Number.isFinite(startedAt)
          ? Math.max(0, Math.floor((pausedAt - startedAt) / 1000))
          : undefined;
        activeTimers.push({
          type: widgetType,
          startTime: lock.startedAt,
          timerInstanceId: typeof lock.timerData?.timerInstanceId === "string"
            ? lock.timerData.timerInstanceId
            : undefined,
          context: lock.startedByName,
          isRemote: true,
          isPaused: isPaused || undefined,
          accumulatedSeconds,
        });
      }
    }

    const activeTimer = activeTimers.length > 0 ? activeTimers[0] : null;

    return {
      babyId: selectedBaby.id,
      babyName: selectedBaby.name,
      activities,
      activeTimer,
      activeTimers,
      updatedAt: new Date().toISOString(),
    };
  }, [
    selectedBaby,
    feedings,
    feedingTimer,
    getLastFeeding,
    sleeps,
    sleepTimer,
    sleepGoal,
    getCurrentNapSlot,
    getCompletedNapsSinceNightSleep,
    pendingMorningConfirmations,
    getTodaysCounts,
    getLastDiaper,
    pumpings,
    pumpingTimer,
    measurements,
    tummyTimes,
    tummyTimeTimer,
    tummyTimeGoalSeconds,
    locks,
    user,
  ]);

  const refreshWidgetData = useCallback(async () => {
    if (Platform.OS !== "ios") return;

    const widgetData = buildWidgetData();
    if (!widgetData) return;

    const pendingStops = await readExternalTimerCommands(widgetData.babyId);
    for (const pendingStop of pendingStops) {
      if (pendingStop.babyId !== widgetData.babyId) continue;
      const stopType = pendingStop.activityType === "tummy_time"
        ? "tummyTime" : pendingStop.activityType;
      const matchingTimers = widgetData.activeTimers.filter(
        (timer) => timer.type === stopType
      );
      if (matchingTimers.length === 0) continue;
      const stoppedAtMs = new Date(pendingStop.eventAt).getTime();
      const targetsLegacyTimer = pendingStop.legacy === true &&
        pendingStop.timerInstanceId.startsWith("legacy:");
      const targetsCurrentTimer = matchingTimers.some((timer) =>
        targetsLegacyTimer
          ? new Date(timer.startTime).getTime() <= stoppedAtMs
          : timer.timerInstanceId === pendingStop.timerInstanceId
      );
      if (!targetsCurrentTimer) {
        await acknowledgeExternalTimerCommand(pendingStop);
        continue;
      }
      widgetData.activeTimers = widgetData.activeTimers.filter((timer) =>
        timer.type !== stopType ||
        (targetsLegacyTimer
          ? new Date(timer.startTime).getTime() > stoppedAtMs
          : timer.timerInstanceId !== pendingStop.timerInstanceId)
      );
      widgetData.activeTimer = widgetData.activeTimers[0] ?? null;
    }

    const pendingPause = await readPendingWidgetPauseToggle();
    if (pendingPause) {
      const pauseType = pendingPause.activityType === "tummy_time"
        ? "tummyTime" : pendingPause.activityType;
      widgetData.activeTimers = widgetData.activeTimers.map(t => {
        if (t.type !== pauseType) return t;
        if (pendingPause.action === "pause") {
          return {
            ...t,
            isPaused: true,
            accumulatedSeconds: pendingPause.accumulatedSeconds,
          };
        }
        return { ...t, isPaused: false, accumulatedSeconds: undefined };
      });
      widgetData.activeTimer = widgetData.activeTimers[0] ?? null;
    }

    const dataHash = JSON.stringify({
      babyId: widgetData.babyId,
      activities: widgetData.activities,
      activeTimer: widgetData.activeTimer,
      activeTimers: widgetData.activeTimers,
      accessToken: session?.access_token,
      householdId: user?.householdId,
    });

    if (dataHash === lastUpdateRef.current) {
      return;
    }

    lastUpdateRef.current = dataHash;

    let authContext: WatchAuthContext | undefined;
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey && session?.access_token && user?.id) {
      const [liveActivityPushToken, pushToStartToken] = await Promise.all([
        readLiveActivityPushToken(),
        readPushToStartToken(),
      ]);
      authContext = {
        supabaseUrl,
        supabaseAnonKey,
        accessToken: session.access_token,
        userId: user.id,
        householdId: user.householdId ?? undefined,
        liveActivityPushToken: liveActivityPushToken ?? undefined,
        pushToStartToken: pushToStartToken ?? undefined,
      };
    }

    try {
      await updateWidgetData(widgetData, authContext);
    } catch (error) {
      console.error("[WidgetContext] Failed to update widget data:", error);
    }
  }, [buildWidgetData, session?.access_token, user?.householdId, user?.id]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!selectedBaby) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      refreshWidgetData();
    }, 100);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    selectedBaby,
    feedings,
    feedingTimer,
    sleeps,
    sleepTimer,
    pumpings,
    pumpingTimer,
    measurements,
    tummyTimes,
    tummyTimeTimer,
    locks,
    refreshWidgetData,
  ]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        lastUpdateRef.current = "";
        refreshWidgetData();
      }
    });

    return () => subscription.remove();
  }, [refreshWidgetData]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;
    writeSupabaseConfigToAppGroup(supabaseUrl, supabaseAnonKey);
    registerPushToStart();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!session?.access_token || !user?.id || !selectedBaby?.id) return;

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const writeAuth = () => {
      writeAuthToAppGroup({
        supabaseUrl,
        supabaseAnonKey,
        accessToken: session.access_token,
        userId: user.id,
        selectedBabyId: selectedBaby.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        newbornNapOptIn:
          sleepBabyBinding.babyId === selectedBaby.id
          && sleepBabyBinding.status === "ready"
            ? newbornNapOptIn
            : false,
      });
    };

    writeAuth();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background") {
        writeAuth();
      }
    });

    return () => subscription.remove();
  }, [
    session?.access_token,
    user?.id,
    selectedBaby?.id,
    newbornNapOptIn,
    sleepBabyBinding.babyId,
    sleepBabyBinding.status,
  ]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!user?.id) return;

    syncWidgetPushToken();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncWidgetPushToken();
      }
    });

    return () => subscription.remove();
  }, [user?.id]);

  const getWidgetDataJson = useCallback((): string | null => {
    const data = buildWidgetData();
    if (!data) return null;
    return JSON.stringify(data);
  }, [buildWidgetData]);

  const value: WidgetContextValue = useMemo(() => ({
    refreshWidgetData,
    getWidgetDataJson,
  }), [refreshWidgetData, getWidgetDataJson]);

  return (
    <WidgetContext.Provider value={value}>{children}</WidgetContext.Provider>
  );
}

export function useWidget(): WidgetContextValue {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
}
