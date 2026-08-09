import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useTummyTime } from "@/contexts";
import { ACTIVITY, SURFACE, TEXT as TEXT_COLORS } from "@/constants/colors";
import { StatCard } from "../StatCard";
import { BarChartWithAxis } from "../BarChartWithAxis";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculateTummyTimeStats,
  calculateDailyBreakdown,
  getWeekdayLabelFromDateKey,
} from "@/utils/statistics";
import { formatDuration, formatDurationShort, type TranslateFn } from "@/utils/time";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import { computeNiceYAxis } from "@/utils/chart-axis";

export function TummyTimeWeekView() {
  const { t, i18n } = useTranslation();
  const { tummyTimes } = useTummyTime();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const locale = i18n.language;
  const formatMinutes = (value: number) =>
    formatDurationShort(0, value, t as TranslateFn);

  const accentColor = isDark ? ACTIVITY.tummyTime.accentDark : ACTIVITY.tummyTime.accent;
  const textAccent = isDark ? ACTIVITY.tummyTime.textAccentDark : ACTIVITY.tummyTime.textAccent;
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;

  const { stats, dailyMin, yAxis } = useMemo(() => {
    const range = getDateRangeForPeriod("7days");
    const weekTT = filterEntriesByDateRange(tummyTimes, range, (e) => e.startedAt);
    const s = calculateTummyTimeStats(weekTT);

    const breakdown = calculateDailyBreakdown<StoredTummyTimeEntry>(weekTT, (e) => e.startedAt, 7);
    const bars: { value: number; label: string }[] = [];
    for (const [dateKey, entries] of breakdown) {
      const label = getWeekdayLabelFromDateKey(dateKey, locale);
      const totalSec = entries.reduce((sum, tt) => sum + (tt.durationSeconds || 0), 0);
      bars.push({ value: Math.round(totalSec / 60), label });
    }

    return { stats: s, dailyMin: bars, yAxis: computeNiceYAxis(bars, 20) };
  }, [tummyTimes, locale]);

  const totalStr = formatDuration(stats.totalDurationSeconds, "short");
  const avgDaily = Math.round(stats.totalDurationSeconds / 7 / 60);
  const avgSession = stats.sessionCount > 0
    ? (Math.round(stats.totalDurationSeconds / stats.sessionCount / 60 * 10) / 10).toFixed(1)
    : "0";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <StatCard
        accentColor={accentColor}
        labelColor={textAccent}
        label={t("stats.tummyTime.7days")}
        value={totalStr}
        subtitle={t("stats.tummyTime.totalAcrossSessions", { count: stats.sessionCount })}
        details={[
          { label: t("stats.tummyTime.avgDailyTotal"), value: formatMinutes(avgDaily) },
          {
            label: t("stats.tummyTime.avgSessionLength"),
            value: formatMinutes(Number(avgSession)),
          },
        ]}
      />

      {dailyMin.some((d) => d.value > 0) && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary }}>
            {t("stats.tummyTime.dailyTummyTime")}
          </Text>
          <Text style={{ fontSize: 11, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary, marginTop: 2, marginBottom: 12 }}>
            {t("stats.tummyTime.dailyTummyTimeSub")}
          </Text>
          <BarChartWithAxis
            data={dailyMin}
            yAxisLabels={yAxis.labels}
            barColor={accentColor}
            maxY={yAxis.maxY}
            formatValue={formatMinutes}
          />
        </View>
      )}
    </ScrollView>
  );
}
