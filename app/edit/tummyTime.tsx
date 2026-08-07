import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTummyTime } from "@/contexts/tummyTime-context";
import { useBaby, useTimeFormat } from "@/contexts";
import { exitModal } from "@/navigation";
import { StartEndTimeSection } from "@/components/StartEndTimeSection";
import { validateManualTummyTimeTimes } from "@/validators/tummyTime";
import { te } from "@/utils/translate-errors";
import type { UpdateTummyTimeInput } from "@/services/tummyTime-storage";

const TUMMY_TIME_ORANGE = "#E67E22";
const TUMMY_TIME_ORANGE_MUTED = "#FEF3E2";
const MINIMUM_TUMMY_TIME_MS = 60_000;
const MAXIMUM_TUMMY_TIME_MS = 2 * 60 * 60 * 1000;

export default function EditTummyTimeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { tummyTimes, updateTummyTime, deleteTummyTime } = useTummyTime();

  const tummyTime = useMemo(() => {
    return tummyTimes.find((tt) => tt.id === id) ?? null;
  }, [tummyTimes, id]);

  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [initialEndTime, setInitialEndTime] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tummyTime && !isInitialized) {
      const displayedEnd = tummyTime.endedAt ? new Date(tummyTime.endedAt) : new Date();
      setStartTime(new Date(tummyTime.startedAt));
      setEndTime(displayedEnd);
      setInitialEndTime(displayedEnd);
      setNotes(tummyTime.notes ?? "");
      setIsInitialized(true);
    }
  }, [tummyTime, isInitialized]);

  const startChanged = Boolean(
    tummyTime && startTime &&
      startTime.getTime() !== new Date(tummyTime.startedAt).getTime()
  );
  const endChanged = Boolean(
    tummyTime && endTime && initialEndTime &&
      endTime.getTime() !== initialEndTime.getTime()
  );
  const timeChanged = startChanged || endChanged;

  const hasChanges = useMemo(() => {
    if (!tummyTime || !isInitialized) return false;

    const originalNotes = tummyTime.notes ?? "";

    return timeChanged || notes !== originalNotes;
  }, [tummyTime, isInitialized, timeChanged, notes]);

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

  const handleSave = useCallback(async () => {
    if (!selectedBaby || !tummyTime || !startTime || !endTime) return;

    setErrors({});
    if (timeChanged) {
      const validation = validateManualTummyTimeTimes({
        babyId: tummyTime.babyId,
        startedAt: startTime,
        endedAt: endTime,
      });
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }
    }

    setIsSaving(true);
    try {
      const input: UpdateTummyTimeInput = {
        notes: notes || undefined,
      };
      if (timeChanged) {
        input.startedAt = startTime;
        if (tummyTime.endedAt || endChanged) {
          input.endedAt = endTime;
          input.durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        }
      }
      await updateTummyTime(tummyTime.id, input);
      setIsInitialized(false);
      exitModal(router);
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, tummyTime, startTime, endTime, endChanged, timeChanged, notes, updateTummyTime, router]);

  const handleDelete = useCallback(() => {
    if (!tummyTime) return;

    Alert.alert(
      t("timeline.deleteConfirmTitle"),
      t("timeline.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.confirm"),
          style: "destructive",
          onPress: async () => {
            await deleteTummyTime(tummyTime.id);
            exitModal(router);
          },
        },
      ]
    );
  }, [tummyTime, deleteTummyTime, router, t]);

  const startBounds = useCallback(() => {
    const boundaryNow = Date.now();
    return {
      maximumDate: new Date(Math.min(
        boundaryNow,
        (endTime?.getTime() ?? boundaryNow + MINIMUM_TUMMY_TIME_MS) - MINIMUM_TUMMY_TIME_MS
      )),
    };
  }, [endTime]);
  const endBounds = useCallback(() => {
    const boundaryNow = Date.now();
    const startTimestamp = startTime?.getTime() ?? boundaryNow;
    const maximumTimestamp = Math.min(boundaryNow, startTimestamp + MAXIMUM_TUMMY_TIME_MS);
    return {
      minimumDate: new Date(Math.min(startTimestamp + MINIMUM_TUMMY_TIME_MS, maximumTimestamp)),
      maximumDate: new Date(maximumTimestamp),
    };
  }, [startTime]);

  if (!selectedBaby || !tummyTime || !startTime || !endTime) {
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
  const canSave = !timeChanged || (
    durationMs >= MINIMUM_TUMMY_TIME_MS && durationMs <= MAXIMUM_TUMMY_TIME_MS &&
    startTime <= now && endTime <= now
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="edit-activity-screen">
      {/* Header with drag handle */}
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
              {t("tummyTime.title")}
            </Text>
          </View>
          <Pressable
            onPress={handleDelete}
            className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
            accessibilityRole="button"
            accessibilityLabel={t("common.delete")}
            testID="delete-button"
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
        {/* Icon */}
        <View className="items-center mb-6">
          <View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: TUMMY_TIME_ORANGE_MUTED }}
          >
            <Text className="text-4xl">💪</Text>
          </View>
        </View>

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
          accentColor={TUMMY_TIME_ORANGE}
          mutedBackgroundColor={TUMMY_TIME_ORANGE_MUTED}
          textColor="#2D2A26"
          startError={errors.startedAt ? te(t, errors.startedAt) : undefined}
          endError={errors.endedAt ? te(t, errors.endedAt) : undefined}
          durationError={errors.durationSeconds ? te(t, errors.durationSeconds) : undefined}
        />

        {/* Notes */}
        <View>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("common.notes")} ({t("common.optional")})
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t("tummyTime.notesPlaceholder")}
            multiline
            numberOfLines={3}
            className="h-24 px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
            placeholderTextColor="#999"
            textAlignVertical="top"
            testID="notes-input"
          />
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={!canSave || isSaving}
          className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
            !canSave || isSaving ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: TUMMY_TIME_ORANGE }}
          accessibilityRole="button"
          accessibilityLabel={t("common.save")}
          accessibilityState={{ disabled: !canSave || isSaving }}
          testID="save-button"
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
