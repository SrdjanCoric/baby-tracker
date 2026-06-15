import { useTranslation } from "react-i18next";
import { AppState, RefreshControl, ScrollView, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "nativewind";
import { getActionColor } from "@/constants/design-tokens";
import { useTimeRefresh, useBirthdayCelebration } from "@/hooks";

const isAndroid = Platform.OS === "android";
import {
  BabyHeader,
  DashboardCard,
  CompactActivityRow,
  SleepPredictionCard,
  BirthdayCelebrationModal,
} from "@/components";
import { MilestoneCelebrationModal } from "@/components/MilestoneCelebrationModal";
import { MilestoneToast } from "@/components/MilestoneToast";
import { useAchievements } from "@/contexts/achievement-context";
import { TipCarousel } from "@/components/TipCarousel";
import { useFeeding, useSleep, useDiaper, usePumping, useGrowth, useTummyTime, useMilestones, useHealth, useActiveTimers, useBaby, useAuth, useUnits, useDashboardConfig } from "@/contexts";
import { getDashboardLayout } from "@/utils/dashboard-layout";
import { Alert } from "react-native";
import { timeSince, hoursSince, formatDuration, formatDurationShort, type TranslateFn } from "@/utils/time";
import { getGrowthTrendArrow } from "@/utils/growth-helpers";
import { formatTemperature, getFeverStatus } from "@/utils/temperature";
import { getHealthDisplayName } from "@/utils/health-display";
import { formatVolume } from "@/utils/volume";
import { ActivityType } from "@/constants/activities";
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
  timerStartTime?: number;
  timerPausedAt?: number;
  timerTotalPausedMs?: number;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const tFn = t as TranslateFn;
  const router = useRouter();
  const isFocused = useIsFocused();
  const timeTick = useTimeRefresh(60000);

  const safeNavigate = useCallback((path: string) => {
    if (isFocused) {
      router.push(path as Parameters<typeof router.push>[0]);
    } else {
      router.dismissAll();
      setTimeout(() => {
        router.push(path as Parameters<typeof router.push>[0]);
      }, 50);
    }
  }, [isFocused, router]);

  const { config: dashboardConfig } = useDashboardConfig();
  const { feedings, activeTimer: feedingActiveTimer, getLastFeeding, suggestedSide, refreshFeedings, stopBreastfeeding, pauseBreastfeeding, resumeBreastfeeding } = useFeeding();
  const { sleeps, activeTimer: sleepActiveTimer, getLastSleep, getTodaysTotalSleepMinutes, dailyGoalMinutes, getDailyProgress: getSleepDailyProgress, refreshSleeps, stopSleep, pauseSleep, resumeSleep, wakeWindowConfig, getCurrentNapSlot, getCompletedNapsSinceNightSleep } = useSleep();
  const { diapers, getTodaysCounts, refreshDiapers } = useDiaper();
  const { pumpings, activeTimer: pumpingActiveTimer, getLastPumping, getTodaysTotalVolume, getLastSide, refreshPumpings, pausePumping, resumePumping } = usePumping();
  const { measurements, getMeasurementHistory, getWeightChange, refreshMeasurements } = useGrowth();
  const { tummyTimes, activeTimer: tummyTimeActiveTimer, getDailyProgress: getTummyTimeDailyProgress, getTodaysTotalSeconds, getTodaysSessionCount, dailyGoalSeconds, refreshTummyTimes, stopTummyTime, pauseTummyTime, resumeTummyTime } = useTummyTime();
  const { getYesCountForAge, getNotSureCountForAge, getTotalCountForAge, isAgeCompleted, getStarsEarned, getCurrentAgeGroup, responses: milestoneResponses, refreshResponses: refreshMilestones } = useMilestones();
  const { healthEntries, getLastHealth, refreshHealth } = useHealth();
  const { temperatureUnit, volumeUnit } = useUnits();
  const { colorScheme } = useColorScheme();
  const { selectedBaby, isLoading: isBabyLoading } = useBaby();
  const { session } = useAuth();
  const { isLockedByOther, getLockedByName, getLockForActivity, refreshLocks } = useActiveTimers();
  const isAuthenticated = !!session?.access_token;

  const { showCelebration, milestoneAge, dismiss: dismissCelebration } = useBirthdayCelebration(selectedBaby);
  const { pendingCelebration, dismissCelebration: dismissAchievement } = useAchievements();

  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const [tipsViewed, setTipsViewed] = useState(false);

  useEffect(() => {
    if (isFocused) {
      refreshLocks();
    }
  }, [isFocused, refreshLocks]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setRefreshKey(k => k + 1);
      }
      if (nextState !== "active") {
        setRefreshing(false);
      }
    });
    return () => subscription.remove();
  }, []);

  const handleToggleTips = useCallback(() => {
    setTipsExpanded(prev => {
      if (!prev) setTipsViewed(true);
      return !prev;
    });
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
          refreshHealth(),
          refreshLocks(),
        ]),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFeedings, refreshSleeps, refreshDiapers, refreshPumpings, refreshMeasurements, refreshTummyTimes, refreshMilestones, refreshHealth, refreshLocks]);

  const feedingActiveLabel = useMemo(() => {
    if (!feedingActiveTimer?.isRunning) return undefined;
    const side = feedingActiveTimer.side;
    if (side === "left") return t("feeding.leftSide");
    if (side === "right") return t("feeding.rightSide");
    return t("feeding.bothSides");
  }, [feedingActiveTimer, t]);

  const feedingTimeSince = useMemo(() => {
    if (feedingActiveTimer?.isRunning) {
      return t("common.now");
    }
    const lastFeeding = getLastFeeding();
    if (!lastFeeding) {
      return "--";
    }

    const timeAgo = t("dashboard.last", { time: timeSince(new Date(lastFeeding.startedAt), undefined, t) });
    const typeIcon = lastFeeding.type === "breast" ? "🤱" : lastFeeding.type === "bottle" ? "🍼" : "🥣";

    return `${typeIcon} ${timeAgo}`;
  }, [feedingActiveTimer, getLastFeeding, t, timeTick, feedings]);

  const feedingSubtitle = useMemo(() => {
    if (feedingActiveTimer?.isRunning) return undefined;

    const lastFeeding = getLastFeeding();
    if (!lastFeeding) return undefined;

    const parts: string[] = [];

    const L = t("feeding.leftShort");
    const R = t("feeding.rightShort");

    if (lastFeeding.type === "breast") {
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

  const sleepTimeSince = useMemo(() => {
    if (sleepActiveTimer?.isRunning) {
      return t("common.now");
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
  }, [sleepActiveTimer, getTodaysTotalSleepMinutes, dailyGoalMinutes, t, sleeps]);

  const sleepSecondaryInfo = useMemo(() => {
    if (sleepActiveTimer?.isRunning) return undefined;
    const lastSleep = getLastSleep();

    if (!lastSleep?.endedAt) return undefined;

    const awakeText = t("dashboard.awake", { time: timeSince(new Date(lastSleep.endedAt), undefined, t), context: selectedBaby?.gender });

    if (!wakeWindowConfig || !wakeWindowConfig.enabled || wakeWindowConfig.source !== "custom" || wakeWindowConfig.slots.length === 0) {
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
      const timeStr = formatDurationShort(h, m, tFn);
      return `${awakeText}\n${isBedtime ? t("dashboard.bedtimeIn", { time: timeStr }) : t("dashboard.napIn", { time: timeStr })}`;
    }

    return `${awakeText}\n${isBedtime ? t("dashboard.bedtimeIn", { time: formatDurationShort(0, remainingMinutes, tFn) }) : t("dashboard.napIn", { time: formatDurationShort(0, remainingMinutes, tFn) })}`;
  }, [sleepActiveTimer, getLastSleep, t, timeTick, selectedBaby?.gender, selectedBaby?.birthDate, wakeWindowConfig, getCurrentNapSlot, sleeps]);

  const isSleepActive = sleepActiveTimer?.isRunning ?? false;

  const diaperTimeSince = useMemo(() => {
    if (diapers.length === 0) return "--";

    const sortedDiapers = [...diapers].sort((a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );

    const lastDiaper = sortedDiapers[0];
    if (!lastDiaper) return "--";

    return t(`diaper.${lastDiaper.type}`);
  }, [diapers, t]);

  const diaperSubtitle = useMemo(() => {
    if (diapers.length === 0) return undefined;

    const sortedDiapers = [...diapers].sort((a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
    const lastDiaper = sortedDiapers[0];
    if (!lastDiaper) return undefined;

    return t("dashboard.last", { time: timeSince(new Date(lastDiaper.changedAt), undefined, t) });
  }, [diapers, t, timeTick]);

  const todayDiaperCounts = useMemo(() => {
    return getTodaysCounts();
  }, [getTodaysCounts, diapers]);

  const pumpingTimeSince = useMemo(() => {
    if (pumpingActiveTimer?.isRunning) {
      return t("common.now");
    }

    const todayVolume = getTodaysTotalVolume();
    if (todayVolume > 0) {
      return `${formatVolume(todayVolume, volumeUnit)} ${t("common.today").toLowerCase()}`;
    }
    return "--";
  }, [pumpingActiveTimer, getTodaysTotalVolume, t, pumpings, volumeUnit]);

  const pumpingSubtitle = useMemo(() => {
    if (pumpingActiveTimer?.isRunning) return undefined;

    const lastPumping = getLastPumping();
    const lastSide = getLastSide();

    if (!lastPumping) return undefined;

    const timeAgo = t("dashboard.last", { time: timeSince(new Date(lastPumping.startedAt), undefined, t) });
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
    return `${weight.toFixed(2)}kg`;
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

  const tummyTimeTimeSince = useMemo(() => {
    if (tummyTimeActiveTimer?.isRunning) {
      return t("common.now");
    }

    const totalSeconds = getTodaysTotalSeconds();
    const goalMinutes = Math.round(dailyGoalSeconds / 60);
    const totalMinutes = Math.round(totalSeconds / 60);

    return t("dashboard.minuteProgress", { current: totalMinutes, goal: goalMinutes });
  }, [tummyTimeActiveTimer, getTodaysTotalSeconds, dailyGoalSeconds, t, tummyTimes]);

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

  const handleHealthCardPress = useCallback(() => {
    safeNavigate("/health");
  }, [safeNavigate]);

  const handleAddHealth = useCallback(() => {
    safeNavigate("/health");
  }, [safeNavigate]);

  const healthTimeSince = useMemo(() => {
    const lastHealth = getLastHealth();
    if (!lastHealth) return "--";

    return t("dashboard.last", { time: timeSince(new Date(lastHealth.loggedAt), undefined, t) });
  }, [getLastHealth, t, timeTick, healthEntries]);

  const healthSubtitle = useMemo(() => {
    const lastHealth = getLastHealth();
    if (!lastHealth) return undefined;

    switch (lastHealth.type) {
      case "medication": {
        const parts: string[] = [];
        if (lastHealth.medicationName) parts.push(getHealthDisplayName(lastHealth.medicationName, "medication", t));
        if (lastHealth.dosageAmount) {
          const amt = lastHealth.dosageAmount;
          const unitLabels = { ml: t("health.unitMl"), mg: t("health.unitMg"), drops: t("health.unitDrops", { count: amt }), tsp: t("health.unitTsp") } as const;
          const unitLabel = unitLabels[lastHealth.dosageUnit || "ml"] || t("health.unitMl");
          parts.push(`${lastHealth.dosageAmount} ${unitLabel}`);
        }
        return parts.length > 0 ? parts.join(" \u00B7 ") : t("health.medication");
      }
      case "temperature": {
        if (lastHealth.temperatureCelsius) {
          const tempStr = formatTemperature(lastHealth.temperatureCelsius, temperatureUnit);
          const status = getFeverStatus(lastHealth.temperatureCelsius, lastHealth.measurementMethod);
          return `\uD83C\uDF21\uFE0F ${tempStr} \u00B7 ${t(`health.feverStatus.${status}`)}`;
        }
        return t("health.temperature");
      }
      case "vaccination":
        return lastHealth.vaccineName ? `\uD83D\uDC89 ${getHealthDisplayName(lastHealth.vaccineName, "vaccine", t)}` : t("health.vaccination");
      case "symptom": {
        if (lastHealth.symptoms && lastHealth.symptoms.length > 0) {
          const symptomLabels = lastHealth.symptoms.slice(0, 2).map(s =>
            t(`health.symptom.${s}`)
          );
          return `\uD83E\uDD12 ${symptomLabels.join(", ")}`;
        }
        return t("health.symptomsLabel");
      }
      default:
        return undefined;
    }
  }, [getLastHealth, t, temperatureUnit, volumeUnit, timeTick, healthEntries]);



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
      timerStartTime: feedingActiveTimer?.startTime?.getTime(),
      timerPausedAt: feedingActiveTimer?.pausedAt?.getTime(),
      timerTotalPausedMs: feedingActiveTimer?.totalPausedMs,
    };
  }, [t, feedingTimeSince, feedingSubtitle, isFeedingActive, feedingActiveLabel, feedingActiveTimer, handleFeedingCardPress, handleAddFeeding, handleStopFeeding, handleTogglePauseFeeding, isAuthenticated, getTimerLockInfo, selectedBaby?.name]);

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
      timerStartTime: sleepActiveTimer?.startTime?.getTime(),
      timerPausedAt: sleepActiveTimer?.pausedAt?.getTime(),
      timerTotalPausedMs: sleepActiveTimer?.totalPausedMs,
    };
  }, [t, sleepTimeSince, sleepSecondaryInfo, isSleepActive, sleepActiveTimer, sleepProgress, handleSleepCardPress, handleAddSleep, handleStopSleep, handleTogglePauseSleep, isAuthenticated, getTimerLockInfo, selectedBaby?.name]);

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
      timerStartTime: pumpingActiveTimer?.startTime?.getTime(),
      timerPausedAt: pumpingActiveTimer?.pausedAt?.getTime(),
      timerTotalPausedMs: pumpingActiveTimer?.totalPausedMs,
    };
  }, [t, pumpingTimeSince, pumpingSubtitle, isPumpingActive, pumpingActiveTimer, handlePumpingCardPress, handleAddPumping, handleStopPumping, handleTogglePausePumping, isAuthenticated, getTimerLockInfo, selectedBaby?.name]);

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
      timerStartTime: tummyTimeActiveTimer?.startTime?.getTime(),
      timerPausedAt: tummyTimeActiveTimer?.pausedAt?.getTime(),
      timerTotalPausedMs: tummyTimeActiveTimer?.totalPausedMs,
    };
  }, [t, tummyTimeTimeSince, tummyTimeSecondaryInfo, isTummyTimeActive, tummyTimeActiveTimer, tummyTimeProgress, handleTummyTimeCardPress, handleAddTummyTime, handleStopTummyTime, handleTogglePauseTummyTime, isAuthenticated, getTimerLockInfo, selectedBaby?.name]);

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

  const healthCardProps = useMemo((): CardProps => {
    return {
      label: t("health.title"),
      timeSince: healthTimeSince,
      subtitle: healthSubtitle,
      isActive: false,
      onPress: handleHealthCardPress,
      onActionPress: handleAddHealth,
      actionLabel: "+",
    };
  }, [t, healthTimeSince, healthSubtitle, handleHealthCardPress, handleAddHealth]);

  const cardPropsMap = useMemo((): Record<ActivityType, CardProps> => ({
    feeding: feedingCardProps,
    sleep: sleepCardProps,
    diaper: diaperCardProps,
    pumping: pumpingCardProps,
    tummyTime: tummyTimeCardProps,
    growth: growthCardProps,
    milestones: milestonesCardProps,
    health: healthCardProps,
  }), [feedingCardProps, sleepCardProps, diaperCardProps, pumpingCardProps, tummyTimeCardProps, growthCardProps, milestonesCardProps, healthCardProps]);

  const { gridRows, compactCards } = useMemo(
    () => getDashboardLayout(dashboardConfig.cards),
    [dashboardConfig.cards]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top"]} testID="home-screen">
      <BabyHeader
        onSettingsPress={handleSettingsPress}
        tipsExpanded={tipsExpanded}
        hasTips={!!selectedBaby}
        tipsViewed={tipsViewed}
        onTipToggle={selectedBaby ? handleToggleTips : undefined}
      />

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
              key={refreshKey}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={getActionColor("primary", colorScheme === "dark")}
              colors={[getActionColor("primary", colorScheme === "dark")]}
            />
          )
        }
      >
        {tipsExpanded && selectedBaby && (
          <TipCarousel
            babyId={selectedBaby.id}
            birthDate={selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined}
            onDismiss={handleToggleTips}
          />
        )}

        {(selectedBaby || isBabyLoading) && (
          <SleepPredictionCard
            babyName={selectedBaby?.name}
          />
        )}

        <View style={{ height: 24 }} />

        <View style={{ gap: 12 }}>
          {gridRows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: "row", gap: 12 }}>
              {row.length === 1 && <View style={{ flex: 0.5 }} />}
              {row.map((activity) => {
                const props = cardPropsMap[activity];
                return (
                  <DashboardCard
                    key={activity}
                    activity={activity}
                    testID={`${activity}-card`}
                    {...props}
                  />
                );
              })}
              {row.length === 1 && <View style={{ flex: 0.5 }} />}
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />

        <View style={{ gap: 6 }}>
          {compactCards.map((activity) => {
            const props = cardPropsMap[activity];
            return (
              <CompactActivityRow
                key={activity}
                activity={activity}
                testID={`${activity}-card`}
                {...props}
              />
            );
          })}
        </View>
      </ScrollView>

      {selectedBaby && (
        <BirthdayCelebrationModal
          visible={showCelebration}
          baby={selectedBaby}
          milestoneAge={milestoneAge}
          onClose={dismissCelebration}
        />
      )}

      {pendingCelebration?.tier === "major" && (
        <MilestoneCelebrationModal
          visible
          achievementId={pendingCelebration.id}
          emoji={pendingCelebration.emoji}
          babyAgeMonths={pendingCelebration.babyAgeMonths}
          onClose={dismissAchievement}
        />
      )}

      {pendingCelebration?.tier === "minor" && (
        <MilestoneToast
          visible
          achievementId={pendingCelebration.id}
          emoji={pendingCelebration.emoji}
          onDismiss={dismissAchievement}
        />
      )}
    </SafeAreaView>
  );
}
