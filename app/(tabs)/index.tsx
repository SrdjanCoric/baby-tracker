import { useTranslation } from "react-i18next";
import { AppState, RefreshControl, ScrollView, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "nativewind";
import { getActionColor } from "@/constants/design-tokens";
import { useTimeRefresh } from "@/hooks";

const isAndroid = Platform.OS === "android";
import {
  BabyHeader,
  DashboardCard,
} from "@/components";
import { useFeeding, useSleep, useDiaper, usePumping, useGrowth, useTummyTime, useMilestones, useDashboardConfig, useActiveTimers, useBaby, useAuth } from "@/contexts";
import { Alert } from "react-native";
import { timeSince, formatDate, hoursSince, formatDuration } from "@/utils/time";
import { getGrowthTrendArrow } from "@/utils/growth-helpers";
import { ActivityType } from "@/constants/activities";
import { DashboardCardConfig } from "@/services/dashboard-config-storage";
import { isUnderTwoMonths } from "@/utils/sleepGoals";
import { getCurrentAgeGroupKey, AGE_GROUPS } from "@/constants/milestones";

interface CardProps {
  label: string;
  timeSince: string;
  subtitle?: string;
  secondaryInfo?: string;
  isActive: boolean;
  activeLabel?: string;
  onPress: () => void;
  onActionPress: () => void;
  onPausePress?: () => void;
  isPaused?: boolean;
  actionLabel?: string;
  progress?: number;
  isLockedByOther?: boolean;
  lockedByName?: string;
  lockedElapsedTime?: string;
  babyName?: string;
  isPausedByOther?: boolean;
  todayBadge?: string;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { visibleCards } = useDashboardConfig();
  const timeTick = useTimeRefresh(60000);

  // Navigate safely - if a modal is open, dismiss it first then navigate
  const safeNavigate = useCallback((path: string) => {
    if (isFocused) {
      router.push(path as Parameters<typeof router.push>[0]);
    } else {
      // Modal is open - dismiss it and navigate to new destination
      router.dismissAll();
      // Small delay to let dismissal complete
      setTimeout(() => {
        router.push(path as Parameters<typeof router.push>[0]);
      }, 50);
    }
  }, [isFocused, router]);

  const { feedings, activeTimer: feedingActiveTimer, getLastFeeding, suggestedSide, refreshFeedings, stopBreastfeeding, pauseBreastfeeding, resumeBreastfeeding } = useFeeding();
  const { sleeps, activeTimer: sleepActiveTimer, getLastSleep, getTodaysTotalSleepMinutes, dailyGoalMinutes, getDailyProgress: getSleepDailyProgress, refreshSleeps, stopSleep, pauseSleep, resumeSleep, wakeWindowConfig, getCurrentNapSlot, getCompletedNapsSinceNightSleep } = useSleep();
  const { diapers, getTodaysCounts, refreshDiapers } = useDiaper();
  const { pumpings, activeTimer: pumpingActiveTimer, getLastPumping, getTodaysTotalVolume, getLastSide, refreshPumpings, pausePumping, resumePumping } = usePumping();
  const { measurements, getMeasurementHistory, getWeightChange, refreshMeasurements } = useGrowth();
  const { tummyTimes, activeTimer: tummyTimeActiveTimer, getDailyProgress: getTummyTimeDailyProgress, getTodaysTotalSeconds, getTodaysSessionCount, dailyGoalSeconds, refreshTummyTimes, stopTummyTime, pauseTummyTime, resumeTummyTime } = useTummyTime();
  const { getYesCountForAge, getNotSureCountForAge, getTotalCountForAge, isAgeCompleted, getStarsEarned, getCurrentAgeGroup, responses: milestoneResponses, refreshResponses: refreshMilestones } = useMilestones();
  const { colorScheme } = useColorScheme();
  const { selectedBaby } = useBaby();
  const { session } = useAuth();
  const { isLockedByOther, getLockedByName, getLockForActivity, refreshLocks } = useActiveTimers();
  const isAuthenticated = !!session?.access_token;

  const [refreshing, setRefreshing] = useState(false);
  const [timerTick, setTimerTick] = useState(0);

  const hasActiveTimer = feedingActiveTimer?.isRunning || sleepActiveTimer?.isRunning || pumpingActiveTimer?.isRunning || tummyTimeActiveTimer?.isRunning;

  useEffect(() => {
    if (!hasActiveTimer) return;

    const interval = setInterval(() => {
      setTimerTick(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [hasActiveTimer]);

  useEffect(() => {
    if (isFocused) {
      refreshLocks();
    }
  }, [isFocused, refreshLocks]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        setRefreshing(false);
      }
    });
    return () => subscription.remove();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.race([
        Promise.all([
          refreshFeedings(),
          refreshSleeps(),
          refreshDiapers(),
          refreshPumpings(),
          refreshMeasurements(),
          refreshTummyTimes(),
          refreshMilestones(),
          refreshLocks(),
        ]),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFeedings, refreshSleeps, refreshDiapers, refreshPumpings, refreshMeasurements, refreshTummyTimes, refreshMilestones, refreshLocks]);

  const feedingElapsedTime = useMemo(() => {
    if (!feedingActiveTimer?.isRunning) return null;
    void timerTick;
    let elapsed: number;
    if (feedingActiveTimer.isPaused && feedingActiveTimer.pausedAt) {
      elapsed = Math.floor(
        (feedingActiveTimer.pausedAt.getTime() - feedingActiveTimer.startTime.getTime() - feedingActiveTimer.totalPausedMs) / 1000
      );
    } else {
      elapsed = Math.floor(
        (Date.now() - feedingActiveTimer.startTime.getTime() - (feedingActiveTimer.totalPausedMs ?? 0)) / 1000
      );
    }
    return formatDuration(elapsed, "long");
  }, [feedingActiveTimer, timerTick]);

  const feedingActiveLabel = useMemo(() => {
    if (!feedingActiveTimer?.isRunning) return undefined;
    const side = feedingActiveTimer.side;
    if (side === "left") return t("feeding.leftSide");
    if (side === "right") return t("feeding.rightSide");
    return t("feeding.bothSides");
  }, [feedingActiveTimer, t]);

  const feedingTimeSince = useMemo(() => {
    if (feedingActiveTimer?.isRunning) {
      return feedingElapsedTime ?? t("common.now");
    }
    const lastFeeding = getLastFeeding();
    if (!lastFeeding) {
      return "--";
    }

    const timeAgo = t("dashboard.last", { time: timeSince(new Date(lastFeeding.startedAt)) });
    const typeIcon = lastFeeding.type === "breast" ? "🤱" : lastFeeding.type === "bottle" ? "🍼" : "🥣";

    return `${typeIcon} ${timeAgo}`;
  }, [feedingActiveTimer, feedingElapsedTime, getLastFeeding, t, timeTick, feedings]);

  const feedingSubtitle = useMemo(() => {
    if (feedingActiveTimer?.isRunning) return undefined;

    const lastFeeding = getLastFeeding();
    if (!lastFeeding) return undefined;

    const parts: string[] = [];

    // Add duration/quantity as first part
    const L = t("feeding.leftShort");
    const R = t("feeding.rightShort");

    if (lastFeeding.type === "breast") {
      // Show L/R breakdown if both sides were used
      if (lastFeeding.leftDurationSeconds && lastFeeding.rightDurationSeconds) {
        const leftTime = formatDuration(lastFeeding.leftDurationSeconds, "short");
        const rightTime = formatDuration(lastFeeding.rightDurationSeconds, "short");
        parts.push(`${L} ${leftTime} ${R} ${rightTime}`);
      } else if (lastFeeding.leftDurationSeconds) {
        parts.push(`${L} ${formatDuration(lastFeeding.leftDurationSeconds, "short")}`);
      } else if (lastFeeding.rightDurationSeconds) {
        parts.push(`${R} ${formatDuration(lastFeeding.rightDurationSeconds, "short")}`);
      } else if (lastFeeding.durationSeconds) {
        parts.push(formatDuration(lastFeeding.durationSeconds, "short"));
      }
    } else if (lastFeeding.type === "bottle" && lastFeeding.amountMl) {
      parts.push(`${lastFeeding.amountMl}ml`);
    }

    // Add contextual info based on type
    if (lastFeeding.type === "breast") {
      if (hoursSince(new Date(lastFeeding.startedAt)) <= 24) {
        const nextSide = suggestedSide === "left" ? L : R;
        parts.push(`${t("feeding.nextBreast")}: ${nextSide}`);
      }
    } else if (lastFeeding.type === "bottle" && lastFeeding.contentType) {
      parts.push(t(`feeding.${lastFeeding.contentType}`));
    } else if (lastFeeding.type === "solid") {
      if (lastFeeding.foodType) {
        parts.push(lastFeeding.foodType);
      }
      if (lastFeeding.reaction) {
        const reactionEmoji = lastFeeding.reaction === "loved" ? "😋" : lastFeeding.reaction === "meh" ? "😐" : "😣";
        parts.push(reactionEmoji);
      }
    }

    return parts.length > 0 ? parts.join(" · ") : undefined;
  }, [feedingActiveTimer?.isRunning, getLastFeeding, suggestedSide, t, timeTick, feedings]);


  const isFeedingActive = feedingActiveTimer?.isRunning ?? false;

  const sleepElapsedTime = useMemo(() => {
    if (!sleepActiveTimer?.isRunning) return null;
    void timerTick;
    let elapsed: number;
    if (sleepActiveTimer.isPaused && sleepActiveTimer.pausedAt) {
      elapsed = Math.floor(
        (sleepActiveTimer.pausedAt.getTime() - sleepActiveTimer.startTime.getTime() - sleepActiveTimer.totalPausedMs) / 1000
      );
    } else {
      elapsed = Math.floor(
        (Date.now() - sleepActiveTimer.startTime.getTime() - (sleepActiveTimer.totalPausedMs ?? 0)) / 1000
      );
    }
    return formatDuration(elapsed, "long");
  }, [sleepActiveTimer, timerTick]);

  const sleepTimeSince = useMemo(() => {
    if (sleepActiveTimer?.isRunning) {
      return sleepElapsedTime ?? t("common.now");
    }

    const totalMinutes = getTodaysTotalSleepMinutes();
    const goalHours = Math.round(dailyGoalMinutes / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;

    let progress: string;
    if (totalMinutes === 0) {
      progress = t("dashboard.goalProgress", { current: 0, goal: goalHours });
    } else if (remainingMins > 0) {
      progress = t("dashboard.goalProgressWithMinutes", { hours: totalHours, minutes: remainingMins, goal: goalHours });
    } else {
      progress = t("dashboard.goalProgress", { current: totalHours, goal: goalHours });
    }

    return progress;
  }, [sleepActiveTimer, sleepElapsedTime, getTodaysTotalSleepMinutes, dailyGoalMinutes, t, sleeps]);

  const sleepSecondaryInfo = useMemo(() => {
    if (sleepActiveTimer?.isRunning) return undefined;
    const lastSleep = getLastSleep();

    if (!lastSleep?.endedAt) return undefined;

    const awakeText = t("dashboard.awake", { time: timeSince(new Date(lastSleep.endedAt)), context: selectedBaby?.gender });

    if (!wakeWindowConfig || wakeWindowConfig.slots.length === 0) {
      return awakeText;
    }

    const currentSlot = getCurrentNapSlot();
    if (!currentSlot) return awakeText;

    const endedAt = new Date(lastSleep.endedAt);
    const awakeMs = Date.now() - endedAt.getTime();
    const windowMs = currentSlot.durationMinutes * 60000;
    const remainingMs = windowMs - awakeMs;
    const remainingMinutes = Math.floor(remainingMs / 60000);
    const isBedtime = currentSlot.label === "bedtime" && !isUnderTwoMonths(selectedBaby?.birthDate);

    if (remainingMinutes <= 0) {
      return `${awakeText}\n${isBedtime ? t("dashboard.bedtimeNow") : t("dashboard.napTimeNow")}`;
    }

    if (remainingMinutes >= 60) {
      const h = Math.floor(remainingMinutes / 60);
      const m = remainingMinutes % 60;
      const timeStr = m > 0 ? `${h}h ${m}m` : `${h}h`;
      return `${awakeText}\n${isBedtime ? t("dashboard.bedtimeIn", { time: timeStr }) : t("dashboard.napIn", { time: timeStr })}`;
    }

    return `${awakeText}\n${isBedtime ? t("dashboard.bedtimeIn", { time: `${remainingMinutes}m` }) : t("dashboard.napIn", { time: `${remainingMinutes}m` })}`;
  }, [sleepActiveTimer, getLastSleep, t, timeTick, selectedBaby?.gender, selectedBaby?.birthDate, wakeWindowConfig, getCurrentNapSlot, sleeps]);

  const isSleepActive = sleepActiveTimer?.isRunning ?? false;

  const diaperTimeSince = useMemo(() => {
    if (diapers.length === 0) return "--";

    // Find the last diaper - primary display is just the type
    const sortedDiapers = [...diapers].sort((a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );

    const lastDiaper = sortedDiapers[0];
    if (!lastDiaper) return "--";

    return t(`diaper.${lastDiaper.type}`);
  }, [diapers, t]);

  const diaperSubtitle = useMemo(() => {
    if (diapers.length === 0) return undefined;

    // Find last diaper for time since
    const sortedDiapers = [...diapers].sort((a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
    const lastDiaper = sortedDiapers[0];
    if (!lastDiaper) return undefined;

    // Show time since last change
    return t("dashboard.last", { time: timeSince(new Date(lastDiaper.changedAt)) });
  }, [diapers, t, timeTick]);

  const todayDiaperCounts = useMemo(() => {
    return getTodaysCounts();
  }, [getTodaysCounts, diapers]);

  const pumpingElapsedTime = useMemo(() => {
    if (!pumpingActiveTimer?.isRunning) return null;
    void timerTick;
    let elapsed: number;
    if (pumpingActiveTimer.isPaused && pumpingActiveTimer.pausedAt) {
      elapsed = Math.floor(
        (pumpingActiveTimer.pausedAt.getTime() - pumpingActiveTimer.startTime.getTime() - pumpingActiveTimer.totalPausedMs) / 1000
      );
    } else {
      elapsed = Math.floor(
        (Date.now() - pumpingActiveTimer.startTime.getTime() - (pumpingActiveTimer.totalPausedMs ?? 0)) / 1000
      );
    }
    return formatDuration(elapsed, "long");
  }, [pumpingActiveTimer, timerTick]);

  const pumpingTimeSince = useMemo(() => {
    if (pumpingActiveTimer?.isRunning) {
      return pumpingElapsedTime ?? t("common.now");
    }

    // Show daily total as primary (most important for supply tracking)
    const todayVolume = getTodaysTotalVolume();
    if (todayVolume > 0) {
      return `${todayVolume}ml ${t("common.today").toLowerCase()}`;
    }
    return "--";
  }, [pumpingActiveTimer, pumpingElapsedTime, getTodaysTotalVolume, t, pumpings]);

  const pumpingSubtitle = useMemo(() => {
    if (pumpingActiveTimer?.isRunning) return undefined;

    const lastPumping = getLastPumping();
    const lastSide = getLastSide();

    if (!lastPumping) return undefined;

    const timeAgo = t("dashboard.last", { time: timeSince(new Date(lastPumping.startedAt)) });
    const parts: string[] = [timeAgo];

    if (lastSide) {
      parts.push(lastSide === "left" ? t("feeding.left") : lastSide === "right" ? t("feeding.right") : t("feeding.both"));
    }

    return parts.join(" · ");
  }, [pumpingActiveTimer, getLastPumping, getLastSide, t, timeTick, pumpings]);

  const isPumpingActive = pumpingActiveTimer?.isRunning ?? false;

  const growthTimeSince = useMemo(() => {
    const history = getMeasurementHistory();
    const withWeight = history.filter((m) => m.weightKg != null);

    if (withWeight.length === 0) return "--";

    const latest = withWeight[0];
    const weight = Number(latest.weightKg);
    return `${weight.toFixed(1)}kg`;
  }, [getMeasurementHistory, measurements]);

  const growthSubtitle = useMemo(() => {
    const history = getMeasurementHistory();
    const withWeight = history.filter((m) => m.weightKg != null);
    const weightChange = getWeightChange();

    if (withWeight.length === 0) return undefined;

    const latestWeight = withWeight[0];
    const measuredDate = new Date(latestWeight.measuredAt);
    const now = new Date();
    const diffMs = now.getTime() - measuredDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let timeAgo: string;
    if (diffDays === 0) {
      timeAgo = t("common.today").toLowerCase();
    } else if (diffDays === 1) {
      timeAgo = t("common.yesterday").toLowerCase();
    } else {
      timeAgo = t("dashboard.daysAgo", { days: diffDays });
    }

    if (weightChange?.hasPrevious) {
      const arrow = getGrowthTrendArrow(weightChange.change);
      if (weightChange.change === 0) {
        return `${arrow} ${t("growth.stable")} · ${timeAgo}`;
      }
      const sign = weightChange.change > 0 ? "+" : "";
      return `${arrow} ${sign}${weightChange.change}g · ${timeAgo}`;
    }

    return timeAgo;
  }, [getMeasurementHistory, getWeightChange, t, timeTick, measurements]);

  const tummyTimeElapsedTime = useMemo(() => {
    if (!tummyTimeActiveTimer?.isRunning) return null;
    void timerTick;
    let elapsed: number;
    if (tummyTimeActiveTimer.isPaused && tummyTimeActiveTimer.pausedAt) {
      elapsed = Math.floor(
        (tummyTimeActiveTimer.pausedAt.getTime() - tummyTimeActiveTimer.startTime.getTime() - tummyTimeActiveTimer.totalPausedMs) / 1000
      );
    } else {
      elapsed = Math.floor(
        (Date.now() - tummyTimeActiveTimer.startTime.getTime() - (tummyTimeActiveTimer.totalPausedMs ?? 0)) / 1000
      );
    }
    return formatDuration(elapsed, "long");
  }, [tummyTimeActiveTimer, timerTick]);

  const tummyTimeTimeSince = useMemo(() => {
    if (tummyTimeActiveTimer?.isRunning) {
      return tummyTimeElapsedTime ?? t("common.now");
    }

    const totalSeconds = getTodaysTotalSeconds();
    const goalMinutes = Math.round(dailyGoalSeconds / 60);
    const totalMinutes = Math.round(totalSeconds / 60);

    return t("dashboard.minuteProgress", { current: totalMinutes, goal: goalMinutes });
  }, [tummyTimeActiveTimer, tummyTimeElapsedTime, getTodaysTotalSeconds, dailyGoalSeconds, t, tummyTimes]);

  const tummyTimeSecondaryInfo = useMemo(() => {
    if (tummyTimeActiveTimer?.isRunning) return undefined;

    const sessionCount = getTodaysSessionCount();

    if (sessionCount > 0) {
      return t("dashboard.session", { count: sessionCount });
    }

    return undefined;
  }, [tummyTimeActiveTimer, getTodaysSessionCount, t, tummyTimes]);

  const isTummyTimeActive = tummyTimeActiveTimer?.isRunning ?? false;

  const tummyTimeProgress = useMemo(() => {
    return getTummyTimeDailyProgress();
  }, [getTummyTimeDailyProgress, tummyTimes]);

  const sleepProgress = useMemo(() => {
    return getSleepDailyProgress();
  }, [getSleepDailyProgress, sleeps]);

  const handleAddFeeding = useCallback(() => {
    safeNavigate("/feeding");
  }, [safeNavigate]);

  const handleFeedingCardPress = useCallback(() => {
    safeNavigate("/feeding");
  }, [safeNavigate]);

  const handleAddSleep = useCallback(() => {
    safeNavigate("/sleep");
  }, [safeNavigate]);

  const handleSleepCardPress = useCallback(() => {
    safeNavigate("/sleep");
  }, [safeNavigate]);

  const handleAddDiaper = useCallback(() => {
    safeNavigate("/diaper");
  }, [safeNavigate]);

  const handleDiaperCardPress = useCallback(() => {
    safeNavigate("/diaper");
  }, [safeNavigate]);

  const handleAddGrowth = useCallback(() => {
    safeNavigate("/growth");
  }, [safeNavigate]);

  const handleGrowthCardPress = useCallback(() => {
    safeNavigate("/growth");
  }, [safeNavigate]);

  const handleAddPumping = useCallback(() => {
    safeNavigate("/pumping");
  }, [safeNavigate]);

  const handlePumpingCardPress = useCallback(() => {
    safeNavigate("/pumping");
  }, [safeNavigate]);

  const handleStopPumping = useCallback(() => {
    safeNavigate("/pumping?showVolumeInput=true");
  }, [safeNavigate]);

  const handleAddTummyTime = useCallback(() => {
    safeNavigate("/tummyTime");
  }, [safeNavigate]);

  const handleTummyTimeCardPress = useCallback(() => {
    safeNavigate("/tummyTime");
  }, [safeNavigate]);

  const handleMilestonesPress = useCallback(() => {
    safeNavigate("/milestones");
  }, [safeNavigate]);

  const isStoppingFeedingRef = useRef(false);
  const handleStopFeeding = useCallback(async () => {
    if (isStoppingFeedingRef.current) return;
    isStoppingFeedingRef.current = true;
    try {
      await stopBreastfeeding();
    } catch (error) {
      console.error("[HomeScreen] Failed to stop feeding:", error);
      Alert.alert(t("common.error"), t("feeding.stopError"));
    } finally {
      isStoppingFeedingRef.current = false;
    }
  }, [stopBreastfeeding, t]);

  const isStoppingSleepRef = useRef(false);
  const handleStopSleep = useCallback(async () => {
    if (isStoppingSleepRef.current) return;
    isStoppingSleepRef.current = true;
    try {
      await stopSleep();
    } catch (error) {
      console.error("[HomeScreen] Failed to stop sleep:", error);
      Alert.alert(t("common.error"), t("sleep.stopError"));
    } finally {
      isStoppingSleepRef.current = false;
    }
  }, [stopSleep, t]);

  const isStoppingTummyTimeRef = useRef(false);
  const handleStopTummyTime = useCallback(async () => {
    if (isStoppingTummyTimeRef.current) return;
    isStoppingTummyTimeRef.current = true;
    try {
      await stopTummyTime();
    } catch (error) {
      console.error("[HomeScreen] Failed to stop tummy time:", error);
      Alert.alert(t("common.error"), t("tummyTime.stopError"));
    } finally {
      isStoppingTummyTimeRef.current = false;
    }
  }, [stopTummyTime, t]);

  const handleTogglePauseFeeding = useCallback(async () => {
    if (feedingActiveTimer?.isPaused) {
      await resumeBreastfeeding();
    } else {
      await pauseBreastfeeding();
    }
  }, [feedingActiveTimer?.isPaused, pauseBreastfeeding, resumeBreastfeeding]);

  const handleTogglePauseSleep = useCallback(async () => {
    if (sleepActiveTimer?.isPaused) {
      await resumeSleep();
    } else {
      await pauseSleep();
    }
  }, [sleepActiveTimer?.isPaused, pauseSleep, resumeSleep]);

  const handleTogglePausePumping = useCallback(async () => {
    if (pumpingActiveTimer?.isPaused) {
      await resumePumping();
    } else {
      await pausePumping();
    }
  }, [pumpingActiveTimer?.isPaused, pausePumping, resumePumping]);

  const handleTogglePauseTummyTime = useCallback(async () => {
    if (tummyTimeActiveTimer?.isPaused) {
      await resumeTummyTime();
    } else {
      await pauseTummyTime();
    }
  }, [tummyTimeActiveTimer?.isPaused, pauseTummyTime, resumeTummyTime]);

  const handleSettingsPress = useCallback(() => {
    safeNavigate("/settings");
  }, [safeNavigate]);

  const getTimerLockInfo = useCallback((activityType: "feeding" | "sleep" | "pumping" | "tummy_time") => {
    if (!selectedBaby?.id) return { isLocked: false };

    const locked = isLockedByOther(selectedBaby.id, activityType);
    if (!locked) return { isLocked: false };

    const lockedByName = getLockedByName(selectedBaby.id, activityType);
    const lock = getLockForActivity(selectedBaby.id, activityType);

    let elapsedTime: string | undefined;
    if (lock?.startedAt) {
      elapsedTime = timeSince(new Date(lock.startedAt));
    }

    const isPausedByOther = lock?.timerData?.isPaused === true;

    return {
      isLocked: true,
      lockedByName: lockedByName || undefined,
      elapsedTime,
      isPausedByOther,
    };
  }, [selectedBaby?.id, isLockedByOther, getLockedByName, getLockForActivity]);

  const feedingCardProps = useMemo((): CardProps => {
    const feedingLock = getTimerLockInfo("feeding");
    return {
      label: t("feeding.title"),
      timeSince: feedingTimeSince,
      subtitle: feedingSubtitle,
      isActive: isFeedingActive,
      activeLabel: feedingActiveLabel,
      onPress: handleFeedingCardPress,
      onActionPress: isFeedingActive ? handleStopFeeding : handleAddFeeding,
      onPausePress: isFeedingActive && isAuthenticated ? handleTogglePauseFeeding : undefined,
      isPaused: feedingActiveTimer?.isPaused,
      actionLabel: isFeedingActive ? undefined : "+",
      isLockedByOther: feedingLock.isLocked,
      lockedByName: feedingLock.lockedByName,
      lockedElapsedTime: feedingLock.elapsedTime,
      babyName: selectedBaby?.name,
      isPausedByOther: feedingLock.isPausedByOther,
    };
  }, [t, feedingTimeSince, feedingSubtitle, isFeedingActive, feedingActiveLabel, feedingActiveTimer?.isPaused, handleFeedingCardPress, handleAddFeeding, handleStopFeeding, handleTogglePauseFeeding, isAuthenticated, getTimerLockInfo, selectedBaby?.name]);

  const sleepCardProps = useMemo((): CardProps => {
    const sleepLock = getTimerLockInfo("sleep");
    return {
      label: t("sleep.title"),
      timeSince: sleepTimeSince,
      secondaryInfo: sleepSecondaryInfo,
      isActive: isSleepActive,
      activeLabel: t("sleep.sleeping"),
      onPress: handleSleepCardPress,
      onActionPress: isSleepActive ? handleStopSleep : handleAddSleep,
      onPausePress: isSleepActive && isAuthenticated ? handleTogglePauseSleep : undefined,
      isPaused: sleepActiveTimer?.isPaused,
      actionLabel: isSleepActive ? undefined : "+",
      progress: sleepProgress,
      isLockedByOther: sleepLock.isLocked,
      lockedByName: sleepLock.lockedByName,
      lockedElapsedTime: sleepLock.elapsedTime,
      babyName: selectedBaby?.name,
      isPausedByOther: sleepLock.isPausedByOther,
    };
  }, [t, sleepTimeSince, sleepSecondaryInfo, isSleepActive, sleepActiveTimer?.isPaused, sleepProgress, handleSleepCardPress, handleAddSleep, handleStopSleep, handleTogglePauseSleep, isAuthenticated, getTimerLockInfo, selectedBaby?.name]);

  const diaperCardProps = useMemo((): CardProps => {
    const wetCount = todayDiaperCounts.wet + todayDiaperCounts.mixed;
    return {
      label: t("diaper.title"),
      timeSince: diaperTimeSince,
      subtitle: diaperSubtitle,
      isActive: false,
      onPress: handleDiaperCardPress,
      onActionPress: handleAddDiaper,
      actionLabel: "+",
      todayBadge: `${wetCount}\u{1F4A7} ${t("common.today").toLowerCase()}`,
    };
  }, [t, diaperTimeSince, diaperSubtitle, handleDiaperCardPress, handleAddDiaper, todayDiaperCounts]);

  const pumpingCardProps = useMemo((): CardProps => {
    const pumpingLock = getTimerLockInfo("pumping");
    return {
      label: t("pumping.title"),
      timeSince: pumpingTimeSince,
      subtitle: pumpingSubtitle,
      isActive: isPumpingActive,
      activeLabel: t("pumping.pumping"),
      onPress: handlePumpingCardPress,
      onActionPress: isPumpingActive ? handleStopPumping : handleAddPumping,
      onPausePress: isPumpingActive && isAuthenticated ? handleTogglePausePumping : undefined,
      isPaused: pumpingActiveTimer?.isPaused,
      actionLabel: isPumpingActive ? undefined : "+",
      isLockedByOther: pumpingLock.isLocked,
      lockedByName: pumpingLock.lockedByName,
      lockedElapsedTime: pumpingLock.elapsedTime,
      babyName: selectedBaby?.name,
      isPausedByOther: pumpingLock.isPausedByOther,
    };
  }, [t, pumpingTimeSince, pumpingSubtitle, isPumpingActive, pumpingActiveTimer?.isPaused, handlePumpingCardPress, handleAddPumping, handleStopPumping, handleTogglePausePumping, isAuthenticated, getTimerLockInfo, selectedBaby?.name]);

  const tummyTimeCardProps = useMemo((): CardProps => {
    const tummyTimeLock = getTimerLockInfo("tummy_time");
    return {
      label: t("tummyTime.title"),
      timeSince: tummyTimeTimeSince,
      secondaryInfo: tummyTimeSecondaryInfo,
      isActive: isTummyTimeActive,
      activeLabel: t("tummyTime.inProgress"),
      onPress: handleTummyTimeCardPress,
      onActionPress: isTummyTimeActive ? handleStopTummyTime : handleAddTummyTime,
      onPausePress: isTummyTimeActive && isAuthenticated ? handleTogglePauseTummyTime : undefined,
      isPaused: tummyTimeActiveTimer?.isPaused,
      actionLabel: isTummyTimeActive ? undefined : "+",
      progress: tummyTimeProgress,
      isLockedByOther: tummyTimeLock.isLocked,
      babyName: selectedBaby?.name,
      lockedByName: tummyTimeLock.lockedByName,
      lockedElapsedTime: tummyTimeLock.elapsedTime,
      isPausedByOther: tummyTimeLock.isPausedByOther,
    };
  }, [t, tummyTimeTimeSince, tummyTimeSecondaryInfo, isTummyTimeActive, tummyTimeActiveTimer?.isPaused, tummyTimeProgress, handleTummyTimeCardPress, handleAddTummyTime, handleStopTummyTime, handleTogglePauseTummyTime, isAuthenticated, getTimerLockInfo, selectedBaby?.name]);

  const growthCardProps = useMemo((): CardProps => {
    return {
      label: t("growth.title"),
      timeSince: growthTimeSince,
      subtitle: growthSubtitle,
      isActive: false,
      onPress: handleGrowthCardPress,
      onActionPress: handleAddGrowth,
      actionLabel: "+",
    };
  }, [t, growthTimeSince, growthSubtitle, handleGrowthCardPress, handleAddGrowth]);

  const milestonesCardProps = useMemo((): CardProps => {
    const currentAgeGroup = getCurrentAgeGroup();
    const ageGroup = currentAgeGroup ?? AGE_GROUPS[0];
    const ageKey = ageGroup.key;
    const yesCount = getYesCountForAge(ageKey);
    const notSureCount = getNotSureCountForAge(ageKey);
    const total = getTotalCountForAge(ageKey);
    const stars = getStarsEarned();
    const allDone = isAgeCompleted(ageKey);
    const starPrefix = stars > 0 ? "\u2605".repeat(stars) + " " : "";
    const progress = total > 0 ? Math.round((yesCount / total) * 100) : 0;

    let subtitle: string;
    if (allDone) {
      subtitle = t("milestones.allDone");
    } else {
      subtitle = t("milestones.progress", { yes: yesCount, total });
      if (notSureCount > 0) {
        subtitle += " \u00B7 " + t("milestones.notSureCount", { count: notSureCount });
      }
    }

    return {
      label: t("milestones.title"),
      timeSince: `${starPrefix}${t(`milestones.age.${ageGroup.key}` as never)}`,
      subtitle,
      isActive: false,
      onPress: handleMilestonesPress,
      onActionPress: handleMilestonesPress,
      actionLabel: "+",
      progress,
    };
  }, [t, getCurrentAgeGroup, getYesCountForAge, getNotSureCountForAge, getTotalCountForAge, getStarsEarned, isAgeCompleted, handleMilestonesPress, milestoneResponses]);

  const cardPropsMap = useMemo((): Record<ActivityType, CardProps> => ({
    feeding: feedingCardProps,
    sleep: sleepCardProps,
    diaper: diaperCardProps,
    pumping: pumpingCardProps,
    tummyTime: tummyTimeCardProps,
    growth: growthCardProps,
    milestones: milestonesCardProps,
  }), [feedingCardProps, sleepCardProps, diaperCardProps, pumpingCardProps, tummyTimeCardProps, growthCardProps, milestonesCardProps]);

  const cardRows = useMemo(() => {
    const rows: DashboardCardConfig[][] = [];
    for (let i = 0; i < visibleCards.length; i += 2) {
      rows.push(visibleCards.slice(i, i + 2));
    }
    return rows;
  }, [visibleCards]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top"]} testID="home-screen">
      <BabyHeader onSettingsPress={handleSettingsPress} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: isAndroid ? 12 : 16,
          paddingTop: isAndroid ? 8 : 0,
          paddingBottom: isAndroid ? 16 : 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isAndroid ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={getActionColor("primary", colorScheme === "dark")}
              colors={[getActionColor("primary", colorScheme === "dark")]}
            />
          )
        }
      >
        <View className={isAndroid ? "gap-2.5" : "gap-3"}>
          {cardRows.map((row, rowIndex) => (
            <View key={rowIndex} className={`flex-row ${isAndroid ? "gap-2.5" : "gap-3"}`}>
              {row.length === 1 && <View style={{ flex: 0.5 }} />}
              {row.map((cardConfig) => {
                const props = cardPropsMap[cardConfig.activity];
                return (
                  <DashboardCard
                    key={cardConfig.activity}
                    activity={cardConfig.activity}
                    testID={`${cardConfig.activity}-card`}
                    {...props}
                  />
                );
              })}
              {row.length === 1 && <View style={{ flex: 0.5 }} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
