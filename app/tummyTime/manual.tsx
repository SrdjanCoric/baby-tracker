import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme } from "nativewind";
import { useTummyTime, useBaby, useTimeFormat } from "@/contexts";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { formatTime as formatTimeUtil } from "@/utils/time";
import { validateManualTummyTime } from "@/validators/tummyTime";
import { ACTIVITY } from "@/constants/colors";

const QUICK_DURATIONS = [1, 2, 3, 5, 10, 15];

export default function ManualTummyTimeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { addTummyTime } = useTummyTime();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = {
    accent: isDark ? ACTIVITY.tummyTime.accentDark : ACTIVITY.tummyTime.accent,
    mutedBg: isDark ? ACTIVITY.tummyTime.mutedDark : ACTIVITY.tummyTime.muted,
    textOnMuted: isDark ? ACTIVITY.tummyTime.textAccentDark : ACTIVITY.tummyTime.textAccent,
  };

  const [startTime, setStartTime] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [durationInput, setDurationInput] = useState("");

  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
      }
      if (selectedDate) {
        const newDateTime = new Date(startTime);
        newDateTime.setFullYear(selectedDate.getFullYear());
        newDateTime.setMonth(selectedDate.getMonth());
        newDateTime.setDate(selectedDate.getDate());
        setStartTime(newDateTime);
      }
    },
    [startTime]
  );

  const handleTimeChange = useCallback(
    (_event: unknown, selectedTime?: Date) => {
      if (Platform.OS === "android") {
        setShowTimePicker(false);
      }
      if (selectedTime) {
        const newDateTime = new Date(startTime);
        newDateTime.setHours(selectedTime.getHours());
        newDateTime.setMinutes(selectedTime.getMinutes());
        setStartTime(newDateTime);
      }
    },
    [startTime]
  );

  const handleDateTimeChange = useCallback(
    (_event: unknown, selectedDateTime?: Date) => {
      if (selectedDateTime) {
        setStartTime(selectedDateTime);
      }
    },
    []
  );

  const handleDurationChange = useCallback((text: string) => {
    setDurationInput(text);
    const value = parseInt(text, 10);
    if (!isNaN(value) && value > 0) {
      setDurationMinutes(value);
    } else {
      setDurationMinutes(null);
    }
  }, []);

  const handleQuickDurationSelect = useCallback((minutes: number) => {
    setDurationMinutes(minutes);
    setDurationInput(minutes.toString());
    Keyboard.dismiss();
  }, []);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!selectedBaby) return;

    setErrors({});

    const durationSeconds = durationMinutes ? durationMinutes * 60 : undefined;
    const validation = validateManualTummyTime({
      startedAt: startTime,
      durationSeconds,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const endedAt = new Date(
        startTime.getTime() + (durationSeconds ?? 0) * 1000
      );
      await addTummyTime({
        babyId: selectedBaby.id,
        startedAt: startTime,
        endedAt,
        durationSeconds,
        notes: notes || undefined,
      });
      router.replace("/(tabs)");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [selectedBaby, startTime, durationMinutes, notes, addTummyTime, router]);

  const canSave = durationMinutes !== null && durationMinutes > 0;

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  const formatTime = (date: Date) => formatTimeUtil(date, timeFormat);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      {/* Header with drag handle */}
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="items-center pt-2 pb-3"
        testID="dismiss-keyboard"
      >
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("tummyTime.pastTummyTimeTitle")}
        </Text>
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
          {selectedBaby.name}
        </Text>
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Start Time Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("tummyTime.startTime")}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowDatePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: colors.mutedBg }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectDate")}
            >
              <Text className="text-base" style={{ color: colors.textOnMuted }}>
                {formatDate(startTime)}
              </Text>
              <Text style={{ color: colors.accent }}>📅</Text>
            </Pressable>
            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowTimePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: colors.mutedBg }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectTime")}
            >
              <Text className="text-base" style={{ color: colors.textOnMuted }}>
                {formatTime(startTime)}
              </Text>
              <Text style={{ color: colors.accent }}>🕐</Text>
            </Pressable>
          </View>
          {errors.startedAt && (
            <Text className="text-red-500 text-sm mt-2">{errors.startedAt}</Text>
          )}
        </View>

        {/* iOS: Combined datetime picker */}
        {showDateTimePicker && Platform.OS === "ios" && (
          <View>
            <View className="flex-row justify-end px-2">
              <Pressable
                onPress={() => setShowDateTimePicker(false)}
                className="py-1 px-3"
              >
                <Text className="text-sm font-semibold" style={{ color: colors.accent }}>
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={startTime}
              mode="datetime"
              display="spinner"
              onChange={handleDateTimeChange}
              maximumDate={new Date()}
            />
          </View>
        )}

        {/* Android: Separate date picker */}
        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={startTime}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* Android: Separate time picker */}
        {showTimePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {/* Duration Input */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("tummyTime.durationMinutes")}
          </Text>
          <View
            className="flex-row items-center rounded-card-lg px-4 py-3 mb-4"
            style={{ backgroundColor: colors.mutedBg }}
          >
            <TextInput
              className="flex-1 text-2xl font-semibold text-center"
              style={{ color: colors.textOnMuted }}
              value={durationInput}
              onChangeText={handleDurationChange}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              returnKeyType="done"
              accessibilityLabel={t("tummyTime.durationPlaceholder")}
            />
            <Text
              className="text-lg font-medium ml-2"
              style={{ color: colors.accent }}
            >
              {t("common.min")}
            </Text>
          </View>

          {/* Quick duration buttons */}
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("tummyTime.quickDurations")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {QUICK_DURATIONS.map((minutes) => (
              <QuickButton
                key={minutes}
                label={`${minutes}`}
                isSelected={durationMinutes === minutes}
                onPress={() => handleQuickDurationSelect(minutes)}
                accentColor={colors.accent}
                mutedColor={colors.mutedBg}
                textColor={colors.textOnMuted}
              />
            ))}
          </View>
          {errors.durationSeconds && (
            <Text className="text-red-500 text-sm mt-2">
              {errors.durationSeconds}
            </Text>
          )}
        </View>

        {/* Notes */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("common.notes")} <Text className="font-normal text-content-tertiary">({t("common.optional")})</Text>
          </Text>
          <TextInput
            className="rounded-card-lg px-4 py-3 text-base bg-surface-secondary dark:bg-surface-dark-secondary text-content-primary dark:text-content-dark-primary"
            value={notes}
            onChangeText={setNotes}
            placeholder={t("tummyTime.notesPlaceholder")}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />
        </View>
      </ScrollView>

      {/* Save Button - Fixed at bottom */}
      <View className="px-6 pb-6 pt-2 bg-surface dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800">
        <Pressable
          onPress={handleSave}
          disabled={!canSave || isSaving}
          className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${
            !canSave || isSaving ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: colors.accent }}
          accessibilityRole="button"
          accessibilityLabel={t("tummyTime.logManualTummyTime")}
          accessibilityState={{ disabled: !canSave || isSaving }}
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : t("tummyTime.logManualTummyTime")}
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface QuickButtonProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function QuickButton({ label, isSelected, onPress, accentColor, mutedColor, textColor }: QuickButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[56px] py-2 px-3 rounded-button-lg items-center active:scale-95"
      style={{
        backgroundColor: isSelected ? accentColor : mutedColor,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isSelected ? "#FFFFFF" : textColor }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
