import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { useSleep } from "@/contexts/sleep-context";
import { useBaby } from "@/contexts/baby-context";
import { useTimeFormat } from "@/contexts/time-format-context";
import { SURFACE, TEXT, BORDER, ACTION, ACTIVITY } from "@/constants/colors";
import { formatDuration, formatTime, formatHourValue } from "@/utils/time";
import type { TimeFormat } from "@/utils/time";
import {
  buildDayViewData,
  buildWeekViewData,
  calculateSleepSummary,
  getHoursForAxis,
  getEvenHoursForAxis,
  getNowPosition,
  getNowFraction,
  formatWeekRange,
} from "@/utils/sleep-patterns";
import type { DayBlock, WeekColumn, SleepSummary } from "@/utils/sleep-patterns";
import { EmptySleepPatterns } from "@/components/sleep-patterns/EmptySleepPatterns";

type TabView = "day" | "week" | "summary";

const PX_PER_HOUR = 60;
const WEEK_PX_PER_HOUR = 36;
const AXIS_WIDTH = 38;
const SCREEN_WIDTH = Dimensions.get("window").width;

export default function SleepPatternsScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { sleeps, isLoading, wakeWindowConfig } = useSleep();
  const dayStartHour = wakeWindowConfig?.dayStartHour ?? 6;
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();

  const [activeTab, setActiveTab] = useState<TabView>("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekEndDate, setWeekEndDate] = useState(new Date());

  const bgColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const textSecondary = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const textTertiary = isDark ? TEXT.dark.tertiary : TEXT.light.tertiary;
  const borderSubtle = isDark ? BORDER.dark.subtle : BORDER.light.subtle;
  const accentColor = isDark ? ACTION.dark.primary : ACTION.light.primary;
  const nightColor = isDark ? ACTIVITY.sleep.buttonDark : ACTIVITY.sleep.button;
  const napColor = isDark ? ACTIVITY.sleep.accentDark : ACTIVITY.sleep.accent;

  const hasSleepData = sleeps.length > 0;

  const dayViewData = useMemo(
    () => buildDayViewData(sleeps, selectedDate, PX_PER_HOUR, new Date(), dayStartHour),
    [sleeps, selectedDate, dayStartHour]
  );

  const weekViewData = useMemo(
    () => buildWeekViewData(sleeps, weekEndDate, new Date(), dayStartHour),
    [sleeps, weekEndDate, dayStartHour]
  );

  const summaryData = useMemo(
    () => calculateSleepSummary(sleeps),
    [sleeps]
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
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: textPrimary }}>
          {t("sleepPatterns.title")}
        </Text>
        {selectedBaby && (
          <Text style={{ fontSize: 14, color: textSecondary, marginTop: 2 }}>
            {selectedBaby.name}
          </Text>
        )}
      </View>

      <PillTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isDark={isDark}
        accentColor={accentColor}
        cardBg={cardBg}
        textPrimary={textPrimary}
      />

      {!hasSleepData && !isLoading ? (
        <EmptySleepPatterns />
      ) : activeTab === "day" ? (
        <DayView
          data={dayViewData}
          timeFormat={timeFormat}
          isDark={isDark}
          textTertiary={textTertiary}
          borderSubtle={borderSubtle}
          nightColor={nightColor}
          napColor={napColor}
          accentColor={accentColor}
          selectedDate={selectedDate}
          onNavigate={navigateDay}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          cardBg={cardBg}
          dayStartHour={dayStartHour}
        />
      ) : activeTab === "week" ? (
        <WeekView
          data={weekViewData}
          timeFormat={timeFormat}
          isDark={isDark}
          textTertiary={textTertiary}
          borderSubtle={borderSubtle}
          nightColor={nightColor}
          napColor={napColor}
          accentColor={accentColor}
          weekEndDate={weekEndDate}
          onNavigate={navigateWeek}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          cardBg={cardBg}
          dayStartHour={dayStartHour}
        />
      ) : (
        <SummaryView
          data={summaryData}
          timeFormat={timeFormat}
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textTertiary={textTertiary}
          cardBg={cardBg}
          nightColor={nightColor}
          napColor={napColor}
          accentColor={accentColor}
          borderSubtle={borderSubtle}
        />
      )}
    </SafeAreaView>
  );
}

