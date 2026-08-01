import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSleep } from "@/contexts/sleep-context";
import { useBaby } from "@/contexts/baby-context";
import { useTimeFormat } from "@/contexts/time-format-context";
import { useTimeRefresh } from "@/hooks";
import { buildDayViewData, buildWeekViewData, getSleepDate } from "@/utils/sleep-patterns";
import { isUnderThreeMonths } from "@/utils/sleepGoals";
import {
  DayView,
  WeekView,
  SummaryView,
  PillTabs,
  useSleepPatternColors,
  EmptySleepPatterns,
} from "@/components/sleep-patterns";
import type { TabView } from "@/components/sleep-patterns";
import type { SleepSummaryPeriod } from "@/components/sleep-patterns/SummaryView";
import {
  getSleepDayRange,
  getSleepSummaryRange,
  getSleepWeekRange,
  sleepOverlapsActivityRange,
} from "@/utils/statistics-ranges";
import { ActivityRangeBoundary } from "@/components/stats/ActivityRangeBoundary";

const PX_PER_HOUR = 60;

export default function SleepPatternsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useSleepPatternColors();
  const {
    sleeps,
    wakeWindowConfig,
    loadSleepRange,
    getSleepRangeStatus,
  } = useSleep();
  const dayStartHour = wakeWindowConfig?.dayStartHour ?? 6;
  const dayEndHour = wakeWindowConfig?.dayEndHour ?? 19;
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const locale = i18n.language;
  const refreshTick = useTimeRefresh(60000);
  const summaryNow = useMemo(() => {
    void refreshTick;
    return new Date();
  }, [refreshTick]);

  const [activeTab, setActiveTab] = useState<TabView>("day");
  const [selectedDate, setSelectedDate] = useState(() => getSleepDate(new Date(), dayStartHour));
  const [weekEndDate, setWeekEndDate] = useState(() => getSleepDate(new Date(), dayStartHour));
  const [summaryPeriod, setSummaryPeriod] = useState<SleepSummaryPeriod>(7);

  const selectedSleeps = useMemo(
    () => sleeps.filter((sleep) => sleep.babyId === selectedBaby?.id),
    [selectedBaby?.id, sleeps]
  );
  const requestedRange = useMemo(() => {
    if (activeTab === "day") return getSleepDayRange(selectedDate, dayStartHour);
    if (activeTab === "week") return getSleepWeekRange(weekEndDate, dayStartHour);
    return getSleepSummaryRange(summaryPeriod, summaryNow, dayStartHour);
  }, [activeTab, dayStartHour, selectedDate, summaryNow, summaryPeriod, weekEndDate]);
  const rangeStatus = getSleepRangeStatus(requestedRange);
  const hasSleepData = selectedSleeps.some((sleep) =>
    sleepOverlapsActivityRange(sleep, requestedRange)
  );
  const retryRange = useCallback(() => {
    loadSleepRange(requestedRange).catch(() => {});
  }, [loadSleepRange, requestedRange]);
  const isNewborn = isUnderThreeMonths(selectedBaby?.birthDate);

  useEffect(() => {
    if (rangeStatus !== "unverified") return;
    loadSleepRange(requestedRange).catch(() => {});
  }, [loadSleepRange, rangeStatus, requestedRange]);

  const dayViewData = useMemo(
    () => buildDayViewData(selectedSleeps, selectedDate, PX_PER_HOUR, new Date(), dayStartHour, locale, dayEndHour),
    [selectedSleeps, selectedDate, dayStartHour, dayEndHour, locale]
  );

  const weekViewData = useMemo(
    () => buildWeekViewData(selectedSleeps, weekEndDate, new Date(), dayStartHour, locale, dayEndHour),
    [selectedSleeps, weekEndDate, dayStartHour, dayEndHour, locale]
  );

  const navigateDay = (offset: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + offset);
    setSelectedDate(next);
  };

  const navigateWeek = (offset: number) => {
    const next = new Date(weekEndDate);
    next.setDate(next.getDate() + offset * 7);
    setWeekEndDate(next);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgColor }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textPrimary }}>
          {t("sleepPatterns.title")}
        </Text>
        {selectedBaby && (
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
            {selectedBaby.name}
          </Text>
        )}
      </View>

      <PillTabs activeTab={activeTab} onTabChange={setActiveTab} colors={colors} />

      <ActivityRangeBoundary
        status={rangeStatus}
        hasCachedData={hasSleepData}
        onRetry={retryRange}
      >
        {!hasSleepData ? (
          <EmptySleepPatterns />
        ) : activeTab === "day" ? (
          <DayView
            data={dayViewData}
            timeFormat={timeFormat}
            selectedDate={selectedDate}
            onNavigate={navigateDay}
            dayStartHour={dayStartHour}
            colors={colors}
          />
        ) : activeTab === "week" ? (
          <WeekView
            data={weekViewData}
            timeFormat={timeFormat}
            weekEndDate={weekEndDate}
            onNavigate={navigateWeek}
            dayStartHour={dayStartHour}
            colors={colors}
            locale={locale}
          />
        ) : (
          <SummaryView
            sleeps={selectedSleeps}
            now={summaryNow}
            timeFormat={timeFormat}
            dayStartHour={dayStartHour}
            dayEndHour={dayEndHour}
            colors={colors}
            isNewborn={isNewborn}
            locale={locale}
            birthDate={selectedBaby?.birthDate}
            period={summaryPeriod}
            onPeriodChange={setSummaryPeriod}
          />
        )}
      </ActivityRangeBoundary>
    </SafeAreaView>
  );
}
