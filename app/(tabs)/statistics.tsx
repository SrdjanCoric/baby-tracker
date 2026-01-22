import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo, useCallback } from "react";
import { useColorScheme } from "nativewind";
import { getActionColor } from "@/constants/design-tokens";
import { useFeeding, useSleep, useDiaper, usePumping, useTummyTime } from "@/contexts";
import { SimpleBarChart, TrendIndicator, InsightCard, EmptyState, LoadingState } from "@/components";
import { ACTIVITY_CONFIG } from "@/constants/activities";
import { formatDuration } from "@/utils/time";
import {
  getDateRangeForPeriod,
  filterEntriesByDateRange,
  calculateFeedingStats,
  calculateSleepStats,
  calculateDiaperStats,
  calculatePumpingStats,
  calculateTummyTimeStats,
  calculateWeeklyBreakdown,
  type StatisticsPeriod,
} from "@/utils/statistics";
import { calculateWeekOverWeekTrend, type TrendResult } from "@/utils/trends";
import {
  generateInsights,
  prioritizeInsights,
  type TrendData,
  type Insight,
} from "@/utils/insights";

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  subvalue?: string;
  color: string;
  bgColor: string;
  trend?: TrendResult | null;
  trendFormatted?: string;
  showTrend?: boolean;
}

