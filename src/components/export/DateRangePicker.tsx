import { useState } from "react";
import { View, Text, Pressable, Platform, useColorScheme } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import type { DateRangePreset, DateRange } from "@/types/export";
import { DATE_RANGE_PRESETS } from "@/constants/export";
import { getDateLocale } from "@/utils/time";

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

interface PresetButtonProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function PresetButton({ label, isSelected, onPress }: PresetButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={`px-4 py-2 rounded-full mr-2 mb-2 ${
        isSelected
          ? "bg-primary-500"
          : "bg-surface-secondary dark:bg-surface-dark-secondary"
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          isSelected
            ? "text-white"
            : "text-content-primary dark:text-content-dark-primary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function getDateRangeFromPreset(preset: DateRangePreset): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  const presetConfig = DATE_RANGE_PRESETS.find((p) => p.value === preset);

  if (presetConfig?.days) {
    startDate.setDate(startDate.getDate() - presetConfig.days + 1);
  } else if (preset === "allTime") {
    startDate.setFullYear(2020, 0, 1);
  }

  return { startDate, endDate };
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
}: DateRangePickerProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === "custom") {
      onDateRangeChange({ ...dateRange, preset });
    } else {
      const { startDate, endDate } = getDateRangeFromPreset(preset);
      onDateRangeChange({ startDate, endDate, preset });
    }
  };

  const handleStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowStartPicker(false);
    }
    if (selectedDate) {
      selectedDate.setHours(0, 0, 0, 0);
      onDateRangeChange({
        ...dateRange,
        startDate: selectedDate,
        preset: "custom",
      });
    }
  };

  const handleEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowEndPicker(false);
    }
    if (selectedDate) {
      selectedDate.setHours(23, 59, 59, 999);
      onDateRangeChange({
        ...dateRange,
        endDate: selectedDate,
        preset: "custom",
      });
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(getDateLocale(), {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const presetLabels: Record<DateRangePreset, string> = {
    last7days: t("export.last7Days"),
    last30days: t("export.last30Days"),
    last90days: t("export.last90Days"),
    allTime: t("export.allTime"),
    custom: t("export.custom"),
  };

  return (
    <View>
      <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
        {t("export.dateRange")}
      </Text>

      <View className="flex-row flex-wrap mb-4">
        {DATE_RANGE_PRESETS.map((preset) => (
          <PresetButton
            key={preset.value}
            label={presetLabels[preset.value]}
            isSelected={dateRange.preset === preset.value}
            onPress={() => handlePresetSelect(preset.value)}
          />
        ))}
      </View>

      {dateRange.preset === "custom" && (
        <View className="flex-row justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mb-1">
              {t("export.startDate")}
            </Text>
            <Pressable
              onPress={() => setShowStartPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`${t("export.startDate")}: ${formatDate(dateRange.startDate)}`}
              className={`px-4 py-3 rounded-xl border ${
                isDark
                  ? "border-gray-700 bg-surface-dark-card"
                  : "border-gray-300 bg-gray-50"
              }`}
              testID="start-date-picker"
            >
              <Text className="text-content-primary dark:text-content-dark-primary text-center">
                {formatDate(dateRange.startDate)}
              </Text>
            </Pressable>
          </View>

          <View className="flex-1 ml-2">
            <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mb-1">
              {t("export.endDate")}
            </Text>
            <Pressable
              onPress={() => setShowEndPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`${t("export.endDate")}: ${formatDate(dateRange.endDate)}`}
              className={`px-4 py-3 rounded-xl border ${
                isDark
                  ? "border-gray-700 bg-surface-dark-card"
                  : "border-gray-300 bg-gray-50"
              }`}
              testID="end-date-picker"
            >
              <Text className="text-content-primary dark:text-content-dark-primary text-center">
                {formatDate(dateRange.endDate)}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {showStartPicker && (
        <DateTimePicker
          value={dateRange.startDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleStartDateChange}
          maximumDate={dateRange.endDate}
          testID="start-date-time-picker"
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={dateRange.endDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleEndDateChange}
          minimumDate={dateRange.startDate}
          maximumDate={new Date()}
          testID="end-date-time-picker"
        />
      )}
    </View>
  );
}