function PillTabs({
  activeTab,
  onTabChange,
  isDark,
  accentColor,
  cardBg,
  textPrimary,
}: {
  activeTab: TabView;
  onTabChange: (tab: TabView) => void;
  isDark: boolean;
  accentColor: string;
  cardBg: string;
  textPrimary: string;
}) {
  const { t } = useTranslation();
  const tabs: { key: TabView; label: string }[] = [
    { key: "day", label: t("sleepPatterns.day") },
    { key: "week", label: t("sleepPatterns.week") },
    { key: "summary", label: t("sleepPatterns.summary") },
  ];

  const pillBg = isDark ? SURFACE.dark.secondary : SURFACE.light.secondary;

  return (
    <View
      style={{
        flexDirection: "row",
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: pillBg,
        borderRadius: 10,
        padding: 3,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: isActive ? cardBg : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: isActive ? "600" : "500",
                color: isActive ? accentColor : textPrimary,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DateNavigator({
  label,
  onPrev,
  onNext,
  textPrimary,
  textSecondary,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      <Pressable onPress={onPrev} hitSlop={12}>
        <Text style={{ fontSize: 22, color: textSecondary }}>{"‹"}</Text>
      </Pressable>
      <Text style={{ fontSize: 15, fontWeight: "600", color: textPrimary }}>
        {label}
      </Text>
      <Pressable onPress={onNext} hitSlop={12}>
        <Text style={{ fontSize: 22, color: textSecondary }}>{"›"}</Text>
      </Pressable>
    </View>
  );
}

function Legend({
  nightColor,
  napColor,
  textSecondary,
}: {
  nightColor: string;
  napColor: string;
  textSecondary: string;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
        paddingVertical: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            backgroundColor: nightColor,
          }}
        />
        <Text style={{ fontSize: 12, color: textSecondary }}>
          {t("sleepPatterns.nightSleep")}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            backgroundColor: napColor,
          }}
        />
        <Text style={{ fontSize: 12, color: textSecondary }}>
          {t("sleepPatterns.napSleep")}
        </Text>
      </View>
    </View>
  );
}

function DayView({
  data,
  timeFormat,
  isDark,
  textTertiary,
  borderSubtle,
  nightColor,
  napColor,
  accentColor,
  selectedDate,
  onNavigate,
  textPrimary,
  textSecondary,
  cardBg,
  dayStartHour,
}: {
  data: ReturnType<typeof buildDayViewData>;
  timeFormat: TimeFormat;
  isDark: boolean;
  textTertiary: string;
  borderSubtle: string;
  nightColor: string;
  napColor: string;
  accentColor: string;
  selectedDate: Date;
  onNavigate: (offset: number) => void;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  dayStartHour: number;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const hours = getHoursForAxis(dayStartHour);
  const totalHeight = 24 * PX_PER_HOUR;
  const nowPos = getNowPosition(PX_PER_HOUR, new Date(), dayStartHour);
  const isViewingToday = data.dateLabel === "Today";

  useEffect(() => {
    if (isViewingToday && nowPos !== null && scrollRef.current) {
      const scrollTo = Math.max(0, nowPos - 200);
      setTimeout(() => scrollRef.current?.scrollTo({ y: scrollTo, animated: false }), 100);
    }
  }, [isViewingToday, nowPos]);

  return (
    <View style={{ flex: 1 }}>
      <DateNavigator
        label={data.dateLabel}
        onPrev={() => onNavigate(-1)}
        onNext={() => onNavigate(1)}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
      />
      <ScrollView ref={scrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: totalHeight, position: "relative", marginBottom: 8 }}>
          {hours.map((hour, i) => (
            <View
              key={hour}
              style={{
                position: "absolute",
                top: i * PX_PER_HOUR,
                left: 0,
                right: 0,
                height: PX_PER_HOUR,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <Text
                style={{
                  width: AXIS_WIDTH - 4,
                  textAlign: "right",
                  fontSize: 10,
                  color: textTertiary,
                  lineHeight: 14,
                  marginTop: -7,
                }}
              >
                {formatHourValue(hour, timeFormat)}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: borderSubtle,
                  marginTop: 0,
                }}
              />
            </View>
          ))}

          {data.blocks.map((block, i) => (
            <View
              key={`${block.startedAt}-${i}`}
              style={{
                position: "absolute",
                top: block.topPx,
                left: AXIS_WIDTH,
                right: 8,
                height: block.heightPx,
                backgroundColor: block.type === "night" ? nightColor : napColor,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                overflow: "hidden",
              }}
            >
              {block.heightPx >= 20 && (
                <>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                    numberOfLines={1}
                  >
                    {block.type === "night"
                      ? t("sleepPatterns.nightSleep")
                      : t("sleepPatterns.napSleep")}
                  </Text>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: "500",
                    }}
                    numberOfLines={1}
                  >
                    {formatDuration(block.durationSeconds, "short")}
                  </Text>
                </>
              )}
            </View>
          ))}

          {isViewingToday && nowPos !== null && (
            <View
              style={{
                position: "absolute",
                top: nowPos,
                left: AXIS_WIDTH - 4,
                right: 0,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: accentColor,
                }}
              />
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: accentColor,
                }}
              />
            </View>
          )}
        </View>
        <Legend
          nightColor={nightColor}
          napColor={napColor}
          textSecondary={textSecondary}
        />
      </ScrollView>
    </View>
  );
}

