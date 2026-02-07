import { useCallback, useState, useMemo } from "react";
import { Pressable, Text, TextInput, View, ScrollView, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFeeding } from "@/contexts";
import { useBaby } from "@/contexts";
import { useNotificationIntegration } from "@/hooks";
import { COMMON_FOODS } from "@/constants/foods";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import type { SolidReaction } from "@/constants/activities";

const FEEDING_GREEN = "#88B04B";
const FEEDING_GREEN_MUTED = "#E8F0E0";
const FEEDING_GREEN_DARK = "#6A9030";

export default function SolidFeedingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { addFeeding, feedings } = useFeeding();
  const { scheduleReminderAfterFeeding } = useNotificationIntegration();

  const [foodType, setFoodType] = useState("");
  const [reaction, setReaction] = useState<SolidReaction | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const recentFoods = useMemo(() => {
    const solidFeedings = feedings
      .filter((f) => f.type === "solid" && f.foodType)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );

    const uniqueFoods: string[] = [];
    for (const f of solidFeedings) {
      if (f.foodType && !uniqueFoods.includes(f.foodType)) {
        uniqueFoods.push(f.foodType);
      }
      if (uniqueFoods.length >= 6) break;
    }
    return uniqueFoods;
  }, [feedings]);

  const suggestedFoods = useMemo(() => {
    if (recentFoods.length > 0) {
      return recentFoods;
    }
    return COMMON_FOODS.slice(0, 8);
  }, [recentFoods]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleLogPast = useCallback(() => {
    router.push("/feeding/manual?type=solids");
  }, [router]);

  const handleFoodSelect = useCallback((food: string) => {
    setFoodType(food);
    setShowValidation(false);
    Keyboard.dismiss();
  }, []);

  const handleReactionSelect = useCallback((selectedReaction: SolidReaction) => {
    setReaction(selectedReaction);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedBaby) return;

    if (!foodType.trim()) {
      setShowValidation(true);
      return;
    }

    setIsSaving(true);
    try {
      await addFeeding({
        babyId: selectedBaby.id,
        type: "solid",
        foodType: foodType.trim(),
        reaction: reaction ?? undefined,
        startedAt: new Date(),
        notes: notes || undefined,
      });
      await scheduleReminderAfterFeeding(new Date());
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, foodType, reaction, notes, addFeeding, scheduleReminderAfterFeeding, router]);

  const validationMessage = useMemo(() => {
    if (!showValidation) return null;
    if (!foodType.trim()) {
      return t("feeding.enterFoodValidation");
    }
    return null;
  }, [showValidation, foodType, t]);

  const handleFoodInputChange = useCallback((text: string) => {
    setFoodType(text);
    if (text.trim()) {
      setShowValidation(false);
    }
  }, []);

  const getFoodLabel = (food: string): string => {
    const foodLabels: Record<string, string> = {
      banana: t("foods.banana"),
      avocado: t("foods.avocado"),
      apple: t("foods.apple"),
      pear: t("foods.pear"),
      mango: t("foods.mango"),
      peach: t("foods.peach"),
      blueberries: t("foods.blueberries"),
      strawberries: t("foods.strawberries"),
      sweetPotato: t("foods.sweetPotato"),
      carrot: t("foods.carrot"),
      peas: t("foods.peas"),
      broccoli: t("foods.broccoli"),
      zucchini: t("foods.zucchini"),
      spinach: t("foods.spinach"),
      butternutSquash: t("foods.butternutSquash"),
      greenBeans: t("foods.greenBeans"),
      chicken: t("foods.chicken"),
      turkey: t("foods.turkey"),
      beef: t("foods.beef"),
      egg: t("foods.egg"),
      tofu: t("foods.tofu"),
      lentils: t("foods.lentils"),
      salmon: t("foods.salmon"),
      oatmeal: t("foods.oatmeal"),
      rice: t("foods.rice"),
      pasta: t("foods.pasta"),
      bread: t("foods.bread"),
      cereal: t("foods.cereal"),
      yogurt: t("foods.yogurt"),
      cheese: t("foods.cheese"),
    };
    if (foodLabels[food]) {
      return foodLabels[food];
    }
    return food.charAt(0).toUpperCase() + food.slice(1).replace(/([A-Z])/g, " $1");
  };

  if (!selectedBaby) {
    return <NoBabyScreen />;
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
            {t("feeding.solidFood")}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {selectedBaby.name}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Illustration */}
        <View className="items-center mt-4 mb-6">
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: FEEDING_GREEN_MUTED }}
          >
            <Text className="text-5xl">🥣</Text>
          </View>
        </View>

        {/* Food Selection */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("feeding.selectFood")}
          </Text>

          {/* Food input */}
          <View
            className="flex-row items-center min-h-[48px] px-4 rounded-2xl mb-4"
            style={{ backgroundColor: FEEDING_GREEN_MUTED }}
          >
            <TextInput
              className="flex-1"
              style={{ fontSize: 16, lineHeight: 20, paddingBottom: 6, paddingTop: 6, color: FEEDING_GREEN_DARK }}
              value={foodType}
              onChangeText={handleFoodInputChange}
              placeholder={t("feeding.foodPlaceholder")}
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t("feeding.foodPlaceholder")}
            />
          </View>

          {/* Quick food selection */}
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {recentFoods.length > 0
              ? t("feeding.recentFoods")
              : t("feeding.commonFoods")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {suggestedFoods.map((food) => (
              <FoodButton
                key={food}
                food={food}
                label={getFoodLabel(food)}
                isSelected={foodType === food}
                onPress={() => handleFoodSelect(food)}
              />
            ))}
          </View>
        </View>

        {/* Reaction Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.howDidBabyLikeIt")}
          </Text>
          <View className="flex-row gap-3">
            <ReactionButton
              reaction="loved"
              emoji="😍"
              label={t("feeding.loved")}
              isSelected={reaction === "loved"}
              onPress={() => handleReactionSelect("loved")}
            />
            <ReactionButton
              reaction="meh"
              emoji="😐"
              label={t("feeding.meh")}
              isSelected={reaction === "meh"}
              onPress={() => handleReactionSelect("meh")}
            />
            <ReactionButton
              reaction="refused"
              emoji="😣"
              label={t("feeding.refused")}
              isSelected={reaction === "refused"}
              onPress={() => handleReactionSelect("refused")}
            />
          </View>
        </View>

        {/* Notes */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            Notes
          </Text>
          <TextInput
            className="rounded-card-lg px-4 py-3 text-base bg-surface-secondary dark:bg-surface-dark-secondary text-content-primary dark:text-content-dark-primary"
            value={notes}
            onChangeText={setNotes}
            placeholder={t("feeding.notesPlaceholder")}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />
        </View>

        {/* Log Past Button */}
        <View className="items-center mt-8 mb-8">
          <Pressable
            onPress={handleLogPast}
            className="py-3 px-6 rounded-button-lg active:opacity-70"
            style={{ backgroundColor: FEEDING_GREEN_MUTED }}
            accessibilityRole="button"
            accessibilityLabel={t("feeding.logPastSolid")}
          >
            <Text className="text-base font-medium" style={{ color: FEEDING_GREEN }}>
              {t("feeding.logPastSolid")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Section - Validation & Save */}
      <View className="px-6 pb-6 pt-3 bg-surface dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800">
        {/* Validation Message */}
        {validationMessage && (
          <View className="mb-3 items-center">
            <Text className="text-sm text-amber-600 dark:text-amber-400 text-center">
              {validationMessage}
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${
            isSaving ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: FEEDING_GREEN }}
          accessibilityRole="button"
          accessibilityLabel={t("common.save")}
          accessibilityState={{ disabled: isSaving }}
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : t("feeding.logSolidFeeding")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface FoodButtonProps {
  food: string;
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function FoodButton({ label, isSelected, onPress }: FoodButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="py-2 px-4 rounded-button-lg active:scale-95"
      style={{
        backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-base font-medium"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface ReactionButtonProps {
  reaction: SolidReaction;
  emoji: string;
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function ReactionButton({ emoji, label, isSelected, onPress }: ReactionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-4 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text className="text-2xl mb-1">{emoji}</Text>
      <Text
        className="text-sm font-semibold"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN_DARK }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
