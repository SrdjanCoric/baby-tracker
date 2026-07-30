import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useDiaper } from "@/contexts/diaper-context";
import { useBaby } from "@/contexts";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import type { DiaperType, StoolColor } from "@/constants/activities";
import { STOOL_COLORS } from "@/constants/activities";
import { ACTIVITY, TEXT, SURFACE } from "@/constants/colors";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const DIAPER_ACCENT = ACTIVITY.diaper.accent;
const DIAPER_ACCENT_DARK = ACTIVITY.diaper.accentDark;
const DIAPER_BUTTON = ACTIVITY.diaper.button;
const DIAPER_BUTTON_DARK = ACTIVITY.diaper.buttonDark;

const STOOL_COLOR_MAP: Record<StoolColor, string> = {
  yellow: "#F4D03F",
  brown: "#8B4513",
  green: "#228B22",
  orange: "#FF8C00",
  black: "#2C2C2C",
  white: "#F5F5DC",
  red: "#CD5C5C",
};

export default function DiaperScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onboardingActivity } = useLocalSearchParams<{ onboardingActivity?: string }>();
  const { selectedBaby } = useBaby();
  const { addDiaper } = useDiaper();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const accentColor = isDark ? DIAPER_ACCENT_DARK : DIAPER_ACCENT;
  const buttonBgColor = isDark ? DIAPER_BUTTON_DARK : DIAPER_BUTTON;
  const linkTextColor = isDark ? DIAPER_ACCENT_DARK : DIAPER_BUTTON;
  const secondaryBg = isDark ? SURFACE.dark.cardElevated : SURFACE.light.secondary;
  const textColor = isDark ? TEXT.dark.primary : TEXT.light.primary;

  const [selectedType, setSelectedType] = useState<DiaperType | null>(null);
  const [selectedColor, setSelectedColor] = useState<StoolColor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const handleTypeSelect = useCallback((type: DiaperType) => {
    setSelectedType(type);
    if (type === "wet" || type === "dry") {
      setSelectedColor(null);
    }
  }, []);

  const handleColorSelect = useCallback((color: StoolColor) => {
    setSelectedColor(color);
  }, []);

  const handleLogPastDiaper = useCallback(() => {
    router.push(onboardingActivity === "first"
      ? "/diaper/manual?onboardingActivity=first"
      : "/diaper/manual");
  }, [onboardingActivity, router]);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!selectedBaby || !selectedType) return;

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await addDiaper({
        babyId: selectedBaby.id,
        type: selectedType,
        stoolColor: selectedType !== "wet" ? selectedColor ?? undefined : undefined,
        changedAt: new Date(),
      });
      if (onboardingActivity === "first") {
        await NewOwnerOnboardingStorageService.markActivitySaved("diaper");
        router.replace("/onboarding/owner/saved");
      } else {
        router.back();
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [selectedBaby, selectedType, selectedColor, addDiaper, onboardingActivity, router]);

  const canSave = selectedType !== null && !isSaving;

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="diaper-screen">
      {/* Header with drag handle */}
      <View className="items-center pt-2 pb-3">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("diaper.logDiaperChange")}
        </Text>
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
          {selectedBaby.name}
        </Text>
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
        {/* Illustration/Icon */}
        <View className="items-center mb-6">
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: secondaryBg }}
          >
            <Text className="text-5xl">🚼</Text>
          </View>
        </View>

        {/* Diaper Type Selection */}
        <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
          {t("diaper.selectType")}
        </Text>

        <View className="gap-3 mb-6">
          <DiaperTypeButton
            type="wet"
            label={t("diaper.wet")}
            description={t("diaper.wetOnly")}
            icon="💧"
            isSelected={selectedType === "wet"}
            onPress={() => handleTypeSelect("wet")}
            accentColor={accentColor}
            secondaryBg={secondaryBg}
            textColor={textColor}
            isDark={isDark}
          />
          <DiaperTypeButton
            type="dirty"
            label={t("diaper.dirty")}
            description={t("diaper.dirtyOnly")}
            icon="💩"
            isSelected={selectedType === "dirty"}
            onPress={() => handleTypeSelect("dirty")}
            accentColor={accentColor}
            secondaryBg={secondaryBg}
            textColor={textColor}
            isDark={isDark}
          />
          <DiaperTypeButton
            type="mixed"
            label={t("diaper.mixed")}
            description={t("diaper.mixedType")}
            icon="💧💩"
            isSelected={selectedType === "mixed"}
            onPress={() => handleTypeSelect("mixed")}
            accentColor={accentColor}
            secondaryBg={secondaryBg}
            textColor={textColor}
            isDark={isDark}
          />
          <DiaperTypeButton
            type="dry"
            label={t("diaper.dry")}
            description={t("diaper.dryOnly")}
            icon="✨"
            isSelected={selectedType === "dry"}
            onPress={() => handleTypeSelect("dry")}
            accentColor={accentColor}
            secondaryBg={secondaryBg}
            textColor={textColor}
            isDark={isDark}
          />
        </View>

        {/* Stool Color Selection (only for dirty/mixed) */}
        {(selectedType === "dirty" || selectedType === "mixed") && (
          <>
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
              {t("diaper.selectColor")} <Text className="text-content-tertiary dark:text-content-dark-tertiary font-normal">({t("diaper.optionalColor").toLowerCase()})</Text>
            </Text>

            <View className="flex-row flex-wrap gap-3 mb-6">
              {STOOL_COLORS.map(color => (
                <StoolColorButton
                  key={color}
                  color={color}
                  label={t(`stoolColors.${color}`)}
                  hexColor={STOOL_COLOR_MAP[color]}
                  isSelected={selectedColor === color}
                  onPress={() => handleColorSelect(color)}
                  accentColor={accentColor}
                  textColor={textColor}
                />
              ))}
            </View>
          </>
        )}

        {/* Log Past Diaper Link */}
        <Pressable
          onPress={handleLogPastDiaper}
          className="py-3 px-6 rounded-button-lg active:opacity-70 self-center mb-6"
          style={{ backgroundColor: secondaryBg }}
          accessibilityRole="button"
          accessibilityLabel={t("diaper.logPastDiaper")}
        >
          <Text className="text-lg font-semibold" style={{ color: linkTextColor }}>
            {t("diaper.logPastDiaper")}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Save Button */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
            !canSave ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: buttonBgColor }}
          accessibilityRole="button"
          accessibilityLabel={t("diaper.logDiaper")}
          testID="save-button"
        >
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700", fontFamily: "System" }}>
            {isSaving ? t("common.loading") : t("diaper.logDiaper")}
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface DiaperTypeButtonProps {
  type: DiaperType;
  label: string;
  description: string;
  icon: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  secondaryBg: string;
  textColor: string;
  isDark: boolean;
}

