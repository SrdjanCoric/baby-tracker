import { useMemo } from "react";
import { View, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { usePumping } from "@/contexts";
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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const accentColor = isDark ? ACTIVITY.pumping.accentDark : ACTIVITY.pumping.accent;

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
        label={t("stats.pumping.totalDailyOutput")}
        value={String(stats.totalVolumeMl)}
        unit="ml"
        subtitle={t("stats.pumping.acrossSessions", { count: stats.totalCount })}
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatsMetricCard label={t("stats.pumping.sessionsToday")} value={String(stats.totalCount)} />
        <StatsMetricCard label={t("stats.pumping.avgPerSession")} value={`${avgPerSession} ml`} />
      </View>
    </ScrollView>
  );
}
