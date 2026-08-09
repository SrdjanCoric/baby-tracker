import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useDiaper } from "@/contexts";
import { ACTIVITY, SURFACE, TEXT as TEXT_COLORS } from "@/constants/colors";
import { StatCard } from "../StatCard";
import { BreakdownCard } from "../BreakdownCard";
import { StackedBarChartWithAxis } from "../StackedBarChartWithAxis";
import { getDiaperTypeColors } from "./DiapersTodayView";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculateDiaperStats,
  calculateDailyBreakdown,
  getWeekdayLabelFromDateKey,
} from "@/utils/statistics";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import { computeNiceCountYAxis } from "@/utils/chart-axis";

export function DiapersWeekView() {
  const { t, i18n } = useTranslation();
  const { diapers } = useDiaper();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const locale = i18n.language;

  const accentColor = isDark ? ACTIVITY.diaper.accentDark : ACTIVITY.diaper.accent;
  const textAccent = isDark ? ACTIVITY.diaper.textAccentDark : ACTIVITY.diaper.textAccent;
  const diaperColors = getDiaperTypeColors(isDark);
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;

  const { stats, chartData, yAxis } = useMemo(() => {
    const range = getDateRangeForPeriod("7days");
    const weekDiapers = filterEntriesByDateRange(diapers, range, (e) => e.changedAt);
    const s = calculateDiaperStats(weekDiapers);

    const breakdown = calculateDailyBreakdown<StoredDiaperEntry>(weekDiapers, (e) => e.changedAt, 7);
    const bars = [];
    for (const [dateKey, entries] of breakdown) {
      let wet = 0, dirty = 0, mixed = 0;
      for (const d of entries) {
        if (d.type === "wet") wet++;
        else if (d.type === "dirty") dirty++;
        else if (d.type === "mixed") mixed++;
      }
      bars.push({
        label: getWeekdayLabelFromDateKey(dateKey, locale),
        segments: [
          { value: wet, color: diaperColors.wet },
          { value: dirty, color: diaperColors.dirty },
          { value: mixed, color: diaperColors.mixed },
        ],
      });
    }

    const totals = bars.map((bar) => ({
      value: bar.segments.reduce((sum, segment) => sum + segment.value, 0),
    }));
    return { stats: s, chartData: bars, yAxis: computeNiceCountYAxis(totals, 12) };
  }, [diapers, locale, diaperColors.wet, diaperColors.dirty, diaperColors.mixed]);

  const avgPerDay = (stats.totalCount / 7).toFixed(1);
  const dryCount = stats.totalCount - stats.wetCount - stats.dirtyCount - stats.mixedCount;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <StatCard
        accentColor={accentColor}
        labelColor={textAccent}
        label={t("stats.diapers.7days")}
        value={String(stats.totalCount)}
        subtitle={t("stats.diapers.avgPerDay", { value: avgPerDay })}
      />

      <BreakdownCard
        title={t("stats.diapers.typeBreakdown")}
        rows={[
          { color: diaperColors.wet, label: t("stats.diapers.wet"), count: stats.wetCount },
          { color: diaperColors.dirty, label: t("stats.diapers.dirty"), count: stats.dirtyCount },
          { color: diaperColors.mixed, label: t("stats.diapers.mixed"), count: stats.mixedCount },
          { color: diaperColors.dry, label: t("stats.diapers.dry"), count: dryCount },
        ]}
      />

      {chartData.some((d) => d.segments.some((s) => s.value > 0)) && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary, marginBottom: 8 }}>
            {t("stats.diapers.dailyDiapers")}
          </Text>
          <StackedBarChartWithAxis
            data={chartData}
            yAxisLabels={yAxis.labels}
            legend={[
              { color: diaperColors.wet, label: t("stats.diapers.wet") },
              { color: diaperColors.dirty, label: t("stats.diapers.dirty") },
              { color: diaperColors.mixed, label: t("stats.diapers.mixed") },
            ]}
            maxY={yAxis.maxY}
          />
        </View>
      )}
    </ScrollView>
  );
}
