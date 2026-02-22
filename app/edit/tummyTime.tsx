import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTummyTime } from "@/contexts/tummyTime-context";
import { useBaby, useTimeFormat } from "@/contexts";
import { formatDate, formatTime } from "@/utils/time";

const TUMMY_TIME_ORANGE = "#E67E22";
const TUMMY_TIME_ORANGE_MUTED = "#FEF3E2";

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

  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (tummyTime && !isInitialized) {
      setDurationMinutes(tummyTime.durationSeconds ? String(Math.round(tummyTime.durationSeconds / 60)) : "");
      setNotes(tummyTime.notes ?? "");
      setIsInitialized(true);
    }
  }, [tummyTime, isInitialized]);

  const hasChanges = useMemo(() => {
    if (!tummyTime || !isInitialized) return false;

    const originalDuration = tummyTime.durationSeconds ? String(Math.round(tummyTime.durationSeconds / 60)) : "";
    const originalNotes = tummyTime.notes ?? "";

    return (
      durationMinutes !== originalDuration ||
      notes !== originalNotes
    );
  }, [tummyTime, isInitialized, durationMinutes, notes]);

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
    if (!selectedBaby || !tummyTime) return;

    setIsSaving(true);
    try {
      const durationSeconds = durationMinutes ? parseInt(durationMinutes, 10) * 60 : undefined;

      await updateTummyTime(tummyTime.id, {
        durationSeconds,
        notes: notes || undefined,
      });
      setIsInitialized(false);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, tummyTime, durationMinutes, notes, updateTummyTime, router]);

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
            router.back();
          },
        },
      ]
    );
  }, [tummyTime, deleteTummyTime, router, t]);

  if (!selectedBaby || !tummyTime) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.loading")}
        </Text>
      </SafeAreaView>
    );
  }

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

        {/* Date/Time display */}
        <View className="items-center mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {formatDate(new Date(tummyTime.startedAt))}
          </Text>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
            {formatTime(new Date(tummyTime.startedAt), timeFormat)}
          </Text>
        </View>

        {/* Duration */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("tummyTime.durationMinutes")}
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
          disabled={isSaving}
          className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
            isSaving ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: TUMMY_TIME_ORANGE }}
          accessibilityRole="button"
          accessibilityLabel={t("common.save")}
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
