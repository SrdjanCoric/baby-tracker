import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import type { FirstActivityType } from "@/types/new-owner-onboarding";
import { ACTION } from "@/constants/colors";

const PRIMARY_ACTIVITIES: Array<{ type: FirstActivityType; icon: string }> = [
  { type: "feeding", icon: "🍼" },
  { type: "sleep", icon: "🌙" },
  { type: "diaper", icon: "🚼" },
  { type: "pumping", icon: "🫗" },
];

const MORE_ACTIVITIES: Array<{ type: FirstActivityType; icon: string }> = [
  { type: "growth", icon: "📏" },
  { type: "tummyTime", icon: "🐛" },
  { type: "health", icon: "🩺" },
  { type: "milestones", icon: "⭐" },
];

const ACTIVITY_ROUTES: Record<FirstActivityType, string> = {
  feeding: "/feeding?onboardingPreview=firstActivity",
  sleep: "/sleep?onboardingPreview=firstActivity",
  diaper: "/diaper?onboardingPreview=firstActivity",
  pumping: "/pumping?onboardingPreview=firstActivity",
  growth: "/growth?onboardingPreview=firstActivity",
  tummyTime: "/tummyTime?onboardingPreview=firstActivity",
  health: "/health?onboardingPreview=firstActivity",
  milestones: "/milestones?onboardingPreview=firstActivity",
};

export default function NewOwnerActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  const handleNotNow = useCallback(async () => {
    await NewOwnerOnboardingStorageService.completeWithoutActivity();
    router.replace("/(tabs)");
  }, [router]);

  const activities = showAll ? [...PRIMARY_ACTIVITIES, ...MORE_ACTIVITIES] : PRIMARY_ACTIVITIES;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="first-activity-screen">
      <ScrollView contentContainerClassName="px-6 py-8">
        <Text className="text-3xl font-bold text-content-primary dark:text-content-dark-primary mb-3">
          {t("newOwnerOnboarding.activity.title")}
        </Text>
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-7">
          {t("newOwnerOnboarding.activity.subtitle")}
        </Text>

        <View className="gap-3">
          {activities.map(activity => (
            <Pressable
              key={activity.type}
              onPress={() => router.push(ACTIVITY_ROUTES[activity.type] as never)}
              className="flex-row items-center rounded-card px-5 py-4 bg-surface-secondary dark:bg-surface-dark-secondary"
              accessibilityRole="button"
              testID={`first-activity-${activity.type}`}
            >
              <Text className="text-2xl mr-4">{activity.icon}</Text>
              <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
                {t(`newOwnerOnboarding.activity.${activity.type}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {!showAll && (
          <Pressable
            onPress={() => setShowAll(true)}
            className="py-4 items-center mt-2"
            accessibilityRole="button"
            testID="see-all-activity-types"
          >
            <Text className="font-semibold" style={{ color: ACTION.light.primary }}>
              {t("newOwnerOnboarding.activity.seeAll")}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <View className="px-6 pb-6">
        <Pressable
          onPress={handleNotNow}
          className="py-4 items-center rounded-button-lg border border-border dark:border-border-dark"
          accessibilityRole="button"
          testID="not-now-button"
        >
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
            {t("newOwnerOnboarding.activity.notNow")}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleNotNow}
          className="py-3 items-center"
          accessibilityRole="button"
          testID="skip-remaining-setup-button"
        >
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary text-center">
            {t("newOwnerOnboarding.activity.skipRemaining")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
