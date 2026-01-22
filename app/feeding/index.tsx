import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFeeding, useBaby, useUnits } from "@/contexts";
import type { CreateFeedingInput, StoredFeedingEntry } from "@/services/feeding-storage";
import { formatDuration } from "@/utils/time";
import { formatVolume, mlToOz, ozToMl } from "@/utils/volume";
import { getLastFeedingType, feedingTypeToTab } from "@/utils/feeding";
import { COMMON_FOODS } from "@/constants/foods";
import type { BreastSide, BottleContentType, SolidReaction } from "@/constants/activities";

const FEEDING_GREEN = "#88B04B";
const FEEDING_GREEN_MUTED = "#E8F0E0";
const FEEDING_GREEN_DARK = "#6A9030";

type FeedingTab = "breast" | "bottle" | "solids";

const QUICK_AMOUNTS_OZ = [1, 2, 3, 4, 5, 6];
const QUICK_AMOUNTS_ML = [30, 60, 90, 120, 150, 180];

type VolumeUnit = "ml" | "oz";

export default function FeedingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const {
    activeTimer,
    suggestedSide,
    startBreastfeeding,
    stopBreastfeeding,
    changeSide,
    addFeeding,
    feedings,
  } = useFeeding();

  const [tick, setTick] = useState(0);

  const [activeTab, setActiveTab] = useState<FeedingTab>(() => {
    const lastType = getLastFeedingType(feedings);
    return lastType ? feedingTypeToTab(lastType) : "breast";
  });

  // Timer tick for breastfeeding
  useEffect(() => {
    if (!activeTimer?.isRunning) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.isRunning]);

  const elapsedSeconds = useMemo(() => {
    if (!activeTimer?.isRunning) return 0;
    void tick;
    const now = new Date();
    return Math.floor((now.getTime() - activeTimer.startTime.getTime()) / 1000);
  }, [activeTimer, tick]);

  const handleTabChange = useCallback((tab: FeedingTab) => {
    setActiveTab(tab);
  }, []);

  const handleLogPast = useCallback(() => {
    router.push(`/feeding/manual?type=${activeTab === "breast" ? "breastfeed" : activeTab}`);
  }, [router, activeTab]);

  // Breastfeeding handlers
  const handleStartBreastfeeding = useCallback(async (side: BreastSide) => {
    await startBreastfeeding(side);
  }, [startBreastfeeding]);

  const handleStopBreastfeeding = useCallback(async () => {
    await stopBreastfeeding();
    router.back();
  }, [stopBreastfeeding, router]);

  const handleSideChange = useCallback((side: BreastSide) => {
    changeSide(side);
  }, [changeSide]);

  if (!selectedBaby) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.noBabySelected")}
        </Text>
      </SafeAreaView>
    );
  }


  const isTimerRunning = activeTimer?.isRunning ?? false;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      {/* Header with drag handle */}
      <View className="items-center pt-2 pb-3">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("feeding.title")}
        </Text>
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
          {selectedBaby.name}
        </Text>
      </View>

      {/* Tab Bar */}
      {!isTimerRunning && (
        <View className="px-4 mb-4">
          <View
            className="flex-row rounded-card-lg p-1"
            style={{ backgroundColor: FEEDING_GREEN_MUTED }}
          >
            <TabButton
              label={t("feeding.breastfeedingTab")}
              emoji="🤱"
              isActive={activeTab === "breast"}
              onPress={() => handleTabChange("breast")}
            />
            <TabButton
              label={t("feeding.bottleTab")}
              emoji="🍼"
              isActive={activeTab === "bottle"}
              onPress={() => handleTabChange("bottle")}
            />
            <TabButton
              label={t("feeding.solidFood")}
              emoji="🥣"
              isActive={activeTab === "solids"}
              onPress={() => handleTabChange("solids")}
            />
          </View>
        </View>
      )}

      {/* Content based on active tab */}
      {activeTab === "breast" && (
        isTimerRunning ? (
          <BreastfeedingTimerView
            elapsedSeconds={elapsedSeconds}
            side={activeTimer?.side}
            onSideChange={handleSideChange}
            onStop={handleStopBreastfeeding}
          />
        ) : (
          <BreastfeedingForm
            suggestedSide={suggestedSide}
            onSelectSide={handleStartBreastfeeding}
            onLogPast={handleLogPast}
          />
        )
      )}

      {activeTab === "bottle" && !isTimerRunning && (
        <BottleForm
          selectedBaby={selectedBaby}
          addFeeding={addFeeding}
          onLogPast={handleLogPast}
          onComplete={() => router.back()}
        />
      )}

      {activeTab === "solids" && !isTimerRunning && (
        <SolidsForm
          selectedBaby={selectedBaby}
          addFeeding={addFeeding}
          feedings={feedings}
          onLogPast={handleLogPast}
          onComplete={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}

// Tab Button Component
interface TabButtonProps {
  label: string;
  emoji: string;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ label, emoji, isActive, onPress }: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center py-3 rounded-card active:opacity-80"
      style={isActive ? { backgroundColor: FEEDING_GREEN } : undefined}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text className="text-lg mr-1">{emoji}</Text>
      <Text
        className="text-sm font-semibold"
        style={{ color: isActive ? "#FFFFFF" : FEEDING_GREEN_DARK }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ============ BREASTFEEDING COMPONENTS ============

interface BreastfeedingFormProps {
  suggestedSide: BreastSide;
  onSelectSide: (side: BreastSide) => void;
  onLogPast: () => void;
}

function BreastfeedingForm({ suggestedSide, onSelectSide, onLogPast }: BreastfeedingFormProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="items-center w-full">
        {/* Illustration */}
        <View
          className="w-28 h-28 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: FEEDING_GREEN_MUTED }}
        >
          <Text className="text-5xl">🤱</Text>
        </View>

        {/* Title */}
        <Text className="text-xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
          {t("feeding.startBreastfeeding")}
        </Text>
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-8 text-center">
          {t("feeding.selectSideToStart")}
        </Text>

        {/* Side Selection Buttons */}
        <View className="flex-row gap-4 mb-4 w-full">
          <SideButton
            side="left"
            label={t("feeding.leftSide")}
            shortLabel="L"
            isSuggested={suggestedSide === "left"}
            onPress={() => onSelectSide("left")}
          />
          <SideButton
            side="right"
            label={t("feeding.rightSide")}
            shortLabel="R"
            isSuggested={suggestedSide === "right"}
            onPress={() => onSelectSide("right")}
          />
        </View>

        {/* Both Sides Option */}
        <Pressable
          onPress={() => onSelectSide("both")}
          className="py-3 px-6 rounded-button-lg active:scale-[0.98]"
          style={{ backgroundColor: FEEDING_GREEN_MUTED }}
          accessibilityRole="button"
        >
          <Text style={{ color: FEEDING_GREEN }} className="text-base font-semibold">
            {t("feeding.bothSides")}
          </Text>
        </Pressable>

        {/* Suggestion hint */}
        {suggestedSide !== "both" && (
          <View className="flex-row items-center mt-6">
            <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: FEEDING_GREEN }} />
            <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
              {t("feeding.suggestedSideHint", { side: suggestedSide === "left" ? t("feeding.left") : t("feeding.right") })}
            </Text>
          </View>
        )}

        {/* Log Past Button */}
        <Pressable
          onPress={onLogPast}
          className="mt-8 py-3 px-6 rounded-button-lg active:opacity-70"
          style={{ backgroundColor: FEEDING_GREEN_MUTED }}
          accessibilityRole="button"
        >
          <Text className="text-base font-medium" style={{ color: FEEDING_GREEN }}>
            {t("feeding.logPastBreastfeeding")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

interface SideButtonProps {
  side: "left" | "right";
  label: string;
  shortLabel: string;
  isSuggested: boolean;
  onPress: () => void;
}

function SideButton({ label, shortLabel, isSuggested, onPress }: SideButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-5 rounded-card-lg active:scale-[0.97]"
      style={{ backgroundColor: isSuggested ? FEEDING_GREEN : FEEDING_GREEN_MUTED }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${isSuggested ? `, ${t("feeding.suggested")}` : ""}`}
    >
      <Text
        className="text-3xl font-bold mb-1"
        style={{ color: isSuggested ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {shortLabel}
      </Text>
      <Text
        className="text-sm font-medium"
        style={{ color: isSuggested ? "#FFFFFF" : FEEDING_GREEN_DARK }}
      >
        {label}
      </Text>
      {isSuggested && (
        <View className="bg-white/20 px-2 py-0.5 rounded-pill mt-1">
          <Text className="text-xs font-semibold text-white">{t("feeding.suggested")}</Text>
        </View>
      )}
    </Pressable>
  );
}

interface BreastfeedingTimerViewProps {
  elapsedSeconds: number;
  side?: BreastSide;
  onSideChange: (side: BreastSide) => void;
  onStop: () => void;
}

function BreastfeedingTimerView({ elapsedSeconds, side, onSideChange, onStop }: BreastfeedingTimerViewProps) {
  const { t } = useTranslation();
  const formattedTime = formatDuration(elapsedSeconds);

  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="items-center w-full">
        {/* Activity indicator */}
        <View className="flex-row items-center mb-4">
          <Text className="text-4xl mr-3">🤱</Text>
          <Text style={{ color: FEEDING_GREEN }} className="text-lg font-semibold">
            {t("feeding.breastfeeding")}
          </Text>
        </View>

        {/* Side selector */}
        <View className="flex-row rounded-pill p-1 mb-8" style={{ backgroundColor: FEEDING_GREEN_MUTED }}>
          <CompactSideButton label="L" fullLabel={t("feeding.left")} isSelected={side === "left"} onPress={() => onSideChange("left")} />
          <CompactSideButton label="B" fullLabel={t("feeding.both")} isSelected={side === "both"} onPress={() => onSideChange("both")} />
          <CompactSideButton label="R" fullLabel={t("feeding.right")} isSelected={side === "right"} onPress={() => onSideChange("right")} />
        </View>

        {/* Timer display */}
        <View className="px-12 py-8 rounded-card-lg mb-8" style={{ backgroundColor: FEEDING_GREEN_MUTED }}>
          <Text
            className="text-timer-xl text-center font-bold tracking-tight"
            style={{ color: FEEDING_GREEN }}
            accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
          >
            {formattedTime}
          </Text>
        </View>

        {/* Status indicator */}
        <View className="flex-row items-center mb-10">
          <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: FEEDING_GREEN }} />
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
            {t("feeding.timerRunning")}
          </Text>
        </View>

        {/* Stop button */}
        <Pressable
          onPress={onStop}
          className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
          style={{ backgroundColor: FEEDING_GREEN }}
          accessibilityRole="button"
          accessibilityLabel={t("common.stopTimer")}
        >
          <Text className="text-3xl text-white">⏹</Text>
        </Pressable>

        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
          {t("feeding.tapToStop")}
        </Text>
      </View>
    </View>
  );
}

interface CompactSideButtonProps {
  label: string;
  fullLabel: string;
  isSelected: boolean;
  onPress: () => void;
}

function CompactSideButton({ label, fullLabel, isSelected, onPress }: CompactSideButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[64px] min-h-[48px] rounded-pill items-center justify-center px-4 active:scale-95"
      style={isSelected ? { backgroundColor: FEEDING_GREEN } : undefined}
      accessibilityRole="button"
      accessibilityLabel={fullLabel}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className={`text-base font-semibold ${isSelected ? "text-white" : ""}`}
        style={!isSelected ? { color: FEEDING_GREEN } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ============ BOTTLE COMPONENTS ============

interface BottleFormProps {
  selectedBaby: { id: string; name: string };
  addFeeding: (input: CreateFeedingInput) => Promise<StoredFeedingEntry>;
  onLogPast: () => void;
  onComplete: () => void;
}

function BottleForm({ selectedBaby, addFeeding, onLogPast, onComplete }: BottleFormProps) {
  const { t } = useTranslation();
  const { volumeUnit } = useUnits();

  const [contentType, setContentType] = useState<BottleContentType | null>(null);
  const [amountMl, setAmountMl] = useState<number | null>(null);
  const [unit, setUnit] = useState<VolumeUnit>(volumeUnit);
  const [inputValue, setInputValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const handleQuickAmountSelect = useCallback((amount: number) => {
    if (unit === "oz") {
      setAmountMl(ozToMl(amount));
      setInputValue(amount.toString());
    } else {
      setAmountMl(amount);
      setInputValue(amount.toString());
    }
    setShowValidation(false);
    Keyboard.dismiss();
  }, [unit]);

  const handleInputChange = useCallback((text: string) => {
    setInputValue(text);
    const value = parseFloat(text);
    if (!isNaN(value) && value > 0) {
      setAmountMl(unit === "oz" ? ozToMl(value) : value);
      setShowValidation(false);
    } else {
      setAmountMl(null);
    }
  }, [unit]);

  const handleUnitToggle = useCallback(() => {
    if (amountMl !== null) {
      setInputValue(unit === "oz" ? Math.round(amountMl).toString() : mlToOz(amountMl).toString());
    }
    setUnit((prev) => (prev === "oz" ? "ml" : "oz"));
  }, [unit, amountMl]);

  const handleSave = useCallback(async () => {
    if (!contentType || !amountMl || amountMl <= 0) {
      setShowValidation(true);
      return;
    }

    setIsSaving(true);
    try {
      await addFeeding({
        babyId: selectedBaby.id,
        type: "bottle",
        contentType,
        amountMl,
        startedAt: new Date(),
        notes: notes || undefined,
      });
      onComplete();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, contentType, amountMl, notes, addFeeding, onComplete]);

  const validationMessage = useMemo(() => {
    if (!showValidation) return null;
    if (!contentType && (!amountMl || amountMl <= 0)) return t("feeding.selectContentAndAmount");
    if (!contentType) return t("feeding.selectContentType");
    if (!amountMl || amountMl <= 0) return t("feeding.enterAmountValidation");
    return null;
  }, [showValidation, contentType, amountMl, t]);

  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-6" keyboardShouldPersistTaps="handled">
        {/* Illustration */}
        <View className="items-center mt-2 mb-4">
          <View className="w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: FEEDING_GREEN_MUTED }}>
            <Text className="text-4xl">🍼</Text>
          </View>
        </View>

        {/* Content Type Selection */}
        <View className="mb-5">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.selectContentType")}
          </Text>
          <View className="flex-row gap-3">
            <ContentTypeButton
              label={t("feeding.breastMilk")}
              emoji="🤱"
              isSelected={contentType === "breastMilk"}
              onPress={() => { setContentType("breastMilk"); setShowValidation(false); }}
            />
            <ContentTypeButton
              label={t("feeding.formula")}
              emoji="🧪"
              isSelected={contentType === "formula"}
              onPress={() => { setContentType("formula"); setShowValidation(false); }}
            />
          </View>
        </View>

        {/* Amount Input */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
              {t("feeding.amount")}
            </Text>
            <UnitToggle unit={unit} onToggle={handleUnitToggle} />
          </View>

          <View className="flex-row items-center rounded-card-lg px-4 py-3 mb-3" style={{ backgroundColor: FEEDING_GREEN_MUTED }}>
            <TextInput
              className="flex-1 text-2xl font-semibold text-center"
              style={{ color: FEEDING_GREEN_DARK }}
              value={inputValue}
              onChangeText={handleInputChange}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <Text className="text-lg font-medium ml-2" style={{ color: FEEDING_GREEN }}>{unit}</Text>
          </View>

          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("feeding.quickAmounts")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(unit === "oz" ? QUICK_AMOUNTS_OZ : QUICK_AMOUNTS_ML).map((amount) => (
              <QuickAmountButton
                key={amount}
                amount={amount}
                isSelected={unit === "oz" ? amountMl !== null && Math.abs(ozToMl(amount) - amountMl) < 1 : amountMl === amount}
                onPress={() => handleQuickAmountSelect(amount)}
              />
            ))}
          </View>
        </View>

        {/* Notes */}
        <View className="mb-4">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("common.notes")}
          </Text>
          <TextInput
            className="rounded-card-lg px-4 py-3 text-base bg-surface-secondary dark:bg-surface-dark-secondary text-content-primary dark:text-content-dark-primary"
            value={notes}
            onChangeText={setNotes}
            placeholder={t("feeding.notesPlaceholder")}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            style={{ minHeight: 60 }}
          />
        </View>

        {/* Amount preview */}
        {amountMl !== null && amountMl > 0 && (
          <View className="items-center mb-4">
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {formatVolume(amountMl, "ml")} = {formatVolume(amountMl, "oz")}
            </Text>
          </View>
        )}

        {/* Log Past Button */}
        <View className="items-center mt-4 mb-6">
          <Pressable onPress={onLogPast} className="py-3 px-6 rounded-button-lg active:opacity-70" style={{ backgroundColor: FEEDING_GREEN_MUTED }}>
            <Text className="text-base font-medium" style={{ color: FEEDING_GREEN }}>{t("feeding.logPastBottle")}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Save Button */}
      <View className="px-6 pb-6 pt-3 bg-surface dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800">
        {validationMessage && (
          <View className="mb-3 items-center">
            <Text className="text-sm text-amber-600 dark:text-amber-400 text-center">{validationMessage}</Text>
          </View>
        )}
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${isSaving ? "opacity-50" : ""}`}
          style={{ backgroundColor: FEEDING_GREEN }}
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : t("feeding.logBottleFeeding")}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

interface ContentTypeButtonProps {
  label: string;
  emoji: string;
  isSelected: boolean;
  onPress: () => void;
}

function ContentTypeButton({ label, emoji, isSelected, onPress }: ContentTypeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-4 rounded-card-lg active:scale-[0.97]"
      style={{ backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED }}
    >
      <Text className="text-3xl mb-2">{emoji}</Text>
      <Text className="text-base font-medium" style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN_DARK }}>
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
    <Pressable onPress={onToggle} className="flex-row rounded-pill p-1" style={{ backgroundColor: FEEDING_GREEN_MUTED }}>
      <View className="px-3 py-1 rounded-pill" style={unit === "oz" ? { backgroundColor: FEEDING_GREEN } : undefined}>
        <Text className="text-sm font-semibold" style={{ color: unit === "oz" ? "#FFFFFF" : FEEDING_GREEN }}>{t("feeding.oz")}</Text>
      </View>
      <View className="px-3 py-1 rounded-pill" style={unit === "ml" ? { backgroundColor: FEEDING_GREEN } : undefined}>
        <Text className="text-sm font-semibold" style={{ color: unit === "ml" ? "#FFFFFF" : FEEDING_GREEN }}>{t("feeding.ml")}</Text>
      </View>
    </Pressable>
  );
}

