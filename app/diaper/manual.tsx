import { useCallback, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme } from "nativewind";
import { useDiaper } from "@/contexts/diaper-context";
import { useBaby, useTimeFormat } from "@/contexts";
import { formatTime as formatTimeUtil } from "@/utils/time";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import type { DiaperType, StoolColor } from "@/constants/activities";
import { STOOL_COLORS } from "@/constants/activities";
import { ACTIVITY } from "@/constants/colors";

const STOOL_COLOR_MAP: Record<StoolColor, string> = {
  yellow: "#F4D03F",
  brown: "#8B4513",
  green: "#228B22",
  orange: "#FF8C00",
  black: "#2C2C2C",
  white: "#F5F5DC",
  red: "#CD5C5C",
};

export default function ManualDiaperScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { addDiaper } = useDiaper();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = {
    accent: isDark ? ACTIVITY.diaper.accentDark : ACTIVITY.diaper.accent,
    mutedBg: isDark ? ACTIVITY.diaper.mutedDark : ACTIVITY.diaper.muted,
    textOnMuted: isDark ? ACTIVITY.diaper.textAccentDark : ACTIVITY.diaper.textAccent,
  };

  const [selectedType, setSelectedType] = useState<DiaperType | null>(null);
  const [selectedColor, setSelectedColor] = useState<StoolColor | null>(null);
  const [changeTime, setChangeTime] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const handleTypeSelect = useCallback((type: DiaperType) => {
    setSelectedType(type);
    if (type === "wet") {
      setSelectedColor(null);
    }
  }, []);

  const handleColorSelect = useCallback((color: StoolColor) => {
    setSelectedColor(color);
  }, []);

  const handleDateChange = useCallback((_event: unknown, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (date) {
      const newDateTime = new Date(changeTime);
      newDateTime.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setChangeTime(newDateTime);
    }
  }, [changeTime]);

  const handleTimeChange = useCallback((_event: unknown, date?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (date) {
      const newDateTime = new Date(changeTime);
      newDateTime.setHours(date.getHours(), date.getMinutes());
      setChangeTime(newDateTime);
    }
  }, [changeTime]);

  const handleDateTimeChange = useCallback((_event: unknown, selectedDateTime?: Date) => {
    if (selectedDateTime) {
      setChangeTime(selectedDateTime);
    }
  }, []);

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
        changedAt: changeTime,
      });
      router.replace("/(tabs)");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [selectedBaby, selectedType, selectedColor, changeTime, addDiaper, router]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  const formatTime = (date: Date) => formatTimeUtil(date, timeFormat);

  const canSave = selectedType !== null && !isSaving;

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

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
          {t("diaper.logPastDiaper")}
        </Text>
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
          {selectedBaby.name}
        </Text>
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
        {/* Change Time Section */}
        <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
          {t("diaper.changeTime")}
        </Text>

        <View className="flex-row gap-3 mb-6">
          {/* Date Picker */}
          <Pressable
            onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowDatePicker(true)}
            className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
            style={{ backgroundColor: colors.mutedBg }}
            accessibilityRole="button"
            accessibilityLabel={t("feeding.selectDate")}
          >
            <Text className="text-base" style={{ color: colors.textOnMuted }}>
              {formatDate(changeTime)}
            </Text>
            <Text style={{ color: colors.accent }}>📅</Text>
          </Pressable>

          {/* Time Picker */}
          <Pressable
            onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowTimePicker(true)}
            className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
            style={{ backgroundColor: colors.mutedBg }}
            accessibilityRole="button"
            accessibilityLabel={t("feeding.selectTime")}
          >
            <Text className="text-base" style={{ color: colors.textOnMuted }}>
              {formatTime(changeTime)}
            </Text>
            <Text style={{ color: colors.accent }}>🕐</Text>
          </Pressable>
        </View>

        {/* iOS: Combined datetime picker */}
        {showDateTimePicker && Platform.OS === "ios" && (
          <View className="mb-4">
            <View className="flex-row justify-end px-2">
              <Pressable
                onPress={() => setShowDateTimePicker(false)}
                className="py-1 px-3"
              >
                <Text className="text-sm font-semibold" style={{ color: colors.accent }}>
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={changeTime}
              mode="datetime"
              display="spinner"
              onChange={handleDateTimeChange}
              maximumDate={new Date()}
            />
          </View>
        )}

        {/* Android: Separate date picker */}
        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={changeTime}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* Android: Separate time picker */}
        {showTimePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={changeTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {/* Diaper Type Selection */}
        <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
          {t("diaper.selectType")}
        </Text>

        <View className="gap-3 mb-6">
          <DiaperTypeButton
            type="wet"
            label={t("diaper.wet")}
            icon="💧"
            isSelected={selectedType === "wet"}
            onPress={() => handleTypeSelect("wet")}
            accentColor={colors.accent}
            mutedColor={colors.mutedBg}
            textColor={colors.textOnMuted}
          />
          <DiaperTypeButton
            type="dirty"
            label={t("diaper.dirty")}
            icon="💩"
            isSelected={selectedType === "dirty"}
            onPress={() => handleTypeSelect("dirty")}
            accentColor={colors.accent}
            mutedColor={colors.mutedBg}
            textColor={colors.textOnMuted}
          />
          <DiaperTypeButton
            type="mixed"
            label={t("diaper.mixed")}
            icon="💧💩"
            isSelected={selectedType === "mixed"}
            onPress={() => handleTypeSelect("mixed")}
            accentColor={colors.accent}
            mutedColor={colors.mutedBg}
            textColor={colors.textOnMuted}
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
                  accentColor={colors.accent}
                  textColor={colors.textOnMuted}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Save Button */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
            !canSave ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: colors.accent }}
          accessibilityRole="button"
          accessibilityLabel={t("diaper.logDiaper")}
        >
          <Text className="text-white text-lg font-semibold">
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
  icon: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function DiaperTypeButton({
  type: _type,
  label,
  icon,
  isSelected,
  onPress,
  accentColor,
  mutedColor,
  textColor,
}: DiaperTypeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-card-lg active:scale-[0.98] ${
        isSelected ? "border-2" : "border border-border dark:border-border-dark"
      }`}
      style={isSelected ? { borderColor: accentColor, backgroundColor: mutedColor } : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text className="text-3xl mr-4">{icon}</Text>
      <Text
        className={`text-base font-medium flex-1 ${
          isSelected ? "" : "text-content-primary dark:text-content-dark-primary"
        }`}
        style={isSelected ? { color: textColor } : undefined}
      >
        {label}
      </Text>
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
