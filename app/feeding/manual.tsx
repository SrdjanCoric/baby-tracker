import { useCallback, useRef, useState, useMemo } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme } from "nativewind";
import { useFeeding, useBaby, useUnits, useTimeFormat } from "@/contexts";
import { useNotificationIntegration } from "@/hooks";
import { formatVolume, mlToOz, ozToMl } from "@/utils/volume";
import { te } from "@/utils/translate-errors";
import {
  validateManualBreastfeedingTimes,
  validateManualBottleFeeding,
} from "@/validators/feeding";
import { COMMON_FOODS } from "@/constants/foods";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { StartEndTimeSection } from "@/components/StartEndTimeSection";
import { formatTime as formatTimeUtil } from "@/utils/time";
import type { BreastSide, BottleContentType, SolidReaction } from "@/constants/activities";
import { ACTIVITY } from "@/constants/colors";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const QUICK_AMOUNTS_OZ = [1, 2, 3, 4, 5, 6];
const QUICK_AMOUNTS_ML = [30, 60, 90, 120, 150, 180];
const MINIMUM_BREASTFEEDING_MS = 60_000;
const MAXIMUM_BREASTFEEDING_MS = 2 * 60 * 60 * 1000;

type FeedingTab = "breast" | "bottle" | "solids";
type VolumeUnit = "ml" | "oz";
type FeedingTypeParam = "breastfeed" | "bottle" | "solids";

