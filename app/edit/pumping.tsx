import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { usePumping } from "@/contexts/pumping-context";
import { useBaby, useTimeFormat } from "@/contexts";
import type { BreastSide } from "@/constants/activities";
import { exitModal } from "@/navigation";
import { StartEndTimeSection } from "@/components/StartEndTimeSection";
import { validateManualPumpingTimes, validatePumpingVolume } from "@/validators/pumping";
import { te } from "@/utils/translate-errors";
import type { UpdatePumpingInput } from "@/services/pumping-storage";

const PUMPING_BLUE = "#7B9BC9";
const PUMPING_BLUE_MUTED = "#E8EDF5";
const MINIMUM_PUMPING_MS = 60_000;
const MAXIMUM_PUMPING_MS = 60 * 60 * 1000;

export default function EditPumpingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { pumpings, updatePumping, deletePumping } = usePumping();

  const pumping = useMemo(() => {
    return pumpings.find((p) => p.id === id) ?? null;
  }, [pumpings, id]);

  const [side, setSide] = useState<BreastSide>("left");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [initialEndTime, setInitialEndTime] = useState<Date | null>(null);
  const [volumeMl, setVolumeMl] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (pumping && !isInitialized) {
      const displayedEnd = pumping.endedAt ? new Date(pumping.endedAt) : new Date();
      setSide(pumping.side);
      setStartTime(new Date(pumping.startedAt));
      setEndTime(displayedEnd);
      setInitialEndTime(displayedEnd);
      setVolumeMl(pumping.volumeMl ? String(pumping.volumeMl) : "");
      setNotes(pumping.notes ?? "");
      setIsInitialized(true);
    }
  }, [pumping, isInitialized]);

  const timeChanged = Boolean(
    pumping && startTime && endTime && initialEndTime &&
      (startTime.getTime() !== new Date(pumping.startedAt).getTime() ||
        endTime.getTime() !== initialEndTime.getTime())
  );

  const hasChanges = useMemo(() => {
    if (!pumping || !isInitialized) return false;

    const originalVolume = pumping.volumeMl ? String(pumping.volumeMl) : "";
    const originalNotes = pumping.notes ?? "";

    return (
      side !== pumping.side ||
      timeChanged ||
      volumeMl !== originalVolume ||
      notes !== originalNotes
    );
  }, [pumping, isInitialized, side, timeChanged, volumeMl, notes]);

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
    if (!selectedBaby || !pumping || !startTime || !endTime) return;

    setErrors({});
    const parsedVolume = volumeMl ? parseInt(volumeMl, 10) : undefined;
    const volumeError = validatePumpingVolume(parsedVolume);
    if (volumeError) {
      setErrors({ volumeMl: volumeError });
      return;
    }
    if (timeChanged) {
      const validation = validateManualPumpingTimes({
        babyId: pumping.babyId,
        side,
        startedAt: startTime,
        endedAt: endTime,
      });
      const { volumeMl: _volumeError, ...timeErrors } = validation.errors;
      if (Object.keys(timeErrors).length > 0) {
        setErrors(timeErrors);
        return;
      }
    }

    setIsSaving(true);
    try {
      const input: UpdatePumpingInput = {
        side,
        volumeMl: parsedVolume,
        notes: notes || undefined,
      };
      if (timeChanged) {
        input.startedAt = startTime;
        input.endedAt = endTime;
        input.durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      }
      await updatePumping(pumping.id, input);
      setIsInitialized(false);
      exitModal(router);
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, pumping, startTime, endTime, timeChanged, side, volumeMl, notes, updatePumping, router]);

  const handleDelete = useCallback(() => {
    if (!pumping) return;

    Alert.alert(
      t("timeline.deleteConfirmTitle"),
      t("timeline.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            await deletePumping(pumping.id);
            exitModal(router);
          },
        },
      ]
    );
  }, [pumping, deletePumping, router, t]);

  const startBounds = useCallback(() => {
    const boundaryNow = Date.now();
    return {
      maximumDate: new Date(Math.min(
        boundaryNow,
        (endTime?.getTime() ?? boundaryNow + MINIMUM_PUMPING_MS) - MINIMUM_PUMPING_MS
      )),
    };
  }, [endTime]);
  const endBounds = useCallback(() => {
    const boundaryNow = Date.now();
    const startTimestamp = startTime?.getTime() ?? boundaryNow;
    const maximumTimestamp = Math.min(boundaryNow, startTimestamp + MAXIMUM_PUMPING_MS);
    return {
      minimumDate: new Date(Math.min(startTimestamp + MINIMUM_PUMPING_MS, maximumTimestamp)),
      maximumDate: new Date(maximumTimestamp),
    };
  }, [startTime]);

  if (!selectedBaby || !pumping || !startTime || !endTime) {
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
    durationMs >= MINIMUM_PUMPING_MS && durationMs <= MAXIMUM_PUMPING_MS &&
    startTime <= now && endTime <= now
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
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
              {t("pumping.title")}
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
        {/* Icon */}
        <View className="items-center mb-6">
          <View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: PUMPING_BLUE_MUTED }}
          >
            <Text className="text-4xl">🫙</Text>
          </View>
        </View>

        {/* Side */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("pumping.side")}
          </Text>
          <View className="flex-row gap-2">
            {(["left", "right", "both"] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSide(s)}
                className={`flex-1 py-3 rounded-button-lg items-center ${
                  side === s ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
                }`}
                style={side === s ? { backgroundColor: PUMPING_BLUE } : undefined}
              >
                <Text
                  className={`text-base font-medium ${
                    side === s
                      ? "text-white"
                      : "text-content-primary dark:text-content-dark-primary"
                  }`}
                >
                  {t(`feeding.${s}`)}
                </Text>
              </Pressable>
            ))}
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
          startLabel={t("pumping.startTime")}
          endLabel={t("pumping.endTime")}
          durationLabel={t("pumping.duration")}
          doneLabel={t("common.done")}
          selectDateLabel={t("feeding.selectDate")}
          selectTimeLabel={t("feeding.selectTime")}
          accentColor={PUMPING_BLUE}
          mutedBackgroundColor={PUMPING_BLUE_MUTED}
          textColor="#2D2A26"
          startError={errors.startedAt ? te(t, errors.startedAt) : undefined}
          endError={errors.endedAt ? te(t, errors.endedAt) : undefined}
          durationError={errors.durationSeconds ? te(t, errors.durationSeconds) : undefined}
        />

        {/* Volume */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("pumping.amount")} ({t("feeding.ml")})
          </Text>
          <TextInput
            value={volumeMl}
            onChangeText={setVolumeMl}
            placeholder="0"
            keyboardType="number-pad"
            className="h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
            placeholderTextColor="#999"
          />
          {errors.volumeMl && (
            <Text className="text-red-500 text-sm mt-2">{te(t, errors.volumeMl)}</Text>
          )}
        </View>

        {/* Notes */}
        <View>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("common.notes")} ({t("common.optional")})
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t("feeding.notesPlaceholder")}
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
          disabled={!canSave || isSaving}
          className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
            !canSave || isSaving ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: PUMPING_BLUE }}
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
