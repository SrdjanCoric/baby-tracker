/**
 * Features Screen - Dashboard customization during onboarding
 */

import { useCallback } from "react";
import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useOnboarding, useDashboardConfig } from "@/contexts";
import { OnboardingPagination } from "@/components/onboarding";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";

const PRIMARY_COLOR = "#6B9E6E";

interface ActivityToggleProps {
  type: ActivityType;
  title: string;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  isDark: boolean;
}

function ActivityToggle({ type, title, isEnabled, onToggle, isDark }: ActivityToggleProps) {
  const config = ACTIVITY_CONFIG[type];

  return (
    <View
      className="flex-row items-center rounded-2xl p-4 mb-3"
      style={{
        backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5",
      }}
    >
      <Text className="text-3xl mr-3">{config.icon}</Text>
      <Text
        className="flex-1 text-base font-medium"
        style={{ color: isDark ? "#E0E0E0" : "#333333" }}
      >
        {title}
      </Text>
      <Switch
        value={isEnabled}
        onValueChange={onToggle}
        trackColor={{ false: isDark ? "#404040" : "#D1D5DB", true: PRIMARY_COLOR }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function FeaturesScreen() {
  const { t: translate } = useTranslation();
  const t = translate as (key: string) => string;
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { state, nextStep, skipOnboarding } = useOnboarding();
  const { config, setCardVisibility } = useDashboardConfig();

  const handleNext = useCallback(() => {
    nextStep();
    router.push("/onboarding/preferences");
  }, [nextStep, router]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

  const handleToggle = useCallback(async (type: ActivityType, enabled: boolean) => {
    await setCardVisibility(type, enabled);
  }, [setCardVisibility]);

  const getCardVisibility = (type: ActivityType): boolean => {
    const card = config.cards.find(c => c.activity === type);
    return card?.visible ?? true;
  };

  const activities: { type: ActivityType; titleKey: string }[] = [
    { type: "feeding", titleKey: "feeding.title" },
    { type: "sleep", titleKey: "sleep.title" },
    { type: "diaper", titleKey: "diaper.title" },
    { type: "pumping", titleKey: "pumping.title" },
    { type: "growth", titleKey: "growth.title" },
    { type: "tummyTime", titleKey: "tummyTime.title" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top", "bottom"]}>
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
          {t("onboarding.features.customizeTitle")}
        </Text>

        {/* Subtitle */}
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-6">
          {t("onboarding.features.customizeSubtitle")}
        </Text>

        {/* Activity Toggles */}
        <View className="mb-4">
          {activities.map((activity) => (
            <ActivityToggle
              key={activity.type}
              type={activity.type}
              title={t(activity.titleKey)}
              isEnabled={getCardVisibility(activity.type)}
              onToggle={(enabled) => handleToggle(activity.type, enabled)}
              isDark={isDark}
            />
          ))}
        </View>

        {/* Hint */}
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary text-center">
          {t("onboarding.features.customizeHint")}
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
        >
          <Text className="text-lg font-semibold text-white">
            {t("onboarding.next")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
