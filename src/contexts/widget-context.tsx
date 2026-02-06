import React, { createContext, useContext, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { useBaby } from "./baby-context";
import { useFeeding } from "./feeding-context";
import { useSleep } from "./sleep-context";
import { useDiaper } from "./diaper-context";
import { usePumping } from "./pumping-context";
import { useGrowth } from "./growth-context";
import { useTummyTime } from "./tummyTime-context";
import { useActiveTimers } from "./active-timers-context";
import { useAuth } from "./auth-context";
import {
  updateWidgetData,
  type WidgetData,
  type WidgetActivityData,
  type ActiveTimerData,
} from "@/services/widget-data-service";
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
  const { sleeps, activeTimer: sleepTimer, dailyGoalMinutes: sleepGoal } = useSleep();
  const { diapers, getTodaysCounts, getLastDiaper } = useDiaper();
  const { pumpings, activeTimer: pumpingTimer } = usePumping();
  const { measurements } = useGrowth();
  const { tummyTimes, activeTimer: tummyTimeTimer, dailyGoalSeconds: tummyTimeGoalSeconds } = useTummyTime();
  const { locks } = useActiveTimers();
  const { user } = useAuth();

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
        lastTime: lastFeeding?.startedAt || null,
        todayCount: todayFeedings.length,
        lastType: lastFeeding?.type || null,
        lastSide: (lastFeeding?.side as BreastSide) || null,
      },
      sleep: {
        lastTime: lastSleep?.startedAt || null,
        todayMinutes: todaySleepMinutes,
        lastDurationMinutes: lastSleep ? Math.floor((lastSleep.durationSeconds || 0) / 60) : null,
        isActive: sleepTimer?.isRunning || false,
        sleepType: (lastSleep?.type as SleepType) || null,
      },
      diaper: {
        lastTime: lastDiaperEntry?.changedAt || null,
        todayCounts: diaperCounts,
        lastType: (lastDiaperEntry?.type as DiaperType) || null,
      },
      pumping: {
        lastTime: lastPumping?.startedAt || null,
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
        lastTime: lastTummyTime?.startedAt || null,
        todayMinutes: todayTummyTimeMinutes,
        goalMinutes: Math.floor(tummyTimeGoalSeconds / 60),
        lastDurationMinutes: lastTummyTime
          ? Math.floor((lastTummyTime.durationSeconds || 0) / 60)
          : null,
      },
    };

    const activeTimers: WidgetData["activeTimers"] = [];

    if (feedingTimer?.isRunning) {
      activeTimers.push({
        type: "feeding",
        startTime: feedingTimer.startTime.toISOString(),
        context: feedingTimer.side,
      });
    }
    if (sleepTimer?.isRunning) {
      activeTimers.push({
        type: "sleep",
        startTime: sleepTimer.startTime.toISOString(),
        context: sleepTimer.sleepType,
      });
    }
    if (pumpingTimer?.isRunning) {
      activeTimers.push({
        type: "pumping",
        startTime: pumpingTimer.startTime.toISOString(),
        context: pumpingTimer.side,
      });
    }
    if (tummyTimeTimer?.isRunning) {
      activeTimers.push({
        type: "tummyTime",
        startTime: tummyTimeTimer.startTime.toISOString(),
      });
    }

    const remoteLocks = locks.filter(
      (lock) => lock.startedBy !== user?.id && lock.babyId === selectedBaby.id
    );
    for (const lock of remoteLocks) {
      const widgetType = ACTIVITY_TYPE_MAP[lock.activityType];
      if (widgetType) {
        activeTimers.push({
          type: widgetType,
          startTime: lock.startedAt,
          context: lock.startedByName,
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
    diapers,
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

    const dataHash = JSON.stringify({
      babyId: widgetData.babyId,
      activities: widgetData.activities,
      activeTimer: widgetData.activeTimer,
      activeTimers: widgetData.activeTimers,
    });

    if (dataHash === lastUpdateRef.current) {
      return;
    }

    lastUpdateRef.current = dataHash;

    try {
      await updateWidgetData(widgetData);
    } catch (error) {
      console.error("[WidgetContext] Failed to update widget data:", error);
    }
  }, [buildWidgetData]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!selectedBaby) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      refreshWidgetData();
    }, 500);

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
    diapers,
    pumpings,
    pumpingTimer,
    measurements,
    tummyTimes,
    tummyTimeTimer,
    locks,
    refreshWidgetData,
  ]);

  const getWidgetDataJson = useCallback((): string | null => {
    const data = buildWidgetData();
    if (!data) return null;
    return JSON.stringify(data);
  }, [buildWidgetData]);

  const value: WidgetContextValue = {
    refreshWidgetData,
    getWidgetDataJson,
  };

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
