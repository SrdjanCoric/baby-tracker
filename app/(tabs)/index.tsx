import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  BabyHeader,
  DashboardCard,
  TodaySummary,
  FeedingTypeMenu,
  type FeedingMenuOption,
} from "@/components";
import { useFeeding, useSleep, useDiaper, usePumping, useGrowth, useTummyTime } from "@/contexts";
import { timeSince, formatDate } from "@/utils/time";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { feedings, activeTimer: feedingActiveTimer, getLastFeeding, suggestedSide } = useFeeding();
  const { sleeps, activeTimer: sleepActiveTimer, getLastSleep, getTodaysTotalSleepMinutes } = useSleep();
  const { diapers, getLastDiaper, getTodaysCounts } = useDiaper();
  const { activeTimer: pumpingActiveTimer, getLastPumping, getTodaysTotalVolume, getLastSide } = usePumping();
  const { getLastMeasurement, getWeightChange } = useGrowth();
  const { activeTimer: tummyTimeActiveTimer, getLastTummyTime, getDailyProgress, getTodaysTotalSeconds, getTodaysSessionCount, dailyGoalSeconds } = useTummyTime();
  const [showFeedingMenu, setShowFeedingMenu] = useState(false);

  const feedingTimeSince = useMemo(() => {
    if (feedingActiveTimer?.isRunning) {
      return t("common.now");
    }
    const lastFeeding = getLastFeeding();
    if (!lastFeeding) {
      return "--";
    }
    return `Last: ${timeSince(new Date(lastFeeding.startedAt))}`;
  }, [feedingActiveTimer, getLastFeeding, t]);

  const feedingSubtitle = useMemo(() => {
    if (feedingActiveTimer?.isRunning) return undefined;

    // Find the last breast feeding (not just any feeding)
    const sortedFeedings = [...feedings].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    const lastBreastFeeding = sortedFeedings.find(f => f.type === "breast");

    if (!lastBreastFeeding) return undefined;

    // Only show suggested side if last breastfeeding was within 24 hours
    const hoursSinceBreastfeeding = (Date.now() - new Date(lastBreastFeeding.startedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceBreastfeeding > 24) return undefined;

    return `Next: ${suggestedSide === "left" ? "Left" : "Right"} side`;
  }, [feedingActiveTimer, feedings, suggestedSide]);

  const isFeedingActive = feedingActiveTimer?.isRunning ?? false;

  const sleepTimeSince = useMemo(() => {
    if (sleepActiveTimer?.isRunning) {
      return t("common.now");
    }
    const lastSleep = getLastSleep();
    if (!lastSleep) {
      return "--";
    }
    // Show awake time (time since sleep ended)
    if (lastSleep.endedAt) {
      return `Awake: ${timeSince(new Date(lastSleep.endedAt))}`;
    }
    return timeSince(new Date(lastSleep.startedAt));
  }, [sleepActiveTimer, getLastSleep, t]);

  const sleepSubtitle = useMemo(() => {
    if (sleepActiveTimer?.isRunning) return undefined;
    const lastSleep = getLastSleep();

    const parts: string[] = [];

    // Show last nap duration
    if (lastSleep?.durationSeconds) {
      const hours = Math.floor(lastSleep.durationSeconds / 3600);
      const minutes = Math.floor((lastSleep.durationSeconds % 3600) / 60);
      if (hours > 0) {
        parts.push(`Last: ${hours}h ${minutes}m`);
      } else {
        parts.push(`Last: ${minutes}m`);
      }
    }

    // Show total sleep today
    const totalMinutes = getTodaysTotalSleepMinutes();
    if (totalMinutes > 0) {
      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMins = totalMinutes % 60;
      if (totalHours > 0) {
        parts.push(`Today: ${totalHours}h ${remainingMins}m`);
      } else {
        parts.push(`Today: ${remainingMins}m`);
      }
    }

    return parts.length > 0 ? parts.join(" • ") : undefined;
  }, [sleepActiveTimer, getLastSleep, getTodaysTotalSleepMinutes]);

  const isSleepActive = sleepActiveTimer?.isRunning ?? false;

  const diaperTimeSince = useMemo(() => {
    // Show today's wet count (hydration tracking - target 6+ per day)
    const counts = getTodaysCounts();
    if (counts.total === 0) return "--";
    return `${counts.wet} wet today`;
  }, [getTodaysCounts]);

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
      ? ` (${lastDirty.stoolColor})`
      : "";
    return `Last dirty: ${timeSince(new Date(lastDirty.changedAt))} ago${colorInfo}`;
  }, [diapers]);

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
      return `Today: ${todayVolume}ml`;
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
      parts.push(lastSide === "left" ? "Left" : lastSide === "right" ? "Right" : "Both");
    }

    return parts.join(" • ");
  }, [pumpingActiveTimer, getLastPumping, getLastSide]);

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
      parts.push("today");
    } else if (diffDays === 1) {
      parts.push("yesterday");
    } else {
      parts.push(`${diffDays}d ago`);
    }

    return parts.join(" • ");
  }, [getLastMeasurement, getWeightChange]);

  const tummyTimeTimeSince = useMemo(() => {
    if (tummyTimeActiveTimer?.isRunning) {
      return t("common.now");
    }

    const totalSeconds = getTodaysTotalSeconds();
    const goalMinutes = Math.round(dailyGoalSeconds / 60);
    const totalMinutes = Math.round(totalSeconds / 60);

    return `${totalMinutes} / ${goalMinutes} min`;
  }, [tummyTimeActiveTimer, getTodaysTotalSeconds, dailyGoalSeconds, t]);

  const tummyTimeSecondaryInfo = useMemo(() => {
    if (tummyTimeActiveTimer?.isRunning) return undefined;

    const sessionCount = getTodaysSessionCount();
    const lastTummyTime = getLastTummyTime();

    const parts: string[] = [];
    if (sessionCount > 0) {
      parts.push(`${sessionCount} session${sessionCount !== 1 ? "s" : ""}`);
    }
    if (lastTummyTime) {
      parts.push(timeSince(new Date(lastTummyTime.startedAt)));
    }

    return parts.length > 0 ? parts.join(" • ") : undefined;
  }, [tummyTimeActiveTimer, getTodaysSessionCount, getLastTummyTime]);

  const isTummyTimeActive = tummyTimeActiveTimer?.isRunning ?? false;

  const tummyTimeProgress = useMemo(() => {
    return getDailyProgress();
  }, [getDailyProgress]);

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
    setShowFeedingMenu(true);
  }, []);

  const handleFeedingMenuSelect = useCallback((option: FeedingMenuOption) => {
    if (option === "breastfeed") {
      router.push("/feeding/breastfeed");
    } else if (option === "bottle") {
      router.push("/feeding/bottle");
    } else if (option === "solids") {
      router.push("/feeding/solids");
    }
  }, [router]);

  const handleFeedingCardPress = useCallback(() => {
    if (isFeedingActive) {
      router.push("/feeding/breastfeed");
    }
  }, [isFeedingActive, router]);

  const handleAddSleep = useCallback(() => {
    router.push("/sleep");
  }, [router]);

  const handleSleepCardPress = useCallback(() => {
    if (isSleepActive) {
      router.push("/sleep");
    }
  }, [isSleepActive, router]);

  const handleAddDiaper = useCallback(() => {
    router.push("/diaper");
  }, [router]);

  const handleAddGrowth = useCallback(() => {
    router.push("/growth");
  }, [router]);

  const handleAddPumping = useCallback(() => {
    router.push("/pumping");
  }, [router]);

  const handlePumpingCardPress = useCallback(() => {
    if (isPumpingActive) {
      router.push("/pumping");
    }
  }, [isPumpingActive, router]);

  const handleAddTummyTime = useCallback(() => {
    router.push("/tummyTime");
  }, [router]);

  const handleTummyTimeCardPress = useCallback(() => {
    if (isTummyTimeActive) {
      router.push("/tummyTime");
    }
  }, [isTummyTimeActive, router]);

  const handleSettingsPress = () => {
    router.push("/(tabs)/profile");
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top"]}>
      <BabyHeader onSettingsPress={handleSettingsPress} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Activity Cards Grid */}
        <View className="gap-3">
          {/* Row 1: Feeding & Sleep */}
          <View className="flex-row gap-3">
            <DashboardCard
              activity="feeding"
              label={t("feeding.title")}
              timeSince={feedingTimeSince}
              subtitle={feedingSubtitle}
              isActive={isFeedingActive}
              activeLabel={t("common.now")}
              onPress={handleFeedingCardPress}
              onActionPress={handleAddFeeding}
              actionLabel={isFeedingActive ? undefined : "+"}
            />
            <DashboardCard
              activity="sleep"
              label={t("sleep.title")}
              timeSince={sleepTimeSince}
              subtitle={sleepSubtitle}
              isActive={isSleepActive}
              activeLabel={t("sleep.sleeping")}
              onPress={handleSleepCardPress}
              onActionPress={handleAddSleep}
              actionLabel={isSleepActive ? undefined : "+"}
            />
          </View>

          {/* Row 2: Diaper & Pumping */}
          <View className="flex-row gap-3">
            <DashboardCard
              activity="diaper"
              label={t("diaper.title")}
              timeSince={diaperTimeSince}
              subtitle={diaperSubtitle}
              onPress={() => {}}
              onActionPress={handleAddDiaper}
              actionLabel="+"
            />
            <DashboardCard
              activity="pumping"
              label={t("pumping.title")}
              timeSince={pumpingTimeSince}
              subtitle={pumpingSubtitle}
              isActive={isPumpingActive}
              activeLabel={t("pumping.pumping")}
              onPress={handlePumpingCardPress}
              onActionPress={handleAddPumping}
              actionLabel={isPumpingActive ? undefined : "+"}
            />
          </View>

          {/* Row 3: Tummy Time & Growth */}
          <View className="flex-row gap-3">
            <DashboardCard
              activity="tummyTime"
              label={t("tummyTime.title")}
              timeSince={tummyTimeTimeSince}
              secondaryInfo={tummyTimeSecondaryInfo}
              isActive={isTummyTimeActive}
              activeLabel={t("tummyTime.inProgress")}
              onPress={handleTummyTimeCardPress}
              onActionPress={handleAddTummyTime}
              actionLabel={isTummyTimeActive ? undefined : "+"}
              progress={tummyTimeProgress}
            />
            <DashboardCard
              activity="growth"
              label={t("growth.title")}
              timeSince={growthTimeSince}
              subtitle={growthSubtitle}
              onPress={() => {}}
              onActionPress={handleAddGrowth}
              actionLabel="+"
            />
          </View>
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

      {/* Feeding Type Menu Modal */}
      <FeedingTypeMenu
        visible={showFeedingMenu}
        onClose={() => setShowFeedingMenu(false)}
        onSelect={handleFeedingMenuSelect}
      />
    </SafeAreaView>
  );
}
