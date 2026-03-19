/**
 * Preferences Screen - Language, Units, Theme selection
 */

import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useOnboarding, useTheme, useUnits, useTimeFormat } from "@/contexts";
import { OnboardingPagination } from "@/components/onboarding";
import type { ThemePreference } from "@/contexts/theme-context";
import type { UnitSystem } from "@/contexts/unit-context";
import type { TimeFormat } from "@/contexts/time-format-context";

const PRIMARY_COLOR = "#6B9E6E";

type LanguageCode = "en" | "sr" | "es";

interface OptionButtonProps {
  label: string;
  icon?: string;
  isSelected: boolean;
  onPress: () => void;
  isDark: boolean;
}

function OptionButton({ label, icon, isSelected, onPress, isDark }: OptionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 py-4 rounded-xl items-center active:scale-[0.98]"
      style={{
        backgroundColor: isSelected
          ? PRIMARY_COLOR
          : isDark ? "#2A2A2A" : "#F5F5F5",
        borderWidth: isSelected ? 0 : 1,
        borderColor: isDark ? "#404040" : "#E0E0E0",
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      {icon && <Text className="text-2xl mb-1">{icon}</Text>}
      <Text
        className="text-sm font-medium"
        style={{ color: isSelected ? "#FFFFFF" : isDark ? "#E0E0E0" : "#333333" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View className="mb-6">
      <Text className="text-sm font-semibold text-content-secondary dark:text-content-dark-secondary uppercase tracking-wider mb-3">
        {title}
      </Text>
      <View className="flex-row gap-3">
        {children}
      </View>
    </View>
  );
}

export default function PreferencesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { state, nextStep, skipOnboarding } = useOnboarding();
  const { setThemePreference, preference: currentTheme } = useTheme();
  const { setUnitSystem, unitSystem: currentUnits } = useUnits();
  const { setTimeFormat, timeFormat: currentTimeFormat } = useTimeFormat();

  const [language, setLanguage] = useState<LanguageCode>(
    (i18n.language?.startsWith("sr") ? "sr" : i18n.language?.startsWith("es") ? "es" : "en") as LanguageCode
  );
  const [units, setUnits] = useState<UnitSystem>(currentUnits);
  const [selectedTimeFormat, setSelectedTimeFormat] = useState<TimeFormat>(currentTimeFormat);
  const [theme, setTheme] = useState<ThemePreference>(currentTheme);

  const handleNext = useCallback(async () => {
    await i18n.changeLanguage(language);
    await setUnitSystem(units);
    await setTimeFormat(selectedTimeFormat);
    await setThemePreference(theme);

    nextStep();
    router.push("/onboarding/sync");
  }, [language, units, selectedTimeFormat, theme, i18n, setUnitSystem, setTimeFormat, setThemePreference, nextStep, router]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top", "bottom"]} testID="preferences-screen">
      {/* Skip button */}
      <View className="absolute top-4 right-4 z-10">
        <Pressable
          onPress={handleSkip}
          className="py-2 px-4 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={t("common.skip")}
        >
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary font-medium">
            {t("common.skip")}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-6"
        contentContainerClassName="pt-16 pb-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary text-center mb-2">
          {t("onboarding.preferences.title")}
        </Text>

        {/* Subtitle */}
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-8">
          {t("onboarding.preferences.subtitle")}
        </Text>

        {/* Language Selection */}
        <Section title={t("onboarding.preferences.language")}>
          <OptionButton
            label="English"
            icon="🇬🇧"
            isSelected={language === "en"}
            onPress={() => setLanguage("en")}
            isDark={isDark}
          />
          <OptionButton
            label="Srpski"
            icon="🇷🇸"
            isSelected={language === "sr"}
            onPress={() => setLanguage("sr")}
            isDark={isDark}
          />
          <OptionButton
            label="Español"
            icon="🇪🇸"
            isSelected={language === "es"}
            onPress={() => setLanguage("es")}
            isDark={isDark}
          />
        </Section>

        {/* Time Format Selection */}
        <Section title={t("onboarding.timeFormat")}>
          <OptionButton
            label={t("settings.12hour")}
            icon="🕐"
            isSelected={selectedTimeFormat === "12h"}
            onPress={() => setSelectedTimeFormat("12h")}
            isDark={isDark}
          />
          <OptionButton
            label={t("settings.24hour")}
            icon="🕑"
            isSelected={selectedTimeFormat === "24h"}
            onPress={() => setSelectedTimeFormat("24h")}
            isDark={isDark}
          />
        </Section>

        {/* Units Selection */}
        <Section title={t("onboarding.preferences.units")}>
          <OptionButton
            label={t("settings.metric")}
            icon="📏"
            isSelected={units === "metric"}
            onPress={() => setUnits("metric")}
            isDark={isDark}
          />
          <OptionButton
            label={t("settings.imperial")}
            icon="📐"
            isSelected={units === "imperial"}
            onPress={() => setUnits("imperial")}
            isDark={isDark}
          />
        </Section>

        {/* Theme Selection */}
        <Section title={t("onboarding.preferences.theme")}>
          <OptionButton
            label={t("settings.lightMode")}
            icon="☀️"
            isSelected={theme === "light"}
            onPress={() => setTheme("light")}
            isDark={isDark}
          />
          <OptionButton
            label={t("settings.darkMode")}
            icon="🌙"
            isSelected={theme === "dark"}
            onPress={() => setTheme("dark")}
            isDark={isDark}
          />
          <OptionButton
            label={t("settings.systemDefault")}
            icon="📱"
            isSelected={theme === "system"}
            onPress={() => setTheme("system")}
            isDark={isDark}
          />
        </Section>

        {/* Hint */}
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary text-center mt-4">
          {t("onboarding.preferences.hint")}
        </Text>
      </ScrollView>

      {/* Bottom Section */}
      <View className="px-8 pb-8">
        {/* Pagination dots */}
        <OnboardingPagination currentStep={state.currentStep} totalSteps={6} />

        {/* Primary button */}
        <Pressable
          onPress={handleNext}
          className="py-4 rounded-button-lg items-center active:scale-[0.98]"
          style={{ backgroundColor: PRIMARY_COLOR }}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.next")}
          testID="next-button"
        >
          <Text className="text-lg font-semibold text-white">
            {t("onboarding.next")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
