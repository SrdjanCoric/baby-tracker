/**
 * Features Screen - Interactive activity showcase
 */

import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useOnboarding } from "@/contexts";
import { OnboardingPagination } from "@/components/onboarding";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";

const PRIMARY_COLOR = "#7C3AED";

interface ActivityCardProps {
  type: ActivityType;
  title: string;
  description: string;
  isExpanded: boolean;
  onPress: () => void;
  isDark: boolean;
}

function ActivityCard({ type, title, description, isExpanded, onPress, isDark }: ActivityCardProps) {
  const config = ACTIVITY_CONFIG[type];

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl p-4 mb-3 active:scale-[0.98]"
      style={{
        backgroundColor: isDark ? config.mutedBgDark : config.mutedBg,
        borderWidth: isExpanded ? 2 : 0,
        borderColor: config.accentColor,
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ expanded: isExpanded }}
    >
      <View className="flex-row items-center">
        <Text className="text-3xl mr-3">{config.icon}</Text>
        <View className="flex-1">
          <Text
            className="text-base font-semibold"
            style={{ color: config.accentColor }}
          >
            {title}
          </Text>
          {isExpanded && (
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mt-1">
              {description}
            </Text>
          )}
        </View>
        <Text className="text-content-tertiary dark:text-content-dark-tertiary">
          {isExpanded ? "▲" : "▼"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function FeaturesScreen() {
  const { t: translate } = useTranslation();
  const t = translate as (key: string) => string;
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { state, nextStep, skipOnboarding } = useOnboarding();
  const [expandedActivity, setExpandedActivity] = useState<ActivityType | null>(null);

  const handleNext = useCallback(() => {
    nextStep();
    router.push("/onboarding/preferences");
  }, [nextStep, router]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

  const handleActivityPress = useCallback((type: ActivityType) => {
    setExpandedActivity(prev => prev === type ? null : type);
  }, []);

  const activities: { type: ActivityType; titleKey: string; descKey: string }[] = [
    { type: "feeding", titleKey: "feeding.title", descKey: "onboarding.activityDesc.feeding" },
    { type: "sleep", titleKey: "sleep.title", descKey: "onboarding.activityDesc.sleep" },
    { type: "diaper", titleKey: "diaper.title", descKey: "onboarding.activityDesc.diaper" },
    { type: "pumping", titleKey: "pumping.title", descKey: "onboarding.activityDesc.pumping" },
    { type: "growth", titleKey: "growth.title", descKey: "onboarding.activityDesc.growth" },
    { type: "tummyTime", titleKey: "tummyTime.title", descKey: "onboarding.activityDesc.tummyTime" },
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
          {t("onboarding.features.title")}
        </Text>

        {/* Subtitle */}
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-6">
          {t("onboarding.features.interactiveSubtitle")}
        </Text>

        {/* Activity Cards */}
        <View className="mb-4">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.type}
              type={activity.type}
              title={t(activity.titleKey)}
              description={t(activity.descKey)}
              isExpanded={expandedActivity === activity.type}
              onPress={() => handleActivityPress(activity.type)}
              isDark={isDark}
            />
          ))}
        </View>
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
