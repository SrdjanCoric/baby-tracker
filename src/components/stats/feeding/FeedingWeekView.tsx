import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useFeeding, useUnits } from "@/contexts";
import { formatVolume, mlToOz } from "@/utils/volume";
import { ACTIVITY, SURFACE, TEXT as TEXT_COLORS } from "@/constants/colors";
import { StatCard } from "../StatCard";
import { BreastBalanceBar } from "../BreastBalanceBar";
import { BarChartWithAxis } from "../BarChartWithAxis";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculateExtendedFeedingStats,
  calculateDailyBreakdown,
} from "@/utils/statistics";
import { formatDuration } from "@/utils/time";
import type { StoredFeedingEntry } from "@/services/feeding-storage";

function getWeekdayLabel(dateKey: string, locale: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.toLocaleDateString(locale, { weekday: "short" });
}

export function FeedingWeekView() {
  const { t, i18n } = useTranslation();
  const { feedings } = useFeeding();
  const { volumeUnit } = useUnits();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const locale = i18n.language;

  const accentColor = isDark ? ACTIVITY.feeding.accentDark : ACTIVITY.feeding.accent;
  const textAccent = isDark ? ACTIVITY.feeding.textAccentDark : ACTIVITY.feeding.textAccent;
  const accentDark = isDark ? ACTIVITY.feeding.buttonDark : ACTIVITY.feeding.button;
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;

  const { stats, dailyBreastMin, dailyBottleMl } = useMemo(() => {
    const range = getDateRangeForPeriod("7days");
    const weekFeedings = filterEntriesByDateRange(feedings, range, (e) => e.startedAt);
    const s = calculateExtendedFeedingStats(weekFeedings);

    const breakdown = calculateDailyBreakdown<StoredFeedingEntry>(weekFeedings, (e) => e.startedAt, 7);
    const breastMin: { value: number; label: string }[] = [];
    const bottleMl: { value: number; label: string }[] = [];

    for (const [dateKey, entries] of breakdown) {
      const label = getWeekdayLabel(dateKey, locale);
      let breastSec = 0;
      let bottleVol = 0;
      for (const f of entries) {
        if (f.type === "breast" && f.durationSeconds) breastSec += f.durationSeconds;
        if (f.type === "bottle" && f.amountMl) bottleVol += f.amountMl;
      }
      breastMin.push({ value: Math.round(breastSec / 60), label });
      bottleMl.push({ value: bottleVol, label });
    }

    return { stats: s, dailyBreastMin: breastMin, dailyBottleMl: bottleMl };
  }, [feedings, locale]);

  const avgPerDay = (stats.totalCount / 7).toFixed(1);
  const avgBetweenStr = stats.avgTimeBetweenSessionsSeconds > 0
    ? formatDuration(stats.avgTimeBetweenSessionsSeconds, "short")
    : "--";

  const details = [
    { label: t("stats.feeding.avgBetween"), value: avgBetweenStr },
    ...(stats.leftRightBalancePercent
      ? [{
          label: t("stats.feeding.breastBalance"),
          children: (
            <BreastBalanceBar
              leftPercent={stats.leftRightBalancePercent.left}
              rightPercent={stats.leftRightBalancePercent.right}
            />
          ),
        }]
      : []),
    ...(stats.totalBottleVolumeMl > 0
      ? [{ label: t("stats.feeding.bottleVolumeTotal"), value: formatVolume(stats.totalBottleVolumeMl, volumeUnit) }]
      : []),
  ];

  const hasBreastData = dailyBreastMin.some((d) => d.value > 0);
  const hasBottleData = dailyBottleMl.some((d) => d.value > 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <StatCard
        accentColor={accentColor}
        labelColor={textAccent}
        label={t("stats.feeding.7days")}
        value={`${stats.totalCount} ${t("stats.feeding.sessions")}`}
        subtitle={t("stats.feeding.avgPerDay", { value: avgPerDay })}
        details={details}
      />

      {hasBreastData && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary }}>
            {t("stats.feeding.breastfeedingChart")}
          </Text>
          <Text style={{ fontSize: 11, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary, marginTop: 2, marginBottom: 12 }}>
            {t("stats.feeding.breastfeedingChartSub")}
          </Text>
          <BarChartWithAxis
            data={dailyBreastMin}
            yAxisLabels={[0, 15, 30, 45, 60]}
            barColor={accentColor}
            maxY={60}
            formatBarLabel={(v) => `${v}m`}
          />
        </View>
      )}

      {hasBottleData && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary }}>
            {t("stats.feeding.bottleChart")}
          </Text>
          <Text style={{ fontSize: 11, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary, marginTop: 2, marginBottom: 12 }}>
            {t("stats.feeding.bottleChartSub")}
          </Text>
          <BarChartWithAxis
            data={volumeUnit === "oz" ? dailyBottleMl.map(d => ({ ...d, value: mlToOz(d.value) })) : dailyBottleMl}
            yAxisLabels={volumeUnit === "oz" ? [0, 2, 4, 6, 8] : [0, 50, 100, 150, 200]}
            barColor={accentDark}
            maxY={volumeUnit === "oz" ? 8 : 200}
            formatBarLabel={volumeUnit === "oz" ? (v) => `${v} oz` : undefined}
          />
        </View>
      )}
    </ScrollView>
  );
}
