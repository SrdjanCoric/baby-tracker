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
  const { feedings, activeTimer: feedingActiveTimer, getLastFeeding } = useFeeding();
  const { sleeps, activeTimer: sleepActiveTimer, getLastSleep } = useSleep();
  const { getLastDiaper, getTodaysCounts } = useDiaper();
  const { activeTimer: pumpingActiveTimer, getLastPumping } = usePumping();
  const { getLastMeasurement } = useGrowth();
  const { activeTimer: tummyTimeActiveTimer, getLastTummyTime, getDailyProgress } = useTummyTime();
  const [showFeedingMenu, setShowFeedingMenu] = useState(false);

  const feedingTimeSince = useMemo(() => {
    if (feedingActiveTimer?.isRunning) {
      return t("common.now");
    }
    const lastFeeding = getLastFeeding();
    if (!lastFeeding) {
      return "--";
    }
    return timeSince(new Date(lastFeeding.startedAt));
  }, [feedingActiveTimer, getLastFeeding, t]);

  const isFeedingActive = feedingActiveTimer?.isRunning ?? false;

  const sleepTimeSince = useMemo(() => {
    if (sleepActiveTimer?.isRunning) {
      return t("common.now");
    }
    const lastSleep = getLastSleep();
    if (!lastSleep) {
      return "--";
    }
    return timeSince(new Date(lastSleep.startedAt));
  }, [sleepActiveTimer, getLastSleep, t]);

  const isSleepActive = sleepActiveTimer?.isRunning ?? false;

  const diaperTimeSince = useMemo(() => {
    const lastDiaper = getLastDiaper();
    if (!lastDiaper) {
      return "--";
    }
    return timeSince(new Date(lastDiaper.changedAt));
  }, [getLastDiaper]);

  const todayDiaperCounts = useMemo(() => {
    return getTodaysCounts();
  }, [getTodaysCounts]);

  const pumpingTimeSince = useMemo(() => {
    if (pumpingActiveTimer?.isRunning) {
      return t("common.now");
    }
    const lastPumping = getLastPumping();
    if (!lastPumping) {
      return "--";
    }
    return timeSince(new Date(lastPumping.startedAt));
  }, [pumpingActiveTimer, getLastPumping, t]);

  const isPumpingActive = pumpingActiveTimer?.isRunning ?? false;

  const growthTimeSince = useMemo(() => {
    const lastMeasurement = getLastMeasurement();
    if (!lastMeasurement) {
      return "--";
    }
    return formatDate(new Date(lastMeasurement.measuredAt));
  }, [getLastMeasurement]);

  const tummyTimeTimeSince = useMemo(() => {
    if (tummyTimeActiveTimer?.isRunning) {
      return t("common.now");
    }
    const lastTummyTime = getLastTummyTime();
    if (!lastTummyTime) {
      return "--";
    }
    return timeSince(new Date(lastTummyTime.startedAt));
  }, [tummyTimeActiveTimer, getLastTummyTime, t]);

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
    } else if (option === "manual") {
      router.push("/feeding/manual");
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
              onPress={() => {}}
              onActionPress={handleAddDiaper}
              actionLabel="+"
            />
            <DashboardCard
              activity="pumping"
              label={t("pumping.title")}
              timeSince={pumpingTimeSince}
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
