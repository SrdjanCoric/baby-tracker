import { useCallback, useState } from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useDiaper } from "@/contexts/diaper-context";
import { useBaby } from "@/contexts";
import type { DiaperType, StoolColor } from "@/constants/activities";
import { STOOL_COLORS } from "@/constants/activities";

const DIAPER_PEACH = "#D4837D";
const DIAPER_PEACH_MUTED = "#FDF0EF";
const DIAPER_PEACH_DARK = "#A85E58";

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
  const { selectedBaby } = useBaby();
  const { addDiaper } = useDiaper();

  const [selectedType, setSelectedType] = useState<DiaperType | null>(null);
  const [selectedColor, setSelectedColor] = useState<StoolColor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleTypeSelect = useCallback((type: DiaperType) => {
    setSelectedType(type);
    if (type === "wet") {
      setSelectedColor(null);
    }
  }, []);

  const handleColorSelect = useCallback((color: StoolColor) => {
    setSelectedColor(color);
  }, []);

  const handleLogPastDiaper = useCallback(() => {
    router.push("/diaper/manual");
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!selectedBaby || !selectedType) return;

    setIsSaving(true);
    try {
      await addDiaper({
        babyId: selectedBaby.id,
        type: selectedType,
        stoolColor: selectedType !== "wet" ? selectedColor ?? undefined : undefined,
        changedAt: new Date(),
      });
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, selectedType, selectedColor, addDiaper, router]);

  const canSave = selectedType !== null && !isSaving;

  if (!selectedBaby) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.noBabySelected")}
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
            {t("diaper.logDiaperChange")}
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
        showsVerticalScrollIndicator={false}
      >
        {/* Illustration/Icon */}
        <View className="items-center mb-6">
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: DIAPER_PEACH_MUTED }}
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
          />
          <DiaperTypeButton
            type="dirty"
            label={t("diaper.dirty")}
            description={t("diaper.dirtyOnly")}
            icon="💩"
            isSelected={selectedType === "dirty"}
            onPress={() => handleTypeSelect("dirty")}
          />
          <DiaperTypeButton
            type="mixed"
            label={t("diaper.mixed")}
            description={t("diaper.mixedType")}
            icon="💧💩"
            isSelected={selectedType === "mixed"}
            onPress={() => handleTypeSelect("mixed")}
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
                />
              ))}
            </View>
          </>
        )}

        {/* Log Past Diaper Link */}
        <Pressable
          onPress={handleLogPastDiaper}
          className="py-3 px-6 rounded-button-lg active:opacity-70 self-center mb-6"
          style={{ backgroundColor: DIAPER_PEACH_MUTED }}
          accessibilityRole="button"
          accessibilityLabel={t("diaper.logPastDiaper")}
        >
          <Text className="text-base font-medium" style={{ color: DIAPER_PEACH }}>
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
          style={{ backgroundColor: DIAPER_PEACH }}
          accessibilityRole="button"
          accessibilityLabel={t("diaper.logDiaper")}
        >
          <Text className="text-white text-lg font-semibold">
            {isSaving ? t("common.loading") : t("diaper.logDiaper")}
          </Text>
        </Pressable>
      </View>
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
}

function DiaperTypeButton({
  type: _type,
  label,
  description,
  icon,
  isSelected,
  onPress,
}: DiaperTypeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-card-lg active:scale-[0.98] ${
        isSelected ? "border-2" : "border border-border dark:border-border-dark"
      }`}
      style={isSelected ? { borderColor: DIAPER_PEACH, backgroundColor: DIAPER_PEACH_MUTED } : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text className="text-3xl mr-4">{icon}</Text>
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            isSelected ? "" : "text-content-primary dark:text-content-dark-primary"
          }`}
          style={isSelected ? { color: DIAPER_PEACH_DARK } : undefined}
        >
          {label}
        </Text>
        <Text
          className={`text-sm ${
            isSelected
              ? ""
              : "text-content-secondary dark:text-content-dark-secondary"
          }`}
          style={isSelected ? { color: DIAPER_PEACH } : undefined}
        >
          {description}
        </Text>
      </View>
      {isSelected && (
        <View
          className="w-6 h-6 rounded-full items-center justify-center"
          style={{ backgroundColor: DIAPER_PEACH }}
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
}

function StoolColorButton({
  color: _color,
  label,
  hexColor,
  isSelected,
  onPress,
}: StoolColorButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`items-center p-3 rounded-card active:scale-[0.95] ${
        isSelected ? "border-2" : "border border-border dark:border-border-dark"
      }`}
      style={isSelected ? { borderColor: DIAPER_PEACH } : undefined}
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
        style={isSelected ? { color: DIAPER_PEACH_DARK } : undefined}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}