function DiaperTypeButton({
  type,
  label,
  description,
  icon,
  isSelected,
  onPress,
  accentColor,
  secondaryBg,
  textColor,
  isDark,
}: DiaperTypeButtonProps) {
  const secondaryTextColor = isDark ? TEXT.dark.secondary : TEXT.light.secondary;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-card-lg active:scale-[0.98] ${
        isSelected ? "border-2" : "border border-border dark:border-border-dark"
      }`}
      style={isSelected ? { borderColor: accentColor, backgroundColor: secondaryBg } : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      testID={`type-${type}`}
    >
      <Text className="text-3xl mr-4">{icon}</Text>
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            isSelected ? "" : "text-content-primary dark:text-content-dark-primary"
          }`}
          style={isSelected ? { color: textColor } : undefined}
        >
          {label}
        </Text>
        <Text
          className={`text-sm ${
            isSelected
              ? ""
              : "text-content-secondary dark:text-content-dark-secondary"
          }`}
          style={isSelected ? { color: secondaryTextColor } : undefined}
        >
          {description}
        </Text>
      </View>
      {isSelected && (
        <View
          className="w-6 h-6 rounded-full items-center justify-center"
          style={{ backgroundColor: accentColor }}
        >
          <Text className="text-white text-sm">✓</Text>
        </View>
      )}
    </Pressable>
  );
}

interface StoolColorButtonProps {
  color: StoolColor;
  label: string;
  hexColor: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  textColor: string;
}

function StoolColorButton({
  color: _color,
  label,
  hexColor,
  isSelected,
  onPress,
  accentColor,
  textColor,
}: StoolColorButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`items-center p-3 rounded-card active:scale-[0.95] ${
        isSelected ? "border-2" : "border border-border dark:border-border-dark"
      }`}
      style={isSelected ? { borderColor: accentColor } : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <View
        className="w-10 h-10 rounded-full mb-2 border border-gray-300"
        style={{ backgroundColor: hexColor }}
      />
      <Text
        className={`text-xs text-center ${
          isSelected
            ? ""
            : "text-content-secondary dark:text-content-dark-secondary"
        }`}
        style={isSelected ? { color: textColor } : undefined}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}
