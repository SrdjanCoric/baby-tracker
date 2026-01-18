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
import { useFeeding } from "@/contexts";
import { timeSince } from "@/utils/time";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { feedings, activeTimer, getLastFeeding } = useFeeding();
  const [showFeedingMenu, setShowFeedingMenu] = useState(false);

  const feedingTimeSince = useMemo(() => {
    if (activeTimer?.isRunning) {
      return t("common.now");
    }
    const lastFeeding = getLastFeeding();
    if (!lastFeeding) {
      return "--";
    }
    return timeSince(new Date(lastFeeding.startedAt));
  }, [activeTimer, getLastFeeding, t]);

  const isFeedingActive = activeTimer?.isRunning ?? false;

  const todayFeedings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return feedings.filter(f => new Date(f.startedAt) >= today);
  }, [feedings]);

  const mockData = {
    sleepTimeSince: "45 min",
    diaperTimeSince: "1h 30m",
    pumpingTimeSince: "4h 20m",
    tummyTimeTimeSince: "3h",
    growthTimeSince: "5 days",
    isSleeping: false,
    todayFeedingTotal: todayFeedings.length.toString(),
    todayNapCount: 3,
    todayDiaperCount: 6,
  };

  const handleAddFeeding = useCallback(() => {
    setShowFeedingMenu(true);
  }, []);

  const handleFeedingMenuSelect = useCallback((option: FeedingMenuOption) => {
    if (option === "breastfeed") {
      router.push("/feeding/breastfeed");
    } else if (option === "bottle") {
      router.push("/feeding/bottle");
    } else if (option === "manual") {
      router.push("/feeding/manual");
    }
  }, [router]);

  const handleFeedingCardPress = useCallback(() => {
    if (isFeedingActive) {
      router.push("/feeding/breastfeed");
    }
  }, [isFeedingActive, router]);

  const handleAddSleep = () => {
    console.log("Add sleep");
  };

  const handleAddDiaper = () => {
    console.log("Add diaper");
  };

  const handleAddGrowth = () => {
    console.log("Add growth");
  };

  const handleAddPumping = () => {
    console.log("Add pumping");
  };

  const handleAddTummyTime = () => {
    console.log("Add tummy time");
  };

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
              timeSince={mockData.sleepTimeSince}
              isActive={mockData.isSleeping}
              activeLabel="Sleeping"
              onPress={() => {}}
              onActionPress={handleAddSleep}
              actionLabel={mockData.isSleeping ? undefined : "+"}
            />
          </View>

          {/* Row 2: Diaper & Pumping */}
          <View className="flex-row gap-3">
            <DashboardCard
              activity="diaper"
              label={t("diaper.title")}
              timeSince={mockData.diaperTimeSince}
              onPress={() => {}}
              onActionPress={handleAddDiaper}
              actionLabel="+"
            />
            <DashboardCard
              activity="pumping"
              label={t("pumping.title")}
              timeSince={mockData.pumpingTimeSince}
              onPress={() => {}}
              onActionPress={handleAddPumping}
              actionLabel="+"
            />
          </View>

          {/* Row 3: Tummy Time & Growth */}
          <View className="flex-row gap-3">
            <DashboardCard
              activity="tummyTime"
              label={t("tummyTime.title")}
              timeSince={mockData.tummyTimeTimeSince}
              onPress={() => {}}
              onActionPress={handleAddTummyTime}
              actionLabel="+"
            />
            <DashboardCard
              activity="growth"
              label={t("growth.title")}
              timeSince={mockData.growthTimeSince}
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
            diaperCount={mockData.todayDiaperCount}
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
