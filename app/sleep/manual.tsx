import { useCallback, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSleep, useBaby, useTimeFormat } from "@/contexts";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { formatTime as formatTimeUtil } from "@/utils/time";
import { validateManualSleep, determineSleepType } from "@/validators/sleep";
import type { SleepType } from "@/constants/activities";

const SLEEP_PURPLE = "#6B5B95";
const SLEEP_PURPLE_MUTED = "#E8E4F0";
const SLEEP_PURPLE_DARK = "#574A7B";

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120];

export default function ManualSleepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { addSleep, wakeWindowConfig } = useSleep();

  const [startTime, setStartTime] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [sleepType, setSleepType] = useState<SleepType>(() =>
    determineSleepType(new Date(), wakeWindowConfig?.dayStartHour, wakeWindowConfig?.dayEndHour)
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [durationInput, setDurationInput] = useState("");

  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suggestedType = useMemo(() => {
    return determineSleepType(startTime, wakeWindowConfig?.dayStartHour, wakeWindowConfig?.dayEndHour);
  }, [startTime, wakeWindowConfig?.dayStartHour, wakeWindowConfig?.dayEndHour]);

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
    const validation = validateManualSleep({
      type: sleepType,
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
      await addSleep({
        babyId: selectedBaby.id,
        type: sleepType,
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
  }, [
    selectedBaby,
    sleepType,
    startTime,
    durationMinutes,
    notes,
    addSleep,
    router,
  ]);

  const canSave = sleepType !== null && durationMinutes !== null && durationMinutes > 0;

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
          {t("sleep.pastSleepTitle")}
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
        {/* Sleep Type Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("sleep.sleepType")}
          </Text>
          <View className="flex-row gap-3">
            <SleepTypeButton
              type="nap"
              label={t("sleep.nap")}
              icon="💤"
              isSuggested={suggestedType === "nap"}
              isSelected={sleepType === "nap"}
              onPress={() => setSleepType("nap")}
            />
            <SleepTypeButton
              type="night"
              label={t("sleep.night")}
              icon="🌙"
              isSuggested={suggestedType === "night"}
              isSelected={sleepType === "night"}
              onPress={() => setSleepType("night")}
            />
          </View>
          {errors.type && (
            <Text className="text-red-500 text-sm mt-2">{errors.type}</Text>
          )}
        </View>

        {/* Start Time Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("sleep.startTime")}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowDatePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectDate")}
            >
              <Text className="text-base" style={{ color: SLEEP_PURPLE_DARK }}>
                {formatDate(startTime)}
              </Text>
              <Text style={{ color: SLEEP_PURPLE }}>📅</Text>
            </Pressable>
            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowTimePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectTime")}
            >
              <Text className="text-base" style={{ color: SLEEP_PURPLE_DARK }}>
                {formatTime(startTime)}
              </Text>
              <Text style={{ color: SLEEP_PURPLE }}>🕐</Text>
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
                <Text className="text-sm font-semibold" style={{ color: SLEEP_PURPLE }}>
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
            {t("sleep.durationMinutes")}
          </Text>
          <View
            className="flex-row items-center rounded-card-lg px-4 py-3 mb-4"
            style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
          >
            <TextInput
              className="flex-1 text-2xl font-semibold text-center"
              style={{ color: SLEEP_PURPLE_DARK }}
              value={durationInput}
              onChangeText={handleDurationChange}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              returnKeyType="done"
              accessibilityLabel={t("sleep.durationPlaceholder")}
            />
            <Text
              className="text-lg font-medium ml-2"
              style={{ color: SLEEP_PURPLE }}
            >
              {t("common.min")}
            </Text>
          </View>

          {/* Quick duration buttons */}
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("sleep.quickDurations")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {QUICK_DURATIONS.map((minutes) => (
              <QuickButton
                key={minutes}
                label={`${minutes}`}
                isSelected={durationMinutes === minutes}
                onPress={() => handleQuickDurationSelect(minutes)}
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
            {t("sleep.notes")}
          </Text>
          <TextInput
            className="rounded-card-lg px-4 py-3 text-base bg-surface-secondary dark:bg-surface-dark-secondary text-content-primary dark:text-content-dark-primary"
            value={notes}
            onChangeText={setNotes}
            placeholder={t("sleep.notesPlaceholder")}
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
          style={{ backgroundColor: SLEEP_PURPLE }}
          accessibilityRole="button"
          accessibilityLabel={t("sleep.logManualSleep")}
          accessibilityState={{ disabled: !canSave || isSaving }}
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : t("sleep.logManualSleep")}
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface SleepTypeButtonProps {
  type: SleepType;
  label: string;
  icon: string;
  isSuggested: boolean;
  isSelected: boolean;
  onPress: () => void;
}

function SleepTypeButton({
  label,
  icon,
  isSuggested,
  isSelected,
  onPress,
}: SleepTypeButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-5 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSelected ? SLEEP_PURPLE : SLEEP_PURPLE_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${isSuggested ? `, ${t("feeding.suggested")}` : ""}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Text className="text-3xl mb-2">{icon}</Text>
      <Text
        className="text-base font-medium"
        style={{ color: isSelected ? "#FFFFFF" : SLEEP_PURPLE_DARK }}
      >
        {label}
      </Text>
      {isSuggested && !isSelected && (
        <View
          className="px-2 py-0.5 rounded-pill mt-2"
          style={{ backgroundColor: SLEEP_PURPLE + "30" }}
        >
          <Text className="text-xs font-medium" style={{ color: SLEEP_PURPLE }}>
            {t("feeding.suggested")}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface QuickButtonProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function QuickButton({ label, isSelected, onPress }: QuickButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[56px] py-2 px-3 rounded-button-lg items-center active:scale-95"
      style={{
        backgroundColor: isSelected ? SLEEP_PURPLE : SLEEP_PURPLE_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isSelected ? "#FFFFFF" : SLEEP_PURPLE }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
