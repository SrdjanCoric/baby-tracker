import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSleep } from "@/contexts/sleep-context";
import { useBaby } from "@/contexts/baby-context";
import { useTimeFormat } from "@/contexts/time-format-context";
import { useTimeRefresh } from "@/hooks";
import { buildDayViewData, buildWeekViewData, getSleepDate } from "@/utils/sleep-patterns";
import { buildOngoingSleepEntry } from "@/utils/ongoing-sleep";
import { isUnderThreeMonths } from "@/utils/sleepGoals";
import {
  getSleepDayRange,
  getSleepSummaryRange,
  getSleepWeekRange,
  sleepOverlapsActivityRange,
} from "@/utils/statistics-ranges";
import type { SleepSummaryPeriod } from "@/components/sleep-patterns/SummaryView";
import { ActivityRangeBoundary } from "@/components/stats/ActivityRangeBoundary";
import {
  DayView,
  WeekView,
  SummaryView,
  useSleepPatternColors,
  EmptySleepPatterns,
} from "@/components/sleep-patterns";

const PX_PER_HOUR = 60;

interface SleepStatsContainerProps {
  activeTab: string;
}

export function SleepStatsContainer({ activeTab }: SleepStatsContainerProps) {
  const { i18n } = useTranslation();
  const colors = useSleepPatternColors();
  const {
    sleeps,
    activeTimer,
    babyBinding,
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

  const [selectedDate, setSelectedDate] = useState(() => getSleepDate(new Date(), dayStartHour));
  const [weekEndDate, setWeekEndDate] = useState(() => getSleepDate(new Date(), dayStartHour));
  const [summaryPeriod, setSummaryPeriod] = useState<SleepSummaryPeriod>(7);

  const requestedRange = useMemo(() => {
    if (activeTab === "day") return getSleepDayRange(selectedDate, dayStartHour);
    if (activeTab === "week") return getSleepWeekRange(weekEndDate, dayStartHour);
    return getSleepSummaryRange(summaryPeriod, summaryNow, dayStartHour);
  }, [activeTab, dayStartHour, selectedDate, summaryNow, summaryPeriod, weekEndDate]);
  const rangeStatus = getSleepRangeStatus(requestedRange);

  useEffect(() => {
    if (rangeStatus !== "unverified") return;
    loadSleepRange(requestedRange).catch(() => {});
  }, [loadSleepRange, rangeStatus, requestedRange]);

  const selectedSleeps = useMemo(
    () => sleeps.filter((sleep) => sleep.babyId === selectedBaby?.id),
    [selectedBaby?.id, sleeps]
  );

  const sleepsWithOngoing = useMemo(() => {
    void refreshTick;
    const ongoing = buildOngoingSleepEntry({
      timer: activeTimer,
      babyId: selectedBaby?.id,
      isCurrentBaby:
        babyBinding.babyId === selectedBaby?.id && babyBinding.status !== "loading",
      now: new Date(),
      dayStartHour,
      dayEndHour,
    });
    return ongoing ? [ongoing, ...selectedSleeps] : selectedSleeps;
  }, [activeTimer, babyBinding, dayEndHour, dayStartHour, refreshTick, selectedBaby, selectedSleeps]);

  const hasSleepData = sleepsWithOngoing.some((sleep) =>
    sleepOverlapsActivityRange(sleep, requestedRange)
  );
  const retryRange = useCallback(() => {
    loadSleepRange(requestedRange).catch(() => {});
  }, [loadSleepRange, requestedRange]);
  const isNewborn = isUnderThreeMonths(selectedBaby?.birthDate);

  const dayViewData = useMemo(
    () => buildDayViewData(sleepsWithOngoing, selectedDate, PX_PER_HOUR, new Date(), dayStartHour, locale, dayEndHour),
    [sleepsWithOngoing, selectedDate, dayStartHour, dayEndHour, locale]
  );

  const weekViewData = useMemo(
    () => buildWeekViewData(sleepsWithOngoing, weekEndDate, new Date(), dayStartHour, locale, dayEndHour),
    [sleepsWithOngoing, weekEndDate, dayStartHour, dayEndHour, locale]
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

  let content;
  if (!hasSleepData) {
    content = <EmptySleepPatterns />;
  } else if (activeTab === "day") {
    content = (
      <DayView
        data={dayViewData}
        timeFormat={timeFormat}
        selectedDate={selectedDate}
        onNavigate={navigateDay}
        dayStartHour={dayStartHour}
        colors={colors}
      />
    );
  } else if (activeTab === "week") {
    content = (
      <WeekView
        data={weekViewData}
        timeFormat={timeFormat}
        weekEndDate={weekEndDate}
        onNavigate={navigateWeek}
        dayStartHour={dayStartHour}
        colors={colors}
        locale={locale}
      />
    );
  } else {
    content = (
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
    );
  }

  return (
    <ActivityRangeBoundary
      status={rangeStatus}
      hasCachedData={hasSleepData}
      onRetry={retryRange}
    >
      {content}
    </ActivityRangeBoundary>
  );
}
