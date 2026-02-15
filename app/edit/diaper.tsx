import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useDiaper } from "@/contexts/diaper-context";
import { useBaby, useTimeFormat } from "@/contexts";
import { formatDate, formatTime } from "@/utils/time";
import type { DiaperType, StoolColor } from "@/constants/activities";

const DIAPER_CORAL = "#D4837D";
const DIAPER_CORAL_MUTED = "#FDF0EF";

const STOOL_COLORS: StoolColor[] = ["yellow", "brown", "green", "black", "white", "red", "orange"];

export default function EditDiaperScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { diapers, updateDiaper, deleteDiaper } = useDiaper();

  const diaper = useMemo(() => {
    return diapers.find((d) => d.id === id) ?? null;
  }, [diapers, id]);

  const [diaperType, setDiaperType] = useState<DiaperType>("wet");
  const [stoolColor, setStoolColor] = useState<StoolColor | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (diaper && !isInitialized) {
      setDiaperType(diaper.type);
      setStoolColor(diaper.stoolColor);
      setNotes(diaper.notes ?? "");
      setIsInitialized(true);
    }
  }, [diaper, isInitialized]);

  const hasChanges = useMemo(() => {
    if (!diaper || !isInitialized) return false;

    const originalNotes = diaper.notes ?? "";

    return (
      diaperType !== diaper.type ||
      stoolColor !== diaper.stoolColor ||
      notes !== originalNotes
    );
  }, [diaper, isInitialized, diaperType, stoolColor, notes]);

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
    if (!selectedBaby || !diaper) return;

    setIsSaving(true);
    try {
      await updateDiaper(diaper.id, {
        type: diaperType,
        stoolColor: diaperType === "wet" || diaperType === "dry" ? undefined : stoolColor,
        notes: notes || undefined,
      });
      setIsInitialized(false);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, diaper, diaperType, stoolColor, notes, updateDiaper, router]);

  const handleDelete = useCallback(() => {
    if (!diaper) return;

    Alert.alert(
      t("timeline.deleteConfirmTitle"),
      t("timeline.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            await deleteDiaper(diaper.id);
            router.back();
          },
        },
      ]
    );
  }, [diaper, deleteDiaper, router, t]);

  if (!selectedBaby || !diaper) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.loading")}
        </Text>
      </SafeAreaView>
    );
  }

  const showColorSelector = diaperType === "dirty" || diaperType === "mixed";

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
            {t("diaper.title")}
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
            style={{ backgroundColor: DIAPER_CORAL_MUTED }}
          >
            <Text className="text-4xl">🚼</Text>
          </View>
        </View>

        {/* Date/Time display */}
        <View className="items-center mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {formatDate(new Date(diaper.changedAt))}
          </Text>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
            {formatTime(new Date(diaper.changedAt), timeFormat)}
          </Text>
        </View>

        {/* Diaper Type */}
        <View className="mb-4">
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("diaper.selectType")}
          </Text>
          <View className="flex-row gap-2">
            {(["wet", "dirty", "mixed", "dry"] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setDiaperType(type)}
                className={`flex-1 py-3 rounded-button-lg items-center ${
                  diaperType === type ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
                }`}
                style={diaperType === type ? { backgroundColor: DIAPER_CORAL } : undefined}
              >
                <Text
                  className={`text-base font-medium ${
                    diaperType === type
                      ? "text-white"
                      : "text-content-primary dark:text-content-dark-primary"
                  }`}
                >
                  {t(`diaper.${type}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Stool Color (only for dirty/mixed) */}
        {showColorSelector && (
          <View className="mb-4">
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("diaper.selectColor")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {STOOL_COLORS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setStoolColor(stoolColor === color ? undefined : color)}
                  className={`px-4 py-2 rounded-full ${
                    stoolColor === color
                      ? ""
                      : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  }`}
                  style={stoolColor === color ? { backgroundColor: DIAPER_CORAL } : undefined}
                >
                  <Text
                    className={`text-sm ${
                      stoolColor === color
                        ? "text-white"
                        : "text-content-primary dark:text-content-dark-primary"
                    }`}
                  >
                    {t(`stoolColors.${color}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        <View>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("common.notes")} ({t("common.optional")})
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t("diaper.notesPlaceholder")}
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
          style={{ backgroundColor: DIAPER_CORAL }}
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
