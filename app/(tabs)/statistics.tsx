import { useTranslation } from "react-i18next";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo, useCallback } from "react";
import { useColorScheme } from "nativewind";
import { getActionColor, ACTION_COLORS, SURFACE } from "@/constants/design-tokens";
import { useFeeding, useSleep, useDiaper, usePumping, useTummyTime, useBaby } from "@/contexts";
import { SimpleBarChart, StackedBarChart, TrendIndicator, EmptyState, LoadingState } from "@/components";
import { GrowthStatsCard } from "@/components/stats";
import { ACTIVITY_CONFIG } from "@/constants/activities";
import { formatDuration, timeSince } from "@/utils/time";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculateFeedingStats,
  calculateSleepStats,
  calculateDiaperStats,
  calculatePumpingStats,
  calculateTummyTimeStats,
  calculateWeeklyBreakdown,
  calculateDailyAverages,
} from "@/utils/statistics";
import { calculateWeekOverWeekTrend, type TrendResult } from "@/utils/trends";
import {
  generateWeeklySummary,
  type TrendData,
} from "@/utils/insights";
import { PDFService } from "@/services/pdf-service";
import { REPORT_SECTIONS } from "@/types/report";

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  subvalue?: string;
  color: string;
  trend?: TrendResult | null;
  trendFormatted?: string;
  showTrend?: boolean;
  isDark?: boolean;
}

function StatCard({
  icon,
  label,
  value,
  subvalue,
  color,
  trend,
  trendFormatted,
  showTrend = false,
  isDark = false,
}: StatCardProps) {
  const hasTrend = showTrend && trend && trend.direction !== "stable";
  const bgColor = isDark ? SURFACE.dark.card : SURFACE.light.card;

  return (
    <View
      className="flex-1 rounded-card p-4"
      style={{
        backgroundColor: bgColor,
        borderLeftWidth: 3,
        borderLeftColor: color,
      }}
    >
      <View className="flex-row items-center mb-2">
        <Text className="text-xl mr-2">{icon}</Text>
        <Text
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color }}
        >
          {label}
        </Text>
      </View>
      <Text
        className="text-2xl font-bold text-content-primary dark:text-content-dark-primary"
      >
        {value}
      </Text>
      {subvalue && (
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mt-1">
          {subvalue}
        </Text>
      )}
      {hasTrend && (
        <View className="mt-2">
          <TrendIndicator
            direction={trend.direction}
            percentageChange={trend.percentageChange}
            absoluteChangeFormatted={trendFormatted}
          />
        </View>
      )}
    </View>
  );
}

