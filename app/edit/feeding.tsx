import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useFeeding } from "@/contexts/feeding-context";
import { useBaby, useTimeFormat } from "@/contexts";
import { formatDate, formatTime } from "@/utils/time";
import type { BreastSide, BottleContentType, SolidAmount, SolidReaction } from "@/constants/activities";

const FEEDING_GREEN = "#88B04B";
const FEEDING_GREEN_MUTED = "#E8F0E0";

export default function EditFeedingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { feedings, updateFeeding, deleteFeeding } = useFeeding();

  const feeding = useMemo(() => {
    return feedings.find((f) => f.id === id) ?? null;
  }, [feedings, id]);

  const [side, setSide] = useState<BreastSide | undefined>(undefined);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [amountMl, setAmountMl] = useState("");
  const [contentType, setContentType] = useState<BottleContentType | undefined>(undefined);
  const [foodType, setFoodType] = useState("");
  const [amount, setAmount] = useState<SolidAmount | undefined>(undefined);
  const [reaction, setReaction] = useState<SolidReaction | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (feeding && !isInitialized) {
      setSide(feeding.side);
      setDurationMinutes(feeding.durationSeconds ? String(Math.round(feeding.durationSeconds / 60)) : "");
      setAmountMl(feeding.amountMl ? String(feeding.amountMl) : "");
      setContentType(feeding.contentType);
      setFoodType(feeding.foodType ?? "");
      setAmount(feeding.amount);
      setReaction(feeding.reaction);
      setNotes(feeding.notes ?? "");
      setIsInitialized(true);
    }
  }, [feeding, isInitialized]);

  const hasChanges = useMemo(() => {
    if (!feeding || !isInitialized) return false;

    const originalDuration = feeding.durationSeconds ? String(Math.round(feeding.durationSeconds / 60)) : "";
    const originalAmount = feeding.amountMl ? String(feeding.amountMl) : "";
    const originalNotes = feeding.notes ?? "";
    const originalFoodType = feeding.foodType ?? "";

    return (
      side !== feeding.side ||
      durationMinutes !== originalDuration ||
      amountMl !== originalAmount ||
      contentType !== feeding.contentType ||
      foodType !== originalFoodType ||
      amount !== feeding.amount ||
      reaction !== feeding.reaction ||
      notes !== originalNotes
    );
  }, [feeding, isInitialized, side, durationMinutes, amountMl, contentType, foodType, amount, reaction, notes]);

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
    if (!selectedBaby || !feeding) return;

    setIsSaving(true);
    try {
      const durationSeconds = durationMinutes ? parseInt(durationMinutes, 10) * 60 : undefined;
      const parsedAmount = amountMl ? parseInt(amountMl, 10) : undefined;

      const updateInput: Parameters<typeof updateFeeding>[1] = {
        side,
        durationSeconds,
        amountMl: parsedAmount,
        contentType,
        foodType: foodType || undefined,
        amount,
        reaction,
        notes: notes || undefined,
      };

      if (feeding.type === "breast" && durationSeconds !== undefined) {
        if (side === "left") {
          updateInput.leftDurationSeconds = durationSeconds;
          updateInput.rightDurationSeconds = 0;
        } else if (side === "right") {
          updateInput.rightDurationSeconds = durationSeconds;
          updateInput.leftDurationSeconds = 0;
        } else if (side === "both") {
          updateInput.leftDurationSeconds = 0;
          updateInput.rightDurationSeconds = 0;
        }
      }

      await updateFeeding(feeding.id, updateInput);
      setIsInitialized(false);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, feeding, side, durationMinutes, amountMl, contentType, foodType, amount, reaction, notes, updateFeeding, router]);

  const handleDelete = useCallback(() => {
    if (!feeding) return;

    Alert.alert(
      t("timeline.deleteConfirmTitle"),
      t("timeline.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            await deleteFeeding(feeding.id);
            router.back();
          },
        },
      ]
    );
  }, [feeding, deleteFeeding, router, t]);

  const foodTranslations: Record<string, string> = useMemo(() => ({
    banana: t("foods.banana"), avocado: t("foods.avocado"), apple: t("foods.apple"),
    sweetPotato: t("foods.sweetPotato"), carrot: t("foods.carrot"),
    oatmeal: t("foods.oatmeal"), rice: t("foods.rice"), yogurt: t("foods.yogurt"),
    chicken: t("foods.chicken"), egg: t("foods.egg"),
  }), [t]);

  const commonFoods = useMemo(() => Object.entries(foodTranslations), [foodTranslations]);

  if (!selectedBaby || !feeding) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.loading")}
        </Text>
      </SafeAreaView>
    );
  }

  const renderBreastfeedingForm = () => (
    <View className="gap-4">
      <View>
        <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
          {t("feeding.side")}
        </Text>
        <View className="flex-row gap-2">
          {(["left", "right", "both"] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSide(s)}
              className={`flex-1 py-3 rounded-button-lg items-center ${
                side === s ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
              }`}
              style={side === s ? { backgroundColor: FEEDING_GREEN } : undefined}
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

      <View>
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
    </View>
  );

  const renderBottleForm = () => (
    <View className="gap-4">
      <View>
        <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
          {t("feeding.selectContentType")}
        </Text>
        <View className="flex-row gap-2">
          {(["breastMilk", "formula"] as const).map((type) => (
            <Pressable
              key={type}
              onPress={() => setContentType(type)}
              className={`flex-1 py-3 rounded-button-lg items-center ${
                contentType === type ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
              }`}
              style={contentType === type ? { backgroundColor: FEEDING_GREEN } : undefined}
            >
              <Text
                className={`text-base font-medium ${
                  contentType === type
                    ? "text-white"
                    : "text-content-primary dark:text-content-dark-primary"
                }`}
              >
                {t(`feeding.${type}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
          {t("feeding.amount")} ({t("feeding.ml")})
        </Text>
        <TextInput
          value={amountMl}
          onChangeText={setAmountMl}
          placeholder="0"
          keyboardType="number-pad"
          className="h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
          placeholderTextColor="#999"
        />
      </View>
    </View>
  );

  const renderSolidsForm = () => (
    <View className="gap-4">
      <View>
        <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
          {t("feeding.selectFood")}
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-2">
          {commonFoods.map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setFoodType(label)}
              className={`px-4 py-2 rounded-full ${
                foodType === label
                  ? ""
                  : "bg-surface-secondary dark:bg-surface-dark-secondary"
              }`}
              style={foodType === label ? { backgroundColor: FEEDING_GREEN } : undefined}
            >
              <Text
                className={`text-sm ${
                  foodType === label
                    ? "text-white"
                    : "text-content-primary dark:text-content-dark-primary"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={foodType}
          onChangeText={setFoodType}
          placeholder={t("feeding.foodPlaceholder")}
          className="h-14 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-lg text-content-primary dark:text-content-dark-primary"
          placeholderTextColor="#999"
        />
      </View>

      <View>
        <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
          {t("feeding.selectAmount")}
        </Text>
        <View className="flex-row gap-2">
          {(["aLittle", "some", "aLot"] as const).map((a) => (
            <Pressable
              key={a}
              onPress={() => setAmount(a)}
              className={`flex-1 py-3 rounded-button-lg items-center ${
                amount === a ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
              }`}
              style={amount === a ? { backgroundColor: FEEDING_GREEN } : undefined}
            >
              <Text
                className={`text-base font-medium ${
                  amount === a
                    ? "text-white"
                    : "text-content-primary dark:text-content-dark-primary"
                }`}
              >
                {t(`feeding.${a}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
          {t("feeding.howDidBabyLikeIt")}
        </Text>
        <View className="flex-row gap-2">
          {(["loved", "meh", "refused"] as const).map((r) => {
            const emoji = r === "loved" ? "😍" : r === "meh" ? "😐" : "😣";
            return (
              <Pressable
                key={r}
                onPress={() => setReaction(r)}
                className={`flex-1 py-3 rounded-button-lg items-center ${
                  reaction === r ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
                }`}
                style={reaction === r ? { backgroundColor: FEEDING_GREEN } : undefined}
              >
                <Text className="text-2xl mb-1">{emoji}</Text>
                <Text
                  className={`text-sm ${
                    reaction === r
                      ? "text-white"
                      : "text-content-primary dark:text-content-dark-primary"
                  }`}
                >
                  {t(`feeding.${r}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  const getTitle = () => {
    if (feeding.type === "breast") return t("feeding.breastfeeding");
    if (feeding.type === "bottle") return t("feeding.bottleFeeding");
    return t("feeding.solidFood");
  };

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
            {getTitle()}
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
            style={{ backgroundColor: FEEDING_GREEN_MUTED }}
          >
            <Text className="text-4xl">🤱</Text>
          </View>
        </View>

        {/* Date/Time display */}
        <View className="items-center mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {formatDate(new Date(feeding.startedAt))}
          </Text>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
            {formatTime(new Date(feeding.startedAt), timeFormat)}
          </Text>
        </View>

        {/* Type-specific form */}
        {feeding.type === "breast" && renderBreastfeedingForm()}
        {feeding.type === "bottle" && renderBottleForm()}
        {feeding.type === "solid" && renderSolidsForm()}

        {/* Notes */}
        <View className="mt-4">
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
          style={{ backgroundColor: FEEDING_GREEN }}
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
