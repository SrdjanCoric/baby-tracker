import { useTranslation } from "react-i18next";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo, useCallback } from "react";
import { useColorScheme } from "nativewind";
import { getActionColor, ACTION_COLORS, SURFACE, BORDER } from "@/constants/design-tokens";
import { useFeeding, useSleep, useDiaper, usePumping, useTummyTime, useBaby } from "@/contexts";
import { SimpleBarChart, StackedBarChart, TrendIndicator, EmptyState, LoadingState } from "@/components";
import {
  GrowthStatsCard,
  PeriodPicker,
  TodayComparisonCard,
  BreastBalanceBar,
  StoolColorDistribution,
} from "@/components/stats";
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
  calculateDailyBreakdown,
  calculateDailyAverages,
  calculateExtendedFeedingStats,
  calculateExtendedSleepStats,
  calculateExtendedDiaperStats,
  calculateRolling7DayAverage,
  type StatisticsPeriod,
} from "@/utils/statistics";
import { countFeedingSessions } from "@/utils/feeding-sessions";
import { calculatePeriodOverPeriodTrend, type TrendResult } from "@/utils/trends";
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
  children?: React.ReactNode;
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
  children,
}: StatCardProps) {
  const hasTrend = showTrend && trend && trend.direction !== "stable";
  const bgColor = isDark ? SURFACE.dark.card : SURFACE.light.card;

  return (
    <View
      className="rounded-card p-4"
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
      {children}
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  isDark,
  isLast = false,
  children,
}: {
  icon: string;
  label: string;
  value?: string;
  isDark: boolean;
  isLast?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={!isLast ? {
        borderBottomWidth: 1,
        borderBottomColor: isDark ? BORDER.dark.subtle : BORDER.light.subtle,
        paddingBottom: 12,
        marginBottom: 12,
      } : undefined}
    >
      <View className="flex-row items-center">
        <Text className="text-base mr-2">{icon}</Text>
        <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary flex-1">
          {label}
        </Text>
        {value && (
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {value}
          </Text>
        )}
      </View>
      {children}
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
  const [selectedPeriod, setSelectedPeriod] = useState<StatisticsPeriod>("7days");

  const isDark = colorScheme === "dark";
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

  const periodDays = selectedPeriod === "today" ? 1 : selectedPeriod === "7days" ? 7 : 30;

  const stats = useMemo(() => {
    const now = new Date();
    const dateRange = getDateRangeForPeriod(selectedPeriod, now);

    const filteredFeedings = filterEntriesByDateRange(
      feedings, dateRange, (entry) => entry.startedAt
    );
    const filteredSleeps = filterEntriesByDateRange(
      sleeps, dateRange, (entry) => entry.startedAt
    );
    const filteredDiapers = filterEntriesByDateRange(
      diapers, dateRange, (entry) => entry.changedAt
    );
    const filteredPumpings = filterEntriesByDateRange(
      pumpings, dateRange, (entry) => entry.startedAt
    );
    const filteredTummyTimes = filterEntriesByDateRange(
      tummyTimes, dateRange, (entry) => entry.startedAt
    );

    return {
      feeding: calculateFeedingStats(filteredFeedings),
      sleep: calculateSleepStats(filteredSleeps),
      diaper: calculateDiaperStats(filteredDiapers),
      pumping: calculatePumpingStats(filteredPumpings),
      tummyTime: calculateTummyTimeStats(filteredTummyTimes),
      extendedFeeding: calculateExtendedFeedingStats(filteredFeedings),
      extendedSleep: calculateExtendedSleepStats(filteredSleeps),
      extendedDiaper: calculateExtendedDiaperStats(filteredDiapers),
    };
  }, [feedings, sleeps, diapers, pumpings, tummyTimes, selectedPeriod]);

  const rolling7DayAvg = useMemo(() => {
    return calculateRolling7DayAverage(feedings, sleeps, diapers, tummyTimes);
  }, [feedings, sleeps, diapers, tummyTimes]);

  const periodTrends = useMemo(() => {
    const now = new Date();

    return {
      sleep: calculatePeriodOverPeriodTrend(
        sleeps,
        (entry) => entry.startedAt,
        (entries) => entries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0),
        selectedPeriod,
        now
      ),
      feeding: calculatePeriodOverPeriodTrend(
        feedings,
        (entry) => entry.startedAt,
        (entries) => entries.length,
        selectedPeriod,
        now
      ),
      diaper: calculatePeriodOverPeriodTrend(
        diapers,
        (entry) => entry.changedAt,
        (entries) => entries.length,
        selectedPeriod,
        now
      ),
      tummyTime: calculatePeriodOverPeriodTrend(
        tummyTimes,
        (entry) => entry.startedAt,
        (entries) => entries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0),
        selectedPeriod,
        now
      ),
    };
  }, [sleeps, feedings, diapers, tummyTimes, selectedPeriod]);

  const trendDataArray = useMemo((): TrendData[] => {
    return [
      {
        type: "sleep",
        direction: periodTrends.sleep.direction,
        absoluteChange: periodTrends.sleep.absoluteChange,
        percentageChange: periodTrends.sleep.percentageChange,
        currentValue: periodTrends.sleep.currentValue,
        previousValue: periodTrends.sleep.previousValue,
      },
      {
        type: "feeding",
        direction: periodTrends.feeding.direction,
        absoluteChange: periodTrends.feeding.absoluteChange,
        percentageChange: periodTrends.feeding.percentageChange,
        currentValue: periodTrends.feeding.currentValue,
        previousValue: periodTrends.feeding.previousValue,
      },
      {
        type: "diaper",
        direction: periodTrends.diaper.direction,
        absoluteChange: periodTrends.diaper.absoluteChange,
        percentageChange: periodTrends.diaper.percentageChange,
        currentValue: periodTrends.diaper.currentValue,
        previousValue: periodTrends.diaper.previousValue,
      },
      {
        type: "tummyTime",
        direction: periodTrends.tummyTime.direction,
        absoluteChange: periodTrends.tummyTime.absoluteChange,
        percentageChange: periodTrends.tummyTime.percentageChange,
        currentValue: periodTrends.tummyTime.currentValue,
        previousValue: periodTrends.tummyTime.previousValue,
      },
    ];
  }, [periodTrends]);

  const weeklySummary = useMemo(() => {
    return generateWeeklySummary(trendDataArray, selectedPeriod);
  }, [trendDataArray, selectedPeriod]);

  const dailyAverages = useMemo(() => {
    return calculateDailyAverages(
      stats.feeding,
      stats.sleep,
      stats.diaper,
      stats.pumping,
      stats.tummyTime,
      periodDays
    );
  }, [stats, periodDays]);

  const formatSleepDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const formatTrendDuration = (seconds: number): string => {
    const absSeconds = Math.abs(seconds);
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const sign = seconds >= 0 ? "+" : "-";
    if (hours === 0) return `${sign}${minutes}m`;
    if (minutes === 0) return `${sign}${hours}h`;
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
    ? t("statistics.nap", { count: stats.sleep.napCount })
    : undefined;

  const diaperSubvalue = useMemo(() => {
    if (stats.diaper.wetCount === 0 && stats.diaper.dirtyCount === 0 && stats.diaper.mixedCount === 0) return undefined;
    const parts: string[] = [];
    if (stats.diaper.wetCount > 0) parts.push(`${stats.diaper.wetCount} ${t("statistics.wet" as never)}`);
    if (stats.diaper.dirtyCount > 0) parts.push(`${stats.diaper.dirtyCount} ${t("statistics.dirty" as never)}`);
    if (stats.diaper.mixedCount > 0) parts.push(`${stats.diaper.mixedCount} ${t("diaper.mixed")}`);
    return parts.join(" · ");
  }, [stats.diaper, t]);

  const pumpingSubvalue = stats.pumping.totalDurationSeconds > 0
    ? formatDuration(stats.pumping.totalDurationSeconds, "short")
    : undefined;

  const chartData = useMemo(() => {
    const now = new Date();
    const days = selectedPeriod === "30days" ? 30 : 7;
    const isCompact = selectedPeriod === "30days";

    const feedingBreakdown = calculateDailyBreakdown(
      feedings, (entry) => entry.startedAt, days, now
    );
    const diaperBreakdown = calculateDailyBreakdown(
      diapers, (entry) => entry.changedAt, days, now
    );
    const sleepBreakdown = calculateDailyBreakdown(
      sleeps, (entry) => entry.startedAt, days, now
    );

    const dayNames = [
      t("statistics.daySun"), t("statistics.dayMon"), t("statistics.dayTue"),
      t("statistics.dayWed"), t("statistics.dayThu"), t("statistics.dayFri"),
      t("statistics.daySat"),
    ];

    const feedingData: { label: string; value: number }[] = [];
    const diaperStackedData: { label: string; primary: number; secondary: number; tertiary: number }[] = [];
    const sleepData: { label: string; primary: number; secondary: number }[] = [];

    feedingBreakdown.forEach((entries, dateKey) => {
      const date = new Date(dateKey);
      const label = isCompact
        ? `${date.getMonth() + 1}/${date.getDate()}`
        : dayNames[date.getDay()];
      feedingData.push({
        label,
        value: countFeedingSessions(entries),
      });
    });

    diaperBreakdown.forEach((entries, dateKey) => {
      const date = new Date(dateKey);
      const label = isCompact
        ? `${date.getMonth() + 1}/${date.getDate()}`
        : dayNames[date.getDay()];
      const wet = entries.filter((d) => d.type === "wet").length;
      const dirty = entries.filter((d) => d.type === "dirty").length;
      const mixed = entries.filter((d) => d.type === "mixed").length;
      diaperStackedData.push({ label, primary: wet, secondary: dirty, tertiary: mixed });
    });

    sleepBreakdown.forEach((entries, dateKey) => {
      const date = new Date(dateKey);
      const label = isCompact
        ? `${date.getMonth() + 1}/${date.getDate()}`
        : dayNames[date.getDay()];
      const nightHours = entries
        .filter((s) => s.type === "night")
        .reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
      const napHours = entries
        .filter((s) => s.type === "nap")
        .reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
      sleepData.push({ label, primary: nightHours, secondary: napHours });
    });

    return { feedingData, diaperStackedData, sleepData, isCompact };
  }, [feedings, diapers, sleeps, t, selectedPeriod]);

  const handleShareReport = useCallback(async () => {
    if (!selectedBaby) return;

    setIsGeneratingReport(true);
    try {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - (periodDays - 1));
      startDate.setHours(0, 0, 0, 0);

      const result = await PDFService.generateReport({
        babyId: selectedBaby.id,
        babyName: selectedBaby.name,
        babyBirthDate: selectedBaby.birthDate ? new Date(selectedBaby.birthDate) : undefined,
        babyGender: selectedBaby.gender as "male" | "female" | undefined,
        startDate,
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
  }, [selectedBaby, t, periodDays]);

  const hasAnyData = stats.feeding.totalCount > 0 ||
    stats.sleep.totalDurationSeconds > 0 ||
    stats.diaper.totalCount > 0 ||
    stats.tummyTime.sessionCount > 0;

  if (isLoading && !hasAnyData) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
        <LoadingState fullScreen />
      </SafeAreaView>
    );
  }

  const renderTodayView = () => {
    const todaySleepSeconds = stats.sleep.totalDurationSeconds;
    const todayFeedingCount = stats.feeding.totalCount;
    const todayDiaperCount = stats.diaper.totalCount;
    const todayTummySeconds = stats.tummyTime.totalDurationSeconds;

    const feedingColor = isDark ? ACTIVITY_CONFIG.feeding.accentColorDark : ACTIVITY_CONFIG.feeding.accentColor;
    const sleepColor = isDark ? ACTIVITY_CONFIG.sleep.accentColorDark : ACTIVITY_CONFIG.sleep.accentColor;
    const diaperColor = isDark ? ACTIVITY_CONFIG.diaper.accentColorDark : ACTIVITY_CONFIG.diaper.accentColor;
    const tummyColor = isDark ? ACTIVITY_CONFIG.tummyTime.accentColorDark : ACTIVITY_CONFIG.tummyTime.accentColor;

    const breastDuration = stats.extendedFeeding.leftDurationSeconds + stats.extendedFeeding.rightDurationSeconds;
    const totalBottle = stats.extendedFeeding.bottleFormulaVolumeMl + stats.extendedFeeding.bottleBreastMilkVolumeMl;

    const sleepRows: { icon: string; label: string; value?: string; children?: React.ReactNode; key: string }[] = [];

    if (stats.extendedSleep.longestStretchSeconds > 0) {
      sleepRows.push({
        key: "longest-sleep",
        icon: ACTIVITY_CONFIG.sleep.icon,
        label: t("statistics.longestSleep" as never),
        value: formatSleepDuration(stats.extendedSleep.longestStretchSeconds),
      });
    }

    const feedingRows: { icon: string; label: string; value?: string; children?: React.ReactNode; key: string }[] = [];

    if (stats.extendedFeeding.avgTimeBetweenSessionsSeconds > 0) {
      feedingRows.push({
        key: "avg-between",
        icon: ACTIVITY_CONFIG.feeding.icon,
        label: t("statistics.avgTimeBetweenFeedings" as never),
        value: formatSleepDuration(stats.extendedFeeding.avgTimeBetweenSessionsSeconds),
      });
    }

    if (stats.extendedFeeding.leftRightBalancePercent) {
      feedingRows.push({
        key: "breast-balance",
        icon: ACTIVITY_CONFIG.feeding.icon,
        label: t("statistics.breastBalance" as never),
        children: (
          <View className="mt-2">
            <BreastBalanceBar
              leftPercent={stats.extendedFeeding.leftRightBalancePercent.left}
              rightPercent={stats.extendedFeeding.leftRightBalancePercent.right}
            />
          </View>
        ),
      });
    }

    if (breastDuration > 0) {
      feedingRows.push({
        key: "breastfeeding-time",
        icon: ACTIVITY_CONFIG.feeding.icon,
        label: t("statistics.breastfeedingTime" as never),
        value: formatSleepDuration(breastDuration),
      });
    }

    if (totalBottle > 0) {
      const bottleParts: string[] = [];
      if (stats.extendedFeeding.bottleFormulaVolumeMl > 0) {
        bottleParts.push(`${stats.extendedFeeding.bottleFormulaVolumeMl} ml ${t("statistics.formulaLabel" as never)}`);
      }
      if (stats.extendedFeeding.bottleBreastMilkVolumeMl > 0) {
        bottleParts.push(`${stats.extendedFeeding.bottleBreastMilkVolumeMl} ml ${t("statistics.breastMilkLabel" as never)}`);
      }
      feedingRows.push({
        key: "bottle-volume",
        icon: "🍼",
        label: t("statistics.bottleVolume" as never),
        value: `${totalBottle} ml`,
        children: bottleParts.length > 0 ? (
          <View className="mt-1">
            {bottleParts.map((part, i) => (
              <Text key={i} className="text-sm text-content-tertiary dark:text-content-dark-tertiary ml-7">
                {part}
              </Text>
            ))}
          </View>
        ) : undefined,
      });
    }

    if (stats.feeding.solidsCount > 0) {
      feedingRows.push({
        key: "solid-food",
        icon: "🥣",
        label: t("feeding.solidFood"),
        value: String(stats.feeding.solidsCount),
      });
    }

    return (
      <>
        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("statistics.todayVsAverage" as never)}
          </Text>
          <View className="flex-row gap-3 mb-3">
            <TodayComparisonCard
              icon={ACTIVITY_CONFIG.feeding.icon}
              label={t("feeding.title")}
              todayValue={String(todayFeedingCount)}
              averageValue={String(rolling7DayAvg.feedingsPerDay)}
              color={feedingColor}
            />
            <TodayComparisonCard
              icon={ACTIVITY_CONFIG.sleep.icon}
              label={t("sleep.title")}
              todayValue={formatSleepDuration(todaySleepSeconds)}
              averageValue={formatSleepDuration(rolling7DayAvg.sleepSecondsPerDay)}
              color={sleepColor}
            />
          </View>
          <View className="flex-row gap-3">
            <TodayComparisonCard
              icon={ACTIVITY_CONFIG.diaper.icon}
              label={t("diaper.title")}
              todayValue={String(todayDiaperCount)}
              averageValue={String(rolling7DayAvg.totalDiapersPerDay)}
              color={diaperColor}
            />
            <TodayComparisonCard
              icon={ACTIVITY_CONFIG.tummyTime.icon}
              label={t("tummyTime.title")}
              todayValue={todayTummySeconds > 0 ? formatSleepDuration(todayTummySeconds) : "0m"}
              averageValue={formatSleepDuration(rolling7DayAvg.tummyTimeSecondsPerDay)}
              color={tummyColor}
            />
          </View>
        </View>

        {feedingRows.length > 0 && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
              {t("feeding.title")}
            </Text>
            <View
              className="rounded-card p-4"
              style={{ backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card }}
            >
              {feedingRows.map((row, index) => (
                <DetailRow
                  key={row.key}
                  icon={row.icon}
                  label={row.label}
                  value={row.value}
                  isDark={isDark}
                  isLast={index === feedingRows.length - 1}
                >
                  {row.children}
                </DetailRow>
              ))}
            </View>
          </View>
        )}

        {sleepRows.length > 0 && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
              {t("sleep.title")}
            </Text>
            <View
              className="rounded-card p-4"
              style={{ backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card }}
            >
              {sleepRows.map((row, index) => (
                <DetailRow
                  key={row.key}
                  icon={row.icon}
                  label={row.label}
                  value={row.value}
                  isDark={isDark}
                  isLast={index === sleepRows.length - 1}
                >
                  {row.children}
                </DetailRow>
              ))}
            </View>
          </View>
        )}

        {stats.diaper.totalCount > 0 && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
              {t("diaper.title")}
            </Text>
            <View
              className="rounded-card p-4"
              style={{ backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card }}
            >
              <View className="flex-row items-center mb-1">
                <Text className="text-base mr-2">{ACTIVITY_CONFIG.diaper.icon}</Text>
                <Text className="text-lg font-bold text-content-primary dark:text-content-dark-primary">
                  {stats.diaper.totalCount} {t("statistics.totalDiapers")}
                </Text>
              </View>
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary ml-7">
                {diaperSubvalue}
              </Text>
              {Object.keys(stats.extendedDiaper.stoolColorDistribution).length > 0 && (
                <View className="ml-5">
                  <StoolColorDistribution distribution={stats.extendedDiaper.stoolColorDistribution} />
                </View>
              )}
            </View>
          </View>
        )}

        <GrowthStatsCard />
      </>
    );
  };

  const renderMultiDayView = () => {
    const feedingColor = isDark ? ACTIVITY_CONFIG.feeding.accentColorDark : ACTIVITY_CONFIG.feeding.accentColor;
    const sleepColor = isDark ? ACTIVITY_CONFIG.sleep.accentColorDark : ACTIVITY_CONFIG.sleep.accentColor;
    const diaperColor = isDark ? ACTIVITY_CONFIG.diaper.accentColorDark : ACTIVITY_CONFIG.diaper.accentColor;
    const tummyColor = isDark ? ACTIVITY_CONFIG.tummyTime.accentColorDark : ACTIVITY_CONFIG.tummyTime.accentColor;

    const showTrends = selectedPeriod !== "today";
    const labelInterval = selectedPeriod === "30days" ? 5 : 1;
    const isCompact = selectedPeriod === "30days";

    const extFeedingRows: React.ReactNode[] = [];

    if (stats.extendedFeeding.avgTimeBetweenSessionsSeconds > 0) {
      extFeedingRows.push(
        <View key="avg-between" className="flex-row justify-between">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {t("statistics.avgTimeBetweenFeedings" as never)}
          </Text>
          <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary">
            {formatSleepDuration(stats.extendedFeeding.avgTimeBetweenSessionsSeconds)}
          </Text>
        </View>
      );
    }

    if (stats.extendedFeeding.leftRightBalancePercent) {
      extFeedingRows.push(
        <View key="breast-balance">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("statistics.breastBalance" as never)}
          </Text>
          <BreastBalanceBar
            leftPercent={stats.extendedFeeding.leftRightBalancePercent.left}
            rightPercent={stats.extendedFeeding.leftRightBalancePercent.right}
          />
        </View>
      );
    }

    const totalBottle = stats.extendedFeeding.bottleFormulaVolumeMl + stats.extendedFeeding.bottleBreastMilkVolumeMl;
    if (totalBottle > 0) {
      const parts: string[] = [];
      if (stats.extendedFeeding.bottleFormulaVolumeMl > 0) {
        parts.push(`${stats.extendedFeeding.bottleFormulaVolumeMl}ml ${t("statistics.formulaLabel" as never)}`);
      }
      if (stats.extendedFeeding.bottleBreastMilkVolumeMl > 0) {
        parts.push(`${stats.extendedFeeding.bottleBreastMilkVolumeMl}ml ${t("statistics.breastMilkLabel" as never)}`);
      }
      extFeedingRows.push(
        <View key="bottle-vol" className="flex-row justify-between">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {t("statistics.bottleVolume" as never)}
          </Text>
          <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary">
            {totalBottle}ml ({parts.join(" / ")})
          </Text>
        </View>
      );
    }

    return (
      <>
        {weeklySummary.type !== "noData" && (
          <View className="mb-4">
            <View
              className="rounded-card p-4"
              style={{
                backgroundColor: isDark
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
                    {t(weeklySummary.titleKey as never, weeklySummary.titleParams
                      ? Object.fromEntries(
                          Object.entries(weeklySummary.titleParams).map(([key, value]) => [key, t(value as never)])
                        )
                      : undefined)}
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
                  <Text className="text-lg font-semibold" style={{ color: ACTIVITY_CONFIG.sleep.accentColor }}>
                    {dailyAverages.sleepHoursPerDay}h
                  </Text>
                  <Text className="text-base text-content-secondary dark:text-content-dark-secondary ml-1">
                    {t("statistics.perDay")}
                  </Text>
                </View>
              </View>
              <View className="w-1/2 mb-3 pl-2">
                <View className="flex-row items-center">
                  <Text className="text-lg mr-2">{ACTIVITY_CONFIG.feeding.icon}</Text>
                  <Text className="text-lg font-semibold" style={{ color: ACTIVITY_CONFIG.feeding.accentColor }}>
                    {dailyAverages.feedingsPerDay}
                  </Text>
                  <Text className="text-base text-content-secondary dark:text-content-dark-secondary ml-1">
                    {t("statistics.perDay")}
                  </Text>
                </View>
              </View>
              <View className="w-1/2 pr-2">
                <View className="flex-row items-center">
                  <Text className="text-lg mr-2">{ACTIVITY_CONFIG.diaper.icon}</Text>
                  <Text className="text-lg font-semibold" style={{ color: ACTIVITY_CONFIG.diaper.accentColor }}>
                    {dailyAverages.totalDiapersPerDay}
                  </Text>
                  <Text className="text-base text-content-secondary dark:text-content-dark-secondary ml-1">
                    {t("statistics.diapersPerDay" as never)}
                  </Text>
                </View>
              </View>
              {dailyAverages.tummyTimeMinutesPerDay > 0 && (
                <View className="w-1/2 pl-2">
                  <View className="flex-row items-center">
                    <Text className="text-lg mr-2">{ACTIVITY_CONFIG.tummyTime.icon}</Text>
                    <Text className="text-lg font-semibold" style={{ color: ACTIVITY_CONFIG.tummyTime.accentColor }}>
                      {dailyAverages.tummyTimeMinutesPerDay}m
                    </Text>
                    <Text className="text-base text-content-secondary dark:text-content-dark-secondary ml-1">
                      {t("statistics.perDay")}
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
          <StatCard
            icon={ACTIVITY_CONFIG.feeding.icon}
            label={t("statistics.totalFeedings")}
            value={String(stats.feeding.totalCount)}
            subvalue={feedingSubvalue}
            color={feedingColor}
            trend={periodTrends.feeding}
            showTrend={showTrends}
            isDark={isDark}
          >
            {extFeedingRows.length > 0 && (
              <View
                className="mt-3 pt-3 gap-2"
                style={{ borderTopWidth: 1, borderTopColor: isDark ? BORDER.dark.subtle : BORDER.light.subtle }}
              >
                {extFeedingRows}
              </View>
            )}
          </StatCard>
        </View>

        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("sleep.title")}
          </Text>
          <StatCard
            icon={ACTIVITY_CONFIG.sleep.icon}
            label={t("statistics.totalSleep")}
            value={formatSleepDuration(stats.sleep.totalDurationSeconds)}
            subvalue={sleepSubvalue}
            color={sleepColor}
            trend={periodTrends.sleep}
            trendFormatted={periodTrends.sleep ? formatTrendDuration(periodTrends.sleep.absoluteChange) : undefined}
            showTrend={showTrends}
            isDark={isDark}
          >
            {stats.extendedSleep.longestStretchSeconds > 0 && (
              <View
                className="mt-3 pt-3"
                style={{ borderTopWidth: 1, borderTopColor: isDark ? BORDER.dark.subtle : BORDER.light.subtle }}
              >
                <View className="flex-row justify-between">
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                    {t("statistics.longestSleep" as never)}
                  </Text>
                  <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary">
                    {formatSleepDuration(stats.extendedSleep.longestStretchSeconds)}
                  </Text>
                </View>
              </View>
            )}
          </StatCard>
        </View>

        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("diaper.title")}
          </Text>
          <StatCard
            icon={ACTIVITY_CONFIG.diaper.icon}
            label={t("statistics.totalDiapers")}
            value={String(stats.diaper.totalCount)}
            subvalue={diaperSubvalue}
            color={diaperColor}
            trend={periodTrends.diaper}
            showTrend={showTrends}
            isDark={isDark}
          >
            {Object.keys(stats.extendedDiaper.stoolColorDistribution).length > 0 && (
              <View
                className="mt-3 pt-3"
                style={{ borderTopWidth: 1, borderTopColor: isDark ? BORDER.dark.subtle : BORDER.light.subtle }}
              >
                <StoolColorDistribution distribution={stats.extendedDiaper.stoolColorDistribution} />
              </View>
            )}
          </StatCard>
        </View>

        {stats.pumping.totalCount > 0 && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
              {t("pumping.title")}
            </Text>
            <StatCard
              icon={ACTIVITY_CONFIG.pumping.icon}
              label={t("statistics.totalPumping")}
              value={stats.pumping.totalVolumeMl > 0 ? `${stats.pumping.totalVolumeMl} ml` : String(stats.pumping.totalCount)}
              subvalue={pumpingSubvalue}
              color={isDark ? ACTIVITY_CONFIG.pumping.accentColorDark : ACTIVITY_CONFIG.pumping.accentColor}
              isDark={isDark}
            />
          </View>
        )}

        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("tummyTime.title")}
          </Text>
          <View
            className="rounded-card p-4"
            style={{
              backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card,
              borderLeftWidth: 3,
              borderLeftColor: tummyColor,
            }}
          >
            <View className="flex-row items-center mb-2">
              <Text className="text-xl mr-2">{ACTIVITY_CONFIG.tummyTime.icon}</Text>
              <Text
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: tummyColor }}
              >
                {t("statistics.tummyTime")}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary">
              {formatDuration(stats.tummyTime.totalDurationSeconds, "short") || "0m"}
            </Text>
            {showTrends && periodTrends.tummyTime.direction !== "stable" && (
              <View className="mt-2">
                <TrendIndicator
                  direction={periodTrends.tummyTime.direction}
                  percentageChange={periodTrends.tummyTime.percentageChange}
                  absoluteChangeFormatted={formatTrendDuration(periodTrends.tummyTime.absoluteChange)}
                />
              </View>
            )}
            {!showTrends && (
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mt-1">
                {t("statistics.session", { count: stats.tummyTime.sessionCount })}
              </Text>
            )}
          </View>
        </View>

        <GrowthStatsCard />

        {(stats.feeding.totalCount > 0 || stats.diaper.totalCount > 0 || (stats.sleep.napCount + stats.sleep.nightCount) > 0) && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
              {t("statistics.chartOverview" as never)}
            </Text>
            <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-4">
              {stats.feeding.totalCount > 0 && (
                <View className="mb-4">
                  <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
                    {t("feeding.title")}
                  </Text>
                  <SimpleBarChart
                    data={chartData.feedingData}
                    color={ACTIVITY_CONFIG.feeding.accentColor}
                    height={100}
                    compact={isCompact}
                    labelInterval={labelInterval}
                  />
                </View>
              )}
              {stats.diaper.totalCount > 0 && (
                <View className={(stats.sleep.napCount + stats.sleep.nightCount) > 0 ? "mb-4" : ""}>
                  <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
                    {t("diaper.title")}
                  </Text>
                  <StackedBarChart
                    data={chartData.diaperStackedData}
                    primaryColor={isDark ? "#EAB8B2" : "#E0A099"}
                    secondaryColor={isDark ? "#C47A74" : "#B87070"}
                    tertiaryColor={isDark ? "#D49E98" : "#CC8C85"}
                    primaryLabel={t("statistics.wet" as never)}
                    secondaryLabel={t("statistics.dirty" as never)}
                    tertiaryLabel={t("diaper.mixed")}
                    height={100}
                    formatValue={(v) => String(Math.round(v))}
                    compact={isCompact}
                    labelInterval={labelInterval}
                  />
                </View>
              )}
              {(stats.sleep.napCount + stats.sleep.nightCount) > 0 && (
                <View>
                  <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
                    {t("sleep.title")}
                  </Text>
                  <StackedBarChart
                    data={chartData.sleepData}
                    primaryColor={isDark ? "#6B7FD7" : "#5B6BC0"}
                    secondaryColor={isDark ? "#9FA8DA" : "#7986CB"}
                    primaryLabel={t("sleep.night")}
                    secondaryLabel={t("sleep.nap")}
                    height={100}
                    formatValue={(v) => `${v.toFixed(1)}h`}
                    compact={isCompact}
                    labelInterval={labelInterval}
                  />
                </View>
              )}
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={getActionColor("primary", isDark)}
            colors={[getActionColor("primary", isDark)]}
          />
        }
      >
        <PeriodPicker
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />

        {!hasAnyData && (
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card mb-6">
            <EmptyState
              icon="📊"
              title={t(selectedPeriod === "today" ? "statistics.noDataToday" : selectedPeriod === "30days" ? "statistics.noDataThisMonth" : "statistics.noDataThisWeek")}
              compact
              testID="empty-stats"
            />
          </View>
        )}

        {hasAnyData && selectedPeriod === "today" && renderTodayView()}
        {hasAnyData && selectedPeriod !== "today" && renderMultiDayView()}

        {selectedBaby && hasAnyData && (
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
                      backgroundColor: isDark
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
                    backgroundColor: isDark
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
      </ScrollView>
    </SafeAreaView>
  );
}