function WeekView({
  data,
  timeFormat,
  isDark,
  textTertiary,
  borderSubtle,
  nightColor,
  napColor,
  accentColor,
  weekEndDate,
  onNavigate,
  textPrimary,
  textSecondary,
  cardBg,
  dayStartHour,
}: {
  data: WeekColumn[];
  timeFormat: TimeFormat;
  isDark: boolean;
  textTertiary: string;
  borderSubtle: string;
  nightColor: string;
  napColor: string;
  accentColor: string;
  weekEndDate: Date;
  onNavigate: (offset: number) => void;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  dayStartHour: number;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const evenHours = getEvenHoursForAxis(dayStartHour);
  const totalHeight = 24 * WEEK_PX_PER_HOUR;
  const nowFrac = getNowFraction(new Date(), dayStartHour);
  const colWidth = (SCREEN_WIDTH - AXIS_WIDTH - 16) / 7;

  const hasToday = data.some((c) => c.isToday);

  useEffect(() => {
    if (hasToday && nowFrac !== null && scrollRef.current) {
      const scrollTo = Math.max(0, nowFrac * totalHeight - 200);
      setTimeout(() => scrollRef.current?.scrollTo({ y: scrollTo, animated: false }), 100);
    }
  }, [hasToday, nowFrac, totalHeight]);

  return (
    <View style={{ flex: 1 }}>
      <DateNavigator
        label={formatWeekRange(weekEndDate)}
        onPrev={() => onNavigate(-1)}
        onNext={() => onNavigate(1)}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
      />

      <View
        style={{
          flexDirection: "row",
          paddingLeft: AXIS_WIDTH,
          paddingRight: 8,
          marginBottom: 4,
        }}
      >
        {data.map((col) => (
          <View key={col.dateNum + col.dayLabel} style={{ width: colWidth, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 10,
                color: col.isToday ? accentColor : textTertiary,
                fontWeight: col.isToday ? "700" : "500",
              }}
            >
              {col.dayLabel}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: col.isToday ? accentColor : textPrimary,
                fontWeight: col.isToday ? "700" : "500",
              }}
            >
              {col.dateNum}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: totalHeight, position: "relative", marginBottom: 8 }}>
          {evenHours.map((hour, i) => (
            <View
              key={hour}
              style={{
                position: "absolute",
                top: i * 2 * WEEK_PX_PER_HOUR,
                left: 0,
                right: 0,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <Text
                style={{
                  width: AXIS_WIDTH - 4,
                  textAlign: "right",
                  fontSize: 9,
                  color: textTertiary,
                  lineHeight: 12,
                  marginTop: -6,
                }}
              >
                {formatHourValue(hour, timeFormat)}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: borderSubtle,
                }}
              />
            </View>
          ))}

          {data.map((col, colIdx) => (
            <View
              key={col.dateNum + col.dayLabel}
              style={{
                position: "absolute",
                top: 0,
                left: AXIS_WIDTH + colIdx * colWidth,
                width: colWidth,
                height: totalHeight,
              }}
            >
              {col.blocks.map((block, blockIdx) => (
                <View
                  key={blockIdx}
                  style={{
                    position: "absolute",
                    top: block.topFraction * totalHeight,
                    left: 2,
                    right: 2,
                    height: Math.max(block.heightFraction * totalHeight, 2),
                    backgroundColor: block.type === "night" ? nightColor : napColor,
                    borderRadius: 3,
                  }}
                />
              ))}
            </View>
          ))}

          {hasToday && nowFrac !== null && (
            <View
              style={{
                position: "absolute",
                top: nowFrac * totalHeight,
                left: AXIS_WIDTH - 4,
                right: 0,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: accentColor,
                }}
              />
              <View
                style={{
                  flex: 1,
                  height: 1.5,
                  backgroundColor: accentColor,
                }}
              />
            </View>
          )}
        </View>
        <Legend
          nightColor={nightColor}
          napColor={napColor}
          textSecondary={textSecondary}
        />
      </ScrollView>
    </View>
  );
}

