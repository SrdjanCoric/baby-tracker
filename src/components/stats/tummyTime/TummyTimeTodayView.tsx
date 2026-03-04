import { useMemo } from "react";
import { View, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useTummyTime } from "@/contexts";
import { ACTIVITY } from "@/constants/colors";
import { HighlightCard } from "../HighlightCard";
import { StatsMetricCard } from "../StatsMetricCard";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculateTummyTimeStats,
  calculateRolling7DayAverage,
} from "@/utils/statistics";
import { formatDuration } from "@/utils/time";

export function TummyTimeTodayView() {
  const { t } = useTranslation();
  const { tummyTimes } = useTummyTime();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const accentColor = isDark ? ACTIVITY.tummyTime.accentDark : ACTIVITY.tummyTime.accent;

  const { stats, comparisonText } = useMemo(() => {
    const range = getDateRangeForPeriod("today");
    const todayTT = filterEntriesByDateRange(tummyTimes, range, (e) => e.startedAt);
    const s = calculateTummyTimeStats(todayTT);

    const rolling = calculateRolling7DayAverage([], [], [], tummyTimes);
    const avgSecondsPerDay = rolling.tummyTimeSecondsPerDay;
    const diffSeconds = s.totalDurationSeconds - avgSecondsPerDay;
    const diffStr = formatDuration(Math.abs(diffSeconds), "short");

    let comparison: string | undefined;
    if (avgSecondsPerDay > 0) {
      if (diffSeconds > 0) {
        comparison = t("stats.tummyTime.aboveAvg", { value: diffStr });
      } else if (diffSeconds < 0) {
        comparison = t("stats.tummyTime.belowAvg", { value: diffStr });
      }
    }

    return { stats: s, comparisonText: comparison };
  }, [tummyTimes, t]);

  const totalStr = formatDuration(stats.totalDurationSeconds, "short");
  const longestStr = stats.averageDurationSeconds > 0
    ? formatDuration(
        tummyTimes.length > 0
          ? Math.max(...tummyTimes
              .filter((tt) => {
                const d = new Date(tt.startedAt);
                const today = new Date();
                return d.toDateString() === today.toDateString();
              })
              .map((tt) => tt.durationSeconds || 0))
          : 0,
        "short"
      )
    : "--";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <HighlightCard
        accentColor={accentColor}
        label={t("stats.tummyTime.totalTummyTime")}
        value={totalStr}
        subtitle={`${stats.sessionCount} ${t("stats.feeding.sessions")}`}
        comparisonText={comparisonText}
        comparisonPositive={comparisonText?.includes("↑")}
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatsMetricCard label={t("stats.tummyTime.sessions")} value={String(stats.sessionCount)} />
        <StatsMetricCard label={t("stats.tummyTime.longestSession")} value={longestStr} />
      </View>
    </ScrollView>
  );
}
