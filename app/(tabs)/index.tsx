import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { useColorScheme } from "nativewind";
import { getActionColor } from "@/constants/design-tokens";
import {
  BabyHeader,
  DashboardCard,
  TodaySummary,
} from "@/components";
import { useFeeding, useSleep, useDiaper, usePumping, useGrowth, useTummyTime, useDashboardConfig } from "@/contexts";
import { timeSince, formatDate, hoursSince } from "@/utils/time";
import { ActivityType } from "@/constants/activities";
import { DashboardCardConfig } from "@/services/dashboard-config-storage";

interface CardProps {
  label: string;
  timeSince: string;
  subtitle?: string;
  secondaryInfo?: string;
  isActive: boolean;
  activeLabel?: string;
  onPress: () => void;
  onActionPress: () => void;
  actionLabel?: string;
  progress?: number;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { visibleCards } = useDashboardConfig();

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

  const { feedings, activeTimer: feedingActiveTimer, getLastFeeding, suggestedSide, refreshFeedings } = useFeeding();
  const { sleeps, activeTimer: sleepActiveTimer, getLastSleep, getTodaysTotalSleepMinutes, dailyGoalMinutes, getDailyProgress: getSleepDailyProgress, refreshSleeps } = useSleep();
  const { diapers, getTodaysCounts, refreshDiapers } = useDiaper();
  const { activeTimer: pumpingActiveTimer, getLastPumping, getTodaysTotalVolume, getLastSide, refreshPumpings } = usePumping();
  const { getLastMeasurement, getWeightChange, refreshMeasurements } = useGrowth();
  const { activeTimer: tummyTimeActiveTimer, getDailyProgress: getTummyTimeDailyProgress, getTodaysTotalSeconds, getTodaysSessionCount, dailyGoalSeconds, refreshTummyTimes } = useTummyTime();
  const { colorScheme } = useColorScheme();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshFeedings(),
        refreshSleeps(),
        refreshDiapers(),
        refreshPumpings(),
        refreshMeasurements(),
        refreshTummyTimes(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFeedings, refreshSleeps, refreshDiapers, refreshPumpings, refreshMeasurements, refreshTummyTimes]);

  const feedingTimeSince = useMemo(() => {
    if (feedingActiveTimer?.isRunning) {
      return t("common.now");
    }
    const lastFeeding = getLastFeeding();
    if (!lastFeeding) {
      return "--";
    }
    return t("dashboard.last", { time: timeSince(new Date(lastFeeding.startedAt)) });
  }, [feedingActiveTimer, getLastFeeding, t]);

  const lastBreastFeeding = useMemo(() => {
    const sortedFeedings = [...feedings].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sortedFeedings.find(f => f.type === "breast") ?? null;
  }, [feedings]);

  const feedingSubtitle = useMemo(() => {
    if (feedingActiveTimer?.isRunning) return undefined;
    if (!lastBreastFeeding) return undefined;

    // Only show suggested side if last breastfeeding was within 24 hours
    if (hoursSince(new Date(lastBreastFeeding.startedAt)) > 24) return undefined;

    const side = suggestedSide === "left" ? t("feeding.left") : t("feeding.right");
    return t("dashboard.nextSide", { side });
  }, [feedingActiveTimer?.isRunning, lastBreastFeeding, suggestedSide, t]);

  const isFeedingActive = feedingActiveTimer?.isRunning ?? false;

  const sleepTimeSince = useMemo(() => {
    if (sleepActiveTimer?.isRunning) {
      return t("common.now");
    }

    const totalMinutes = getTodaysTotalSleepMinutes();
    const goalHours = Math.round(dailyGoalMinutes / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;

    if (totalMinutes === 0) {
      return t("dashboard.goalProgress", { current: 0, goal: goalHours });
    }

    if (remainingMins > 0) {
      return t("dashboard.goalProgressWithMinutes", { hours: totalHours, minutes: remainingMins, goal: goalHours });
    }
    return t("dashboard.goalProgress", { current: totalHours, goal: goalHours });
  }, [sleepActiveTimer, getTodaysTotalSleepMinutes, dailyGoalMinutes, t]);

  const sleepSecondaryInfo = useMemo(() => {
    if (sleepActiveTimer?.isRunning) return undefined;
    const lastSleep = getLastSleep();

    if (lastSleep?.endedAt) {
      return t("dashboard.awake", { time: timeSince(new Date(lastSleep.endedAt)) });
    }

    return undefined;
  }, [sleepActiveTimer, getLastSleep, t]);

  const isSleepActive = sleepActiveTimer?.isRunning ?? false;

  const diaperTimeSince = useMemo(() => {
    // Show today's wet count (hydration tracking - target 6+ per day)
    const counts = getTodaysCounts();
    if (counts.total === 0) return "--";
    return t("dashboard.wetToday", { count: counts.wet });
  }, [getTodaysCounts, t]);

  const diaperSubtitle = useMemo(() => {
    // Show time since last dirty diaper (what pediatricians ask about)
    if (diapers.length === 0) return undefined;

    // Find the last dirty or mixed diaper
    const sortedDiapers = [...diapers].sort((a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );

    const lastDirty = sortedDiapers.find(d => d.type === "dirty" || d.type === "mixed");
    if (!lastDirty) return undefined;

    const colorInfo = lastDirty.stoolColor
      ? ` (${t(`stoolColors.${lastDirty.stoolColor}`)})`
      : "";
    return t("dashboard.lastDirty", { time: timeSince(new Date(lastDirty.changedAt)) }) + colorInfo;
  }, [diapers, t]);

  const todayDiaperCounts = useMemo(() => {
    return getTodaysCounts();
  }, [getTodaysCounts]);

  const pumpingTimeSince = useMemo(() => {
    if (pumpingActiveTimer?.isRunning) {
      return t("common.now");
    }

    // Show daily total as primary (most important for supply tracking)
    const todayVolume = getTodaysTotalVolume();
    if (todayVolume > 0) {
      return t("dashboard.todayVolume", { volume: todayVolume });
    }
    return "--";
  }, [pumpingActiveTimer, getTodaysTotalVolume, t]);

  const pumpingSubtitle = useMemo(() => {
    if (pumpingActiveTimer?.isRunning) return undefined;

    const lastPumping = getLastPumping();
    const lastSide = getLastSide();

    if (!lastPumping) return undefined;

    const parts: string[] = [];
    parts.push(timeSince(new Date(lastPumping.startedAt)));
    if (lastSide) {
      parts.push(lastSide === "left" ? t("feeding.left") : lastSide === "right" ? t("feeding.right") : t("feeding.both"));
    }

    return parts.join(" • ");
  }, [pumpingActiveTimer, getLastPumping, getLastSide, t]);

  const isPumpingActive = pumpingActiveTimer?.isRunning ?? false;

  const growthTimeSince = useMemo(() => {
    const lastMeasurement = getLastMeasurement();
    if (!lastMeasurement) return "--";

    const parts: string[] = [];
    if (lastMeasurement.weightKg !== undefined) {
      const weight = Number(lastMeasurement.weightKg);
      parts.push(`${weight.toFixed(1)} kg`);
    }
    if (lastMeasurement.heightCm !== undefined) {
      const height = Number(lastMeasurement.heightCm);
      parts.push(`${height.toFixed(1)} cm`);
    }

    return parts.length > 0 ? parts.join(" | ") : formatDate(new Date(lastMeasurement.measuredAt));
  }, [getLastMeasurement]);

  const growthSubtitle = useMemo(() => {
    const lastMeasurement = getLastMeasurement();
    const weightChange = getWeightChange();

    if (!lastMeasurement) return undefined;

    const parts: string[] = [];

    if (weightChange?.hasPrevious && weightChange.change !== 0) {
      const sign = weightChange.change > 0 ? "+" : "";
      parts.push(`${sign}${weightChange.change}g`);
    }

    // For growth, show days ago instead of minutes/hours
    const measuredDate = new Date(lastMeasurement.measuredAt);
    const now = new Date();
    const diffMs = now.getTime() - measuredDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      parts.push(t("common.today").toLowerCase());
    } else if (diffDays === 1) {
      parts.push(t("common.yesterday").toLowerCase());
    } else {
      parts.push(t("dashboard.daysAgo", { days: diffDays }));
    }

    return parts.join(" • ");
  }, [getLastMeasurement, getWeightChange, t]);

  const tummyTimeTimeSince = useMemo(() => {
    if (tummyTimeActiveTimer?.isRunning) {
      return t("common.now");
    }

    const totalSeconds = getTodaysTotalSeconds();
    const goalMinutes = Math.round(dailyGoalSeconds / 60);
    const totalMinutes = Math.round(totalSeconds / 60);

    return t("dashboard.minuteProgress", { current: totalMinutes, goal: goalMinutes });
  }, [tummyTimeActiveTimer, getTodaysTotalSeconds, dailyGoalSeconds, t]);

  const tummyTimeSecondaryInfo = useMemo(() => {
    if (tummyTimeActiveTimer?.isRunning) return undefined;

    const sessionCount = getTodaysSessionCount();

    if (sessionCount > 0) {
      return t("dashboard.session", { count: sessionCount });
    }

    return undefined;
  }, [tummyTimeActiveTimer, getTodaysSessionCount, t]);

  const isTummyTimeActive = tummyTimeActiveTimer?.isRunning ?? false;

  const tummyTimeProgress = useMemo(() => {
    return getTummyTimeDailyProgress();
  }, [getTummyTimeDailyProgress]);

  const sleepProgress = useMemo(() => {
    return getSleepDailyProgress();
  }, [getSleepDailyProgress]);

  const todayFeedings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return feedings.filter(f => new Date(f.startedAt) >= today);
  }, [feedings]);

  const todaySleeps = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sleeps.filter(s => new Date(s.startedAt) >= today);
  }, [sleeps]);

  const mockData = {
    todayFeedingTotal: todayFeedings.length.toString(),
    todayNapCount: todaySleeps.length,
  };

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

  const handleAddTummyTime = useCallback(() => {
    safeNavigate("/tummyTime");
  }, [safeNavigate]);

  const handleTummyTimeCardPress = useCallback(() => {
    safeNavigate("/tummyTime");
  }, [safeNavigate]);

  const handleSettingsPress = useCallback(() => {
    safeNavigate("/settings");
  }, [safeNavigate]);

  const getCardProps = useCallback((activity: ActivityType): CardProps => {
    switch (activity) {
      case "feeding":
        return {
          label: t("feeding.title"),
          timeSince: feedingTimeSince,
          subtitle: feedingSubtitle,
          isActive: isFeedingActive,
          activeLabel: t("common.now"),
          onPress: handleFeedingCardPress,
          onActionPress: handleAddFeeding,
          actionLabel: isFeedingActive ? undefined : "+",
        };
      case "sleep":
        return {
          label: t("sleep.title"),
          timeSince: sleepTimeSince,
          secondaryInfo: sleepSecondaryInfo,
          isActive: isSleepActive,
          activeLabel: t("sleep.sleeping"),
          onPress: handleSleepCardPress,
          onActionPress: handleAddSleep,
          actionLabel: isSleepActive ? undefined : "+",
          progress: sleepProgress,
        };
      case "diaper":
        return {
          label: t("diaper.title"),
          timeSince: diaperTimeSince,
          subtitle: diaperSubtitle,
          isActive: false,
          onPress: handleDiaperCardPress,
          onActionPress: handleAddDiaper,
          actionLabel: "+",
        };
      case "pumping":
        return {
          label: t("pumping.title"),
          timeSince: pumpingTimeSince,
          subtitle: pumpingSubtitle,
          isActive: isPumpingActive,
          activeLabel: t("pumping.pumping"),
          onPress: handlePumpingCardPress,
          onActionPress: handleAddPumping,
          actionLabel: isPumpingActive ? undefined : "+",
        };
      case "tummyTime":
        return {
          label: t("tummyTime.title"),
          timeSince: tummyTimeTimeSince,
          secondaryInfo: tummyTimeSecondaryInfo,
          isActive: isTummyTimeActive,
          activeLabel: t("tummyTime.inProgress"),
          onPress: handleTummyTimeCardPress,
          onActionPress: handleAddTummyTime,
          actionLabel: isTummyTimeActive ? undefined : "+",
          progress: tummyTimeProgress,
        };
      case "growth":
        return {
          label: t("growth.title"),
          timeSince: growthTimeSince,
          subtitle: growthSubtitle,
          isActive: false,
          onPress: handleGrowthCardPress,
          onActionPress: handleAddGrowth,
          actionLabel: "+",
        };
    }
  }, [
    t,
    feedingTimeSince, feedingSubtitle, isFeedingActive, handleFeedingCardPress, handleAddFeeding,
    sleepTimeSince, sleepSecondaryInfo, isSleepActive, sleepProgress, handleSleepCardPress, handleAddSleep,
    diaperTimeSince, diaperSubtitle, handleDiaperCardPress, handleAddDiaper,
    pumpingTimeSince, pumpingSubtitle, isPumpingActive, handlePumpingCardPress, handleAddPumping,
    tummyTimeTimeSince, tummyTimeSecondaryInfo, isTummyTimeActive, tummyTimeProgress, handleTummyTimeCardPress, handleAddTummyTime,
    growthTimeSince, growthSubtitle, handleGrowthCardPress, handleAddGrowth,
  ]);

  const cardRows = useMemo(() => {
    const rows: DashboardCardConfig[][] = [];
    for (let i = 0; i < visibleCards.length; i += 2) {
      rows.push(visibleCards.slice(i, i + 2));
    }
    return rows;
  }, [visibleCards]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top"]}>
      <BabyHeader onSettingsPress={handleSettingsPress} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={getActionColor("primary", colorScheme === "dark")}
            colors={[getActionColor("primary", colorScheme === "dark")]}
          />
        }
      >
        {/* Activity Cards Grid */}
        <View className="gap-3">
          {cardRows.map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row gap-3">
              {row.map((cardConfig) => {
                const props = getCardProps(cardConfig.activity);
                return (
                  <DashboardCard
                    key={cardConfig.activity}
                    activity={cardConfig.activity}
                    {...props}
                  />
                );
              })}
              {row.length === 1 && <View className="flex-1" />}
            </View>
          ))}
        </View>

        {/* Today Summary */}
        <View className="mt-6">
          <TodaySummary
            feedingTotal={mockData.todayFeedingTotal}
            napCount={mockData.todayNapCount}
            diaperCount={todayDiaperCounts.total}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