function MetricCard({
  label,
  value,
  cardBg,
  textPrimary,
  textSecondary,
  accentColor,
}: {
  label: string;
  value: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  accentColor?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cardBg,
        borderRadius: 12,
        padding: 12,
        minWidth: "45%",
      }}
    >
      <Text style={{ fontSize: 12, color: textSecondary, marginBottom: 4 }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: accentColor || textPrimary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SummaryView({
  data,
  timeFormat,
  isDark,
  textPrimary,
  textSecondary,
  textTertiary,
  cardBg,
  nightColor,
  napColor,
  accentColor,
  borderSubtle,
}: {
  data: SleepSummary;
  timeFormat: TimeFormat;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  cardBg: string;
  nightColor: string;
  napColor: string;
  accentColor: string;
  borderSubtle: string;
}) {
  const { t } = useTranslation();

  const avgBedtimeStr = data.avgBedtime
    ? formatTime(data.avgBedtime, timeFormat)
    : "—";
  const avgWakeTimeStr = data.avgWakeTime
    ? formatTime(data.avgWakeTime, timeFormat)
    : "—";
  const avgTotalStr = formatDuration(data.avgTotalSleepSeconds, "short");
  const longestStr = formatDuration(data.longestStretchSeconds, "short");
  const avgNightStr = formatDuration(data.avgNightSleepSeconds, "short");
  const avgNapDurStr = formatDuration(data.avgNapDurationSeconds, "short");

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {(data.bedtimeTrend.length > 1 || data.wakeTimeTrend.length > 1) && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: textPrimary,
              marginBottom: 12,
            }}
          >
            {t("sleepPatterns.bedtimeWakeTrends")}
          </Text>
          <TrendChart
            bedtimeTrend={data.bedtimeTrend}
            wakeTimeTrend={data.wakeTimeTrend}
            timeFormat={timeFormat}
            nightColor={nightColor}
            accentColor={accentColor}
            textTertiary={textTertiary}
            borderSubtle={borderSubtle}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 20,
              marginTop: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 12,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: nightColor,
                }}
              />
              <Text style={{ fontSize: 11, color: textSecondary }}>
                {t("sleepPatterns.avgBedtime")}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 12,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: accentColor,
                }}
              />
              <Text style={{ fontSize: 11, color: textSecondary }}>
                {t("sleepPatterns.avgWakeTime")}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricCard
          label={t("sleepPatterns.avgBedtime")}
          value={avgBedtimeStr}
          cardBg={cardBg}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          accentColor={nightColor}
        />
        <MetricCard
          label={t("sleepPatterns.avgWakeTime")}
          value={avgWakeTimeStr}
          cardBg={cardBg}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          accentColor={accentColor}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricCard
          label={t("sleepPatterns.avgTotalSleep")}
          value={avgTotalStr}
          cardBg={cardBg}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
        <MetricCard
          label={t("sleepPatterns.longestStretch")}
          value={longestStr}
          cardBg={cardBg}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
      </View>

      <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: textPrimary,
            marginBottom: 12,
          }}
        >
          {t("sleepPatterns.averages")}
        </Text>
        <View style={{ gap: 10 }}>
          <AverageRow
            label={t("sleepPatterns.avgNightSleep")}
            value={avgNightStr}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderSubtle={borderSubtle}
          />
          <AverageRow
            label={t("sleepPatterns.avgNapsPerDay")}
            value={String(data.avgNapsPerDay)}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderSubtle={borderSubtle}
          />
          <AverageRow
            label={t("sleepPatterns.avgNapDuration")}
            value={avgNapDurStr}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderSubtle={borderSubtle}
          />
          <AverageRow
            label={t("sleepPatterns.nightWakings")}
            value={String(data.nightWakingsPerNight)}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderSubtle={borderSubtle}
            isLast
          />
        </View>
      </View>
    </ScrollView>
  );
}

