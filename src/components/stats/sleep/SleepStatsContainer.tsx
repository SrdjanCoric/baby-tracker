import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSleep } from "@/contexts/sleep-context";
import { useBaby } from "@/contexts/baby-context";
import { useTimeFormat } from "@/contexts/time-format-context";
import { buildDayViewData, buildWeekViewData } from "@/utils/sleep-patterns";
import { isUnderThreeMonths } from "@/utils/sleepGoals";
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
  const { t, i18n } = useTranslation();
  const colors = useSleepPatternColors();
  const { sleeps, wakeWindowConfig } = useSleep();
  const dayStartHour = wakeWindowConfig?.dayStartHour ?? 6;
  const dayEndHour = wakeWindowConfig?.dayEndHour ?? 19;
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const locale = i18n.language;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekEndDate, setWeekEndDate] = useState(new Date());

  const hasSleepData = sleeps.length > 0;
  const isNewborn = isUnderThreeMonths(selectedBaby?.birthDate);

  const todayLabel = t("sleepPatterns.today");
  const yesterdayLabel = t("sleepPatterns.yesterday");

  const dayViewData = useMemo(
    () => buildDayViewData(sleeps, selectedDate, PX_PER_HOUR, new Date(), dayStartHour, locale, todayLabel, yesterdayLabel),
    [sleeps, selectedDate, dayStartHour, locale, todayLabel, yesterdayLabel]
  );

  const weekViewData = useMemo(
    () => buildWeekViewData(sleeps, weekEndDate, new Date(), dayStartHour, locale),
    [sleeps, weekEndDate, dayStartHour, locale]
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
