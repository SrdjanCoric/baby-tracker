import { useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useOnboarding } from "@/contexts";
import { OnboardingPagination } from "@/components/onboarding";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";

const PRIMARY_COLOR = "#6B9E6E";

interface ActivityPreviewProps {
  type: ActivityType;
  title: string;
  isDark: boolean;
}

function ActivityPreview({ type, title, isDark }: ActivityPreviewProps) {
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

  const handleNext = useCallback(() => {
    nextStep();
    router.push("/onboarding/preferences");
  }, [nextStep, router]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

  const activities: { type: ActivityType; titleKey: string }[] = [
    { type: "feeding", titleKey: "feeding.title" },
    { type: "sleep", titleKey: "sleep.title" },
    { type: "diaper", titleKey: "diaper.title" },
    { type: "pumping", titleKey: "pumping.title" },
    { type: "growth", titleKey: "growth.title" },
    { type: "tummyTime", titleKey: "tummyTime.title" },
    { type: "milestones", titleKey: "milestones.title" },
    { type: "health", titleKey: "health.title" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top", "bottom"]} testID="features-screen">
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

      <ScrollView
        className="flex-1 px-6"
        contentContainerClassName="pt-16 pb-4"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary text-center mb-2">
          {t("onboarding.features.customizeTitle")}
        </Text>

        <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-6">
          {t("onboarding.features.customizeSubtitle")}
        </Text>

        <View className="mb-4">
          {activities.map((activity) => (
            <ActivityPreview
              key={activity.type}
              type={activity.type}
              title={t(activity.titleKey)}
              isDark={isDark}
            />
          ))}
        </View>
      </ScrollView>

      <View className="px-8 pb-8">
        <OnboardingPagination currentStep={state.currentStep} totalSteps={6} />

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
