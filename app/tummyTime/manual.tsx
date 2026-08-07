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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useTummyTime, useBaby, useTimeFormat } from "@/contexts";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { StartEndTimeSection } from "@/components/StartEndTimeSection";
import { te } from "@/utils/translate-errors";
import { validateManualTummyTimeTimes } from "@/validators/tummyTime";
import { ACTIVITY } from "@/constants/colors";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const MINIMUM_TUMMY_TIME_MS = 60_000;
const MAXIMUM_TUMMY_TIME_MS = 2 * 60 * 60 * 1000;

export default function ManualTummyTimeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onboardingActivity } = useLocalSearchParams<{ onboardingActivity?: string }>();
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

  const [startTime, setStartTime] = useState(
    () => new Date(Date.now() - MINIMUM_TUMMY_TIME_MS)
  );
  const [endTime, setEndTime] = useState(() => new Date());

  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!selectedBaby) return;

    setErrors({});

    const validation = validateManualTummyTimeTimes({
      startedAt: startTime,
      endedAt: endTime,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const durationSeconds = Math.floor(
        (endTime.getTime() - startTime.getTime()) / 1000
      );
      await addTummyTime({
        babyId: selectedBaby.id,
        startedAt: startTime,
        endedAt: endTime,
        durationSeconds,
        notes: notes || undefined,
      });
      if (onboardingActivity === "first") {
        await NewOwnerOnboardingStorageService.markActivitySaved("tummyTime");
        router.replace("/onboarding/owner/saved");
      } else {
        router.replace("/(tabs)");
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [selectedBaby, startTime, endTime, notes, addTummyTime, onboardingActivity, router]);

  const startBounds = useCallback(() => {
    const boundaryNow = Date.now();
    return {
      maximumDate: new Date(
        Math.min(boundaryNow, endTime.getTime() - MINIMUM_TUMMY_TIME_MS)
      ),
    };
  }, [endTime]);
  const endBounds = useCallback(() => {
    const boundaryNow = Date.now();
    return {
      minimumDate: new Date(startTime.getTime() + MINIMUM_TUMMY_TIME_MS),
      maximumDate: new Date(
        Math.min(boundaryNow, startTime.getTime() + MAXIMUM_TUMMY_TIME_MS)
      ),
    };
  }, [startTime]);

  const durationMs = endTime.getTime() - startTime.getTime();
  const now = new Date();
  const canSave =
    durationMs >= MINIMUM_TUMMY_TIME_MS &&
    durationMs <= MAXIMUM_TUMMY_TIME_MS &&
    startTime <= now &&
    endTime <= now;

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

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
        <StartEndTimeSection
          startTime={startTime}
          endTime={endTime}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          startBounds={startBounds}
          endBounds={endBounds}
          timeFormat={timeFormat}
          startLabel={t("tummyTime.startTime")}
          endLabel={t("tummyTime.endTime")}
          durationLabel={t("tummyTime.duration")}
          doneLabel={t("common.done")}
          selectDateLabel={t("feeding.selectDate")}
          selectTimeLabel={t("feeding.selectTime")}
          accentColor={colors.accent}
          mutedBackgroundColor={colors.mutedBg}
          textColor={colors.textOnMuted}
          startError={errors.startedAt ? te(t, errors.startedAt) : undefined}
          endError={errors.endedAt ? te(t, errors.endedAt) : undefined}
          durationError={
            errors.durationSeconds ? te(t, errors.durationSeconds) : undefined
          }
        />

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
