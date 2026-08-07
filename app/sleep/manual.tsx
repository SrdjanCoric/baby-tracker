import { useCallback, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useSleep, useBaby, useTimeFormat } from "@/contexts";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { StartEndTimeSection } from "@/components/StartEndTimeSection";
import { te } from "@/utils/translate-errors";
import { validateManualSleepTimes } from "@/validators/sleep";
import { classifySleepByTimeRange } from "@/utils/sleep-patterns";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import { ACTIVITY } from "@/constants/colors";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const MINIMUM_SLEEP_MS = 60_000;
const MAXIMUM_SLEEP_MS = 24 * 60 * 60 * 1000;

export default function ManualSleepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onboardingActivity } = useLocalSearchParams<{ onboardingActivity?: string }>();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { addSleep, sleeps, wakeWindowConfig } = useSleep();
  const { checkAndConfirmSleep } = useDuplicateCheck();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = {
    accent: isDark ? ACTIVITY.sleep.accentDark : ACTIVITY.sleep.accent,
    mutedBg: isDark ? ACTIVITY.sleep.mutedDark : ACTIVITY.sleep.muted,
    textOnMuted: isDark ? ACTIVITY.sleep.textAccentDark : ACTIVITY.sleep.textAccent,
  };

  const [startTime, setStartTime] = useState(
    () => new Date(Date.now() - MINIMUM_SLEEP_MS)
  );
  const [endTime, setEndTime] = useState(() => new Date());
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = useCallback(async () => {
    if (isSavingRef.current || !selectedBaby) return;

    setErrors({});
    const dayStartHour = wakeWindowConfig?.dayStartHour ?? 6;
    const dayEndHour = wakeWindowConfig?.dayEndHour ?? 19;
    const sleepType = classifySleepByTimeRange(
      startTime,
      endTime,
      dayStartHour,
      dayEndHour
    );
    const validation = validateManualSleepTimes({
      type: sleepType,
      startedAt: startTime,
      endedAt: endTime,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const durationSeconds = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000
    );
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const proposedSleep: StoredSleepEntry = {
        id: "manual-sleep-candidate",
        babyId: selectedBaby.id,
        type: sleepType,
        startedAt: startTime.toISOString(),
        endedAt: endTime.toISOString(),
        durationSeconds,
        notes: notes || undefined,
        createdAt: startTime.toISOString(),
        updatedAt: startTime.toISOString(),
      };
      const shouldSave = await checkAndConfirmSleep(
        proposedSleep,
        sleeps.filter((sleep) => sleep.endedAt)
      );
      if (!shouldSave) return;

      await addSleep({
        babyId: selectedBaby.id,
        type: sleepType,
        startedAt: startTime,
        endedAt: endTime,
        durationSeconds,
        notes: notes || undefined,
      });
      if (onboardingActivity === "first") {
        await NewOwnerOnboardingStorageService.markActivitySaved("sleep");
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
    startTime,
    endTime,
    notes,
    addSleep,
    sleeps,
    checkAndConfirmSleep,
    onboardingActivity,
    router,
    wakeWindowConfig?.dayStartHour,
    wakeWindowConfig?.dayEndHour,
  ]);

  const now = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const canSave =
    durationMs >= MINIMUM_SLEEP_MS &&
    durationMs <= MAXIMUM_SLEEP_MS &&
    startTime <= now &&
    endTime <= now;
  const startMaximum = new Date(
    Math.min(now.getTime(), endTime.getTime() - MINIMUM_SLEEP_MS)
  );
  const endMinimum = new Date(startTime.getTime() + MINIMUM_SLEEP_MS);
  const endMaximum = new Date(
    Math.min(now.getTime(), startTime.getTime() + MAXIMUM_SLEEP_MS)
  );

  if (!selectedBaby) return <NoBabyScreen />;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
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
          <StartEndTimeSection
            startTime={startTime}
            endTime={endTime}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            startBounds={{ maximumDate: startMaximum }}
            endBounds={{ minimumDate: endMinimum, maximumDate: endMaximum }}
            timeFormat={timeFormat}
            startLabel={t("sleep.startTime")}
            endLabel={t("sleep.endTime")}
            durationLabel={t("sleep.duration")}
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

        <View className="px-6 pb-6 pt-2 bg-surface dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800">
          <Pressable
            onPress={handleSave}
            disabled={!canSave || isSaving}
            className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${
              !canSave || isSaving ? "opacity-50" : ""
            }`}
            style={{ backgroundColor: colors.accent }}
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
