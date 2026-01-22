import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { usePumping } from "@/contexts/pumping-context";
import { useBaby } from "@/contexts";
import { formatDate, formatTime } from "@/utils/time";
import type { BreastSide } from "@/constants/activities";

const PUMPING_BLUE = "#7B9BC9";
const PUMPING_BLUE_MUTED = "#E8EDF5";

export default function EditPumpingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedBaby } = useBaby();
  const { pumpings, updatePumping, deletePumping } = usePumping();

  const pumping = useMemo(() => {
    return pumpings.find((p) => p.id === id) ?? null;
  }, [pumpings, id]);

  const [side, setSide] = useState<BreastSide>("left");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [volumeMl, setVolumeMl] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (pumping && !isInitialized) {
      setSide(pumping.side);
      setDurationMinutes(pumping.durationSeconds ? String(Math.round(pumping.durationSeconds / 60)) : "");
      setVolumeMl(pumping.volumeMl ? String(pumping.volumeMl) : "");
      setNotes(pumping.notes ?? "");
      setIsInitialized(true);
    }
  }, [pumping, isInitialized]);

  const hasChanges = useMemo(() => {
    if (!pumping || !isInitialized) return false;

    const originalDuration = pumping.durationSeconds ? String(Math.round(pumping.durationSeconds / 60)) : "";
    const originalVolume = pumping.volumeMl ? String(pumping.volumeMl) : "";
    const originalNotes = pumping.notes ?? "";

    return (
      side !== pumping.side ||
      durationMinutes !== originalDuration ||
      volumeMl !== originalVolume ||
      notes !== originalNotes
    );
  }, [pumping, isInitialized, side, durationMinutes, volumeMl, notes]);

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
    if (!selectedBaby || !pumping) return;

    setIsSaving(true);
    try {
      const durationSeconds = durationMinutes ? parseInt(durationMinutes, 10) * 60 : undefined;
      const parsedVolume = volumeMl ? parseInt(volumeMl, 10) : undefined;

      await updatePumping(pumping.id, {
        side,
        durationSeconds,
        volumeMl: parsedVolume,
        notes: notes || undefined,
      });
      setIsInitialized(false);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, pumping, side, durationMinutes, volumeMl, notes, updatePumping, router]);

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
            router.back();
          },
        },
      ]
    );
  }, [pumping, deletePumping, router, t]);

  if (!selectedBaby || !pumping) {
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

        {/* Date/Time display */}
        <View className="items-center mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {formatDate(new Date(pumping.startedAt))}
          </Text>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
            {formatTime(new Date(pumping.startedAt))}
          </Text>
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

        {/* Duration */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("feeding.duration")} ({t("feeding.durationMinutes")})
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
          disabled={isSaving}
          className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
            isSaving ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: PUMPING_BLUE }}
          accessibilityRole="button"
          accessibilityLabel={t("common.save")}
        >
          <Text className="text-white text-lg font-semibold">
            {isSaving ? t("common.loading") : t("common.save")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
