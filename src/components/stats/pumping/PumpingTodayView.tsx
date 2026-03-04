import { useMemo } from "react";
import { View, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { usePumping, useUnits } from "@/contexts";
import { formatVolume, mlToOz } from "@/utils/volume";
import { ACTIVITY } from "@/constants/colors";
import { HighlightCard } from "../HighlightCard";
import { StatsMetricCard } from "../StatsMetricCard";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculatePumpingStats,
} from "@/utils/statistics";

export function PumpingTodayView() {
  const { t } = useTranslation();
  const { pumpings } = usePumping();
  const { volumeUnit } = useUnits();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const accentColor = isDark ? ACTIVITY.pumping.accentDark : ACTIVITY.pumping.accent;
  const textAccent = isDark ? ACTIVITY.pumping.textAccentDark : ACTIVITY.pumping.textAccent;

  const stats = useMemo(() => {
    const range = getDateRangeForPeriod("today");
    const todayPumpings = filterEntriesByDateRange(pumpings, range, (e) => e.startedAt);
    return calculatePumpingStats(todayPumpings);
  }, [pumpings]);

  const avgPerSession = stats.totalCount > 0
    ? Math.round(stats.totalVolumeMl / stats.totalCount)
    : 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <HighlightCard
        accentColor={accentColor}
        labelColor={textAccent}
        label={t("stats.pumping.totalDailyOutput")}
        value={String(volumeUnit === "oz" ? mlToOz(stats.totalVolumeMl) : stats.totalVolumeMl)}
        unit={volumeUnit}
        subtitle={t("stats.pumping.acrossSessions", { count: stats.totalCount })}
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatsMetricCard label={t("stats.pumping.sessionsToday")} value={String(stats.totalCount)} />
        <StatsMetricCard label={t("stats.pumping.avgPerSession")} value={formatVolume(avgPerSession, volumeUnit)} />
      </View>
    </ScrollView>
  );
}
