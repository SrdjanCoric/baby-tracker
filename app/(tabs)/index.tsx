import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BabyHeader,
  DashboardCard,
  TodaySummary,
} from "@/components";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const mockData = {
    feedingTimeSince: "2h 15m",
    sleepTimeSince: "45 min",
    diaperTimeSince: "1h 30m",
    pumpingTimeSince: "4h 20m",
    tummyTimeTimeSince: "3h",
    growthTimeSince: "5 days",
    isSleeping: false,
    todayFeedingTotal: "18 oz",
    todayNapCount: 3,
    todayDiaperCount: 6,
  };

  const handleAddFeeding = () => {
    console.log("Add feeding");
  };

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
              timeSince={mockData.feedingTimeSince}
              onPress={() => {}}
              onActionPress={handleAddFeeding}
              actionLabel="+"
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
    </SafeAreaView>
  );
}
