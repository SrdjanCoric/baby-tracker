import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useGrowth } from "@/contexts/growth-context";
import { useBaby } from "@/contexts";
import { validateGrowthMeasurement } from "@/validators/growth";
import { formatDate } from "@/utils/time";

const GROWTH_TEAL = "#009B77";
const GROWTH_TEAL_MUTED = "#E0F5EF";
const GROWTH_TEAL_DARK = "#007A5E";

export default function GrowthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { addMeasurement } = useGrowth();

  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const parseDecimal = (value: string): number | undefined => {
    if (!value) return undefined;
    // Handle both comma and period as decimal separators
    const normalized = value.replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? undefined : parsed;
  };

  const handleSave = useCallback(async () => {
    if (!selectedBaby) return;

    const weight = parseDecimal(weightKg);
    const height = parseDecimal(heightCm);
    const head = parseDecimal(headCircumferenceCm);

    const validation = validateGrowthMeasurement({
      babyId: selectedBaby.id,
      measuredAt: new Date(),
      weightKg: weight,
      heightCm: height,
      headCircumferenceCm: head,
      notes: notes || undefined,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSaving(true);
    try {
      await addMeasurement({
        babyId: selectedBaby.id,
        measuredAt: new Date(),
        weightKg: weight,
        heightCm: height,
        headCircumferenceCm: head,
        notes: notes || undefined,
      });
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, weightKg, heightCm, headCircumferenceCm, notes, addMeasurement, router]);

  const hasAnyMeasurement = weightKg !== "" || heightCm !== "" || headCircumferenceCm !== "";
  const canSave = hasAnyMeasurement && !isSaving;

  if (!selectedBaby) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.noBabySelected")}
        </Text>
      </SafeAreaView>
    );
  }

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
            {t("growth.logMeasurement")}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {selectedBaby.name}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Illustration/Icon */}
        <View className="items-center mb-6">
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: GROWTH_TEAL_MUTED }}
          >
            <Text className="text-5xl">📏</Text>
          </View>
        </View>

        {/* Date display */}
        <View className="items-center mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {t("growth.measurementDate")}
          </Text>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
            {formatDate(new Date())}
          </Text>
        </View>

        {/* Measurement Inputs */}
        <View className="gap-4 mb-6">
          {/* Weight Input */}
          <View>
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("growth.weight")} ({t("settings.kg")})
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={weightKg}
                onChangeText={(text) => {
                  setWeightKg(text);
                  setErrors((prev) => ({ ...prev, weightKg: "", measurements: "" }));
                }}
                placeholder="0.0"
                keyboardType="decimal-pad"
                className="flex-1 h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
                placeholderTextColor="#999"
              />
              <Text className="ml-3 text-base text-content-secondary dark:text-content-dark-secondary">
                kg
              </Text>
            </View>
            {errors.weightKg && (
              <Text className="text-sm text-red-500 mt-1">{errors.weightKg}</Text>
            )}
          </View>

          {/* Height Input */}
          <View>
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("growth.height")} ({t("settings.cm")})
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={heightCm}
                onChangeText={(text) => {
                  setHeightCm(text);
                  setErrors((prev) => ({ ...prev, heightCm: "", measurements: "" }));
                }}
                placeholder="0.0"
                keyboardType="decimal-pad"
                className="flex-1 h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
                placeholderTextColor="#999"
              />
              <Text className="ml-3 text-base text-content-secondary dark:text-content-dark-secondary">
                cm
              </Text>
            </View>
            {errors.heightCm && (
              <Text className="text-sm text-red-500 mt-1">{errors.heightCm}</Text>
            )}
          </View>

          {/* Head Circumference Input */}
          <View>
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("growth.headCircumference")} ({t("settings.cm")})
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={headCircumferenceCm}
                onChangeText={(text) => {
                  setHeadCircumferenceCm(text);
                  setErrors((prev) => ({ ...prev, headCircumferenceCm: "", measurements: "" }));
                }}
                placeholder="0.0"
                keyboardType="decimal-pad"
                className="flex-1 h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
                placeholderTextColor="#999"
              />
              <Text className="ml-3 text-base text-content-secondary dark:text-content-dark-secondary">
                cm
              </Text>
            </View>
            {errors.headCircumferenceCm && (
              <Text className="text-sm text-red-500 mt-1">{errors.headCircumferenceCm}</Text>
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
          <Text className="text-sm text-red-500 text-center mb-4">{errors.measurements}</Text>
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
            !canSave ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: GROWTH_TEAL }}
          accessibilityRole="button"
          accessibilityLabel={t("growth.saveMeasurement")}
        >
          <Text className="text-white text-lg font-semibold">
            {isSaving ? t("common.loading") : t("growth.saveMeasurement")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
