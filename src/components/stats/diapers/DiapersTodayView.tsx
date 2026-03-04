import { useMemo } from "react";
import { View, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useDiaper } from "@/contexts";
import { ACTIVITY, TEXT as TEXT_COLORS } from "@/constants/colors";
import { StatsMetricCard } from "../StatsMetricCard";
import { BreakdownCard } from "../BreakdownCard";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculateDiaperStats,
} from "@/utils/statistics";

function getDiaperTypeColors(isDark: boolean) {
  return {
    wet: isDark ? ACTIVITY.pumping.accentDark : ACTIVITY.pumping.accent,
    dirty: isDark ? ACTIVITY.diaper.accentDark : ACTIVITY.diaper.accent,
    mixed: isDark ? ACTIVITY.milestones.accentDark : ACTIVITY.milestones.accent,
    dry: isDark ? TEXT_COLORS.dark.secondary : TEXT_COLORS.light.tertiary,
  };
}

export function DiapersTodayView() {
  const { t } = useTranslation();
  const { diapers } = useDiaper();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = getDiaperTypeColors(isDark);

  const stats = useMemo(() => {
    const range = getDateRangeForPeriod("today");
    const todayDiapers = filterEntriesByDateRange(diapers, range, (e) => e.changedAt);
    return calculateDiaperStats(todayDiapers);
  }, [diapers]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatsMetricCard label={t("stats.diapers.totalDiapers")} value={String(stats.totalCount)} />
        <View style={{ flex: 1 }} />
      </View>

      <BreakdownCard
        title={t("stats.diapers.breakdown")}
        rows={[
          { color: colors.wet, label: t("stats.diapers.wet"), count: stats.wetCount },
          { color: colors.dirty, label: t("stats.diapers.dirty"), count: stats.dirtyCount },
          { color: colors.mixed, label: t("stats.diapers.mixed"), count: stats.mixedCount },
          { color: colors.dry, label: t("stats.diapers.dry"), count: stats.totalCount - stats.wetCount - stats.dirtyCount - stats.mixedCount },
        ]}
      />
    </ScrollView>
  );
}

export { getDiaperTypeColors };