function AverageRow({
  label,
  value,
  textPrimary,
  textSecondary,
  borderSubtle,
  isLast = false,
}: {
  label: string;
  value: string;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: isLast ? 0 : 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: borderSubtle,
      }}
    >
      <Text style={{ fontSize: 14, color: textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "600", color: textPrimary }}>
        {value}
      </Text>
    </View>
  );
}

function TrendChart({
  bedtimeTrend,
  wakeTimeTrend,
  timeFormat,
  nightColor,
  accentColor,
  textTertiary,
  borderSubtle,
}: {
  bedtimeTrend: SleepSummary["bedtimeTrend"];
  wakeTimeTrend: SleepSummary["wakeTimeTrend"];
  timeFormat: TimeFormat;
  nightColor: string;
  accentColor: string;
  textTertiary: string;
  borderSubtle: string;
}) {
  const chartWidth = SCREEN_WIDTH - 80;
  const chartHeight = 120;

  const allTimes = [
    ...bedtimeTrend.map((d) => d.time),
    ...wakeTimeTrend.map((d) => d.time),
  ];

  if (allTimes.length === 0) return null;

  const minutes = allTimes.map((t) => t.getHours() * 60 + t.getMinutes());
  const minMin = Math.min(...minutes);
  const maxMin = Math.max(...minutes);
  const range = Math.max(maxMin - minMin, 60);

  const allDates = [
    ...bedtimeTrend.map((d) => d.date),
    ...wakeTimeTrend.map((d) => d.date),
  ];
  const sortedDates = [...new Set(allDates.map((d) => d.toISOString().slice(0, 10)))].sort();
  const dateCount = Math.max(sortedDates.length, 1);

  const getX = (date: Date) => {
    const key = date.toISOString().slice(0, 10);
    const idx = sortedDates.indexOf(key);
    return (idx / Math.max(dateCount - 1, 1)) * chartWidth;
  };

  const getY = (time: Date) => {
    const mins = time.getHours() * 60 + time.getMinutes();
    return chartHeight - ((mins - minMin) / range) * chartHeight;
  };

  const dayLabels = sortedDates.map((ds) => {
    const d = new Date(ds + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short" });
  });

  const minTimeLabel = formatTime(
    (() => {
      const d = new Date(0);
      d.setHours(Math.floor(minMin / 60), minMin % 60);
      return d;
    })(),
    timeFormat
  );
  const maxTimeLabel = formatTime(
    (() => {
      const d = new Date(0);
      d.setHours(Math.floor(maxMin / 60), maxMin % 60);
      return d;
    })(),
    timeFormat
  );

  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            justifyContent: "space-between",
            height: chartHeight,
            marginRight: 4,
          }}
        >
          <Text style={{ fontSize: 9, color: textTertiary }}>{maxTimeLabel}</Text>
          <Text style={{ fontSize: 9, color: textTertiary }}>{minTimeLabel}</Text>
        </View>
        <View style={{ width: chartWidth, height: chartHeight, position: "relative" }}>
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: borderSubtle,
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: borderSubtle,
            }}
          />

          {bedtimeTrend.map((point, i) => (
            <View
              key={`bed-${i}`}
              style={{
                position: "absolute",
                left: getX(point.date) - 4,
                top: getY(point.time) - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: nightColor,
              }}
            />
          ))}

          {wakeTimeTrend.map((point, i) => (
            <View
              key={`wake-${i}`}
              style={{
                position: "absolute",
                left: getX(point.date) - 4,
                top: getY(point.time) - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: accentColor,
              }}
            />
          ))}
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          marginLeft: 28,
          marginTop: 4,
          width: chartWidth,
          justifyContent: "space-between",
        }}
      >
        {dayLabels.map((label, i) => (
          <Text key={i} style={{ fontSize: 9, color: textTertiary, textAlign: "center" }}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