interface QuickAmountButtonProps {
  amount: number;
  isSelected: boolean;
  onPress: () => void;
}

function QuickAmountButton({ amount, isSelected, onPress }: QuickAmountButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[56px] py-2 px-3 rounded-button-lg items-center active:scale-95"
      style={{ backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED }}
    >
      <Text className="text-base font-semibold" style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN }}>
        {amount}
      </Text>
    </Pressable>
  );
}

// ============ SOLIDS COMPONENTS ============

interface SolidsFormProps {
  selectedBaby: { id: string; name: string };
  addFeeding: (input: CreateFeedingInput) => Promise<StoredFeedingEntry>;
  feedings: Array<{ type: string; foodType?: string; startedAt: string | Date }>;
  onLogPast: () => void;
  onComplete: () => void;
}

function SolidsForm({ selectedBaby, addFeeding, feedings, onLogPast, onComplete }: SolidsFormProps) {
  const { t } = useTranslation();

  const [foodType, setFoodType] = useState("");
  const [reaction, setReaction] = useState<SolidReaction | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const recentFoods = useMemo(() => {
    const solidFeedings = feedings
      .filter((f) => f.type === "solid" && f.foodType)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

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
    return recentFoods.length > 0 ? recentFoods : COMMON_FOODS.slice(0, 8);
  }, [recentFoods]);

  const getFoodLabel = (food: string): string => {
    const foodLabels: Record<string, string> = {
      banana: t("foods.banana"), avocado: t("foods.avocado"), apple: t("foods.apple"),
      pear: t("foods.pear"), mango: t("foods.mango"), peach: t("foods.peach"),
      blueberries: t("foods.blueberries"), strawberries: t("foods.strawberries"),
      sweetPotato: t("foods.sweetPotato"), carrot: t("foods.carrot"), peas: t("foods.peas"),
      broccoli: t("foods.broccoli"), zucchini: t("foods.zucchini"), spinach: t("foods.spinach"),
      butternutSquash: t("foods.butternutSquash"), greenBeans: t("foods.greenBeans"),
      chicken: t("foods.chicken"), turkey: t("foods.turkey"), beef: t("foods.beef"),
      egg: t("foods.egg"), tofu: t("foods.tofu"), lentils: t("foods.lentils"),
      salmon: t("foods.salmon"), oatmeal: t("foods.oatmeal"), rice: t("foods.rice"),
      pasta: t("foods.pasta"), bread: t("foods.bread"), cereal: t("foods.cereal"),
      yogurt: t("foods.yogurt"), cheese: t("foods.cheese"),
    };
    return foodLabels[food] || food.charAt(0).toUpperCase() + food.slice(1).replace(/([A-Z])/g, " $1");
  };

  const handleSave = useCallback(async () => {
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
      onComplete();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, foodType, reaction, notes, addFeeding, onComplete]);

  const validationMessage = useMemo(() => {
    if (!showValidation) return null;
    if (!foodType.trim()) return t("feeding.enterFoodValidation");
    return null;
  }, [showValidation, foodType, t]);

  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-6" keyboardShouldPersistTaps="handled">
        {/* Illustration */}
        <View className="items-center mt-2 mb-4">
          <View className="w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: FEEDING_GREEN_MUTED }}>
            <Text className="text-4xl">🥣</Text>
          </View>
        </View>

        {/* Food Selection */}
        <View className="mb-5">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("feeding.selectFood")}
          </Text>

          <View className="flex-row items-center min-h-[48px] px-4 rounded-2xl mb-3" style={{ backgroundColor: FEEDING_GREEN_MUTED }}>
            <TextInput
              className="flex-1"
              style={{ fontSize: 16, lineHeight: 20, paddingVertical: 6, color: FEEDING_GREEN_DARK }}
              value={foodType}
              onChangeText={(text) => { setFoodType(text); if (text.trim()) setShowValidation(false); }}
              placeholder={t("feeding.foodPlaceholder")}
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
            />
          </View>

          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {recentFoods.length > 0 ? t("feeding.recentFoods") : t("feeding.commonFoods")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {suggestedFoods.map((food) => (
              <FoodButton
                key={food}
                label={getFoodLabel(food)}
                isSelected={foodType === food}
                onPress={() => { setFoodType(food); setShowValidation(false); Keyboard.dismiss(); }}
              />
            ))}
          </View>
        </View>

        {/* Reaction Selection */}
        <View className="mb-5">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.howDidBabyLikeIt")}
          </Text>
          <View className="flex-row gap-3">
            <ReactionButton emoji="😍" label={t("feeding.loved")} isSelected={reaction === "loved"} onPress={() => setReaction("loved")} />
            <ReactionButton emoji="😐" label={t("feeding.meh")} isSelected={reaction === "meh"} onPress={() => setReaction("meh")} />
            <ReactionButton emoji="😣" label={t("feeding.refused")} isSelected={reaction === "refused"} onPress={() => setReaction("refused")} />
          </View>
        </View>

        {/* Notes */}
        <View className="mb-4">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("common.notes")}
          </Text>
          <TextInput
            className="rounded-card-lg px-4 py-3 text-base bg-surface-secondary dark:bg-surface-dark-secondary text-content-primary dark:text-content-dark-primary"
            value={notes}
            onChangeText={setNotes}
            placeholder={t("feeding.notesPlaceholder")}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            style={{ minHeight: 60 }}
          />
        </View>

        {/* Log Past Button */}
        <View className="items-center mt-4 mb-6">
          <Pressable onPress={onLogPast} className="py-3 px-6 rounded-button-lg active:opacity-70" style={{ backgroundColor: FEEDING_GREEN_MUTED }}>
            <Text className="text-base font-medium" style={{ color: FEEDING_GREEN }}>{t("feeding.logPastSolid")}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Save Button */}
      <View className="px-6 pb-6 pt-3 bg-surface dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800">
        {validationMessage && (
          <View className="mb-3 items-center">
            <Text className="text-sm text-amber-600 dark:text-amber-400 text-center">{validationMessage}</Text>
          </View>
        )}
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${isSaving ? "opacity-50" : ""}`}
          style={{ backgroundColor: FEEDING_GREEN }}
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : t("feeding.logSolidFeeding")}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

interface FoodButtonProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function FoodButton({ label, isSelected, onPress }: FoodButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="py-2 px-4 rounded-button-lg active:scale-95"
      style={{ backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED }}
    >
      <Text className="text-base font-medium" style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN }}>
        {label}
      </Text>
    </Pressable>
  );
}

interface ReactionButtonProps {
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
      style={{ backgroundColor: isSelected ? FEEDING_GREEN : FEEDING_GREEN_MUTED }}
    >
      <Text className="text-2xl mb-1">{emoji}</Text>
      <Text className="text-sm font-semibold" style={{ color: isSelected ? "#FFFFFF" : FEEDING_GREEN_DARK }}>
        {label}
      </Text>
    </Pressable>
  );
}