function StatCard({
  icon,
  label,
  value,
  subvalue,
  color,
  bgColor,
  trend,
  trendFormatted,
  showTrend = false,
}: StatCardProps) {
  const hasTrend = showTrend && trend && trend.direction !== "stable";

  return (
    <View
      className="flex-1 rounded-card p-4"
      style={{ backgroundColor: bgColor }}
    >
      <View className="flex-row items-center mb-2">
        <Text className="text-xl mr-2">{icon}</Text>
        <Text className="text-xs font-semibold uppercase tracking-wider text-content-secondary dark:text-content-dark-secondary">
          {label}
        </Text>
      </View>
      <Text
        className="text-stat font-bold"
        style={{ color }}
      >
        {value}
      </Text>
      {subvalue && (
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-1">
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
  const [period, setPeriod] = useState<StatisticsPeriod>("daily");

  const { feedings, isLoading: feedingsLoading, refreshFeedings } = useFeeding();
  const { sleeps, isLoading: sleepsLoading, refreshSleeps } = useSleep();
  const { diapers, isLoading: diapersLoading, refreshDiapers } = useDiaper();
  const { pumpings, isLoading: pumpingsLoading, refreshPumpings } = usePumping();
  const { tummyTimes, dailyGoalSeconds, getDailyProgress, isLoading: tummyTimesLoading, refreshTummyTimes } = useTummyTime();
  const { colorScheme } = useColorScheme();

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
    const dateRange = getDateRangeForPeriod(period, now);

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
  }, [period, feedings, sleeps, diapers, pumpings, tummyTimes]);

  const weeklyTrends = useMemo(() => {
    if (period !== "weekly") return null;

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
  }, [period, sleeps, feedings, diapers, tummyTimes]);

  const insights = useMemo((): Insight[] => {
    if (period !== "weekly" || !weeklyTrends) return [];

    const trendDataArray: TrendData[] = [
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

    const generatedInsights = generateInsights(trendDataArray);
    return prioritizeInsights(generatedInsights, 3);
  }, [period, weeklyTrends]);

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

  const feedingSubvalue = stats.feeding.totalDurationSeconds > 0
    ? formatDuration(stats.feeding.totalDurationSeconds, "short")
    : stats.feeding.totalBottleVolumeMl > 0
      ? `${stats.feeding.totalBottleVolumeMl} ml`
      : undefined;

  const sleepSubvalue = stats.sleep.napCount > 0
    ? `${stats.sleep.napCount} ${stats.sleep.napCount === 1 ? "nap" : "naps"}`
    : undefined;

  const diaperSubvalue = (stats.diaper.wetCount > 0 || stats.diaper.dirtyCount > 0)
    ? `${stats.diaper.wetCount} wet · ${stats.diaper.dirtyCount + stats.diaper.mixedCount} dirty`
    : undefined;

  const pumpingSubvalue = stats.pumping.totalDurationSeconds > 0
    ? formatDuration(stats.pumping.totalDurationSeconds, "short")
    : undefined;

  const tummyTimeGoalProgress = period === "daily" ? getDailyProgress() : null;

  const weeklyChartData = useMemo(() => {
    if (period !== "weekly") return null;

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

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const feedingData: { label: string; value: number }[] = [];
    const diaperData: { label: string; value: number }[] = [];

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

    return { feedingData, diaperData };
  }, [period, feedings, diapers]);

  const showWeeklyTrends = period === "weekly" && weeklyTrends;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
        <LoadingState fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
      <View className="flex-row mx-4 mt-2 mb-4 p-1 bg-surface-secondary dark:bg-surface-dark-secondary rounded-pill">
        <Pressable
          onPress={() => setPeriod("daily")}
          className={`flex-1 py-2 rounded-pill ${
            period === "daily" ? "bg-surface-card dark:bg-surface-dark-card" : ""
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              period === "daily"
                ? "text-content-primary dark:text-content-dark-primary"
                : "text-content-secondary dark:text-content-dark-secondary"
            }`}
          >
            {t("statistics.daily")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setPeriod("weekly")}
          className={`flex-1 py-2 rounded-pill ${
            period === "weekly" ? "bg-surface-card dark:bg-surface-dark-card" : ""
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              period === "weekly"
                ? "text-content-primary dark:text-content-dark-primary"
                : "text-content-secondary dark:text-content-dark-secondary"
            }`}
          >
            {t("statistics.weekly")}
          </Text>
        </Pressable>
      </View>

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
        {showWeeklyTrends && insights.length > 0 && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
              {t("statistics.weeklyInsights")}
            </Text>
            <View className="gap-2">
              {insights.map((insight, index) => (
                <InsightCard key={`${insight.type}-${index}`} insight={insight} />
              ))}
            </View>
          </View>
        )}

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
              color={ACTIVITY_CONFIG.feeding.accentColor}
              bgColor={ACTIVITY_CONFIG.feeding.mutedBg}
              trend={weeklyTrends?.feeding}
              showTrend={!!showWeeklyTrends}
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
              color={ACTIVITY_CONFIG.sleep.accentColor}
              bgColor={ACTIVITY_CONFIG.sleep.mutedBg}
              trend={weeklyTrends?.sleep}
              trendFormatted={weeklyTrends?.sleep ? formatTrendDuration(weeklyTrends.sleep.absoluteChange) : undefined}
              showTrend={!!showWeeklyTrends}
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
              color={ACTIVITY_CONFIG.diaper.accentColor}
              bgColor={ACTIVITY_CONFIG.diaper.mutedBg}
              trend={weeklyTrends?.diaper}
              showTrend={!!showWeeklyTrends}
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
                color={ACTIVITY_CONFIG.pumping.accentColor}
                bgColor={ACTIVITY_CONFIG.pumping.mutedBg}
              />
            </View>
          </View>
        )}

        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("tummyTime.title")}
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-card p-4" style={{ backgroundColor: ACTIVITY_CONFIG.tummyTime.mutedBg }}>
              <View className="flex-row items-center mb-2">
                <Text className="text-xl mr-2">{ACTIVITY_CONFIG.tummyTime.icon}</Text>
                <Text className="text-xs font-semibold uppercase tracking-wider text-content-secondary dark:text-content-dark-secondary">
                  {t("statistics.tummyTime")}
                </Text>
              </View>
              <Text className="text-stat font-bold" style={{ color: ACTIVITY_CONFIG.tummyTime.accentColor }}>
                {formatDuration(stats.tummyTime.totalDurationSeconds, "short") || "0m"}
              </Text>
              {period === "daily" && dailyGoalSeconds > 0 && (
                <View className="mt-2">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                      {t("tummyTime.dailyGoal")}: {Math.round(dailyGoalSeconds / 60)}m
                    </Text>
                    <Text className="text-xs font-semibold" style={{ color: ACTIVITY_CONFIG.tummyTime.accentColor }}>
                      {tummyTimeGoalProgress}%
                    </Text>
                  </View>
                  <View className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(tummyTimeGoalProgress ?? 0, 100)}%`,
                        backgroundColor: ACTIVITY_CONFIG.tummyTime.accentColor,
                      }}
                    />
                  </View>
                </View>
              )}
              {showWeeklyTrends && weeklyTrends.tummyTime.direction !== "stable" && (
                <View className="mt-2">
                  <TrendIndicator
                    direction={weeklyTrends.tummyTime.direction}
                    percentageChange={weeklyTrends.tummyTime.percentageChange}
                    absoluteChangeFormatted={formatTrendDuration(weeklyTrends.tummyTime.absoluteChange)}
                  />
                </View>
              )}
              {period === "weekly" && !showWeeklyTrends && (
                <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-1">
                  {stats.tummyTime.sessionCount} {stats.tummyTime.sessionCount === 1 ? "session" : "sessions"}
                </Text>
              )}
            </View>
          </View>
        </View>

        {period === "weekly" && weeklyChartData && (stats.feeding.totalCount > 0 || stats.diaper.totalCount > 0) && (
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
                <View>
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
            </View>
          </View>
        )}

        {(stats.feeding.totalCount === 0 && stats.sleep.totalDurationSeconds === 0 && stats.diaper.totalCount === 0 && stats.tummyTime.sessionCount === 0) && (
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card mb-6">
            <EmptyState
              icon="📊"
              title={period === "daily" ? t("statistics.noDataToday") : t("statistics.noDataThisWeek")}
              compact
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
