import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { usePumping, useUnits } from "@/contexts";
import { formatVolume, mlToOz } from "@/utils/volume";
import { ACTIVITY, SURFACE, TEXT as TEXT_COLORS } from "@/constants/colors";
import { StatCard } from "../StatCard";
import { BarChartWithAxis } from "../BarChartWithAxis";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculatePumpingStats,
  calculateDailyBreakdown,
  getWeekdayLabelFromDateKey,
} from "@/utils/statistics";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import { computeNiceBottleYAxis } from "@/utils/chart-axis";

export function PumpingWeekView() {
  const { t, i18n } = useTranslation();
  const { pumpings } = usePumping();
  const { volumeUnit } = useUnits();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const locale = i18n.language;

  const accentColor = isDark ? ACTIVITY.pumping.accentDark : ACTIVITY.pumping.accent;
  const textAccent = isDark ? ACTIVITY.pumping.textAccentDark : ACTIVITY.pumping.textAccent;
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;

  const { stats, dailyMl, yAxis } = useMemo(() => {
    const range = getDateRangeForPeriod("7days");
    const weekPumpings = filterEntriesByDateRange(pumpings, range, (e) => e.startedAt);
    const s = calculatePumpingStats(weekPumpings);

    const breakdown = calculateDailyBreakdown<StoredPumpingEntry>(weekPumpings, (e) => e.startedAt, 7);
    const bars: { value: number; label: string }[] = [];
    for (const [dateKey, entries] of breakdown) {
      const label = getWeekdayLabelFromDateKey(dateKey, locale);
      const total = entries.reduce((sum, p) => sum + (p.volumeMl || 0), 0);
      bars.push({ value: total, label });
    }

    return {
      stats: s,
      dailyMl: bars,
      yAxis: computeNiceBottleYAxis(
        bars,
        volumeUnit,
        volumeUnit === "oz" ? 20 : 600
      ),
    };
  }, [pumpings, locale, volumeUnit]);

  const avgDaily = Math.round(stats.totalVolumeMl / 7);
  const avgPerSession = stats.totalCount > 0
    ? Math.round(stats.totalVolumeMl / stats.totalCount)
    : 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <StatCard
        accentColor={accentColor}
        labelColor={textAccent}
        label={t("stats.pumping.7days")}
        value={formatVolume(stats.totalVolumeMl, volumeUnit)}
        subtitle={t("stats.pumping.totalVolume")}
        details={[
          { label: t("stats.pumping.totalSessions"), value: String(stats.totalCount) },
          { label: t("stats.pumping.avgDailyOutput"), value: formatVolume(avgDaily, volumeUnit) },
          { label: t("stats.pumping.avgPerSession"), value: formatVolume(avgPerSession, volumeUnit) },
        ]}
      />

      {dailyMl.some((d) => d.value > 0) && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary }}>
            {t("stats.pumping.dailyVolume")}
          </Text>
          <Text style={{ fontSize: 11, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary, marginTop: 2, marginBottom: 12 }}>
            {t("stats.pumping.dailyVolumeSub", { unit: volumeUnit })}
          </Text>
          <BarChartWithAxis
            data={volumeUnit === "oz" ? dailyMl.map(d => ({ ...d, value: mlToOz(d.value) })) : dailyMl}
            yAxisLabels={yAxis.labels}
            barColor={accentColor}
            maxY={yAxis.maxY}
            formatBarLabel={volumeUnit === "oz" ? (v) => `${v} oz` : undefined}
          />
        </View>
      )}
    </ScrollView>
  );
}