export default function StatisticsScreen() {
  const { t } = useTranslation();

  const { selectedBaby } = useBaby();
  const { feedings, isLoading: feedingsLoading, refreshFeedings, getLastFeeding } = useFeeding();
  const { sleeps, isLoading: sleepsLoading, refreshSleeps } = useSleep();
  const { diapers, isLoading: diapersLoading, refreshDiapers } = useDiaper();
  const { pumpings, isLoading: pumpingsLoading, refreshPumpings } = usePumping();
  const { tummyTimes, isLoading: tummyTimesLoading, refreshTummyTimes } = useTummyTime();
  const { colorScheme } = useColorScheme();
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const isLoading = feedingsLoading || sleepsLoading || diapersLoading || pumpingsLoading || tummyTimesLoading;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshFeedings(),
        refreshSleeps(),
        refreshDiapers(),
        refreshPumpings(),
        refreshTummyTimes(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFeedings, refreshSleeps, refreshDiapers, refreshPumpings, refreshTummyTimes]);

  const stats = useMemo(() => {
    const now = new Date();
    const dateRange = getDateRangeForPeriod("weekly", now);

    const filteredFeedings = filterEntriesByDateRange(
      feedings,
      dateRange,
      (entry) => entry.startedAt
    );
    const filteredSleeps = filterEntriesByDateRange(
      sleeps,
      dateRange,
      (entry) => entry.startedAt
    );
    const filteredDiapers = filterEntriesByDateRange(
      diapers,
      dateRange,
      (entry) => entry.changedAt
    );
    const filteredPumpings = filterEntriesByDateRange(
      pumpings,
      dateRange,
      (entry) => entry.startedAt
    );
    const filteredTummyTimes = filterEntriesByDateRange(
      tummyTimes,
      dateRange,
      (entry) => entry.startedAt
    );

    return {
      feeding: calculateFeedingStats(filteredFeedings),
      sleep: calculateSleepStats(filteredSleeps),
      diaper: calculateDiaperStats(filteredDiapers),
      pumping: calculatePumpingStats(filteredPumpings),
      tummyTime: calculateTummyTimeStats(filteredTummyTimes),
    };
  }, [feedings, sleeps, diapers, pumpings, tummyTimes]);

  const weeklyTrends = useMemo(() => {
    const now = new Date();

    const sleepTrend = calculateWeekOverWeekTrend(
      sleeps,
      (entry) => entry.startedAt,
      (entries) => entries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0),
      now
    );

    const feedingTrend = calculateWeekOverWeekTrend(
      feedings,
      (entry) => entry.startedAt,
      (entries) => entries.length,
      now
    );

    const diaperTrend = calculateWeekOverWeekTrend(
      diapers,
      (entry) => entry.changedAt,
      (entries) => entries.length,
      now
    );

    const tummyTimeTrend = calculateWeekOverWeekTrend(
      tummyTimes,
      (entry) => entry.startedAt,
      (entries) => entries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0),
      now
    );

    return {
      sleep: sleepTrend,
      feeding: feedingTrend,
      diaper: diaperTrend,
      tummyTime: tummyTimeTrend,
    };
  }, [sleeps, feedings, diapers, tummyTimes]);

  const trendDataArray = useMemo((): TrendData[] => {
    if (!weeklyTrends) return [];

    return [
      {
        type: "sleep",
        direction: weeklyTrends.sleep.direction,
        absoluteChange: weeklyTrends.sleep.absoluteChange,
        percentageChange: weeklyTrends.sleep.percentageChange,
        currentValue: weeklyTrends.sleep.currentValue,
        previousValue: weeklyTrends.sleep.previousValue,
      },
      {
        type: "feeding",
        direction: weeklyTrends.feeding.direction,
        absoluteChange: weeklyTrends.feeding.absoluteChange,
        percentageChange: weeklyTrends.feeding.percentageChange,
        currentValue: weeklyTrends.feeding.currentValue,
        previousValue: weeklyTrends.feeding.previousValue,
      },
      {
        type: "diaper",
        direction: weeklyTrends.diaper.direction,
        absoluteChange: weeklyTrends.diaper.absoluteChange,
        percentageChange: weeklyTrends.diaper.percentageChange,
        currentValue: weeklyTrends.diaper.currentValue,
        previousValue: weeklyTrends.diaper.previousValue,
      },
      {
        type: "tummyTime",
        direction: weeklyTrends.tummyTime.direction,
        absoluteChange: weeklyTrends.tummyTime.absoluteChange,
        percentageChange: weeklyTrends.tummyTime.percentageChange,
        currentValue: weeklyTrends.tummyTime.currentValue,
        previousValue: weeklyTrends.tummyTime.previousValue,
      },
    ];
  }, [weeklyTrends]);

  const weeklySummary = useMemo(() => {
    return generateWeeklySummary(trendDataArray);
  }, [trendDataArray]);

  const dailyAverages = useMemo(() => {
    return calculateDailyAverages(
      stats.feeding,
      stats.sleep,
      stats.diaper,
      stats.pumping,
      stats.tummyTime,
      7
    );
  }, [stats]);

  const formatSleepDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) {
      return `${minutes}m`;
    }
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const formatTrendDuration = (seconds: number): string => {
    const absSeconds = Math.abs(seconds);
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const sign = seconds >= 0 ? "+" : "-";
    if (hours === 0) {
      return `${sign}${minutes}m`;
    }
    if (minutes === 0) {
      return `${sign}${hours}h`;
    }
    return `${sign}${hours}h ${minutes}m`;
  };

  const feedingSubvalue = useMemo(() => {
    const parts: string[] = [];

    const lastFeeding = getLastFeeding();
    if (lastFeeding) {
      const timeAgo = timeSince(new Date(lastFeeding.startedAt));
      parts.push(t("statistics.timeAgo", { time: timeAgo }));
    }

    if (stats.feeding.totalDurationSeconds > 0) {
      parts.push(formatDuration(stats.feeding.totalDurationSeconds, "short"));
    } else if (stats.feeding.totalBottleVolumeMl > 0) {
      parts.push(`${stats.feeding.totalBottleVolumeMl} ml`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }, [getLastFeeding, feedings, stats.feeding, t]);

  const sleepSubvalue = stats.sleep.napCount > 0
    ? `${stats.sleep.napCount} ${stats.sleep.napCount === 1 ? "nap" : "naps"}`
    : undefined;

  const diaperSubvalue = (stats.diaper.wetCount > 0 || stats.diaper.dirtyCount > 0)
    ? `${stats.diaper.wetCount} wet · ${stats.diaper.dirtyCount + stats.diaper.mixedCount} dirty`
    : undefined;

  const pumpingSubvalue = stats.pumping.totalDurationSeconds > 0
    ? formatDuration(stats.pumping.totalDurationSeconds, "short")
    : undefined;

  const weeklyChartData = useMemo(() => {
    const now = new Date();
    const feedingBreakdown = calculateWeeklyBreakdown(
      feedings,
      (entry) => entry.startedAt,
      now
    );
    const diaperBreakdown = calculateWeeklyBreakdown(
      diapers,
      (entry) => entry.changedAt,
      now
    );
    const sleepBreakdown = calculateWeeklyBreakdown(
      sleeps,
      (entry) => entry.startedAt,
      now
    );

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const feedingData: { label: string; value: number }[] = [];
    const diaperData: { label: string; value: number }[] = [];
    const sleepData: { label: string; primary: number; secondary: number }[] = [];

    feedingBreakdown.forEach((entries, dateKey) => {
      const date = new Date(dateKey);
      feedingData.push({
        label: dayNames[date.getDay()],
        value: entries.length,
      });
    });

    diaperBreakdown.forEach((entries, dateKey) => {
      const date = new Date(dateKey);
      diaperData.push({
        label: dayNames[date.getDay()],
        value: entries.length,
      });
    });

    sleepBreakdown.forEach((entries, dateKey) => {
      const date = new Date(dateKey);
      const nightSleepHours = entries
        .filter((s) => s.type === "night")
        .reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
      const napHours = entries
        .filter((s) => s.type === "nap")
        .reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
      sleepData.push({
        label: dayNames[date.getDay()],
        primary: nightSleepHours,
        secondary: napHours,
      });
    });

    return { feedingData, diaperData, sleepData };
  }, [feedings, diapers, sleeps]);

  const showWeeklyTrends = !!weeklyTrends;

  const handleShareReport = useCallback(async () => {
    if (!selectedBaby) return;

    setIsGeneratingReport(true);
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const result = await PDFService.generateReport({
        babyId: selectedBaby.id,
        babyName: selectedBaby.name,
        babyBirthDate: selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined,
        babyGender: selectedBaby.gender as "male" | "female" | undefined,
        startDate: sevenDaysAgo,
        endDate: now,
        sections: REPORT_SECTIONS,
        includeCharts: true,
      });

      if (result.success && result.filePath && result.fileName) {
        await PDFService.shareReport(result.filePath, result.fileName);
      } else {
        Alert.alert(t("errors.generic"), result.error || t("reports.generateFailed"));
      }
    } catch (_error) {
      Alert.alert(t("errors.generic"), t("reports.generateFailed"));
    } finally {
      setIsGeneratingReport(false);
    }
  }, [selectedBaby, t]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
        <LoadingState fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={getActionColor("primary", colorScheme === "dark")}
            colors={[getActionColor("primary", colorScheme === "dark")]}
          />
        }
      >
        {weeklySummary.type !== "noData" && (
          <View className="mb-4 mt-2">
            <View
              className="rounded-card p-4"
              style={{
                backgroundColor: colorScheme === "dark"
                  ? "#2A2730"
                  : weeklySummary.type === "great" || weeklySummary.type === "improving"
                    ? "#EBF4F2"
                    : weeklySummary.type === "attention"
                      ? "#FBF0EE"
                      : "#F5F2F0"
              }}
            >
              <View className="flex-row items-start">
                <Text className="text-3xl mr-3">{weeklySummary.emoji}</Text>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary mb-1">
                    {t(weeklySummary.titleKey as never)}
                  </Text>
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary leading-5">
                    {t(weeklySummary.descriptionKey as never, weeklySummary.descriptionParams
                      ? Object.fromEntries(
                          Object.entries(weeklySummary.descriptionParams).map(([key, value]) => [key, t(value as never)])
                        )
                      : undefined)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("statistics.dailyAverages")}
          </Text>
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-4">
            <View className="flex-row flex-wrap">
              <View className="w-1/2 mb-3 pr-2">
                <View className="flex-row items-center">
                  <Text className="text-lg mr-2">{ACTIVITY_CONFIG.sleep.icon}</Text>
                  <Text
                    className="text-lg font-semibold"
                    style={{ color: ACTIVITY_CONFIG.sleep.accentColor }}
                  >
                    {dailyAverages.sleepHoursPerDay}h
                  </Text>
                  <Text className="text-base text-content-secondary dark:text-content-dark-secondary ml-1">
                    /day
                  </Text>
                </View>
              </View>

              <View className="w-1/2 mb-3 pl-2">
                <View className="flex-row items-center">
                  <Text className="text-lg mr-2">{ACTIVITY_CONFIG.feeding.icon}</Text>
                  <Text
                    className="text-lg font-semibold"
                    style={{ color: ACTIVITY_CONFIG.feeding.accentColor }}
                  >
                    {dailyAverages.feedingsPerDay}
                  </Text>
                  <Text className="text-base text-content-secondary dark:text-content-dark-secondary ml-1">
                    /day
                  </Text>
                </View>
              </View>

              <View className="w-1/2 pr-2">
                <View className="flex-row items-center">
                  <Text className="text-lg mr-2">{ACTIVITY_CONFIG.diaper.icon}</Text>
                  <Text
                    className="text-lg font-semibold"
                    style={{ color: ACTIVITY_CONFIG.diaper.accentColor }}
                  >
                    {dailyAverages.wetDiapersPerDay}
                  </Text>
                  <Text className="text-base text-content-secondary dark:text-content-dark-secondary ml-1">
                    wet/day
                  </Text>
                  {dailyAverages.wetDiapersPerDay >= 6 && (
                    <Text
                      className="text-base ml-1"
                      style={{ color: colorScheme === "dark" ? "#4ade80" : "#22c55e" }}
                    >
                      ✓
                    </Text>
                  )}
                </View>
              </View>

              {dailyAverages.tummyTimeMinutesPerDay > 0 && (
                <View className="w-1/2 pl-2">
                  <View className="flex-row items-center">
                    <Text className="text-lg mr-2">{ACTIVITY_CONFIG.tummyTime.icon}</Text>
                    <Text
                      className="text-lg font-semibold"
                      style={{ color: ACTIVITY_CONFIG.tummyTime.accentColor }}
                    >
                      {dailyAverages.tummyTimeMinutesPerDay}m
                    </Text>
                    <Text className="text-base text-content-secondary dark:text-content-dark-secondary ml-1">
                      /day
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("feeding.title")}
          </Text>
          <View className="flex-row gap-3">
            <StatCard
              icon={ACTIVITY_CONFIG.feeding.icon}
              label={t("statistics.totalFeedings")}
              value={String(stats.feeding.totalCount)}
              subvalue={feedingSubvalue}
              color={colorScheme === "dark" ? ACTIVITY_CONFIG.feeding.accentColorDark : ACTIVITY_CONFIG.feeding.accentColor}
              trend={weeklyTrends?.feeding}
              showTrend={!!showWeeklyTrends}
              isDark={colorScheme === "dark"}
            />
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("sleep.title")}
          </Text>
          <View className="flex-row gap-3">
            <StatCard
              icon={ACTIVITY_CONFIG.sleep.icon}
              label={t("statistics.totalSleep")}
              value={formatSleepDuration(stats.sleep.totalDurationSeconds)}
              subvalue={sleepSubvalue}
              color={colorScheme === "dark" ? ACTIVITY_CONFIG.sleep.accentColorDark : ACTIVITY_CONFIG.sleep.accentColor}
              trend={weeklyTrends?.sleep}
              trendFormatted={weeklyTrends?.sleep ? formatTrendDuration(weeklyTrends.sleep.absoluteChange) : undefined}
              showTrend={!!showWeeklyTrends}
              isDark={colorScheme === "dark"}
            />
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("diaper.title")}
          </Text>
          <View className="flex-row gap-3">
            <StatCard
              icon={ACTIVITY_CONFIG.diaper.icon}
              label={t("statistics.totalDiapers")}
              value={String(stats.diaper.totalCount)}
              subvalue={diaperSubvalue}
              color={colorScheme === "dark" ? ACTIVITY_CONFIG.diaper.accentColorDark : ACTIVITY_CONFIG.diaper.accentColor}
              trend={weeklyTrends?.diaper}
              showTrend={!!showWeeklyTrends}
              isDark={colorScheme === "dark"}
            />
          </View>
        </View>

        {stats.pumping.totalCount > 0 && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
              {t("pumping.title")}
            </Text>
            <View className="flex-row gap-3">
              <StatCard
                icon={ACTIVITY_CONFIG.pumping.icon}
                label={t("statistics.totalPumping")}
                value={stats.pumping.totalVolumeMl > 0 ? `${stats.pumping.totalVolumeMl} ml` : String(stats.pumping.totalCount)}
                subvalue={pumpingSubvalue}
                color={colorScheme === "dark" ? ACTIVITY_CONFIG.pumping.accentColorDark : ACTIVITY_CONFIG.pumping.accentColor}
                isDark={colorScheme === "dark"}
              />
            </View>
          </View>
        )}

        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("tummyTime.title")}
          </Text>
          <View className="flex-row gap-3">
            <View
              className="flex-1 rounded-card p-4"
              style={{
                backgroundColor: colorScheme === "dark" ? SURFACE.dark.card : SURFACE.light.card,
                borderLeftWidth: 3,
                borderLeftColor: colorScheme === "dark" ? ACTIVITY_CONFIG.tummyTime.accentColorDark : ACTIVITY_CONFIG.tummyTime.accentColor,
              }}
            >
              <View className="flex-row items-center mb-2">
                <Text className="text-xl mr-2">{ACTIVITY_CONFIG.tummyTime.icon}</Text>
                <Text
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: colorScheme === "dark" ? ACTIVITY_CONFIG.tummyTime.accentColorDark : ACTIVITY_CONFIG.tummyTime.accentColor }}
                >
                  {t("statistics.tummyTime")}
                </Text>
              </View>
              <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary">
                {formatDuration(stats.tummyTime.totalDurationSeconds, "short") || "0m"}
              </Text>
              {showWeeklyTrends && weeklyTrends.tummyTime.direction !== "stable" && (
                <View className="mt-2">
                  <TrendIndicator
                    direction={weeklyTrends.tummyTime.direction}
                    percentageChange={weeklyTrends.tummyTime.percentageChange}
                    absoluteChangeFormatted={formatTrendDuration(weeklyTrends.tummyTime.absoluteChange)}
                  />
                </View>
              )}
              {!showWeeklyTrends && (
                <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mt-1">
                  {stats.tummyTime.sessionCount} {stats.tummyTime.sessionCount === 1 ? "session" : "sessions"}
                </Text>
              )}
            </View>
          </View>
        </View>

        <GrowthStatsCard />

        {weeklyChartData && (stats.feeding.totalCount > 0 || stats.diaper.totalCount > 0 || (stats.sleep.napCount + stats.sleep.nightCount) > 0) && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
              {t("statistics.weeklyOverview")}
            </Text>
            <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-4">
              {stats.feeding.totalCount > 0 && (
                <View className="mb-4">
                  <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
                    {t("feeding.title")}
                  </Text>
                  <SimpleBarChart
                    data={weeklyChartData.feedingData}
                    color={ACTIVITY_CONFIG.feeding.accentColor}
                    height={100}
                  />
                </View>
              )}
              {stats.diaper.totalCount > 0 && (
                <View className={(stats.sleep.napCount + stats.sleep.nightCount) > 0 ? "mb-4" : ""}>
                  <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
                    {t("diaper.title")}
                  </Text>
                  <SimpleBarChart
                    data={weeklyChartData.diaperData}
                    color={ACTIVITY_CONFIG.diaper.accentColor}
                    height={100}
                  />
                </View>
              )}
              {(stats.sleep.napCount + stats.sleep.nightCount) > 0 && (
                <View>
                  <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
                    {t("sleep.title")}
                  </Text>
                  <StackedBarChart
                    data={weeklyChartData.sleepData}
                    primaryColor={colorScheme === "dark" ? "#6B7FD7" : "#5B6BC0"}
                    secondaryColor={colorScheme === "dark" ? "#9FA8DA" : "#7986CB"}
                    primaryLabel={t("sleep.night")}
                    secondaryLabel={t("sleep.nap")}
                    height={100}
                    formatValue={(v) => `${v.toFixed(1)}h`}
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {selectedBaby && (
          <View className="mb-6">
            <Pressable
              onPress={handleShareReport}
              disabled={isGeneratingReport}
              className="bg-surface-card dark:bg-surface-dark-card rounded-card p-4 active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{
                      backgroundColor: colorScheme === "dark"
                        ? "rgba(143, 192, 145, 0.15)"
                        : "rgba(107, 158, 110, 0.1)"
                    }}
                  >
                    <Text className="text-lg">📄</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
                      {t("statistics.shareReport")}
                    </Text>
                    <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                      {t("statistics.shareReportDescription")}
                    </Text>
                  </View>
                </View>
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: colorScheme === "dark"
                      ? ACTION_COLORS.dark.primary
                      : ACTION_COLORS.light.primary
                  }}
                >
                  {isGeneratingReport ? (
                    <Text className="text-white text-xs">...</Text>
                  ) : (
                    <Text className="text-white text-sm">→</Text>
                  )}
                </View>
              </View>
            </Pressable>
          </View>
        )}

        {(stats.feeding.totalCount === 0 && stats.sleep.totalDurationSeconds === 0 && stats.diaper.totalCount === 0 && stats.tummyTime.sessionCount === 0) && (
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card mb-6">
            <EmptyState
              icon="📊"
              title={t("statistics.noDataThisWeek")}
              compact
              testID="empty-stats"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
