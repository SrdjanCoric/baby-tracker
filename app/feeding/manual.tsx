import { useCallback, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFeeding } from "@/contexts";
import { useBaby } from "@/contexts";
import { formatVolume, mlToOz, ozToMl } from "@/utils/volume";
import {
  validateManualBreastfeeding,
  validateManualBottleFeeding,
} from "@/validators/feeding";
import type { BreastSide, BottleContentType } from "@/constants/activities";

const FEEDING_GREEN = "#88B04B";
const FEEDING_GREEN_MUTED = "#E8F0E0";
const FEEDING_GREEN_DARK = "#6A9030";

const QUICK_AMOUNTS_OZ = [1, 2, 3, 4, 5, 6];
const QUICK_AMOUNTS_ML = [30, 60, 90, 120, 150, 180];
const QUICK_DURATIONS = [5, 10, 15, 20, 30, 45];

type FeedingTab = "breast" | "bottle";
type VolumeUnit = "ml" | "oz";

export default function ManualFeedingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { addFeeding } = useFeeding();

  const [activeTab, setActiveTab] = useState<FeedingTab>("breast");
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Breastfeeding state
  const [side, setSide] = useState<BreastSide | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [durationInput, setDurationInput] = useState("");

  // Bottle feeding state
  const [contentType, setContentType] = useState<BottleContentType | null>(
    null
  );
  const [amountMl, setAmountMl] = useState<number | null>(null);
  const [unit, setUnit] = useState<VolumeUnit>("oz");
  const [amountInput, setAmountInput] = useState("");

  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      setShowDatePicker(Platform.OS === "ios");
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
      setShowTimePicker(Platform.OS === "ios");
      if (selectedTime) {
        const newDateTime = new Date(startTime);
        newDateTime.setHours(selectedTime.getHours());
        newDateTime.setMinutes(selectedTime.getMinutes());
        setStartTime(newDateTime);
      }
    },
    [startTime]
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

  const handleAmountChange = useCallback(
    (text: string) => {
      setAmountInput(text);
      const value = parseFloat(text);
      if (!isNaN(value) && value > 0) {
        if (unit === "oz") {
          setAmountMl(ozToMl(value));
        } else {
          setAmountMl(value);
        }
      } else {
        setAmountMl(null);
      }
    },
    [unit]
  );

  const handleQuickAmountSelect = useCallback(
    (amount: number) => {
      if (unit === "oz") {
        const ml = ozToMl(amount);
        setAmountMl(ml);
        setAmountInput(amount.toString());
      } else {
        setAmountMl(amount);
        setAmountInput(amount.toString());
      }
      Keyboard.dismiss();
    },
    [unit]
  );

  const handleUnitToggle = useCallback(() => {
    if (amountMl !== null) {
      if (unit === "oz") {
        setAmountInput(Math.round(amountMl).toString());
      } else {
        setAmountInput(mlToOz(amountMl).toString());
      }
    }
    setUnit((prev) => (prev === "oz" ? "ml" : "oz"));
  }, [unit, amountMl]);

  const handleSave = useCallback(async () => {
    if (!selectedBaby) return;

    setErrors({});

    if (activeTab === "breast") {
      const durationSeconds = durationMinutes ? durationMinutes * 60 : undefined;
      const validation = validateManualBreastfeeding({
        type: "breast",
        startedAt: startTime,
        durationSeconds,
        side: side ?? undefined,
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      setIsSaving(true);
      try {
        const endedAt = new Date(
          startTime.getTime() + (durationSeconds ?? 0) * 1000
        );
        await addFeeding({
          babyId: selectedBaby.id,
          type: "breast",
          side: side!,
          startedAt: startTime,
          endedAt,
          durationSeconds,
          notes: notes || undefined,
        });
        router.back();
      } finally {
        setIsSaving(false);
      }
    } else {
      const validation = validateManualBottleFeeding({
        type: "bottle",
        startedAt: startTime,
        amountMl: amountMl ?? undefined,
        contentType: contentType ?? undefined,
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      setIsSaving(true);
      try {
        await addFeeding({
          babyId: selectedBaby.id,
          type: "bottle",
          contentType: contentType!,
          amountMl: amountMl!,
          startedAt: startTime,
          notes: notes || undefined,
        });
        router.back();
      } finally {
        setIsSaving(false);
      }
    }
  }, [
    selectedBaby,
    activeTab,
    startTime,
    side,
    durationMinutes,
    contentType,
    amountMl,
    notes,
    addFeeding,
    router,
  ]);

  const canSave =
    activeTab === "breast"
      ? side !== null && durationMinutes !== null && durationMinutes > 0
      : contentType !== null && amountMl !== null && amountMl > 0;

  if (!selectedBaby) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.noBabySelected")}
        </Text>
      </SafeAreaView>
    );
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={handleBack}
          className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text className="text-2xl">←</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {t("feeding.pastFeedingTitle")}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {selectedBaby.name}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      {/* Tab Selector */}
      <View className="px-6 mb-4">
        <View
          className="flex-row rounded-pill p-1"
          style={{ backgroundColor: FEEDING_GREEN_MUTED }}
        >
          <TabButton
            label={t("feeding.breastfeedingTab")}
            isActive={activeTab === "breast"}
            onPress={() => setActiveTab("breast")}
          />
          <TabButton
            label={t("feeding.bottleTab")}
            isActive={activeTab === "bottle"}
            onPress={() => setActiveTab("bottle")}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Start Time Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.startTime")}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: FEEDING_GREEN_MUTED }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectDate")}
            >
              <Text className="text-base" style={{ color: FEEDING_GREEN_DARK }}>
                {formatDate(startTime)}
              </Text>
              <Text style={{ color: FEEDING_GREEN }}>📅</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: FEEDING_GREEN_MUTED }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectTime")}
            >
              <Text className="text-base" style={{ color: FEEDING_GREEN_DARK }}>
                {formatTime(startTime)}
              </Text>
              <Text style={{ color: FEEDING_GREEN }}>🕐</Text>
            </Pressable>
          </View>
          {errors.startedAt && (
            <Text className="text-red-500 text-sm mt-2">{errors.startedAt}</Text>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={startTime}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
          />
        )}

        {activeTab === "breast" ? (
          <>
            {/* Side Selection */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
                {t("feeding.selectSideToStart")}
              </Text>
              <View className="flex-row gap-3">
                <SideButton
                  side="left"
                  label={t("feeding.leftSide")}
                  shortLabel="L"
                  isSelected={side === "left"}
                  onPress={() => setSide("left")}
                />
                <SideButton
                  side="right"
                  label={t("feeding.rightSide")}
                  shortLabel="R"
                  isSelected={side === "right"}
                  onPress={() => setSide("right")}
                />
              </View>
              <Pressable
                onPress={() => setSide("both")}
                className={`mt-3 py-3 rounded-button-lg items-center active:scale-[0.98]`}
                style={{
                  backgroundColor:
                    side === "both" ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
                }}
                accessibilityRole="button"
                accessibilityLabel={t("feeding.bothSides")}
                accessibilityState={{ selected: side === "both" }}
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: side === "both" ? "#FFFFFF" : FEEDING_GREEN }}
                >
                  {t("feeding.bothSides")}
                </Text>
              </Pressable>
              {errors.side && (
                <Text className="text-red-500 text-sm mt-2">{errors.side}</Text>
              )}
            </View>

            {/* Duration Input */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
                {t("feeding.durationMinutes")}
              </Text>
              <View
                className="flex-row items-center rounded-card-lg px-4 py-3 mb-4"
                style={{ backgroundColor: FEEDING_GREEN_MUTED }}
              >
                <TextInput
                  className="flex-1 text-2xl font-semibold text-center"
                  style={{ color: FEEDING_GREEN_DARK }}
                  value={durationInput}
                  onChangeText={handleDurationChange}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  returnKeyType="done"
                  accessibilityLabel={t("feeding.durationPlaceholder")}
                />
                <Text
                  className="text-lg font-medium ml-2"
                  style={{ color: FEEDING_GREEN }}
                >
                  min
                </Text>
              </View>

              {/* Quick duration buttons */}
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("feeding.quickAmounts")}
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
          </>
        ) : (
          <>
            {/* Content Type Selection */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
                {t("feeding.selectContentType")}
              </Text>
              <View className="flex-row gap-3">
                <ContentTypeButton
                  label={t("feeding.breastMilk")}
                  emoji="🤱"
                  isSelected={contentType === "breastMilk"}
                  onPress={() => setContentType("breastMilk")}
                />
                <ContentTypeButton
                  label={t("feeding.formula")}
                  emoji="🧪"
                  isSelected={contentType === "formula"}
                  onPress={() => setContentType("formula")}
                />
              </View>
              {errors.contentType && (
                <Text className="text-red-500 text-sm mt-2">
                  {errors.contentType}
                </Text>
              )}
            </View>

            {/* Amount Input */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
                  {t("feeding.amount")}
                </Text>
                <UnitToggle unit={unit} onToggle={handleUnitToggle} />
              </View>

              <View
                className="flex-row items-center rounded-card-lg px-4 py-3 mb-4"
                style={{ backgroundColor: FEEDING_GREEN_MUTED }}
              >
                <TextInput
                  className="flex-1 text-2xl font-semibold text-center"
                  style={{ color: FEEDING_GREEN_DARK }}
                  value={amountInput}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  accessibilityLabel={t("feeding.enterAmount")}
                />
                <Text
                  className="text-lg font-medium ml-2"
                  style={{ color: FEEDING_GREEN }}
                >
                  {unit}
                </Text>
              </View>

              {/* Quick amount buttons */}
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("feeding.quickAmounts")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {(unit === "oz" ? QUICK_AMOUNTS_OZ : QUICK_AMOUNTS_ML).map(
                  (amount) => (
                    <QuickButton
                      key={amount}
                      label={amount.toString()}
                      isSelected={
                        unit === "oz"
                          ? amountMl !== null &&
                            Math.abs(ozToMl(amount) - amountMl) < 1
                          : amountMl === amount
                      }
                      onPress={() => handleQuickAmountSelect(amount)}
                    />
                  )
                )}
              </View>
              {errors.amountMl && (
                <Text className="text-red-500 text-sm mt-2">
                  {errors.amountMl}
                </Text>
              )}
            </View>

            {/* Amount preview */}
            {amountMl !== null && amountMl > 0 && (
              <View className="items-center mb-4">
                <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                  {formatVolume(amountMl, "ml")} = {formatVolume(amountMl, "oz")}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Notes */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            Notes
          </Text>
          <TextInput
            className="rounded-card-lg px-4 py-3 text-base bg-surface-secondary dark:bg-surface-dark-secondary text-content-primary dark:text-content-dark-primary"
            value={notes}
            onChangeText={setNotes}
            placeholder={t("feeding.notesPlaceholder")}
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
          style={{ backgroundColor: FEEDING_GREEN }}
          accessibilityRole="button"
          accessibilityLabel={
            activeTab === "breast"
              ? t("feeding.logManualBreastfeeding")
              : t("feeding.logManualBottleFeeding")
          }
          accessibilityState={{ disabled: !canSave || isSaving }}
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving
              ? t("common.loading")
              : activeTab === "breast"
                ? t("feeding.logManualBreastfeeding")
                : t("feeding.logManualBottleFeeding")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ label, isActive, onPress }: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 py-3 rounded-pill items-center active:scale-95"
      style={isActive ? { backgroundColor: FEEDING_GREEN } : undefined}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isActive ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface SideButtonProps {
  side: "left" | "right";
  label: string;
  shortLabel: string;
  isSelected: boolean;
  onPress: () => void;
}

function SideButton({
  label,
  shortLabel,
  isSelected,
  onPress,
}: SideButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-5 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-3xl font-bold mb-1"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {shortLabel}
      </Text>
      <Text
        className="text-base font-medium"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN_DARK }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface ContentTypeButtonProps {
  label: string;
  emoji: string;
  isSelected: boolean;
  onPress: () => void;
}

function ContentTypeButton({
  label,
  emoji,
  isSelected,
  onPress,
}: ContentTypeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-4 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text className="text-3xl mb-2">{emoji}</Text>
      <Text
        className="text-base font-medium"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN_DARK }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface UnitToggleProps {
  unit: VolumeUnit;
  onToggle: () => void;
}

function UnitToggle({ unit, onToggle }: UnitToggleProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onToggle}
      className="flex-row rounded-pill p-1"
      style={{ backgroundColor: FEEDING_GREEN_MUTED }}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${unit === "oz" ? "milliliters" : "ounces"}`}
    >
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "oz" ? { backgroundColor: FEEDING_GREEN } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "oz" ? "#FFFFFF" : FEEDING_GREEN }}
        >
          {t("feeding.oz")}
        </Text>
      </View>
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "ml" ? { backgroundColor: FEEDING_GREEN } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "ml" ? "#FFFFFF" : FEEDING_GREEN }}
        >
          {t("feeding.ml")}
        </Text>
      </View>
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
        backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
