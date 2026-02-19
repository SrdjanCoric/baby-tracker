import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSleep } from "@/contexts/sleep-context";
import { useBaby, useTimeFormat } from "@/contexts";
import { formatDate, formatTime } from "@/utils/time";
import type { SleepType } from "@/constants/activities";

const SLEEP_PURPLE = "#6B5B95";
const SLEEP_PURPLE_MUTED = "#E8E4F0";

export default function EditSleepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { sleeps, updateSleep, deleteSleep } = useSleep();

  const sleep = useMemo(() => {
    return sleeps.find((s) => s.id === id) ?? null;
  }, [sleeps, id]);

  const [sleepType, setSleepType] = useState<SleepType>("nap");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (sleep && !isInitialized) {
      setSleepType(sleep.type);
      setDurationMinutes(sleep.durationSeconds ? String(Math.round(sleep.durationSeconds / 60)) : "");
      setNotes(sleep.notes ?? "");
      setIsInitialized(true);
    }
  }, [sleep, isInitialized]);

  const hasChanges = useMemo(() => {
    if (!sleep || !isInitialized) return false;

    const originalDuration = sleep.durationSeconds ? String(Math.round(sleep.durationSeconds / 60)) : "";
    const originalNotes = sleep.notes ?? "";

    return (
      sleepType !== sleep.type ||
      durationMinutes !== originalDuration ||
      notes !== originalNotes
    );
  }, [sleep, isInitialized, sleepType, durationMinutes, notes]);

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

  const handleSave = useCallback(async () => {
    if (!selectedBaby || !sleep) return;

    setIsSaving(true);
    try {
      const durationSeconds = durationMinutes ? parseInt(durationMinutes, 10) * 60 : undefined;

      await updateSleep(sleep.id, {
        type: sleepType,
        durationSeconds,
        notes: notes || undefined,
      });
      setIsInitialized(false);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, sleep, sleepType, durationMinutes, notes, updateSleep, router]);

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
            router.back();
          },
        },
      ]
    );
  }, [sleep, deleteSleep, router, t]);

  if (!selectedBaby || !sleep) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.loading")}
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
            style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
          >
            <Text className="text-4xl">😴</Text>
          </View>
        </View>

        {/* Date/Time display */}
        <View className="items-center mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {formatDate(new Date(sleep.startedAt))}
          </Text>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
            {formatTime(new Date(sleep.startedAt), timeFormat)}
          </Text>
        </View>

        {/* Sleep Type */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("sleep.sleepType")}
          </Text>
          <View className="flex-row gap-2">
            {(["nap", "night"] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setSleepType(type)}
                className={`flex-1 py-3 rounded-button-lg items-center ${
                  sleepType === type ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
                }`}
                style={sleepType === type ? { backgroundColor: SLEEP_PURPLE } : undefined}
              >
                <Text
                  className={`text-base font-medium ${
                    sleepType === type
                      ? "text-white"
                      : "text-content-primary dark:text-content-dark-primary"
                  }`}
                >
                  {t(`sleep.${type}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Duration */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("sleep.durationMinutes")}
          </Text>
          <TextInput
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            placeholder="0"
            keyboardType="number-pad"
            className="h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
            placeholderTextColor="#999"
          />
        </View>

        {/* Notes */}
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

      {/* Save Button */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
            isSaving ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: SLEEP_PURPLE }}
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
