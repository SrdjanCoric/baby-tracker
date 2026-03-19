import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View, Pressable } from "react-native";
import { SURFACE } from "@/constants/colors";
import { formatDuration, formatTime } from "@/utils/time";
import type { TimeFormat } from "@/utils/time";
import { calculateSleepSummary, buildDailySleepBars } from "@/utils/sleep-patterns";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import { getDefaultSleepGoalForAge } from "@/utils/sleepGoals";
import { SleepDailyChart } from "./SleepDailyChart";
import { TrendChart } from "./TrendChart";
import { MetricCard, AverageRow } from "./MetricCard";
import type { SleepPatternColors } from "./useSleepPatternColors";

const PERIOD_OPTIONS = [7, 14, 30] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

function PeriodSelector({
  selectedPeriod,
  onSelect,
  colors,
}: {
  selectedPeriod: Period;
  onSelect: (period: Period) => void;
  colors: SleepPatternColors;
}) {
  const { t } = useTranslation();
  const pillBg = colors.isDark ? SURFACE.dark.secondary : SURFACE.light.secondary;

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: pillBg,
        borderRadius: 8,
        padding: 2,
        alignSelf: "center",
        marginBottom: 12,
      }}
    >
      {PERIOD_OPTIONS.map((period) => {
        const isActive = selectedPeriod === period;
        return (
          <Pressable
            key={period}
            onPress={() => onSelect(period)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: 6,
              backgroundColor: isActive ? colors.cardBg : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: isActive ? "600" : "500",
                color: isActive ? colors.accentColor : colors.textSecondary,
              }}
            >
              {t("sleepPatterns.periodDays", { count: period })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SleepSplitBar({
  nightPct,
  napPct,
  colors,
}: {
  nightPct: number;
  napPct: number;
  colors: SleepPatternColors;
}) {
  const { t } = useTranslation();

  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
          marginBottom: 8,
        }}
      >
        {t("sleepPatterns.sleepSplit")}
      </Text>
      <View
        style={{
          flexDirection: "row",
          height: 24,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${nightPct}%`,
            backgroundColor: colors.nightColor,
          }}
        />
        <View
          style={{
            width: `${napPct}%`,
            backgroundColor: colors.napColor,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.nightColor,
            }}
          />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {t("sleepPatterns.nightSleep")} {nightPct}%
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.napColor,
            }}
          />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {t("sleepPatterns.napSleep")} {napPct}%
          </Text>
        </View>
      </View>
    </View>
  );
}

export function SummaryView({
  sleeps,
  timeFormat,
  dayStartHour,
  dayEndHour,
  colors,
  isNewborn,
  locale,
  birthDate,
}: {
  sleeps: StoredSleepEntry[];
  timeFormat: TimeFormat;
  dayStartHour: number;
  dayEndHour: number;
  colors: SleepPatternColors;
  isNewborn: boolean;
  locale: string;
  birthDate?: string;
}) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>(7);

  const data = useMemo(
    () => calculateSleepSummary(sleeps, period, new Date(), dayStartHour, dayEndHour),
    [sleeps, period, dayStartHour, dayEndHour]
  );

  const dailyBars = useMemo(
    () => buildDailySleepBars(sleeps, period, new Date(), dayStartHour, dayEndHour, locale),
    [sleeps, period, dayStartHour, dayEndHour, locale]
  );

  const goalRange = useMemo(
    () => (birthDate ? getDefaultSleepGoalForAge(new Date(birthDate)) : null),
    [birthDate]
  );

  const avgTotalStr = formatDuration(data.avgTotalSleepSeconds, "short");
  const longestStr = formatDuration(data.longestStretchSeconds, "short");
  const avgNightStr = formatDuration(data.avgNightSleepSeconds, "short");
  const avgNapDurStr = formatDuration(data.avgNapDurationSeconds, "short");

  const goalSubtitle = goalRange
    ? t("sleepPatterns.recommended", { min: goalRange.minHours, max: goalRange.maxHours })
    : undefined;

  const bedtimeSubtitle =
    data.bedtimeStdDevMinutes !== null
      ? t("sleepPatterns.consistency", { minutes: data.bedtimeStdDevMinutes })
      : undefined;

  const nightPct =
    data.avgTotalSleepSeconds > 0
      ? Math.round((data.avgNightSleepSeconds / data.avgTotalSleepSeconds) * 100)
      : 0;
  const napPct = data.avgTotalSleepSeconds > 0 ? 100 - nightPct : 0;

  const labelInterval = period === 7 ? 1 : period === 14 ? 2 : 4;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <PeriodSelector selectedPeriod={period} onSelect={setPeriod} colors={colors} />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricCard
          label={t("sleepPatterns.avgTotalSleep")}
          value={avgTotalStr}
          colors={colors}
          subtitle={goalSubtitle}
        />
        <MetricCard
          label={t("sleepPatterns.longestStretch")}
          value={longestStr}
          colors={colors}
        />
      </View>

      {!isNewborn && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <MetricCard
            label={t("sleepPatterns.nightWakings")}
            value={String(data.nightWakingsPerNight)}
            colors={colors}
          />
          {data.avgBedtime ? (
            <MetricCard
              label={t("sleepPatterns.avgBedtime")}
              value={formatTime(data.avgBedtime, timeFormat)}
              colors={colors}
              subtitle={bedtimeSubtitle}
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
      )}

      {dailyBars.length > 0 && (
        <View style={{ backgroundColor: colors.cardBg, borderRadius: 12, padding: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.textPrimary,
              marginBottom: 12,
            }}
          >
            {t("sleepPatterns.dailySleep")}
          </Text>
          <SleepDailyChart
            data={dailyBars}
            nightColor={colors.nightColor}
            napColor={colors.napColor}
            nightLabel={t("sleepPatterns.nightSleep")}
            napLabel={t("sleepPatterns.napSleep")}
            colors={colors}
            locale={locale}
            labelInterval={labelInterval}
          />
        </View>
      )}

      {!isNewborn && (data.bedtimeTrend.length > 1 || data.wakeTimeTrend.length > 1) && (
        <View style={{ backgroundColor: colors.cardBg, borderRadius: 12, padding: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.textPrimary,
              marginBottom: 12,
            }}
          >
            {t("sleepPatterns.bedtimeWakeTrends")}
          </Text>
          <TrendChart
            bedtimeTrend={data.bedtimeTrend}
            wakeTimeTrend={data.wakeTimeTrend}
            timeFormat={timeFormat}
            colors={colors}
            locale={locale}
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
                  backgroundColor: colors.nightColor,
                }}
              />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t("sleepPatterns.avgBedtime")}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 12,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: colors.accentColor,
                }}
              />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t("sleepPatterns.avgWakeTime")}
              </Text>
            </View>
          </View>
        </View>
      )}

      {isNewborn && (
        <View
          style={{
            backgroundColor: colors.cardBg,
            borderRadius: 12,
            padding: 16,
            flexDirection: "row",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Text style={{ fontSize: 18, lineHeight: 22 }}>{"\uD83D\uDCA1"}</Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              lineHeight: 19,
              flex: 1,
            }}
          >
            {t("sleepPatterns.newbornNote")}
          </Text>
        </View>
      )}

      <View style={{ backgroundColor: colors.cardBg, borderRadius: 12, padding: 16 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: colors.textPrimary,
            marginBottom: 12,
          }}
        >
          {t("sleepPatterns.averages")}
        </Text>
        <View style={{ gap: 10 }}>
          {!isNewborn && data.avgTotalSleepSeconds > 0 && (
            <SleepSplitBar nightPct={nightPct} napPct={napPct} colors={colors} />
          )}
          {!isNewborn && (
            <AverageRow
              label={t("sleepPatterns.avgNightSleep")}
              value={avgNightStr}
              colors={colors}
            />
          )}
          <AverageRow
            label={t("sleepPatterns.avgNapsPerDay")}
            value={String(data.avgNapsPerDay)}
            colors={colors}
          />
          <AverageRow
            label={t("sleepPatterns.avgNapDuration")}
            value={avgNapDurStr}
            colors={colors}
            isLast
          />
        </View>
      </View>
    </ScrollView>
  );
}
