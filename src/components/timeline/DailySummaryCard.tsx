import { useState, useCallback, useMemo } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { useColorScheme } from "nativewind";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";
import { CONTENT_COLORS, ACTION_COLORS, SURFACE_COLORS } from "@/constants/design-tokens";
import { calculateDailySummary, type TimelineDataByDate } from "@/utils/timeline";
import { formatHourValue, type TimeFormat } from "@/utils/time";
import type { FilterType } from "./ActivityFilterTabs";

interface DailySummaryCardProps {
  filter: FilterType;
  allData: TimelineDataByDate;
  birthDate?: string;
  dayStartHour?: number;
  timeFormat?: TimeFormat;
  t: (key: string, options?: Record<string, unknown>) => string;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export function DailySummaryCard({
  filter,
  allData,
  birthDate,
  dayStartHour = 6,
  timeFormat = "12h",
  t,
  selectedDate,
  onDateChange,
}: DailySummaryCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const summary = useMemo(
    () => calculateDailySummary(selectedDate, allData, dayStartHour),
    [selectedDate, allData, dayStartHour]
  );

  const [pickerDate, setPickerDate] = useState(selectedDate);

  const handleDatePress = useCallback(() => {
    setPickerDate(selectedDate);
    setShowDatePicker(false);
    requestAnimationFrame(() => {
      setShowDatePicker(true);
    });
  }, [selectedDate]);

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
        if (date) {
          const normalized = new Date(date);
          normalized.setHours(0, 0, 0, 0);
          onDateChange(normalized);
        }
      } else if (date) {
        setPickerDate(date);
      }
    },
    [onDateChange]
  );

  const handleCancel = useCallback(() => {
    setPickerDate(selectedDate);
    setShowDatePicker(false);
  }, [selectedDate]);

  const handleDone = useCallback(() => {
    setShowDatePicker(false);
    const normalized = new Date(pickerDate);
    normalized.setHours(0, 0, 0, 0);
    onDateChange(normalized);
  }, [onDateChange, pickerDate]);

  const minDate = useMemo(() => {
    if (!birthDate) return undefined;
    const d = new Date(birthDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [birthDate]);

  const maxDate = useMemo(() => new Date(), []);

  const dateLabel = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const diffDays = Math.round((today.getTime() - selected.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("common.today");
    if (diffDays === 1) return t("common.yesterday");
    return selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, [selectedDate, t]);

  const primaryColor = isDark ? ACTION_COLORS.dark.primary : ACTION_COLORS.light.primary;

  if (filter === "all") {
    return (
      <View
        className="mx-4 mt-3 mb-1 rounded-xl p-3"
        style={{
          backgroundColor: isDark ? SURFACE_COLORS.dark.card : SURFACE_COLORS.light.card,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-base mr-2">📅</Text>
            <Text
              className="text-sm font-semibold"
              style={{ color: isDark ? CONTENT_COLORS.dark.secondary : CONTENT_COLORS.light.secondary }}
            >
              {t("timeline.jumpToDate")}
            </Text>
          </View>
          <Pressable
            onPress={handleDatePress}
            className="flex-row items-center py-1 px-2 rounded-lg active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={`${t("timeline.selectDate")}, ${dateLabel}`}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: primaryColor }}
            >
              {dateLabel}
            </Text>
            <Text
              className="ml-1 text-xs"
              style={{ color: primaryColor }}
            >
              ▼
            </Text>
          </Pressable>
        </View>

        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={minDate}
            maximumDate={maxDate}
          />
        )}

        {showDatePicker && Platform.OS === "ios" && (
          <View
            style={{
              backgroundColor: isDark
                ? SURFACE_COLORS.dark.card
                : SURFACE_COLORS.light.card,
              borderRadius: 12,
              marginTop: 8,
            }}
          >
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              minimumDate={minDate}
              maximumDate={maxDate}
            />
            <View className="flex-row justify-between px-4 py-2 border-t border-border dark:border-border-dark">
              <Pressable
                onPress={handleCancel}
                className="py-2 px-4"
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
              >
                <Text
                  className="text-base"
                  style={{ color: isDark ? CONTENT_COLORS.dark.secondary : CONTENT_COLORS.light.secondary }}
                >
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDone}
                className="py-2 px-4"
                accessibilityRole="button"
                accessibilityLabel={t("common.done")}
              >
                <Text
                  className="font-semibold text-base"
                  style={{ color: primaryColor }}
                >
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  }

  const getSummaryContent = () => {
    switch (filter) {
      case "feeding": {
        const lines: { label: string; value: string }[] = [];
        if (summary.nursingCount > 0) {
          const hours = Math.floor(summary.nursingMinutes / 60);
          const mins = summary.nursingMinutes % 60;
          const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          lines.push({
            label: t("feeding.breastfeeding"),
            value: `${timeStr} · ${summary.nursingCount}×`,
          });
        }
        if (summary.bottleBreastMilkCount > 0) {
          lines.push({
            label: t("feeding.bottleBreastMilk"),
            value: `${summary.bottleBreastMilkMl}ml · ${summary.bottleBreastMilkCount}×`,
          });
        }
        if (summary.bottleFormulaCount > 0) {
          lines.push({
            label: t("feeding.bottleFormula"),
            value: `${summary.bottleFormulaMl}ml · ${summary.bottleFormulaCount}×`,
          });
        }
        if (summary.bottleCount > 0 && summary.bottleBreastMilkCount === 0 && summary.bottleFormulaCount === 0) {
          lines.push({
            label: t("feeding.bottle"),
            value: `${summary.feedingTotalMl}ml · ${summary.bottleCount}×`,
          });
        }
        if (summary.solidCount > 0) {
          lines.push({
            label: t("feeding.solid"),
            value: `${summary.solidCount}×`,
          });
        }
        return lines;
      }
      case "sleep": {
        const lines: { label: string; value: string }[] = [];
        const hours = Math.floor(summary.sleepMinutes / 60);
        const mins = summary.sleepMinutes % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        if (summary.napCount > 0) {
          lines.push({
            label: t("sleep.nap"),
            value: `${summary.napCount}×`,
          });
        }
        if (summary.nightSleepCount > 0) {
          lines.push({
            label: t("sleep.night"),
            value: `${summary.nightSleepCount}×`,
          });
        }
        if (summary.sleepMinutes > 0) {
          lines.push({
            label: t("common.total"),
            value: timeStr,
          });
        }
        return lines;
      }
      case "diaper": {
        const lines: { label: string; value: string }[] = [];
        if (summary.diaperCount.wet > 0) {
          lines.push({ label: t("diaper.wet"), value: `${summary.diaperCount.wet}×` });
        }
        if (summary.diaperCount.dirty > 0) {
          lines.push({ label: t("diaper.dirty"), value: `${summary.diaperCount.dirty}×` });
        }
        if (summary.diaperCount.mixed > 0) {
          lines.push({ label: t("diaper.mixed"), value: `${summary.diaperCount.mixed}×` });
        }
        if (summary.diaperCount.dry > 0) {
          lines.push({ label: t("diaper.dry"), value: `${summary.diaperCount.dry}×` });
        }
        return lines;
      }
      case "pumping": {
        if (summary.pumpingCount > 0) {
          return [
            {
              label: t("pumping.title"),
              value: `${summary.pumpingTotalMl}ml · ${summary.pumpingCount}×`,
            },
          ];
        }
        return [];
      }
      case "growth": {
        if (summary.growthCount > 0) {
          return [
            {
              label: t("growth.title"),
              value: `${summary.growthCount}×`,
            },
          ];
        }
        return [];
      }
      case "tummyTime": {
        if (summary.tummyTimeCount > 0) {
          return [
            {
              label: t("tummyTime.title"),
              value: `${summary.tummyTimeMinutes}m · ${summary.tummyTimeCount}×`,
            },
          ];
        }
        return [];
      }
      default:
        return [];
    }
  };

  const content = getSummaryContent();
  const config = ACTIVITY_CONFIG[filter as ActivityType];
  const bgColor = isDark ? config.mutedBgDark : config.mutedBg;
  const accentColor = config.accentColor;

  return (
    <View
      className="mx-4 mt-3 mb-1 rounded-xl p-3"
      style={{
        backgroundColor: bgColor,
        borderLeftWidth: 4,
        borderLeftColor: accentColor,
      }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Text className="text-lg mr-2">{config.icon}</Text>
          <Text
            className="text-sm font-semibold"
            style={{ color: accentColor }}
          >
            {t("timeline.summary")}
          </Text>
          {filter === "sleep" && (
            <Pressable onPress={() => setShowInfo(prev => !prev)} hitSlop={8}>
              <Text style={{ color: isDark ? CONTENT_COLORS.dark.secondary : CONTENT_COLORS.light.secondary, fontSize: 14, marginLeft: 4 }}>ⓘ</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={handleDatePress}
          className="flex-row items-center py-1 px-2 rounded-lg active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={`${t("timeline.selectDate")}, ${dateLabel}`}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: primaryColor }}
          >
            {dateLabel}
          </Text>
          <Text
            className="ml-1 text-xs"
            style={{ color: primaryColor }}
          >
            ▼
          </Text>
        </Pressable>
      </View>

      {showInfo && filter === "sleep" && (
        <Text
          className="text-xs mb-1"
          style={{ color: isDark ? CONTENT_COLORS.dark.tertiary : CONTENT_COLORS.light.tertiary }}
        >
          {t("timeline.sleepSummaryInfo", { hour: formatHourValue(dayStartHour, timeFormat) })}
        </Text>
      )}

      {content.length > 0 ? (
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          {content.map((item, index) => (
            <View key={index} className="flex-row items-center">
              <Text
                className="text-sm"
                style={{ color: isDark ? CONTENT_COLORS.dark.secondary : CONTENT_COLORS.light.secondary }}
              >
                {item.label}:{" "}
              </Text>
              <Text
                className="text-sm font-semibold"
                style={{ color: isDark ? CONTENT_COLORS.dark.primary : CONTENT_COLORS.light.primary }}
              >
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text
          className="text-sm"
          style={{ color: isDark ? CONTENT_COLORS.dark.secondary : CONTENT_COLORS.light.secondary }}
        >
          {t("common.noData")}
        </Text>
      )}

      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={minDate}
          maximumDate={maxDate}
        />
      )}

      {showDatePicker && Platform.OS === "ios" && (
        <View
          style={{
            backgroundColor: isDark
              ? SURFACE_COLORS.dark.card
              : SURFACE_COLORS.light.card,
            borderRadius: 12,
            marginTop: 8,
          }}
        >
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="spinner"
            onChange={handleDateChange}
            minimumDate={minDate}
            maximumDate={maxDate}
          />
          <View className="flex-row justify-between px-4 py-2 border-t border-border dark:border-border-dark">
            <Pressable
              onPress={handleCancel}
              className="py-2 px-4"
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
            >
              <Text
                className="text-base"
                style={{ color: isDark ? CONTENT_COLORS.dark.secondary : CONTENT_COLORS.light.secondary }}
              >
                {t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleDone}
              className="py-2 px-4"
              accessibilityRole="button"
              accessibilityLabel={t("common.done")}
            >
              <Text
                className="font-semibold text-base"
                style={{ color: primaryColor }}
              >
                {t("common.done")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
