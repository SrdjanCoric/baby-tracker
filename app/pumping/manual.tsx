import { useCallback, useMemo, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme } from "nativewind";
import { usePumping } from "@/contexts/pumping-context";
import { useBaby, useUnits, useTimeFormat } from "@/contexts";
import { formatTime as formatTimeUtil } from "@/utils/time";
import { te } from "@/utils/translate-errors";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { validateManualPumping } from "@/validators/pumping";
import { formatVolume, mlToOz, ozToMl } from "@/utils/volume";
import type { BreastSide } from "@/constants/activities";
import { getOppositeSide } from "@/constants/activities";
import { ACTIVITY } from "@/constants/colors";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const QUICK_DURATIONS = [5, 10, 15, 20, 30, 45];
const QUICK_AMOUNTS_OZ = [1, 2, 3, 4, 5, 6];
const QUICK_AMOUNTS_ML = [30, 60, 90, 120, 150, 180];

type VolumeUnit = "ml" | "oz";

export default function ManualPumpingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onboardingPreview } = useLocalSearchParams<{ onboardingPreview?: string }>();
  const { selectedBaby } = useBaby();
  const { volumeUnit } = useUnits();
  const { timeFormat } = useTimeFormat();
  const { addPumping, getLastSide } = usePumping();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = {
    accent: isDark ? ACTIVITY.pumping.accentDark : ACTIVITY.pumping.accent,
    mutedBg: isDark ? ACTIVITY.pumping.mutedDark : ACTIVITY.pumping.muted,
    textOnMuted: isDark ? ACTIVITY.pumping.textAccentDark : ACTIVITY.pumping.textAccent,
  };

  const suggestedSide = useMemo((): BreastSide => {
    const lastSide = getLastSide();
    return lastSide ? getOppositeSide(lastSide) : "both";
  }, [getLastSide]);

  const [startTime, setStartTime] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [side, setSide] = useState<BreastSide>(suggestedSide);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [durationInput, setDurationInput] = useState("");
  const [volumeMl, setVolumeMl] = useState<number | null>(null);
  const [unit, setUnit] = useState<VolumeUnit>(volumeUnit);
  const [volumeInput, setVolumeInput] = useState("");

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

  const handleVolumeChange = useCallback((text: string) => {
    setVolumeInput(text);
    const value = parseFloat(text);
    if (!isNaN(value) && value > 0) {
      if (unit === "oz") {
        setVolumeMl(ozToMl(value));
      } else {
        setVolumeMl(value);
      }
    } else {
      setVolumeMl(null);
    }
  }, [unit]);

  const handleQuickAmountSelect = useCallback((amount: number) => {
    if (unit === "oz") {
      const ml = ozToMl(amount);
      setVolumeMl(ml);
      setVolumeInput(amount.toString());
    } else {
      setVolumeMl(amount);
      setVolumeInput(amount.toString());
    }
    Keyboard.dismiss();
  }, [unit]);

  const handleUnitToggle = useCallback(() => {
    if (volumeMl !== null) {
      if (unit === "oz") {
        setVolumeInput(Math.round(volumeMl).toString());
      } else {
        setVolumeInput(mlToOz(volumeMl).toString());
      }
    }
    setUnit(prev => prev === "oz" ? "ml" : "oz");
  }, [unit, volumeMl]);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!selectedBaby) return;

    setErrors({});

    const durationSeconds = durationMinutes ? durationMinutes * 60 : undefined;
    const validation = validateManualPumping({
      babyId: selectedBaby.id,
      side,
      startedAt: startTime,
      durationSeconds,
      volumeMl: volumeMl ?? undefined,
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
      await addPumping({
        babyId: selectedBaby.id,
        side,
        startedAt: startTime,
        endedAt,
        durationSeconds,
        volumeMl: volumeMl ?? undefined,
        notes: notes || undefined,
      });
      if (onboardingPreview === "firstActivity") {
        await NewOwnerOnboardingStorageService.markActivitySaved("pumping");
        router.replace("/onboarding/owner/saved");
      } else {
        router.replace("/(tabs)");
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [
    selectedBaby,
    side,
    startTime,
    durationMinutes,
    volumeMl,
    notes,
    addPumping,
    onboardingPreview,
    router,
  ]);

  const canSave = side !== null && durationMinutes !== null && durationMinutes > 0 && volumeMl !== null && volumeMl > 0;

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
          {t("pumping.pastPumpingTitle")}
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
        {/* Side Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("pumping.side")}
          </Text>
          <View className="flex-row gap-3">
            <SideButton
              sideValue="left"
              label={t("feeding.leftSide")}
              shortLabel="L"
              isSuggested={suggestedSide === "left"}
              isSelected={side === "left"}
              onPress={() => setSide("left")}
              accentColor={colors.accent}
              mutedColor={colors.mutedBg}
              textColor={colors.textOnMuted}
            />
            <SideButton
              sideValue="both"
              label={t("feeding.bothSides")}
              shortLabel="B"
              isSuggested={suggestedSide === "both"}
              isSelected={side === "both"}
              onPress={() => setSide("both")}
              accentColor={colors.accent}
              mutedColor={colors.mutedBg}
              textColor={colors.textOnMuted}
            />
            <SideButton
              sideValue="right"
              label={t("feeding.rightSide")}
              shortLabel="R"
              isSuggested={suggestedSide === "right"}
              isSelected={side === "right"}
              onPress={() => setSide("right")}
              accentColor={colors.accent}
              mutedColor={colors.mutedBg}
              textColor={colors.textOnMuted}
            />
          </View>
          {errors.side && (
            <Text className="text-red-500 text-sm mt-2">{te(t, errors.side)}</Text>
          )}
        </View>

        {/* Start Time Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.startTime")}
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
            <Text className="text-red-500 text-sm mt-2">{te(t, errors.startedAt)}</Text>
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
            {t("feeding.durationMinutes")}
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
              accessibilityLabel={t("feeding.durationPlaceholder")}
              testID="duration-input"
            />
            <Text
              className="text-lg font-medium ml-2"
              style={{ color: colors.accent }}
            >
              min
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
                accentColor={colors.accent}
                mutedColor={colors.mutedBg}
                textColor={colors.textOnMuted}
              />
            ))}
          </View>
          {errors.durationSeconds && (
            <Text className="text-red-500 text-sm mt-2">
              {te(t, errors.durationSeconds)}
            </Text>
          )}
        </View>

        {/* Volume Input */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
              {t("pumping.amount")}
            </Text>
            <UnitToggle unit={unit} onToggle={handleUnitToggle} accentColor={colors.accent} mutedColor={colors.mutedBg} textColor={colors.textOnMuted} />
          </View>

          <View
            className="flex-row items-center rounded-card-lg px-4 py-3 mb-4"
            style={{ backgroundColor: colors.mutedBg }}
          >
            <TextInput
              className="flex-1 text-2xl font-semibold text-center"
              style={{ color: colors.textOnMuted }}
              value={volumeInput}
              onChangeText={handleVolumeChange}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              returnKeyType="done"
              accessibilityLabel={t("pumping.enterVolume")}
              testID="volume-input"
            />
            <Text className="text-lg font-medium ml-2" style={{ color: colors.accent }}>
              {unit}
            </Text>
          </View>

          {/* Quick amount buttons */}
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("feeding.quickAmounts")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(unit === "oz" ? QUICK_AMOUNTS_OZ : QUICK_AMOUNTS_ML).map((amount) => (
              <QuickButton
                key={amount}
                label={`${amount}`}
                isSelected={
                  unit === "oz"
                    ? volumeMl !== null && Math.abs(ozToMl(amount) - volumeMl) < 1
                    : volumeMl === amount
                }
                onPress={() => handleQuickAmountSelect(amount)}
                accentColor={colors.accent}
                mutedColor={colors.mutedBg}
                textColor={colors.textOnMuted}
              />
            ))}
          </View>
          {errors.volumeMl && (
            <Text className="text-red-500 text-sm mt-2">{te(t, errors.volumeMl)}</Text>
          )}
        </View>

        {/* Amount preview */}
        {volumeMl !== null && volumeMl > 0 && (
          <View className="items-center mb-4">
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {formatVolume(volumeMl, "ml")} = {formatVolume(volumeMl, "oz")}
            </Text>
          </View>
        )}

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
          style={{ backgroundColor: colors.accent }}
          accessibilityRole="button"
          accessibilityLabel={t("pumping.logManualPumping")}
          accessibilityState={{ disabled: !canSave || isSaving }}
          testID="save-button"
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : t("pumping.logManualPumping")}
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface SideButtonProps {
  sideValue: BreastSide;
  label: string;
  shortLabel: string;
  isSuggested: boolean;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function SideButton({
  label,
  shortLabel,
  isSuggested,
  isSelected,
  onPress,
  accentColor,
  mutedColor,
  textColor,
}: SideButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-4 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSelected ? accentColor : mutedColor,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${isSuggested ? `, ${t("feeding.suggested")}` : ""}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-2xl font-bold mb-1"
        style={{ color: isSelected ? "#FFFFFF" : textColor }}
      >
        {shortLabel}
      </Text>
      <Text
        className="text-sm font-medium"
        style={{ color: isSelected ? "#FFFFFF" : textColor }}
      >
        {label}
      </Text>
      {isSuggested && !isSelected && (
        <View
          className="px-2 py-0.5 rounded-pill mt-1"
          style={{ backgroundColor: accentColor + "30" }}
        >
          <Text className="text-xs font-medium" style={{ color: textColor }}>
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

interface UnitToggleProps {
  unit: VolumeUnit;
  onToggle: () => void;
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function UnitToggle({ unit, onToggle, accentColor, mutedColor, textColor }: UnitToggleProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onToggle}
      className="flex-row rounded-pill p-1"
      style={{ backgroundColor: mutedColor }}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${unit === "oz" ? "milliliters" : "ounces"}`}
    >
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "oz" ? { backgroundColor: accentColor } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "oz" ? "#FFFFFF" : textColor }}
        >
          {t("feeding.oz")}
        </Text>
      </View>
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "ml" ? { backgroundColor: accentColor } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "ml" ? "#FFFFFF" : textColor }}
        >
          {t("feeding.ml")}
        </Text>
      </View>
    </Pressable>
  );
}
