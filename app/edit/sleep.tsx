import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSleep } from "@/contexts/sleep-context";
import { useBaby, useTimeFormat } from "@/contexts";
import type { SleepType } from "@/constants/activities";
import { StartEndTimeSection } from "@/components/StartEndTimeSection";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import type { StoredSleepEntry, UpdateSleepInput } from "@/services/sleep-storage";
import { validateManualSleepTimes } from "@/validators/sleep";
import { classifySleepByTimeRange } from "@/utils/sleep-patterns";
import { classifyNewMorningSleep } from "@/utils/sleepPredictions";
import { MORNING_CLASSIFICATION_VERSION } from "@/types/sleep";
import { te } from "@/utils/translate-errors";
import { exitModal } from "@/navigation";

const SLEEP_PURPLE = "#6B5B95";
const SLEEP_PURPLE_MUTED = "#E8E4F0";
const MINIMUM_SLEEP_MS = 60_000;
const MAXIMUM_SLEEP_MS = 24 * 60 * 60 * 1000;

export default function EditSleepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { sleeps, updateSleep, deleteSleep, wakeWindowConfig } = useSleep();
  const { checkAndConfirmSleep } = useDuplicateCheck();

  const sleep = useMemo(
    () => sleeps.find((candidate) => candidate.id === id) ?? null,
    [sleeps, id]
  );

  const [sleepType, setSleepType] = useState<SleepType>("nap");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [initialEndTime, setInitialEndTime] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [typeSelectedAfterTimeEdit, setTypeSelectedAfterTimeEdit] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sleep && !isInitialized) {
      const storedStart = new Date(sleep.startedAt);
      const displayedEnd = sleep.endedAt ? new Date(sleep.endedAt) : new Date();
      setSleepType(sleep.type);
      setStartTime(storedStart);
      setEndTime(displayedEnd);
      setInitialEndTime(displayedEnd);
      setNotes(sleep.notes ?? "");
      setTypeSelectedAfterTimeEdit(false);
      setIsInitialized(true);
    }
  }, [sleep, isInitialized]);

  const originalStart = sleep ? new Date(sleep.startedAt) : null;
  const originalEnd = initialEndTime;
  const timeChanged = Boolean(
    startTime &&
      endTime &&
      originalStart &&
      originalEnd &&
      (startTime.getTime() !== originalStart.getTime() ||
        endTime.getTime() !== originalEnd.getTime())
  );
  const hasChanges = Boolean(
    sleep &&
      isInitialized &&
      (sleepType !== sleep.type || notes !== (sleep.notes ?? "") || timeChanged)
  );

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

  const deriveType = useCallback(
    (nextStart: Date, nextEnd: Date) =>
      classifySleepByTimeRange(
        nextStart,
        nextEnd,
        wakeWindowConfig?.dayStartHour ?? 6,
        wakeWindowConfig?.dayEndHour ?? 19
      ),
    [wakeWindowConfig?.dayStartHour, wakeWindowConfig?.dayEndHour]
  );

  const handleStartChange = useCallback(
    (value: Date) => {
      setStartTime(value);
      setTypeSelectedAfterTimeEdit(false);
      if (endTime) setSleepType(deriveType(value, endTime));
    },
    [deriveType, endTime]
  );

  const handleEndChange = useCallback(
    (value: Date) => {
      setEndTime(value);
      setTypeSelectedAfterTimeEdit(false);
      if (startTime) setSleepType(deriveType(startTime, value));
    },
    [deriveType, startTime]
  );

  const handleSave = useCallback(async () => {
    if (!selectedBaby || !sleep || !startTime || !endTime) return;

    setErrors({});
    if (timeChanged) {
      const validation = validateManualSleepTimes({
        type: sleepType,
        startedAt: startTime,
        endedAt: endTime,
      });
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }
    }

    const durationSeconds = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000
    );
    if (timeChanged) {
      const proposedSleep: StoredSleepEntry = {
        ...sleep,
        type: sleepType,
        startedAt: startTime.toISOString(),
        endedAt: endTime.toISOString(),
        durationSeconds,
        notes: notes || undefined,
      };
      const shouldSave = await checkAndConfirmSleep(
        proposedSleep,
        sleeps.filter(
          (candidate) => candidate.id !== sleep.id && Boolean(candidate.endedAt)
        )
      );
      if (!shouldSave) return;
    }

    setIsSaving(true);
    try {
      const input: UpdateSleepInput = {
        notes: notes || undefined,
      };
      if (sleepType !== sleep.type || timeChanged) {
        input.type = sleepType;
      }
      if (timeChanged) {
        input.startedAt = startTime;
        input.endedAt = endTime;
        input.durationSeconds = durationSeconds;
        if (!typeSelectedAfterTimeEdit) {
          input.morningClassification = classifyNewMorningSleep(
            sleeps.filter((candidate) => candidate.id !== sleep.id),
            { startedAt: startTime, endedAt: endTime },
            wakeWindowConfig?.dayStartHour ?? 6,
            wakeWindowConfig?.napContinuationMinutes ?? 25,
            new Date(Math.max(Date.now(), endTime.getTime()))
          );
          input.morningClassificationVersion = MORNING_CLASSIFICATION_VERSION;
        }
      }
      await updateSleep(sleep.id, input);
      setIsInitialized(false);
      exitModal(router);
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedBaby,
    sleep,
    startTime,
    endTime,
    sleepType,
    notes,
    checkAndConfirmSleep,
    sleeps,
    timeChanged,
    typeSelectedAfterTimeEdit,
    wakeWindowConfig?.dayStartHour,
    wakeWindowConfig?.napContinuationMinutes,
    updateSleep,
    router,
  ]);

  const handleDelete = useCallback(() => {
    if (!sleep) return;
    Alert.alert(
      t("timeline.deleteConfirmTitle"),
      t("timeline.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            await deleteSleep(sleep.id);
            exitModal(router);
          },
        },
      ]
    );
  }, [sleep, deleteSleep, router, t]);

  const startBounds = useCallback(() => {
    const boundaryNow = Date.now();
    return {
      maximumDate: new Date(
        Math.min(
          boundaryNow,
          (endTime?.getTime() ?? boundaryNow + MINIMUM_SLEEP_MS) - MINIMUM_SLEEP_MS
        )
      ),
    };
  }, [endTime]);
  const endBounds = useCallback(() => {
    const boundaryNow = Date.now();
    const startTimestamp = startTime?.getTime() ?? boundaryNow - MINIMUM_SLEEP_MS;
    const maximumTimestamp = Math.min(
      boundaryNow,
      startTimestamp + MAXIMUM_SLEEP_MS
    );
    const minimumTimestamp = Math.min(
      startTimestamp + MINIMUM_SLEEP_MS,
      maximumTimestamp
    );
    return {
      minimumDate: new Date(minimumTimestamp),
      maximumDate: new Date(maximumTimestamp),
    };
  }, [startTime]);

  if (!selectedBaby || !sleep || !startTime || !endTime) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.loading")}
        </Text>
      </SafeAreaView>
    );
  }

  const now = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const canSave =
    !timeChanged ||
    (durationMs >= MINIMUM_SLEEP_MS &&
      durationMs <= MAXIMUM_SLEEP_MS &&
      startTime <= now &&
      endTime <= now);
  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="items-center pt-2 pb-3"
        testID="dismiss-keyboard"
      >
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <View className="flex-row items-center w-full px-4">
          <View className="w-touch" />
          <View className="flex-1 items-center">
            <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
              {t("timeline.editEntry")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {t("sleep.title")}
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
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-6">
            <View
              className="w-20 h-20 rounded-full items-center justify-center"
              style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
            >
              <Text className="text-4xl">😴</Text>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("sleep.sleepType")}
            </Text>
            <View className="flex-row gap-2">
              {(["nap", "night"] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    setSleepType(type);
                    setTypeSelectedAfterTimeEdit(true);
                  }}
                  className={`flex-1 py-3 rounded-button-lg items-center ${
                    sleepType === type
                      ? ""
                      : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  }`}
                  style={sleepType === type ? { backgroundColor: SLEEP_PURPLE } : undefined}
                >
                  <Text
                    className={
                      sleepType === type
                        ? "text-white"
                        : "text-content-primary dark:text-content-dark-primary"
                    }
                  >
                    {t(`sleep.${type}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <StartEndTimeSection
            startTime={startTime}
            endTime={endTime}
            onStartTimeChange={handleStartChange}
            onEndTimeChange={handleEndChange}
            startBounds={startBounds}
            endBounds={endBounds}
            timeFormat={timeFormat}
            startLabel={t("sleep.startTime")}
            endLabel={t("sleep.endTime")}
            durationLabel={t("sleep.duration")}
            doneLabel={t("common.done")}
            selectDateLabel={t("feeding.selectDate")}
            selectTimeLabel={t("feeding.selectTime")}
            accentColor={SLEEP_PURPLE}
            mutedBackgroundColor={SLEEP_PURPLE_MUTED}
            textColor="#2D2A26"
            startError={errors.startedAt ? te(t, errors.startedAt) : undefined}
            endError={errors.endedAt ? te(t, errors.endedAt) : undefined}
            durationError={
              errors.durationSeconds ? te(t, errors.durationSeconds) : undefined
            }
          />

          <View>
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("common.notes")} ({t("common.optional")})
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("sleep.notesPlaceholder")}
              multiline
              numberOfLines={3}
              className="h-24 px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
              placeholderTextColor="#999"
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        <View className="px-6 pb-6">
          <Pressable
            onPress={handleSave}
            disabled={!canSave || isSaving}
            className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
              !canSave || isSaving ? "opacity-50" : ""
            }`}
            style={{ backgroundColor: SLEEP_PURPLE }}
            accessibilityRole="button"
            accessibilityLabel={t("common.save")}
            accessibilityState={{ disabled: !canSave || isSaving }}
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
