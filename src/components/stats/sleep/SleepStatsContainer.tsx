import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSleep } from "@/contexts/sleep-context";
import { useBaby } from "@/contexts/baby-context";
import { useTimeFormat } from "@/contexts/time-format-context";
import { useTimeRefresh } from "@/hooks";
import { buildDayViewData, buildWeekViewData, getSleepDate, classifySleepByTimeRange } from "@/utils/sleep-patterns";
import { isUnderThreeMonths } from "@/utils/sleepGoals";
import type { StoredSleepEntry } from "@/services/sleep-storage";
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
  const { sleeps, activeTimer, wakeWindowConfig } = useSleep();
  const dayStartHour = wakeWindowConfig?.dayStartHour ?? 6;
  const dayEndHour = wakeWindowConfig?.dayEndHour ?? 19;
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const locale = i18n.language;
  const refreshTick = useTimeRefresh(60000);

  const [selectedDate, setSelectedDate] = useState(() => getSleepDate(new Date(), dayStartHour));
  const [weekEndDate, setWeekEndDate] = useState(() => getSleepDate(new Date(), dayStartHour));

  const sleepsWithOngoing = useMemo(() => {
    void refreshTick;
    if (!activeTimer?.isRunning || !selectedBaby) return sleeps;
    const now = new Date();
    const syntheticEntry: StoredSleepEntry = {
      id: `ongoing-${selectedBaby.id}`,
      babyId: selectedBaby.id,
      type: classifySleepByTimeRange(activeTimer.startTime, now, dayStartHour, dayEndHour),
      startedAt: activeTimer.startTime.toISOString(),
      endedAt: now.toISOString(),
      durationSeconds: Math.floor(
        (now.getTime() - activeTimer.startTime.getTime() - activeTimer.totalPausedMs) / 1000
      ),
      createdAt: activeTimer.startTime.toISOString(),
      updatedAt: now.toISOString(),
    };
    return [syntheticEntry, ...sleeps];
  }, [sleeps, activeTimer, selectedBaby, refreshTick, dayStartHour, dayEndHour]);

  const hasSleepData = sleepsWithOngoing.length > 0;
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

  if (!hasSleepData) {
    return <EmptySleepPatterns />;
  }

  if (activeTab === "day") {
    return (
      <DayView
        data={dayViewData}
        timeFormat={timeFormat}
        selectedDate={selectedDate}
        onNavigate={navigateDay}
        dayStartHour={dayStartHour}
        colors={colors}
      />
    );
  }

  if (activeTab === "week") {
    return (
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
  }

  return (
    <SummaryView
      sleeps={sleeps}
      timeFormat={timeFormat}
      dayStartHour={dayStartHour}
      dayEndHour={dayEndHour}
      colors={colors}
      isNewborn={isNewborn}
      locale={locale}
      birthDate={selectedBaby?.birthDate}
    />
  );
}
