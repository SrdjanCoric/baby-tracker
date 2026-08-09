import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useFeeding, useUnits } from "@/contexts";
import { formatVolume, mlToOz } from "@/utils/volume";
import { ACTIVITY, SURFACE, TEXT as TEXT_COLORS } from "@/constants/colors";
import { formatDurationShort, type TranslateFn } from "@/utils/time";
import { StatCard } from "../StatCard";
import { BreastBalanceBar } from "../BreastBalanceBar";
import { BarChartWithAxis } from "../BarChartWithAxis";
import { StackedBarChartWithAxis } from "../StackedBarChartWithAxis";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculateExtendedFeedingStats,
  calculateDailyBreakdown,
  getWeekdayLabelFromDateKey,
} from "@/utils/statistics";
import { formatDuration } from "@/utils/time";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import { computeNiceBottleYAxis, computeNiceYAxis } from "@/utils/chart-axis";

function makeMinuteFormatter(t: (key: string, opts?: Record<string, unknown>) => string) {
  return (v: number): string => {
    const h = Math.floor(v / 60);
    const m = v % 60;
    return formatDurationShort(h, m, t);
  };
}

export function FeedingWeekView() {
  const { t, i18n } = useTranslation();
  const { feedings } = useFeeding();
  const { volumeUnit } = useUnits();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const locale = i18n.language;
  const formatMinutes = makeMinuteFormatter(t as TranslateFn);

  const accentColor = isDark ? ACTIVITY.feeding.accentDark : ACTIVITY.feeding.accent;
  const textAccent = isDark ? ACTIVITY.feeding.textAccentDark : ACTIVITY.feeding.textAccent;
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;

  const { stats, dailyBreastMin, dailyBottleStacked, breastYAxis, bottleYAxis } = useMemo(() => {
    const range = getDateRangeForPeriod("7days");
    const weekFeedings = filterEntriesByDateRange(feedings, range, (e) => e.startedAt);
    const s = calculateExtendedFeedingStats(weekFeedings);

    const breakdown = calculateDailyBreakdown<StoredFeedingEntry>(weekFeedings, (e) => e.startedAt, 7);
    const breastMin: { value: number; label: string }[] = [];
    const bottleStacked: { segments: { value: number; color: string }[]; label: string }[] = [];
    const bottleTotals: { value: number }[] = [];

    const bmColor = isDark ? ACTIVITY.feeding.accentDark : ACTIVITY.feeding.accent;
    const formulaColor = isDark ? ACTIVITY.tummyTime.accentDark : ACTIVITY.tummyTime.accent;

    for (const [dateKey, entries] of breakdown) {
      const label = getWeekdayLabelFromDateKey(dateKey, locale);
      let breastSec = 0;
      let bmVol = 0;
      let formulaVol = 0;
      for (const f of entries) {
        if (f.type === "breast" && f.durationSeconds) breastSec += f.durationSeconds;
        if (f.type === "bottle" && f.amountMl) {
          if (f.contentType === "breastMilk") {
            bmVol += f.amountMl;
          } else {
            formulaVol += f.amountMl;
          }
        }
      }
      breastMin.push({ value: Math.round(breastSec / 60), label });
      bottleStacked.push({
        segments: [
          { value: formulaVol, color: formulaColor },
          { value: bmVol, color: bmColor },
        ],
        label,
      });
      bottleTotals.push({ value: bmVol + formulaVol });
    }

    const breastYAxis = computeNiceYAxis(breastMin);
    const bottleYAxis = computeNiceBottleYAxis(bottleTotals, volumeUnit);
    return { stats: s, dailyBreastMin: breastMin, dailyBottleStacked: bottleStacked, breastYAxis, bottleYAxis };
  }, [feedings, locale, isDark, volumeUnit]);

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
  const hasBottleData = dailyBottleStacked.some((d) => d.segments.some((s) => s.value > 0));

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
            yAxisLabels={breastYAxis.labels}
            barColor={accentColor}
            maxY={breastYAxis.maxY}
            formatBarLabel={formatMinutes}
            formatValue={formatMinutes}
          />
        </View>
      )}

      {hasBottleData && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary }}>
            {t("stats.feeding.bottleChart")}
          </Text>
          <Text style={{ fontSize: 11, color: isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary, marginTop: 2, marginBottom: 12 }}>
            {t("stats.feeding.bottleChartSub", { unit: volumeUnit })}
          </Text>
          <StackedBarChartWithAxis
            data={volumeUnit === "oz"
              ? dailyBottleStacked.map(d => ({
                  ...d,
                  segments: d.segments.map(s => ({ ...s, value: Math.round(mlToOz(s.value) * 10) / 10 })),
                }))
              : dailyBottleStacked
            }
            yAxisLabels={bottleYAxis.labels}
            maxY={bottleYAxis.maxY}
            legend={[
              { color: isDark ? ACTIVITY.feeding.accentDark : ACTIVITY.feeding.accent, label: t("feeding.breastMilk") },
              { color: isDark ? ACTIVITY.tummyTime.accentDark : ACTIVITY.tummyTime.accent, label: t("feeding.formula") },
            ]}
            showBarLabels
            formatBarLabel={volumeUnit === "oz" ? (v) => `${Math.round(v * 10) / 10} oz` : undefined}
          />
        </View>
      )}
    </ScrollView>
  );
}
