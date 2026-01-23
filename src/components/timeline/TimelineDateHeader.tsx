/**
 * TimelineDateHeader - Tappable date header with date picker
 * Warm, journal-like aesthetic with share functionality
 */

import { useState, useCallback } from "react";
import { View, Text, Pressable, Platform, Share } from "react-native";
import { useColorScheme } from "nativewind";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ACTION_COLORS, SURFACE_COLORS } from "@/constants/design-tokens";

interface TimelineDateHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  dateLabel: string;
  onShare?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function TimelineDateHeader({
  currentDate,
  onDateChange,
  dateLabel,
  onShare,
  t,
}: TimelineDateHeaderProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDatePress = useCallback(() => {
    setShowDatePicker(true);
  }, []);

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
      }
      if (selectedDate) {
        onDateChange(selectedDate);
      }
    },
    [onDateChange]
  );

  const handleDone = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const handleShare = useCallback(async () => {
    if (onShare) {
      onShare();
    } else {
      try {
        await Share.share({
          message: `Baby tracker summary for ${dateLabel}`,
        });
      } catch {
        // Share cancelled or failed silently
      }
    }
  }, [onShare, dateLabel]);

  const primaryColor = isDark ? ACTION_COLORS.dark.primary : ACTION_COLORS.light.primary;

  return (
    <View className="px-4 py-3 flex-row items-center justify-between bg-surface dark:bg-surface-dark">
      {/* Date selector */}
      <Pressable
        onPress={handleDatePress}
        className="flex-row items-center py-2 px-3 -ml-3 rounded-lg active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
        accessibilityRole="button"
        accessibilityLabel={`${t("timeline.selectDate")}, ${dateLabel}`}
        accessibilityHint={t("timeline.tapToSelectDate")}
      >
        <Text className="text-xl font-bold text-content-primary dark:text-content-dark-primary">
          {dateLabel}
        </Text>
        <Text
          className="ml-2 text-lg"
          style={{ color: primaryColor }}
        >
          ▼
        </Text>
      </Pressable>

      {/* Share button */}
      <Pressable
        onPress={handleShare}
        className="w-10 h-10 items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
        accessibilityRole="button"
        accessibilityLabel={t("common.share")}
      >
        <Text className="text-xl">📤</Text>
      </Pressable>

      {/* Date Picker */}
      {showDatePicker && (
        <View
          className="absolute top-full left-0 right-0 z-50"
          style={{
            backgroundColor: isDark
              ? SURFACE_COLORS.dark.card
              : SURFACE_COLORS.light.card,
          }}
        >
          {Platform.OS === "ios" && (
            <View className="flex-row justify-end px-4 py-2 border-b border-border dark:border-border-dark">
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
          )}
          <DateTimePicker
            value={currentDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        </View>
      )}
    </View>
  );
}