export default function ManualFeedingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    type?: FeedingTypeParam;
    onboardingActivity?: string;
  }>();
  const { selectedBaby } = useBaby();
  const { addFeeding, feedings } = useFeeding();
  const { volumeUnit } = useUnits();
  const { timeFormat } = useTimeFormat();
  const { scheduleReminderAfterFeeding } = useNotificationIntegration();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = {
    accent: isDark ? ACTIVITY.feeding.accentDark : ACTIVITY.feeding.accent,
    mutedBg: isDark ? ACTIVITY.feeding.mutedDark : ACTIVITY.feeding.muted,
    textOnMuted: isDark ? ACTIVITY.feeding.textAccentDark : ACTIVITY.feeding.textAccent,
  };

  // Map URL param to tab type
  const getInitialTab = (): FeedingTab => {
    if (params.type === "breastfeed") return "breast";
    if (params.type === "bottle") return "bottle";
    if (params.type === "solids") return "solids";
    return "breast";
  };

  const [activeTab, setActiveTab] = useState<FeedingTab>(getInitialTab);
  const isTypeFromParam = !!params.type;
  const [momentTime, setMomentTime] = useState(() => new Date());
  const [startTime, setStartTime] = useState(
    () => new Date(Date.now() - MINIMUM_BREASTFEEDING_MS)
  );
  const [endTime, setEndTime] = useState(() => new Date());
  const [endTimeTouched, setEndTimeTouched] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Breastfeeding state
  const [side, setSide] = useState<BreastSide | null>(null);

  // Bottle feeding state
  const [contentType, setContentType] = useState<BottleContentType | null>(
    null
  );
  const [amountMl, setAmountMl] = useState<number | null>(null);
  const [unit, setUnit] = useState<VolumeUnit>(volumeUnit);
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
  const isSavingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
      }
      if (selectedDate) {
        const newDateTime = new Date(momentTime);
        newDateTime.setFullYear(selectedDate.getFullYear());
        newDateTime.setMonth(selectedDate.getMonth());
        newDateTime.setDate(selectedDate.getDate());
        const boundaryNow = new Date();
        setMomentTime(newDateTime > boundaryNow ? boundaryNow : newDateTime);
      }
    },
    [momentTime]
  );

  const handleTimeChange = useCallback(
    (_event: unknown, selectedTime?: Date) => {
      if (Platform.OS === "android") {
        setShowTimePicker(false);
      }
      if (selectedTime) {
        const newDateTime = new Date(momentTime);
        newDateTime.setHours(
          selectedTime.getHours(),
          selectedTime.getMinutes(),
          0,
          0
        );
        const boundaryNow = new Date();
        setMomentTime(newDateTime > boundaryNow ? boundaryNow : newDateTime);
      }
    },
    [momentTime]
  );

  const handleDateTimeChange = useCallback(
    (_event: unknown, selectedDateTime?: Date) => {
      if (selectedDateTime) {
        setMomentTime(selectedDateTime);
      }
    },
    []
  );

  const handleEndTimeChange = useCallback((value: Date) => {
    setEndTimeTouched(true);
    setEndTime(value);
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

  const finishSave = useCallback(async () => {
    if (params.onboardingActivity === "first") {
      await NewOwnerOnboardingStorageService.markActivitySaved("feeding");
      router.replace("/onboarding/owner/saved");
      return;
    }
    router.replace("/(tabs)");
  }, [params.onboardingActivity, router]);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!selectedBaby) return;

    setErrors({});

    if (activeTab === "breast") {
      const validation = validateManualBreastfeedingTimes({
        type: "breast",
        startedAt: startTime,
        endedAt: endTime,
        side: side ?? undefined,
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      try {
        const durationSeconds = Math.floor(
          (endTime.getTime() - startTime.getTime()) / 1000
        );
        await addFeeding({
          babyId: selectedBaby.id,
          type: "breast",
          side: side!,
          startedAt: startTime,
          endedAt: endTime,
          durationSeconds,
          notes: notes || undefined,
        });
        await scheduleReminderAfterFeeding(startTime);
        await finishSave();
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    } else if (activeTab === "bottle") {
      const validation = validateManualBottleFeeding({
        type: "bottle",
        startedAt: momentTime,
        amountMl: amountMl ?? undefined,
        contentType: contentType ?? undefined,
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      try {
        await addFeeding({
          babyId: selectedBaby.id,
          type: "bottle",
          contentType: contentType!,
          amountMl: amountMl!,
          startedAt: momentTime,
          notes: notes || undefined,
        });
        await scheduleReminderAfterFeeding(momentTime);
        await finishSave();
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    } else if (activeTab === "solids") {
      // Validate solid food
      if (!foodType.trim()) {
        setErrors({ foodType: t("feeding.enterFoodValidation") });
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      try {
        await addFeeding({
          babyId: selectedBaby.id,
          type: "solid",
          foodType: foodType.trim(),
          reaction: reaction ?? undefined,
          startedAt: momentTime,
          notes: notes || undefined,
        });
        await scheduleReminderAfterFeeding(momentTime);
        await finishSave();
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    }
  }, [
    selectedBaby,
    activeTab,
    momentTime,
    startTime,
    endTime,
    side,
    contentType,
    amountMl,
    foodType,
    reaction,
    notes,
    addFeeding,
    scheduleReminderAfterFeeding,
    finishSave,
    t,
  ]);

  const startBounds = useCallback(() => {
    const boundaryNow = Date.now();
    const effectiveEndTimestamp = endTimeTouched
      ? endTime.getTime()
      : boundaryNow;
    return {
      minimumDate: new Date(
        effectiveEndTimestamp - MAXIMUM_BREASTFEEDING_MS
      ),
      maximumDate: new Date(
        Math.min(
          boundaryNow,
          effectiveEndTimestamp - MINIMUM_BREASTFEEDING_MS
        )
      ),
    };
  }, [endTime, endTimeTouched]);
  const endBounds = useCallback(() => {
    const boundaryNow = Date.now();
    const maximumTimestamp = Math.min(
      boundaryNow,
      startTime.getTime() + MAXIMUM_BREASTFEEDING_MS
    );
    return {
      minimumDate: new Date(
        startTime.getTime() + MINIMUM_BREASTFEEDING_MS
      ),
      maximumDate: new Date(maximumTimestamp),
    };
  }, [startTime]);

  const durationMs = endTime.getTime() - startTime.getTime();
  const now = new Date();

  const canSave =
    activeTab === "breast"
      ? side !== null &&
        durationMs >= MINIMUM_BREASTFEEDING_MS &&
        durationMs <= MAXIMUM_BREASTFEEDING_MS &&
        startTime <= now &&
        endTime <= now
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
    return <NoBabyScreen />;
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  const formatTime = (date: Date) => formatTimeUtil(date, timeFormat);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      {/* Header with drag handle */}
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="items-center pt-2 pb-3"
        testID="dismiss-keyboard"
      >
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {getScreenTitle()}
        </Text>
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
          {selectedBaby.name}
        </Text>
      </Pressable>

      {/* Tab Selector - only show when type not specified in URL */}
      {!isTypeFromParam && (
        <View className="px-6 mb-4">
          <View
            className="flex-row rounded-pill p-1"
            style={{ backgroundColor: colors.mutedBg }}
        >
          <TabButton
            label={t("feeding.breastfeedingTab")}
            isActive={activeTab === "breast"}
            onPress={() => setActiveTab("breast")}
            accentColor={colors.accent}
            textColor={colors.textOnMuted}
          />
          <TabButton
            label={t("feeding.bottleTab")}
            isActive={activeTab === "bottle"}
            onPress={() => setActiveTab("bottle")}
            accentColor={colors.accent}
            textColor={colors.textOnMuted}
          />
        </View>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "breast" ? (
          <StartEndTimeSection
            startTime={startTime}
            endTime={endTime}
            onStartTimeChange={setStartTime}
            onEndTimeChange={handleEndTimeChange}
            startBounds={startBounds}
            endBounds={endBounds}
            timeFormat={timeFormat}
            startLabel={t("feeding.startTime")}
            endLabel={t("feeding.endTime")}
            durationLabel={t("feeding.duration")}
            doneLabel={t("common.done")}
            selectDateLabel={t("feeding.selectDate")}
            selectTimeLabel={t("feeding.selectTime")}
            accentColor={colors.accent}
            mutedBackgroundColor={colors.mutedBg}
            textColor={colors.textOnMuted}
            startError={errors.startedAt ? te(t, errors.startedAt) : undefined}
            endError={errors.endedAt ? te(t, errors.endedAt) : undefined}
            durationError={
              errors.durationSeconds ? te(t, errors.durationSeconds) : undefined
            }
          />
        ) : (
          <>
            <View className="mb-6">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
                {t("feeding.startTime")}
              </Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() =>
                    Platform.OS === "ios"
                      ? setShowDateTimePicker(true)
                      : setShowDatePicker(true)
                  }
                  className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
                  style={{ backgroundColor: colors.mutedBg }}
                  accessibilityRole="button"
                  accessibilityLabel={t("feeding.selectDate")}
                >
                  <Text className="text-base" style={{ color: colors.textOnMuted }}>
                    {formatDate(momentTime)}
                  </Text>
                  <Text style={{ color: colors.accent }}>📅</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Platform.OS === "ios"
                      ? setShowDateTimePicker(true)
                      : setShowTimePicker(true)
                  }
                  className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
                  style={{ backgroundColor: colors.mutedBg }}
                  accessibilityRole="button"
                  accessibilityLabel={t("feeding.selectTime")}
                >
                  <Text className="text-base" style={{ color: colors.textOnMuted }}>
                    {formatTime(momentTime)}
                  </Text>
                  <Text style={{ color: colors.accent }}>🕐</Text>
                </Pressable>
              </View>
              {errors.startedAt && (
                <Text className="text-red-500 text-sm mt-2">
                  {te(t, errors.startedAt)}
                </Text>
              )}
            </View>

            {showDateTimePicker && Platform.OS === "ios" && (
              <View>
                <View className="flex-row justify-end px-2">
                  <Pressable
                    onPress={() => setShowDateTimePicker(false)}
                    className="py-1 px-3"
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.accent }}
                    >
                      {t("common.done")}
                    </Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={momentTime}
                  mode="datetime"
                  display="spinner"
                  onChange={handleDateTimeChange}
                  maximumDate={new Date()}
                />
              </View>
            )}

            {showDatePicker && Platform.OS === "android" && (
              <DateTimePicker
                value={momentTime}
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}

            {showTimePicker && Platform.OS === "android" && (
              <DateTimePicker
                value={momentTime}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )}
          </>
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
                  shortLabel={t("feeding.leftShort")}
                  isSelected={side === "left"}
                  onPress={() => setSide("left")}
                  accentColor={colors.accent}
                  mutedColor={colors.mutedBg}
                  textColor={colors.textOnMuted}
                />
                <SideButton
                  side="right"
                  label={t("feeding.rightSide")}
                  shortLabel={t("feeding.rightShort")}
                  isSelected={side === "right"}
                  onPress={() => setSide("right")}
                  accentColor={colors.accent}
                  mutedColor={colors.mutedBg}
                  textColor={colors.textOnMuted}
                />
              </View>
              <Pressable
                onPress={() => setSide("both")}
                className={`mt-3 py-3 rounded-button-lg items-center active:scale-[0.98]`}
                style={{
                  backgroundColor:
                    side === "both" ? colors.accent : colors.mutedBg,
                }}
                accessibilityRole="button"
                accessibilityLabel={t("feeding.bothSides")}
                accessibilityState={{ selected: side === "both" }}
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: side === "both" ? "#FFFFFF" : colors.textOnMuted }}
                >
                  {t("feeding.bothSides")}
                </Text>
              </Pressable>
              {errors.side && (
                <Text className="text-red-500 text-sm mt-2">{te(t, errors.side)}</Text>
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
                  accentColor={colors.accent}
                  mutedColor={colors.mutedBg}
                  textColor={colors.textOnMuted}
                />
                <ContentTypeButton
                  label={t("feeding.formula")}
                  emoji="🧪"
                  isSelected={contentType === "formula"}
                  onPress={() => setContentType("formula")}
                  accentColor={colors.accent}
                  mutedColor={colors.mutedBg}
                  textColor={colors.textOnMuted}
                />
              </View>
              {errors.contentType && (
                <Text className="text-red-500 text-sm mt-2">
                  {te(t, errors.contentType)}
                </Text>
              )}
            </View>

            {/* Amount Input */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
                  {t("feeding.amount")}
                </Text>
                <UnitToggle unit={unit} onToggle={handleUnitToggle} accentColor={colors.accent} mutedColor={colors.mutedBg} textColor={colors.textOnMuted} />
              </View>

              <View
                className="flex-row items-center rounded-card-lg px-4 py-3 mb-4"
                style={{ backgroundColor: colors.mutedBg }}
              >
                <TextInput
                  className="flex-1 text-2xl font-semibold text-center"
                  style={{ color: colors.textOnMuted }}
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
                  style={{ color: colors.accent }}
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
                      accentColor={colors.accent}
                      mutedColor={colors.mutedBg}
                      textColor={colors.textOnMuted}
                    />
                  )
                )}
              </View>
              {errors.amountMl && (
                <Text className="text-red-500 text-sm mt-2">
                  {te(t, errors.amountMl)}
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
                style={{ backgroundColor: colors.mutedBg }}
              >
                <TextInput
                  className="flex-1"
                  style={{ fontSize: 16, lineHeight: 20, paddingBottom: 6, paddingTop: 6, color: colors.textOnMuted }}
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
                    accentColor={colors.accent}
                    mutedColor={colors.mutedBg}
                    textColor={colors.textOnMuted}
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
                  accentColor={colors.accent}
                  mutedColor={colors.mutedBg}
                  textColor={colors.textOnMuted}
                />
                <ReactionButton
                  reaction="meh"
                  emoji="😐"
                  label={t("feeding.meh")}
                  isSelected={reaction === "meh"}
                  onPress={() => handleReactionSelect("meh")}
                  accentColor={colors.accent}
                  mutedColor={colors.mutedBg}
                  textColor={colors.textOnMuted}
                />
                <ReactionButton
                  reaction="refused"
                  emoji="😣"
                  label={t("feeding.refused")}
                  isSelected={reaction === "refused"}
                  onPress={() => handleReactionSelect("refused")}
                  accentColor={colors.accent}
                  mutedColor={colors.mutedBg}
                  textColor={colors.textOnMuted}
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
          style={{ backgroundColor: colors.accent }}
          accessibilityRole="button"
          accessibilityLabel={getSaveButtonLabel()}
          accessibilityState={{ disabled: !canSave || isSaving }}
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : getSaveButtonLabel()}
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  accentColor: string;
  textColor: string;
}

function TabButton({ label, isActive, onPress, accentColor, textColor }: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 py-3 rounded-pill items-center active:scale-95"
      style={isActive ? { backgroundColor: accentColor } : undefined}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isActive ? "#FFFFFF" : textColor }}
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
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function SideButton({
  label,
  shortLabel,
  isSelected,
  onPress,
  accentColor,
  mutedColor,
  textColor,
}: SideButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-5 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSelected ? accentColor : mutedColor,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-3xl font-bold mb-1"
        style={{ color: isSelected ? "#FFFFFF" : textColor }}
      >
        {shortLabel}
      </Text>
      <Text
        className="text-base font-medium"
        style={{ color: isSelected ? "#FFFFFF" : textColor }}
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
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function ContentTypeButton({
  label,
  emoji,
  isSelected,
  onPress,
  accentColor,
  mutedColor,
  textColor,
}: ContentTypeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-4 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSelected ? accentColor : mutedColor,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text className="text-3xl mb-2">{emoji}</Text>
      <Text
        className="text-base font-medium"
        style={{ color: isSelected ? "#FFFFFF" : textColor }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface UnitToggleProps {
  unit: VolumeUnit;
  onToggle: () => void;
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function UnitToggle({ unit, onToggle, accentColor, mutedColor, textColor }: UnitToggleProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onToggle}
      className="flex-row rounded-pill p-1"
      style={{ backgroundColor: mutedColor }}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${unit === "oz" ? "milliliters" : "ounces"}`}
    >
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "oz" ? { backgroundColor: accentColor } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "oz" ? "#FFFFFF" : textColor }}
        >
          {t("feeding.oz")}
        </Text>
      </View>
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "ml" ? { backgroundColor: accentColor } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "ml" ? "#FFFFFF" : textColor }}
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
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function QuickButton({ label, isSelected, onPress, accentColor, mutedColor, textColor }: QuickButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[56px] py-2 px-3 rounded-button-lg items-center active:scale-95"
      style={{
        backgroundColor: isSelected ? accentColor : mutedColor,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isSelected ? "#FFFFFF" : textColor }}
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
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function FoodButton({ label, isSelected, onPress, accentColor, mutedColor, textColor }: FoodButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="py-2 px-4 rounded-button-lg active:scale-95"
      style={{
        backgroundColor: isSelected ? accentColor : mutedColor,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-base font-medium"
        style={{ color: isSelected ? "#FFFFFF" : textColor }}
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
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function ReactionButton({ emoji, label, isSelected, onPress, accentColor, mutedColor, textColor }: ReactionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-4 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSelected ? accentColor : mutedColor,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text className="text-2xl mb-1">{emoji}</Text>
      <Text
        className="text-sm font-semibold"
        style={{ color: isSelected ? "#FFFFFF" : textColor }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
