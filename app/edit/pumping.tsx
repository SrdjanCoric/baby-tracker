import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { calculateActiveDurationSeconds, getEditablePausedSeconds } from "@/utils/timer-duration";
import { usePumping } from "@/contexts/pumping-context";
import { useBaby, useTimeFormat } from "@/contexts";
import { formatDuration, formatTime } from "@/utils/time";
import type { BreastSide } from "@/constants/activities";
import { exitModal } from "@/navigation";
import { StartEndTimeSection } from "@/components/StartEndTimeSection";
import { BreastSideMinutesFields } from "@/components/BreastSideMinutesFields";
import { CursorAtEndTextInput } from "@/components/CursorAtEndTextInput";
import {
  validateManualPumpingDuration,
  validateManualPumpingTimes,
  validatePumpingVolume,
} from "@/validators/pumping";
import {
  findSidesLongerThanDuration,
  parseWholeMinutes,
  parseWholeMinutesAsSeconds,
  wholeMinutes,
  wholeMinutesText,
} from "@/validators/side-minutes";
import { te } from "@/utils/translate-errors";
import type { StoredPumpingEntry, UpdatePumpingInput } from "@/services/pumping-storage";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";

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
  const { checkAndConfirmPumping } = useDuplicateCheck();

  const pumping = useMemo(() => {
    return pumpings.find((p) => p.id === id) ?? null;
  }, [pumpings, id]);

  const [side, setSide] = useState<BreastSide>("left");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [initialDurationSeconds, setInitialDurationSeconds] = useState(0);
  const [durationText, setDurationText] = useState("");
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [volumeMl, setVolumeMl] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (pumping && !isInitialized) {
      const storedStart = new Date(pumping.startedAt);
      const storedDuration =
        pumping.durationSeconds ??
        calculateActiveDurationSeconds(
          storedStart,
          pumping.endedAt ? new Date(pumping.endedAt) : new Date(),
          getEditablePausedSeconds(pumping)
        );
      setSide(pumping.side);
      setStartTime(storedStart);
      setInitialDurationSeconds(storedDuration);
      setDurationText(String(Math.floor(storedDuration / 60)));
      setLeftText(wholeMinutesText(pumping.leftDurationSeconds));
      setRightText(wholeMinutesText(pumping.rightDurationSeconds));
      setVolumeMl(pumping.volumeMl ? String(pumping.volumeMl) : "");
      setNotes(pumping.notes ?? "");
      setIsInitialized(true);
    }
  }, [pumping, isInitialized]);

  const pausedSeconds = getEditablePausedSeconds(pumping);

  const startChanged = Boolean(
    pumping && startTime &&
      startTime.getTime() !== new Date(pumping.startedAt).getTime()
  );
  const durationChanged =
    Boolean(pumping) &&
    parseWholeMinutes(durationText) !== Math.floor(initialDurationSeconds / 60);
  const leftChanged =
    Boolean(pumping) &&
    parseWholeMinutes(leftText) !== wholeMinutes(pumping?.leftDurationSeconds);
  const rightChanged =
    Boolean(pumping) &&
    parseWholeMinutes(rightText) !== wholeMinutes(pumping?.rightDurationSeconds);
  const timeChanged = startChanged || durationChanged;
  // Untouched fields keep their exact stored seconds rather than the whole minutes shown.
  const enteredDurationSeconds = durationChanged
    ? parseWholeMinutesAsSeconds(durationText)
    : initialDurationSeconds;
  const durationSeconds = enteredDurationSeconds ?? 0;
  const leftSeconds = leftChanged
    ? parseWholeMinutesAsSeconds(leftText)
    : pumping?.leftDurationSeconds;
  const rightSeconds = rightChanged
    ? parseWholeMinutesAsSeconds(rightText)
    : pumping?.rightDurationSeconds;
  // An unfinished session keeps no end until its Duration is edited.
  const writesEnd = Boolean(pumping?.endedAt) || durationChanged;
  const endTime = useMemo(
    () =>
      startTime
        ? new Date(startTime.getTime() + (durationSeconds + pausedSeconds) * 1000)
        : null,
    [startTime, durationSeconds, pausedSeconds]
  );
  // An imported side that already exceeds its session blocks Save only once Duration or that side is edited.
  const sidesTooLong = findSidesLongerThanDuration(enteredDurationSeconds, {
    left: leftSeconds,
    right: rightSeconds,
  }).filter(
    (sideName) =>
      durationChanged || (sideName === "left" ? leftChanged : rightChanged)
  );

  const hasChanges = useMemo(() => {
    if (!pumping || !isInitialized) return false;

    const originalVolume = pumping.volumeMl ? String(pumping.volumeMl) : "";
    const originalNotes = pumping.notes ?? "";

    return (
      side !== pumping.side ||
      timeChanged ||
      leftChanged ||
      rightChanged ||
      volumeMl !== originalVolume ||
      notes !== originalNotes
    );
  }, [pumping, isInitialized, side, timeChanged, leftChanged, rightChanged, volumeMl, notes]);

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
        endedAt: writesEnd ? endTime : new Date(),
        pausedSeconds,
      });
      const { volumeMl: _volumeError, ...timeErrors } = validation.errors;
      if (Object.keys(timeErrors).length > 0) {
        setErrors(timeErrors);
        return;
      }
    }

    if (timeChanged) {
      const proposedPumping: StoredPumpingEntry = {
        ...pumping,
        side,
        volumeMl: parsedVolume,
        startedAt: startTime.toISOString(),
        endedAt: writesEnd ? endTime.toISOString() : pumping.endedAt,
        notes: notes || undefined,
      };
      if (
        !(await checkAndConfirmPumping(
          proposedPumping,
          pumpings.filter((candidate) => candidate.id !== pumping.id)
        ))
      ) {
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
      // Storage marks the sides not tracked on a time edit that does not resupply them.
      if (leftChanged || timeChanged) input.leftDurationSeconds = leftSeconds ?? null;
      if (rightChanged || timeChanged) input.rightDurationSeconds = rightSeconds ?? null;
      if (timeChanged) {
        input.startedAt = startTime;
        if (writesEnd) {
          input.endedAt = endTime;
          input.durationSeconds = durationSeconds;
        }
      }
      await updatePumping(pumping.id, input);
      setIsInitialized(false);
      exitModal(router);
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, pumping, pausedSeconds, startTime, endTime, writesEnd, durationSeconds, timeChanged, leftChanged, rightChanged, leftSeconds, rightSeconds, side, volumeMl, notes, checkAndConfirmPumping, pumpings, updatePumping, router]);

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
    const lengthSeconds = writesEnd
      ? Math.max(durationSeconds, MINIMUM_PUMPING_MS / 1000)
      : MINIMUM_PUMPING_MS / 1000;
    return {
      maximumDate: new Date(Date.now() - (lengthSeconds + pausedSeconds) * 1000),
    };
  }, [writesEnd, durationSeconds, pausedSeconds]);

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
  const durationMs = durationSeconds * 1000;
  const canSave =
    sidesTooLong.length === 0 &&
    (!timeChanged ||
      (durationMs >= MINIMUM_PUMPING_MS &&
        durationMs <= MAXIMUM_PUMPING_MS &&
        startTime <= now &&
        (!writesEnd || endTime <= now)));
  const durationErrorKey = timeChanged
    ? validateManualPumpingDuration(enteredDurationSeconds) ??
      (writesEnd && endTime > now ? "validation.endTimeNotInFuture" : null)
    : null;
  const sessionLength = formatDuration(durationSeconds, "short");
  const endClock = formatTime(endTime, timeFormat);
  const pausedLength = formatDuration(pausedSeconds, "short");
  let endSummary = "";
  if (writesEnd) {
    endSummary =
      pausedSeconds > 0
        ? t("feeding.pausedAndEnds", { paused: pausedLength, time: endClock })
        : t("feeding.endsAt", { time: endClock });
  } else if (pausedSeconds > 0) {
    endSummary = t("feeding.pausedFor", { paused: pausedLength });
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
          <View className="items-center mb-6">
            <View
              className="w-20 h-20 rounded-full items-center justify-center"
              style={{ backgroundColor: PUMPING_BLUE_MUTED }}
            >
              <Text className="text-4xl">🫙</Text>
            </View>
          </View>

          <StartEndTimeSection
            startTime={startTime}
            onStartTimeChange={setStartTime}
            startBounds={startBounds}
            durationInput={{
              minutes: durationText,
              onMinutesChange: setDurationText,
              unitLabel: t("common.min"),
              endSummary,
            }}
            timeFormat={timeFormat}
            startLabel={t("pumping.startTime")}
            durationLabel={t("pumping.duration")}
            doneLabel={t("common.done")}
            selectDateLabel={t("feeding.selectDate")}
            selectTimeLabel={t("feeding.selectTime")}
            accentColor={PUMPING_BLUE}
            mutedBackgroundColor={PUMPING_BLUE_MUTED}
            textColor="#2D2A26"
            startError={errors.startedAt ? te(t, errors.startedAt) : undefined}
            durationError={
              durationErrorKey || errors.durationSeconds || errors.endedAt
                ? te(t, durationErrorKey ?? errors.durationSeconds ?? errors.endedAt)
                : undefined
            }
          />
          <BreastSideMinutesFields
            label={t("feeding.minutesPerSide")}
            leftLabel={t("feeding.left")}
            rightLabel={t("feeding.right")}
            unitLabel={t("common.min")}
            left={leftText}
            right={rightText}
            onLeftChange={setLeftText}
            onRightChange={setRightText}
            leftError={
              sidesTooLong.includes("left")
                ? t("pumping.leftLongerThanSession", { duration: sessionLength })
                : undefined
            }
            rightError={
              sidesTooLong.includes("right")
                ? t("pumping.rightLongerThanSession", { duration: sessionLength })
                : undefined
            }
            mutedBackgroundColor={PUMPING_BLUE_MUTED}
            textColor="#2D2A26"
          />

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
                    side === s
                      ? ""
                      : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  }`}
                  style={
                    side === s ? { backgroundColor: PUMPING_BLUE } : undefined
                  }
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

          <View className="mb-4">
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("pumping.amount")} ({t("feeding.ml")})
            </Text>
            <CursorAtEndTextInput
              value={volumeMl}
              onChangeText={setVolumeMl}
              placeholder="0"
              keyboardType="number-pad"
              className="h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
              placeholderTextColor="#999"
            />
            {errors.volumeMl && (
              <Text className="text-red-500 text-sm mt-2">
                {te(t, errors.volumeMl)}
              </Text>
            )}
          </View>

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

        <View className="px-6 pb-6">
          <Pressable
            onPress={handleSave}
            disabled={!canSave || isSaving}
            className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
              !canSave || isSaving ? "opacity-40" : ""
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
