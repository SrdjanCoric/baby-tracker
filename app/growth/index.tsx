import { useCallback, useRef, useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView, Keyboard, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useGrowth } from "@/contexts/growth-context";
import { useBaby, useUnits, useTimeFormat } from "@/contexts";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { te } from "@/utils/translate-errors";
import { validateGrowthMeasurement } from "@/validators/growth";
import { formatTime as formatTimeUtil } from "@/utils/time";
import { lbsToKg, inchesToCm } from "@/utils/growth";
import { isUnderTwoYears } from "@/utils/growth-helpers";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const GROWTH_TEAL = "#009B77";
const GROWTH_TEAL_MUTED = "#E0F5EF";
const GROWTH_TEAL_DARK = "#007A5E";

export default function GrowthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onboardingPreview } = useLocalSearchParams<{ onboardingPreview?: string }>();
  const { selectedBaby } = useBaby();
  const { addMeasurement } = useGrowth();
  const { weightUnit, heightUnit } = useUnits();
  const { timeFormat } = useTimeFormat();

  const buttonTextColor = "#FFFFFF";

  const [weightValue, setWeightValue] = useState("");
  const [heightValue, setHeightValue] = useState("");
  const [headCircumferenceValue, setHeadCircumferenceValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [measuredAt, setMeasuredAt] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
      }
      if (selectedDate) {
        const newDateTime = new Date(measuredAt);
        newDateTime.setFullYear(selectedDate.getFullYear());
        newDateTime.setMonth(selectedDate.getMonth());
        newDateTime.setDate(selectedDate.getDate());
        setMeasuredAt(newDateTime);
      }
    },
    [measuredAt]
  );

  const handleTimeChange = useCallback(
    (_event: unknown, selectedTime?: Date) => {
      if (Platform.OS === "android") {
        setShowTimePicker(false);
      }
      if (selectedTime) {
        const newDateTime = new Date(measuredAt);
        newDateTime.setHours(selectedTime.getHours());
        newDateTime.setMinutes(selectedTime.getMinutes());
        setMeasuredAt(newDateTime);
      }
    },
    [measuredAt]
  );

  const handleDateTimeChange = useCallback(
    (_event: unknown, selectedDateTime?: Date) => {
      if (selectedDateTime) {
        setMeasuredAt(selectedDateTime);
      }
    },
    []
  );

  const parseDecimal = (value: string): number | undefined => {
    if (!value) return undefined;
    const normalized = value.replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? undefined : parsed;
  };

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!selectedBaby) return;

    const weightInput = parseDecimal(weightValue);
    const heightInput = parseDecimal(heightValue);
    const headInput = parseDecimal(headCircumferenceValue);

    const weightKg = weightInput !== undefined
      ? (weightUnit === "lbs" ? lbsToKg(weightInput) : weightInput)
      : undefined;
    const heightCm = heightInput !== undefined
      ? (heightUnit === "in" ? inchesToCm(heightInput) : heightInput)
      : undefined;
    const headCircumferenceCm = headInput !== undefined
      ? (heightUnit === "in" ? inchesToCm(headInput) : headInput)
      : undefined;

    const validation = validateGrowthMeasurement({
      babyId: selectedBaby.id,
      measuredAt,
      weightKg,
      heightCm,
      headCircumferenceCm,
      notes: notes || undefined,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await addMeasurement({
        babyId: selectedBaby.id,
        measuredAt,
        weightKg,
        heightCm,
        headCircumferenceCm,
        notes: notes || undefined,
      });
      if (onboardingPreview === "firstActivity") {
        await NewOwnerOnboardingStorageService.markActivitySaved("growth");
        router.replace("/onboarding/owner/saved");
      } else {
        router.back();
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [selectedBaby, weightValue, heightValue, headCircumferenceValue, notes, weightUnit, heightUnit, measuredAt, addMeasurement, onboardingPreview, router]);

  const hasAnyMeasurement = weightValue !== "" || heightValue !== "" || headCircumferenceValue !== "";
  const canSave = hasAnyMeasurement && !isSaving;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  const formatTime = (date: Date) => formatTimeUtil(date, timeFormat);

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="growth-screen">
      {/* Header with drag handle - tappable to dismiss keyboard */}
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="items-center pt-2 pb-3"
        testID="dismiss-keyboard"
      >
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("growth.logMeasurement")}
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
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Illustration/Icon */}
        <View className="items-center mb-4">
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: GROWTH_TEAL_MUTED }}
          >
            <Text className="text-5xl">📏</Text>
          </View>
        </View>

        {/* View Charts Link - prominent position */}
        <Pressable
          onPress={() => router.replace("/growth/charts")}
          className="flex-row items-center justify-center py-2.5 px-4 mb-4 rounded-full self-center"
          style={{ backgroundColor: GROWTH_TEAL_MUTED }}
          accessibilityRole="link"
          accessibilityLabel={t("growth.viewCharts")}
          testID="view-charts-button"
        >
          <Text className="text-base font-medium" style={{ color: GROWTH_TEAL_DARK }}>
            📊 {t("growth.viewCharts")}
          </Text>
        </Pressable>

        {/* Date/Time Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("growth.measurementDate")}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowDatePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: GROWTH_TEAL_MUTED }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectDate")}
            >
              <Text className="text-base" style={{ color: GROWTH_TEAL_DARK }}>
                {formatDate(measuredAt)}
              </Text>
              <Text style={{ color: GROWTH_TEAL }}>📅</Text>
            </Pressable>
            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowTimePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: GROWTH_TEAL_MUTED }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectTime")}
            >
              <Text className="text-base" style={{ color: GROWTH_TEAL_DARK }}>
                {formatTime(measuredAt)}
              </Text>
              <Text style={{ color: GROWTH_TEAL }}>🕐</Text>
            </Pressable>
          </View>
        </View>

        {/* iOS: Combined datetime picker */}
        {showDateTimePicker && Platform.OS === "ios" && (
          <View>
            <View className="flex-row justify-end px-2">
              <Pressable
                onPress={() => setShowDateTimePicker(false)}
                className="py-1 px-3"
              >
                <Text className="text-sm font-semibold" style={{ color: GROWTH_TEAL }}>
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={measuredAt}
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
            value={measuredAt}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* Android: Separate time picker */}
        {showTimePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={measuredAt}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {/* Measurement Inputs */}
        <View className="gap-4 mb-6">
          {/* Weight Input */}
          <View>
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("growth.weight")} ({t(`settings.${weightUnit}`)})
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={weightValue}
                onChangeText={(text) => {
                  setWeightValue(text);
                  setErrors((prev) => ({ ...prev, weightKg: "", measurements: "" }));
                }}
                placeholder="0.0"
                keyboardType="decimal-pad"
                className="flex-1 h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
                placeholderTextColor="#999"
                testID="weight-input"
              />
              <Text className="ml-3 text-base text-content-secondary dark:text-content-dark-secondary">
                {weightUnit}
              </Text>
            </View>
            {errors.weightKg && (
              <Text className="text-sm text-red-500 mt-1">{te(t, errors.weightKg)}</Text>
            )}
          </View>

          {/* Height/Length Input */}
          <View>
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {isUnderTwoYears(selectedBaby.birthDate) ? t("growth.length") : t("growth.height")} ({t(`settings.${heightUnit}`)})
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={heightValue}
                onChangeText={(text) => {
                  setHeightValue(text);
                  setErrors((prev) => ({ ...prev, heightCm: "", measurements: "" }));
                }}
                placeholder="0.0"
                keyboardType="decimal-pad"
                className="flex-1 h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
                placeholderTextColor="#999"
                testID="height-input"
              />
              <Text className="ml-3 text-base text-content-secondary dark:text-content-dark-secondary">
                {heightUnit}
              </Text>
            </View>
            {errors.heightCm && (
              <Text className="text-sm text-red-500 mt-1">{te(t, errors.heightCm)}</Text>
            )}
          </View>

          {/* Head Circumference Input */}
          <View>
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("growth.headCircumference")} ({t(`settings.${heightUnit}`)})
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={headCircumferenceValue}
                onChangeText={(text) => {
                  setHeadCircumferenceValue(text);
                  setErrors((prev) => ({ ...prev, headCircumferenceCm: "", measurements: "" }));
                }}
                placeholder="0.0"
                keyboardType="decimal-pad"
                className="flex-1 h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
                placeholderTextColor="#999"
                testID="head-input"
              />
              <Text className="ml-3 text-base text-content-secondary dark:text-content-dark-secondary">
                {heightUnit}
              </Text>
            </View>
            {errors.headCircumferenceCm && (
              <Text className="text-sm text-red-500 mt-1">{te(t, errors.headCircumferenceCm)}</Text>
            )}
          </View>

          {/* Notes Input */}
          <View>
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("common.notes")} ({t("common.optional")})
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("growth.notesPlaceholder")}
              multiline
              numberOfLines={3}
              className="h-24 px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
              placeholderTextColor="#999"
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Validation error for no measurements */}
        {errors.measurements && (
          <Text className="text-sm text-red-500 text-center mb-4">{te(t, errors.measurements)}</Text>
        )}

        {/* Quick entry hint */}
        <View
          className="p-4 rounded-card mb-6"
          style={{ backgroundColor: GROWTH_TEAL_MUTED }}
        >
          <Text className="text-sm text-center" style={{ color: GROWTH_TEAL_DARK }}>
            {t("growth.quickEntryHint")}
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
            !canSave ? "opacity-70" : ""
          }`}
          style={{ backgroundColor: GROWTH_TEAL }}
          accessibilityRole="button"
          accessibilityLabel={t("growth.saveMeasurement")}
          testID="save-button"
        >
          <Text className="text-xl font-semibold" style={{ color: buttonTextColor }}>
            {isSaving ? t("common.loading") : t("growth.saveMeasurement")}
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
