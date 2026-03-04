import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSleep } from "@/contexts/sleep-context";
import { useBaby } from "@/contexts/baby-context";
import { useTimeFormat } from "@/contexts/time-format-context";
import { buildDayViewData, buildWeekViewData } from "@/utils/sleep-patterns";
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

const PX_PER_HOUR = 60;

export default function SleepPatternsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useSleepPatternColors();
  const { sleeps, isLoading, wakeWindowConfig } = useSleep();
  const dayStartHour = wakeWindowConfig?.dayStartHour ?? 6;
  const dayEndHour = wakeWindowConfig?.dayEndHour ?? 19;
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const locale = i18n.language;

  const [activeTab, setActiveTab] = useState<TabView>("day");
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

      {!hasSleepData && !isLoading ? (
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
          sleeps={sleeps}
          timeFormat={timeFormat}
          dayStartHour={dayStartHour}
          dayEndHour={dayEndHour}
          colors={colors}
          isNewborn={isNewborn}
          locale={locale}
          birthDate={selectedBaby?.birthDate}
        />
      )}
    </SafeAreaView>
  );
}
