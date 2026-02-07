import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFeeding, useBaby, useUnits } from "@/contexts";
import { formatVolume, mlToOz, ozToMl } from "@/utils/volume";
import { useNotificationIntegration } from "@/hooks";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import type { BottleContentType } from "@/constants/activities";

const FEEDING_GREEN = "#88B04B";
const FEEDING_GREEN_MUTED = "#E8F0E0";
const FEEDING_GREEN_DARK = "#6A9030";

const QUICK_AMOUNTS_OZ = [1, 2, 3, 4, 5, 6];
const QUICK_AMOUNTS_ML = [30, 60, 90, 120, 150, 180];

type VolumeUnit = "ml" | "oz";

export default function BottleFeedingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { addFeeding } = useFeeding();
  const { volumeUnit } = useUnits();
  const { scheduleReminderAfterFeeding } = useNotificationIntegration();

  const [contentType, setContentType] = useState<BottleContentType | null>(null);
  const [amountMl, setAmountMl] = useState<number | null>(null);
  const [unit, setUnit] = useState<VolumeUnit>(volumeUnit);
  const [inputValue, setInputValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleLogPast = useCallback(() => {
    router.push("/feeding/manual?type=bottle");
  }, [router]);

  const handleContentTypeSelect = useCallback((type: BottleContentType) => {
    setContentType(type);
    setShowValidation(false);
  }, []);

  const handleQuickAmountSelect = useCallback((amount: number) => {
    if (unit === "oz") {
      const ml = ozToMl(amount);
      setAmountMl(ml);
      setInputValue(amount.toString());
    } else {
      setAmountMl(amount);
      setInputValue(amount.toString());
    }
    setShowValidation(false);
    Keyboard.dismiss();
  }, [unit]);

  const handleInputChange = useCallback((text: string) => {
    setInputValue(text);
    const value = parseFloat(text);
    if (!isNaN(value) && value > 0) {
      if (unit === "oz") {
        setAmountMl(ozToMl(value));
      } else {
        setAmountMl(value);
      }
      setShowValidation(false);
    } else {
      setAmountMl(null);
    }
  }, [unit]);

  const handleUnitToggle = useCallback(() => {
    if (amountMl !== null) {
      if (unit === "oz") {
        setInputValue(Math.round(amountMl).toString());
      } else {
        setInputValue(mlToOz(amountMl).toString());
      }
    }
    setUnit(prev => prev === "oz" ? "ml" : "oz");
  }, [unit, amountMl]);

  const handleSave = useCallback(async () => {
    if (!selectedBaby) return;

    if (!contentType || !amountMl || amountMl <= 0) {
      setShowValidation(true);
      return;
    }

    setIsSaving(true);
    try {
      await addFeeding({
        babyId: selectedBaby.id,
        type: "bottle",
        contentType,
        amountMl,
        startedAt: new Date(),
        notes: notes || undefined,
      });
      await scheduleReminderAfterFeeding(new Date());
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, contentType, amountMl, notes, addFeeding, scheduleReminderAfterFeeding, router]);

  const validationMessage = useMemo(() => {
    if (!showValidation) return null;
    if (!contentType && (!amountMl || amountMl <= 0)) {
      return t("feeding.selectContentAndAmount");
    }
    if (!contentType) {
      return t("feeding.selectContentType");
    }
    if (!amountMl || amountMl <= 0) {
      return t("feeding.enterAmountValidation");
    }
    return null;
  }, [showValidation, contentType, amountMl, t]);

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      {/* Header */}
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="flex-row items-center px-4 py-3"
        testID="dismiss-keyboard"
      >
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
            {t("feeding.bottleFeeding")}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {selectedBaby.name}
          </Text>
        </View>
        <View className="w-touch" />
      </Pressable>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Illustration */}
        <View className="items-center mt-4 mb-6">
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: FEEDING_GREEN_MUTED }}
          >
            <Text className="text-5xl">🍼</Text>
          </View>
        </View>

        {/* Content Type Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.selectContentType")}
          </Text>
          <View className="flex-row gap-3">
            <ContentTypeButton
              type="breastMilk"
              label={t("feeding.breastMilk")}
              emoji="🤱"
              isSelected={contentType === "breastMilk"}
              onPress={() => handleContentTypeSelect("breastMilk")}
            />
            <ContentTypeButton
              type="formula"
              label={t("feeding.formula")}
              emoji="🧪"
              isSelected={contentType === "formula"}
              onPress={() => handleContentTypeSelect("formula")}
            />
          </View>
        </View>

        {/* Amount Input */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
              {t("feeding.amount")}
            </Text>
            <UnitToggle unit={unit} onToggle={handleUnitToggle} />
          </View>

          {/* Input field with unit */}
          <View
            className="flex-row items-center rounded-card-lg px-4 py-3 mb-4"
            style={{ backgroundColor: FEEDING_GREEN_MUTED }}
          >
            <TextInput
              className="flex-1 text-2xl font-semibold text-center"
              style={{ color: FEEDING_GREEN_DARK }}
              value={inputValue}
              onChangeText={handleInputChange}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              returnKeyType="done"
              accessibilityLabel={t("feeding.enterAmount")}
              testID="volume-input"
            />
            <Text className="text-lg font-medium ml-2" style={{ color: FEEDING_GREEN }}>
              {unit}
            </Text>
          </View>

          {/* Quick amount buttons */}
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("feeding.quickAmounts")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(unit === "oz" ? QUICK_AMOUNTS_OZ : QUICK_AMOUNTS_ML).map((amount) => (
              <QuickAmountButton
                key={amount}
                amount={amount}
                unit={unit}
                isSelected={
                  unit === "oz"
                    ? amountMl !== null && Math.abs(ozToMl(amount) - amountMl) < 1
                    : amountMl === amount
                }
                onPress={() => handleQuickAmountSelect(amount)}
              />
            ))}
          </View>
        </View>

        {/* Notes */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.duration")} / Notes
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

        {/* Amount preview */}
        {amountMl !== null && amountMl > 0 && (
          <View className="items-center mb-4">
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {formatVolume(amountMl, "ml")} = {formatVolume(amountMl, "oz")}
            </Text>
          </View>
        )}

        {/* Log Past Button */}
        <View className="items-center mt-8 mb-8">
          <Pressable
            onPress={handleLogPast}
            className="py-3 px-6 rounded-button-lg active:opacity-70"
            style={{ backgroundColor: FEEDING_GREEN_MUTED }}
            accessibilityRole="button"
            accessibilityLabel={t("feeding.logPastBottle")}
          >
            <Text className="text-base font-medium" style={{ color: FEEDING_GREEN }}>
              {t("feeding.logPastBottle")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Section - Validation & Save */}
      <View className="px-6 pb-6 pt-3 bg-surface dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800">
        {/* Validation Message */}
        {validationMessage && (
          <View className="mb-3 items-center">
            <Text className="text-sm text-amber-600 dark:text-amber-400 text-center">
              {validationMessage}
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${
            isSaving ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: FEEDING_GREEN }}
          accessibilityRole="button"
          accessibilityLabel={t("common.save")}
          accessibilityState={{ disabled: isSaving }}
          testID="save-bottle-button"
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : t("feeding.logBottleFeeding")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface ContentTypeButtonProps {
  type: BottleContentType;
  label: string;
  emoji: string;
  isSelected: boolean;
  onPress: () => void;
}

function ContentTypeButton({ label, emoji, isSelected, onPress }: ContentTypeButtonProps) {
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

interface QuickAmountButtonProps {
  amount: number;
  unit: VolumeUnit;
  isSelected: boolean;
  onPress: () => void;
}

function QuickAmountButton({ amount, unit, isSelected, onPress }: QuickAmountButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[56px] py-2 px-3 rounded-button-lg items-center active:scale-95"
      style={{
        backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${amount} ${unit}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {amount}
      </Text>
    </Pressable>
  );
}
