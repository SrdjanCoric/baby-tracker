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
import { StackedBarChartWithAxis } from "../StackedBarChartWithAxis";
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

function formatMinutes(v: number): string {
  if (v < 60) return `${v}m`;
  const h = Math.floor(v / 60);
  const m = v % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function computeNiceBottleYAxis(data: { value: number }[], unit: "ml" | "oz") {
  const dataMax = Math.max(...data.map((d) => d.value), 0);
  if (unit === "oz") {
    const maxOz = dataMax * 0.033814;
    const ceiling = Math.ceil(Math.max(maxOz * 1.2, 4));
    const niceSteps = [1, 2, 4, 5, 8, 10];
    const step = niceSteps.find((s) => Math.ceil(ceiling / s) <= 5)
      ?? Math.ceil(ceiling / 5);
    const count = Math.ceil(ceiling / step);
    const labels = Array.from({ length: count + 1 }, (_, i) => i * step);
    return { maxY: count * step, labels };
  }
  const ceiling = Math.ceil(Math.max(dataMax * 1.2, 100));
  const niceSteps = [25, 50, 100, 150, 200, 250];
  const step = niceSteps.find((s) => Math.ceil(ceiling / s) <= 5)
    ?? Math.ceil(ceiling / 5 / 50) * 50;
  const count = Math.ceil(ceiling / step);
  const labels = Array.from({ length: count + 1 }, (_, i) => i * step);
  return { maxY: count * step, labels };
}

function computeNiceYAxis(data: { value: number }[], minMax = 60) {
  const dataMax = Math.max(...data.map((d) => d.value), 0);
  const ceiling = Math.ceil(Math.max(dataMax * 1.2, minMax));
  const niceSteps = [15, 30, 45, 60, 90, 120];
  const step = niceSteps.find((s) => Math.ceil(ceiling / s) <= 5)
    ?? Math.ceil(ceiling / 5 / 60) * 60;
  const count = Math.ceil(ceiling / step);
  const labels = Array.from({ length: count + 1 }, (_, i) => i * step);
  return { maxY: count * step, labels };
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
      const label = getWeekdayLabel(dateKey, locale);
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
            {t("stats.feeding.bottleChartSub")}
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
