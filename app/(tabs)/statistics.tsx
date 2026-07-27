import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { useBaby } from "@/contexts";
import { SURFACE, TEXT as TEXT_COLORS, ACTIVITY } from "@/constants/colors";
import {
  CategoryTabs,
  SegmentedTabs,
  SleepStatsContainer,
  FeedingTodayView,
  FeedingWeekView,
  DiapersTodayView,
  DiapersWeekView,
  GrowthStatsView,
  PumpingTodayView,
  PumpingWeekView,
  TummyTimeTodayView,
  TummyTimeWeekView,
  HealthStatsView,
} from "@/components/stats";
import type { StatsCategory } from "@/components/stats";
import { StatisticsActivityRange } from "@/components/stats/StatisticsActivityRange";

type PeriodMap = Record<StatsCategory, string>;

const SLEEP_TABS = ["day", "week", "summary"] as const;
const TWO_PERIOD_TABS = ["today", "7days"] as const;

const CATEGORY_ACCENT: Record<StatsCategory, { light: string; dark: string; textLight: string; textDark: string }> = {
  sleep: { light: ACTIVITY.sleep.accent, dark: ACTIVITY.sleep.accentDark, textLight: ACTIVITY.sleep.textAccent, textDark: ACTIVITY.sleep.textAccentDark },
  feeding: { light: ACTIVITY.feeding.accent, dark: ACTIVITY.feeding.accentDark, textLight: ACTIVITY.feeding.textAccent, textDark: ACTIVITY.feeding.textAccentDark },
  diapers: { light: ACTIVITY.diaper.accent, dark: ACTIVITY.diaper.accentDark, textLight: ACTIVITY.diaper.textAccent, textDark: ACTIVITY.diaper.textAccentDark },
  growth: { light: ACTIVITY.growth.accent, dark: ACTIVITY.growth.accentDark, textLight: ACTIVITY.growth.textAccent, textDark: ACTIVITY.growth.textAccentDark },
  pumping: { light: ACTIVITY.pumping.accent, dark: ACTIVITY.pumping.accentDark, textLight: ACTIVITY.pumping.textAccent, textDark: ACTIVITY.pumping.textAccentDark },
  tummyTime: { light: ACTIVITY.tummyTime.accent, dark: ACTIVITY.tummyTime.accentDark, textLight: ACTIVITY.tummyTime.textAccent, textDark: ACTIVITY.tummyTime.textAccentDark },
  health: { light: ACTIVITY.health.accent, dark: ACTIVITY.health.accentDark, textLight: ACTIVITY.health.textAccent, textDark: ACTIVITY.health.textAccentDark },
};

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { selectedBaby } = useBaby();

  const bgColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const textPrimary = isDark ? TEXT_COLORS.dark.primary : TEXT_COLORS.light.primary;
  const textSecondary = isDark ? TEXT_COLORS.dark.secondary : TEXT_COLORS.light.secondary;

  const [activeCategory, setActiveCategory] = useState<StatsCategory>("sleep");
  const [periodByCategory, setPeriodByCategory] = useState<PeriodMap>({
    sleep: "day",
    feeding: "today",
    diapers: "today",
    growth: "none",
    pumping: "today",
    tummyTime: "today",
    health: "none",
  });

  const categories = [
    { key: "sleep" as const, label: t("stats.categories.sleep") },
    { key: "feeding" as const, label: t("stats.categories.feeding") },
    { key: "diapers" as const, label: t("stats.categories.diapers") },
    { key: "pumping" as const, label: t("stats.categories.pumping") },
    { key: "tummyTime" as const, label: t("stats.categories.tummyTime") },
    { key: "health" as const, label: t("stats.categories.health") },
    { key: "growth" as const, label: t("stats.categories.growth") },
  ];

  const activePeriod = periodByCategory[activeCategory];
  const textAccentColor = isDark
    ? CATEGORY_ACCENT[activeCategory].textDark
    : CATEGORY_ACCENT[activeCategory].textLight;

  const handlePeriodChange = useCallback(
    (period: string) => {
      setPeriodByCategory((prev) => ({ ...prev, [activeCategory]: period }));
    },
    [activeCategory]
  );

  const getSegmentedTabs = () => {
    if (activeCategory === "sleep") {
      return SLEEP_TABS.map((key) => ({
        key,
        label: t(`stats.periods.${key}`),
      }));
    }
    if (activeCategory === "growth" || activeCategory === "health") return null;
    return TWO_PERIOD_TABS.map((key) => ({
      key,
      label: t(`stats.periods.${key}`),
    }));
  };

  const segmentedTabs = getSegmentedTabs();

  const renderContent = () => {
    switch (activeCategory) {
      case "sleep":
        return <SleepStatsContainer activeTab={activePeriod} />;
      case "feeding":
        return activePeriod === "today" ? <FeedingTodayView /> : <FeedingWeekView />;
      case "diapers":
        return activePeriod === "today" ? <DiapersTodayView /> : <DiapersWeekView />;
      case "growth":
        return <GrowthStatsView />;
      case "pumping":
        return activePeriod === "today" ? <PumpingTodayView /> : <PumpingWeekView />;
      case "tummyTime":
        return activePeriod === "today" ? <TummyTimeTodayView /> : <TummyTimeWeekView />;
      case "health":
        return <HealthStatsView />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={["top"]}>
      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: textPrimary, letterSpacing: -0.3 }}>
          {t("stats.title")}
        </Text>
        {selectedBaby && (
          <Text style={{ fontSize: 14, color: textSecondary, marginTop: 2 }}>
            {selectedBaby.name}
          </Text>
        )}
      </View>

      <CategoryTabs
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <View style={{ height: 8 }} />

      {segmentedTabs && (
        <SegmentedTabs
          tabs={segmentedTabs}
          activeTab={activePeriod}
          onTabChange={handlePeriodChange}
          accentColor={textAccentColor}
        />
      )}

      <View style={{ flex: 1 }}>
        {activeCategory === "sleep" ? renderContent() : (
          <StatisticsActivityRange category={activeCategory} period={activePeriod}>
            {renderContent()}
          </StatisticsActivityRange>
        )}
      </View>
    </SafeAreaView>
  );
}
