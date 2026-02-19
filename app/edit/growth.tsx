import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useGrowth } from "@/contexts/growth-context";
import { useBaby, useTimeFormat } from "@/contexts";
import { formatDate, formatTime } from "@/utils/time";

const GROWTH_TEAL = "#009B77";
const GROWTH_TEAL_MUTED = "#E0F5EF";

export default function EditGrowthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { measurements, updateMeasurement, deleteMeasurement } = useGrowth();

  const measurement = useMemo(() => {
    return measurements.find((m) => m.id === id) ?? null;
  }, [measurements, id]);

  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (measurement && !isInitialized) {
      setWeightKg(measurement.weightKg ? String(measurement.weightKg) : "");
      setHeightCm(measurement.heightCm ? String(measurement.heightCm) : "");
      setHeadCircumferenceCm(measurement.headCircumferenceCm ? String(measurement.headCircumferenceCm) : "");
      setNotes(measurement.notes ?? "");
      setIsInitialized(true);
    }
  }, [measurement, isInitialized]);

  const hasChanges = useMemo(() => {
    if (!measurement || !isInitialized) return false;

    const originalWeight = measurement.weightKg ? String(measurement.weightKg) : "";
    const originalHeight = measurement.heightCm ? String(measurement.heightCm) : "";
    const originalHead = measurement.headCircumferenceCm ? String(measurement.headCircumferenceCm) : "";
    const originalNotes = measurement.notes ?? "";

    return (
      weightKg !== originalWeight ||
      heightCm !== originalHeight ||
      headCircumferenceCm !== originalHead ||
      notes !== originalNotes
    );
  }, [measurement, isInitialized, weightKg, heightCm, headCircumferenceCm, notes]);

  usePreventRemove(hasChanges, ({ data }) => {
    Alert.alert(
      t("timeline.discardChangesTitle"),
      t("timeline.discardChangesMessage"),
      [
        { text: t("timeline.keepEditing"), style: "cancel" },
        {
          text: t("timeline.discard"),
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ]
    );
  });

  const confirmDiscard = useCallback((onDiscard: () => void) => {
    Alert.alert(
      t("timeline.discardChangesTitle"),
      t("timeline.discardChangesMessage"),
      [
        { text: t("timeline.keepEditing"), style: "cancel" },
        {
          text: t("timeline.discard"),
          style: "destructive",
          onPress: onDiscard,
        },
      ]
    );
  }, [t]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      confirmDiscard(() => router.back());
    } else {
      router.back();
    }
  }, [hasChanges, confirmDiscard, router]);

  const parseDecimal = (value: string): number | undefined => {
    if (!value) return undefined;
    const normalized = value.replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? undefined : parsed;
  };

  const handleSave = useCallback(async () => {
    if (!selectedBaby || !measurement) return;

    setIsSaving(true);
    try {
      const weight = parseDecimal(weightKg);
      const height = parseDecimal(heightCm);
      const head = parseDecimal(headCircumferenceCm);

      await updateMeasurement(measurement.id, {
        weightKg: weight,
        heightCm: height,
        headCircumferenceCm: head,
        notes: notes || undefined,
      });
      // Reset initialized state so hasChanges returns false and navigation can proceed
      setIsInitialized(false);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, measurement, weightKg, heightCm, headCircumferenceCm, notes, updateMeasurement, router]);

  const handleDelete = useCallback(() => {
    if (!measurement) return;

    Alert.alert(
      t("timeline.deleteConfirmTitle"),
      t("timeline.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            await deleteMeasurement(measurement.id);
            router.back();
          },
        },
      ]
    );
  }, [measurement, deleteMeasurement, router, t]);

  if (!selectedBaby || !measurement) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.loading")}
        </Text>
      </SafeAreaView>
    );
  }

  const hasAnyMeasurement = weightKg !== "" || heightCm !== "" || headCircumferenceCm !== "";

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
            {t("timeline.editEntry")}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {t("growth.title")}
          </Text>
        </View>
        <Pressable
          onPress={handleDelete}
          className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
          accessibilityRole="button"
          accessibilityLabel={t("common.delete")}
        >
          <Text className="text-2xl">🗑️</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View className="items-center mb-6">
          <View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: GROWTH_TEAL_MUTED }}
          >
            <Text className="text-4xl">📏</Text>
          </View>
        </View>

        {/* Date/Time display */}
        <View className="items-center mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {formatDate(new Date(measurement.measuredAt))}
          </Text>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
            {formatTime(new Date(measurement.measuredAt), timeFormat)}
          </Text>
        </View>

        {/* Weight */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("growth.weight")} ({t("settings.kg")})
          </Text>
          <View className="flex-row items-center">
            <TextInput
              value={weightKg}
              onChangeText={setWeightKg}
              placeholder="0.0"
              keyboardType="decimal-pad"
              className="flex-1 h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
              placeholderTextColor="#999"
            />
            <Text className="ml-3 text-base text-content-secondary dark:text-content-dark-secondary">
              kg
            </Text>
          </View>
        </View>

        {/* Height */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("growth.height")} ({t("settings.cm")})
          </Text>
          <View className="flex-row items-center">
            <TextInput
              value={heightCm}
              onChangeText={setHeightCm}
              placeholder="0.0"
              keyboardType="decimal-pad"
              className="flex-1 h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
              placeholderTextColor="#999"
            />
            <Text className="ml-3 text-base text-content-secondary dark:text-content-dark-secondary">
              cm
            </Text>
          </View>
        </View>

        {/* Head Circumference */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("growth.headCircumference")} ({t("settings.cm")})
          </Text>
          <View className="flex-row items-center">
            <TextInput
              value={headCircumferenceCm}
              onChangeText={setHeadCircumferenceCm}
              placeholder="0.0"
              keyboardType="decimal-pad"
              className="flex-1 h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
              placeholderTextColor="#999"
            />
            <Text className="ml-3 text-base text-content-secondary dark:text-content-dark-secondary">
              cm
            </Text>
          </View>
        </View>

        {/* Notes */}
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
      </ScrollView>

      {/* Save Button */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={isSaving || !hasAnyMeasurement}
          className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
            isSaving || !hasAnyMeasurement ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: GROWTH_TEAL }}
          accessibilityRole="button"
          accessibilityLabel={t("common.save")}
        >
          <Text className="text-white text-lg font-semibold">
            {isSaving ? t("common.loading") : t("common.save")}
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
