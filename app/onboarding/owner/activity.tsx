import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import type { FirstActivityType } from "@/types/new-owner-onboarding";
import { SURFACE, TEXT } from "@/constants/colors";
import { Button } from "@/components/Button";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { useColorScheme } from "nativewind";

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
  feeding: "/feeding?onboardingActivity=first",
  sleep: "/sleep?onboardingActivity=first",
  diaper: "/diaper?onboardingActivity=first",
  pumping: "/pumping?onboardingActivity=first",
  growth: "/growth?onboardingActivity=first",
  tummyTime: "/tummyTime?onboardingActivity=first",
  health: "/health?onboardingActivity=first",
  milestones: "/milestones?onboardingActivity=first",
};

export default function NewOwnerActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const secondaryBackgroundColor = isDark ? SURFACE.dark.secondary : SURFACE.light.secondary;
  const primaryTextColor = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const [showAll, setShowAll] = useState(false);

  const handleSkipRemainingSetup = useCallback(async () => {
    await NewOwnerOnboardingStorageService.completeWithoutActivity();
    router.replace("/(tabs)");
  }, [router]);

  const activities = showAll ? [...PRIMARY_ACTIVITIES, ...MORE_ACTIVITIES] : PRIMARY_ACTIVITIES;

  return (
    <OnboardingScreen
      testID="first-activity-screen"
      title={t("newOwnerOnboarding.activity.title")}
      description={t("newOwnerOnboarding.activity.subtitle")}
    >
      <View className="gap-3">
        {activities.map(activity => (
          <Pressable
            key={activity.type}
            onPress={() => router.push(ACTIVITY_ROUTES[activity.type] as never)}
            className="flex-row items-center rounded-card px-5 py-4"
            style={{ backgroundColor: secondaryBackgroundColor }}
            accessibilityRole="button"
            testID={`first-activity-${activity.type}`}
          >
            <Text className="text-2xl mr-4">{activity.icon}</Text>
            <Text className="flex-1 text-lg font-semibold" style={{ color: primaryTextColor }}>
              {t(`newOwnerOnboarding.activity.${activity.type}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      {!showAll && (
        <Button wrapText variant="ghost" onPress={() => setShowAll(true)} testID="see-all-activity-types">
          {t("newOwnerOnboarding.activity.seeAll")}
        </Button>
      )}
      <Button wrapText variant="secondary" onPress={handleSkipRemainingSetup} testID="skip-remaining-setup-button">
        {t("newOwnerOnboarding.activity.skipRemaining")}
      </Button>
    </OnboardingScreen>
  );
}
