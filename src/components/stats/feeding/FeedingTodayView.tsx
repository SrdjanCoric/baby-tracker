import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useFeeding, useUnits } from "@/contexts";
import { formatVolume } from "@/utils/volume";
import { ACTIVITY, SURFACE, TEXT as TEXT_COLORS, BORDER } from "@/constants/colors";
import { StatsMetricCard } from "../StatsMetricCard";
import { BreastBalanceBar } from "../BreastBalanceBar";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculateExtendedFeedingStats,
} from "@/utils/statistics";
import { formatDuration, timeSince } from "@/utils/time";

export function FeedingTodayView() {
  const { t } = useTranslation();
  const { feedings } = useFeeding();
  const { volumeUnit } = useUnits();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? TEXT_COLORS.dark.primary : TEXT_COLORS.light.primary;
  const textSecondary = isDark ? TEXT_COLORS.dark.secondary : TEXT_COLORS.light.secondary;
  const textTertiary = isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary;
  const borderColor = isDark ? BORDER.dark.default : BORDER.light.default;

  const stats = useMemo(() => {
    const range = getDateRangeForPeriod("today");
    const todayFeedings = filterEntriesByDateRange(feedings, range, (e) => e.startedAt);
    return calculateExtendedFeedingStats(todayFeedings);
  }, [feedings]);

  const lastFeeding = useMemo(() => {
    if (feedings.length === 0) return null;
    const sorted = [...feedings].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  }, [feedings]);

  const timeSinceLastStr = lastFeeding
    ? timeSince(new Date(lastFeeding.startedAt))
    : "--";

  const avgBetweenStr = stats.avgTimeBetweenSessionsSeconds > 0
    ? formatDuration(stats.avgTimeBetweenSessionsSeconds, "short")
    : "--";

  const breastTimeStr = stats.totalDurationSeconds > 0
    ? formatDuration(stats.totalDurationSeconds, "short")
    : "--";

  const detailRows: { icon: string; label: string; value: string }[] = [];
  if (stats.totalBottleVolumeMl > 0)
    detailRows.push({ icon: "\uD83C\uDF7C", label: t("stats.feeding.bottleVolume"), value: formatVolume(stats.totalBottleVolumeMl, volumeUnit) });
  if (stats.bottleFormulaVolumeMl > 0)
    detailRows.push({ icon: "\uD83E\uDDEA", label: t("stats.feeding.formula"), value: formatVolume(stats.bottleFormulaVolumeMl, volumeUnit) });
  if (stats.bottleBreastMilkVolumeMl > 0)
    detailRows.push({ icon: "\uD83E\uDD31", label: t("stats.feeding.breastMilk"), value: formatVolume(stats.bottleBreastMilkVolumeMl, volumeUnit) });
  if (stats.solidsCount > 0)
    detailRows.push({ icon: "\uD83E\uDD44", label: t("stats.feeding.solids"), value: String(stats.solidsCount) });

  const hasDetails = stats.leftRightBalancePercent || detailRows.length > 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatsMetricCard label={t("stats.feeding.totalFeeds")} value={String(stats.totalCount)} />
        <StatsMetricCard label={t("stats.feeding.timeSinceLast")} value={timeSinceLastStr} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatsMetricCard label={t("stats.feeding.avgBetweenFeeds")} value={avgBetweenStr} />
        <StatsMetricCard label={t("stats.feeding.breastfeedingTime")} value={breastTimeStr} />
      </View>

      {hasDetails && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
          {stats.leftRightBalancePercent && (
            <View style={{ marginBottom: detailRows.length > 0 ? 8 : 0 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: textTertiary,
                  marginBottom: 8,
                }}
              >
                {t("stats.feeding.breastBalance")}
              </Text>
              <BreastBalanceBar
                leftPercent={stats.leftRightBalancePercent.left}
                rightPercent={stats.leftRightBalancePercent.right}
              />
            </View>
          )}
          {detailRows.map((row, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                borderTopWidth: (i > 0 || stats.leftRightBalancePercent) ? 1 : 0,
                borderTopColor: borderColor,
              }}
            >
              <Text style={{ fontSize: 15, marginRight: 10, width: 22, textAlign: "center" }}>
                {row.icon}
              </Text>
              <Text style={{ flex: 1, fontSize: 14, color: textSecondary, fontWeight: "500" }}>
                {row.label}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: textPrimary }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
