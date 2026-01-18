import { useCallback, useState, useMemo } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFeeding } from "@/contexts";
import { useBaby } from "@/contexts";
import { formatVolume, mlToOz, ozToMl } from "@/utils/volume";
import {
  validateManualBreastfeeding,
  validateManualBottleFeeding,
} from "@/validators/feeding";
import { COMMON_FOODS } from "@/constants/foods";
import type { BreastSide, BottleContentType, SolidReaction } from "@/constants/activities";

const FEEDING_GREEN = "#88B04B";
const FEEDING_GREEN_MUTED = "#E8F0E0";
const FEEDING_GREEN_DARK = "#6A9030";

const QUICK_AMOUNTS_OZ = [1, 2, 3, 4, 5, 6];
const QUICK_AMOUNTS_ML = [30, 60, 90, 120, 150, 180];
const QUICK_DURATIONS = [5, 10, 15, 20, 30, 45];

type FeedingTab = "breast" | "bottle" | "solids";
type VolumeUnit = "ml" | "oz";
type FeedingTypeParam = "breastfeed" | "bottle" | "solids";

export default function ManualFeedingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: FeedingTypeParam }>();
  const { selectedBaby } = useBaby();
  const { addFeeding, feedings } = useFeeding();

  // Map URL param to tab type
  const getInitialTab = (): FeedingTab => {
    if (params.type === "breastfeed") return "breast";
    if (params.type === "bottle") return "bottle";
    if (params.type === "solids") return "solids";
    return "breast";
  };

  const [activeTab, setActiveTab] = useState<FeedingTab>(getInitialTab);
  const isTypeFromParam = !!params.type;
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Breastfeeding state
  const [side, setSide] = useState<BreastSide | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [durationInput, setDurationInput] = useState("");

  // Bottle feeding state
  const [contentType, setContentType] = useState<BottleContentType | null>(
    null
  );
  const [amountMl, setAmountMl] = useState<number | null>(null);
  const [unit, setUnit] = useState<VolumeUnit>("oz");
  const [amountInput, setAmountInput] = useState("");

  // Solid food state
  const [foodType, setFoodType] = useState("");
  const [reaction, setReaction] = useState<SolidReaction | null>(null);

  // Get recent foods for suggestions
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

  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      setShowDatePicker(Platform.OS === "ios");
      if (selectedDate) {
        const newDateTime = new Date(startTime);
        newDateTime.setFullYear(selectedDate.getFullYear());
        newDateTime.setMonth(selectedDate.getMonth());
        newDateTime.setDate(selectedDate.getDate());
        setStartTime(newDateTime);
      }
    },
    [startTime]
  );

  const handleTimeChange = useCallback(
    (_event: unknown, selectedTime?: Date) => {
      setShowTimePicker(Platform.OS === "ios");
      if (selectedTime) {
        const newDateTime = new Date(startTime);
        newDateTime.setHours(selectedTime.getHours());
        newDateTime.setMinutes(selectedTime.getMinutes());
        setStartTime(newDateTime);
      }
    },
    [startTime]
  );

  const handleDurationChange = useCallback((text: string) => {
    setDurationInput(text);
    const value = parseInt(text, 10);
    if (!isNaN(value) && value > 0) {
      setDurationMinutes(value);
    } else {
      setDurationMinutes(null);
    }
  }, []);

  const handleQuickDurationSelect = useCallback((minutes: number) => {
    setDurationMinutes(minutes);
    setDurationInput(minutes.toString());
    Keyboard.dismiss();
  }, []);

  const handleAmountChange = useCallback(
    (text: string) => {
      setAmountInput(text);
      const value = parseFloat(text);
      if (!isNaN(value) && value > 0) {
        if (unit === "oz") {
          setAmountMl(ozToMl(value));
        } else {
          setAmountMl(value);
        }
      } else {
        setAmountMl(null);
      }
    },
    [unit]
  );

  const handleQuickAmountSelect = useCallback(
    (amount: number) => {
      if (unit === "oz") {
        const ml = ozToMl(amount);
        setAmountMl(ml);
        setAmountInput(amount.toString());
      } else {
        setAmountMl(amount);
        setAmountInput(amount.toString());
      }
      Keyboard.dismiss();
    },
    [unit]
  );

  const handleUnitToggle = useCallback(() => {
    if (amountMl !== null) {
      if (unit === "oz") {
        setAmountInput(Math.round(amountMl).toString());
      } else {
        setAmountInput(mlToOz(amountMl).toString());
      }
    }
    setUnit((prev) => (prev === "oz" ? "ml" : "oz"));
  }, [unit, amountMl]);

  // Solid food handlers
  const handleFoodSelect = useCallback((food: string) => {
    setFoodType(food);
    Keyboard.dismiss();
  }, []);

  const handleReactionSelect = useCallback((selectedReaction: SolidReaction) => {
    setReaction(selectedReaction);
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

  const handleSave = useCallback(async () => {
    if (!selectedBaby) return;

    setErrors({});

    if (activeTab === "breast") {
      const durationSeconds = durationMinutes ? durationMinutes * 60 : undefined;
      const validation = validateManualBreastfeeding({
        type: "breast",
        startedAt: startTime,
        durationSeconds,
        side: side ?? undefined,
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      setIsSaving(true);
      try {
        const endedAt = new Date(
          startTime.getTime() + (durationSeconds ?? 0) * 1000
        );
        await addFeeding({
          babyId: selectedBaby.id,
          type: "breast",
          side: side!,
          startedAt: startTime,
          endedAt,
          durationSeconds,
          notes: notes || undefined,
        });
        router.back();
      } finally {
        setIsSaving(false);
      }
    } else if (activeTab === "bottle") {
      const validation = validateManualBottleFeeding({
        type: "bottle",
        startedAt: startTime,
        amountMl: amountMl ?? undefined,
        contentType: contentType ?? undefined,
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      setIsSaving(true);
      try {
        await addFeeding({
          babyId: selectedBaby.id,
          type: "bottle",
          contentType: contentType!,
          amountMl: amountMl!,
          startedAt: startTime,
          notes: notes || undefined,
        });
        router.back();
      } finally {
        setIsSaving(false);
      }
    } else if (activeTab === "solids") {
      // Validate solid food
      if (!foodType.trim()) {
        setErrors({ foodType: t("feeding.enterFoodValidation") });
        return;
      }

      setIsSaving(true);
      try {
        await addFeeding({
          babyId: selectedBaby.id,
          type: "solid",
          foodType: foodType.trim(),
          reaction: reaction ?? undefined,
          startedAt: startTime,
          notes: notes || undefined,
        });
        router.back();
      } finally {
        setIsSaving(false);
      }
    }
  }, [
    selectedBaby,
    activeTab,
    startTime,
    side,
    durationMinutes,
    contentType,
    amountMl,
    foodType,
    reaction,
    notes,
    addFeeding,
    router,
  ]);

  const canSave =
    activeTab === "breast"
      ? side !== null && durationMinutes !== null && durationMinutes > 0
      : activeTab === "bottle"
        ? contentType !== null && amountMl !== null && amountMl > 0
        : foodType.trim().length > 0;

  // Get the screen title based on type
  const getScreenTitle = () => {
    if (isTypeFromParam) {
      if (activeTab === "breast") return t("feeding.logPastBreastfeeding");
      if (activeTab === "bottle") return t("feeding.logPastBottle");
      if (activeTab === "solids") return t("feeding.logPastSolid");
    }
    return t("feeding.pastFeedingTitle");
  };

  // Get the save button label based on type
  const getSaveButtonLabel = () => {
    if (activeTab === "breast") return t("feeding.logManualBreastfeeding");
    if (activeTab === "bottle") return t("feeding.logManualBottleFeeding");
    return t("feeding.logSolidFeeding");
  };

  if (!selectedBaby) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.noBabySelected")}
        </Text>
      </SafeAreaView>
    );
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
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
            {getScreenTitle()}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {selectedBaby.name}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      {/* Tab Selector - only show when type not specified in URL */}
      {!isTypeFromParam && (
        <View className="px-6 mb-4">
          <View
            className="flex-row rounded-pill p-1"
            style={{ backgroundColor: FEEDING_GREEN_MUTED }}
        >
          <TabButton
            label={t("feeding.breastfeedingTab")}
            isActive={activeTab === "breast"}
            onPress={() => setActiveTab("breast")}
          />
          <TabButton
            label={t("feeding.bottleTab")}
            isActive={activeTab === "bottle"}
            onPress={() => setActiveTab("bottle")}
          />
        </View>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Start Time Selection */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.startTime")}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: FEEDING_GREEN_MUTED }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectDate")}
            >
              <Text className="text-base" style={{ color: FEEDING_GREEN_DARK }}>
                {formatDate(startTime)}
              </Text>
              <Text style={{ color: FEEDING_GREEN }}>📅</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: FEEDING_GREEN_MUTED }}
              accessibilityRole="button"
              accessibilityLabel={t("feeding.selectTime")}
            >
              <Text className="text-base" style={{ color: FEEDING_GREEN_DARK }}>
                {formatTime(startTime)}
              </Text>
              <Text style={{ color: FEEDING_GREEN }}>🕐</Text>
            </Pressable>
          </View>
          {errors.startedAt && (
            <Text className="text-red-500 text-sm mt-2">{errors.startedAt}</Text>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={startTime}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
          />
        )}

        {activeTab === "breast" ? (
          <>
            {/* Side Selection */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
                {t("feeding.selectSideToStart")}
              </Text>
              <View className="flex-row gap-3">
                <SideButton
                  side="left"
                  label={t("feeding.leftSide")}
                  shortLabel="L"
                  isSelected={side === "left"}
                  onPress={() => setSide("left")}
                />
                <SideButton
                  side="right"
                  label={t("feeding.rightSide")}
                  shortLabel="R"
                  isSelected={side === "right"}
                  onPress={() => setSide("right")}
                />
              </View>
              <Pressable
                onPress={() => setSide("both")}
                className={`mt-3 py-3 rounded-button-lg items-center active:scale-[0.98]`}
                style={{
                  backgroundColor:
                    side === "both" ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
                }}
                accessibilityRole="button"
                accessibilityLabel={t("feeding.bothSides")}
                accessibilityState={{ selected: side === "both" }}
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: side === "both" ? "#FFFFFF" : FEEDING_GREEN }}
                >
                  {t("feeding.bothSides")}
                </Text>
              </Pressable>
              {errors.side && (
                <Text className="text-red-500 text-sm mt-2">{errors.side}</Text>
              )}
            </View>

            {/* Duration Input */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
                {t("feeding.durationMinutes")}
              </Text>
              <View
                className="flex-row items-center rounded-card-lg px-4 py-3 mb-4"
                style={{ backgroundColor: FEEDING_GREEN_MUTED }}
              >
                <TextInput
                  className="flex-1 text-2xl font-semibold text-center"
                  style={{ color: FEEDING_GREEN_DARK }}
                  value={durationInput}
                  onChangeText={handleDurationChange}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  returnKeyType="done"
                  accessibilityLabel={t("feeding.durationPlaceholder")}
                />
                <Text
                  className="text-lg font-medium ml-2"
                  style={{ color: FEEDING_GREEN }}
                >
                  min
                </Text>
              </View>

              {/* Quick duration buttons */}
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("feeding.quickAmounts")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {QUICK_DURATIONS.map((minutes) => (
                  <QuickButton
                    key={minutes}
                    label={`${minutes}`}
                    isSelected={durationMinutes === minutes}
                    onPress={() => handleQuickDurationSelect(minutes)}
                  />
                ))}
              </View>
              {errors.durationSeconds && (
                <Text className="text-red-500 text-sm mt-2">
                  {errors.durationSeconds}
                </Text>
              )}
            </View>
          </>
        ) : activeTab === "bottle" ? (
          <>
            {/* Content Type Selection */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
                {t("feeding.selectContentType")}
              </Text>
              <View className="flex-row gap-3">
                <ContentTypeButton
                  label={t("feeding.breastMilk")}
                  emoji="🤱"
                  isSelected={contentType === "breastMilk"}
                  onPress={() => setContentType("breastMilk")}
                />
                <ContentTypeButton
                  label={t("feeding.formula")}
                  emoji="🧪"
                  isSelected={contentType === "formula"}
                  onPress={() => setContentType("formula")}
                />
              </View>
              {errors.contentType && (
                <Text className="text-red-500 text-sm mt-2">
                  {errors.contentType}
                </Text>
              )}
            </View>

            {/* Amount Input */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
                  {t("feeding.amount")}
                </Text>
                <UnitToggle unit={unit} onToggle={handleUnitToggle} />
              </View>

              <View
                className="flex-row items-center rounded-card-lg px-4 py-3 mb-4"
                style={{ backgroundColor: FEEDING_GREEN_MUTED }}
              >
                <TextInput
                  className="flex-1 text-2xl font-semibold text-center"
                  style={{ color: FEEDING_GREEN_DARK }}
                  value={amountInput}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  accessibilityLabel={t("feeding.enterAmount")}
                />
                <Text
                  className="text-lg font-medium ml-2"
                  style={{ color: FEEDING_GREEN }}
                >
                  {unit}
                </Text>
              </View>

              {/* Quick amount buttons */}
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("feeding.quickAmounts")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {(unit === "oz" ? QUICK_AMOUNTS_OZ : QUICK_AMOUNTS_ML).map(
                  (amount) => (
                    <QuickButton
                      key={amount}
                      label={amount.toString()}
                      isSelected={
                        unit === "oz"
                          ? amountMl !== null &&
                            Math.abs(ozToMl(amount) - amountMl) < 1
                          : amountMl === amount
                      }
                      onPress={() => handleQuickAmountSelect(amount)}
                    />
                  )
                )}
              </View>
              {errors.amountMl && (
                <Text className="text-red-500 text-sm mt-2">
                  {errors.amountMl}
                </Text>
              )}
            </View>

            {/* Amount preview */}
            {amountMl !== null && amountMl > 0 && (
              <View className="items-center mb-4">
                <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                  {formatVolume(amountMl, "ml")} = {formatVolume(amountMl, "oz")}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Solid Food Form */}
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
                  onChangeText={setFoodType}
                  placeholder={t("feeding.foodPlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel={t("feeding.foodPlaceholder")}
                />
              </View>
              {errors.foodType && (
                <Text className="text-red-500 text-sm mt-2">{errors.foodType}</Text>
              )}

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
          </>
        )}

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
      </ScrollView>

      {/* Save Button - Fixed at bottom */}
      <View className="px-6 pb-6 pt-2 bg-surface dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800">
        <Pressable
          onPress={handleSave}
          disabled={!canSave || isSaving}
          className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${
            !canSave || isSaving ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: FEEDING_GREEN }}
          accessibilityRole="button"
          accessibilityLabel={getSaveButtonLabel()}
          accessibilityState={{ disabled: !canSave || isSaving }}
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : getSaveButtonLabel()}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ label, isActive, onPress }: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 py-3 rounded-pill items-center active:scale-95"
      style={isActive ? { backgroundColor: FEEDING_GREEN } : undefined}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isActive ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface SideButtonProps {
  side: "left" | "right";
  label: string;
  shortLabel: string;
  isSelected: boolean;
  onPress: () => void;
}

function SideButton({
  label,
  shortLabel,
  isSelected,
  onPress,
}: SideButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-5 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-3xl font-bold mb-1"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {shortLabel}
      </Text>
      <Text
        className="text-base font-medium"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN_DARK }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface ContentTypeButtonProps {
  label: string;
  emoji: string;
  isSelected: boolean;
  onPress: () => void;
}

function ContentTypeButton({
  label,
  emoji,
  isSelected,
  onPress,
}: ContentTypeButtonProps) {
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
      <Text className="text-3xl mb-2">{emoji}</Text>
      <Text
        className="text-base font-medium"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN_DARK }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface UnitToggleProps {
  unit: VolumeUnit;
  onToggle: () => void;
}

function UnitToggle({ unit, onToggle }: UnitToggleProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onToggle}
      className="flex-row rounded-pill p-1"
      style={{ backgroundColor: FEEDING_GREEN_MUTED }}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${unit === "oz" ? "milliliters" : "ounces"}`}
    >
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "oz" ? { backgroundColor: FEEDING_GREEN } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "oz" ? "#FFFFFF" : FEEDING_GREEN }}
        >
          {t("feeding.oz")}
        </Text>
      </View>
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "ml" ? { backgroundColor: FEEDING_GREEN } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "ml" ? "#FFFFFF" : FEEDING_GREEN }}
        >
          {t("feeding.ml")}
        </Text>
      </View>
    </Pressable>
  );
}

interface QuickButtonProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function QuickButton({ label, isSelected, onPress }: QuickButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[56px] py-2 px-3 rounded-button-lg items-center active:scale-95"
      style={{
        backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {label}
      </Text>
    </Pressable>
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
