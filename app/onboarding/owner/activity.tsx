import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import type { FirstActivityType } from "@/types/new-owner-onboarding";
import { ACTION, BORDER, SURFACE, TEXT } from "@/constants/colors";
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
  const backgroundColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const secondaryBackgroundColor = isDark ? SURFACE.dark.secondary : SURFACE.light.secondary;
  const primaryTextColor = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const secondaryTextColor = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const borderColor = isDark ? BORDER.dark.default : BORDER.light.default;
  const [showAll, setShowAll] = useState(false);

  const handleSkipRemainingSetup = useCallback(async () => {
    await NewOwnerOnboardingStorageService.completeWithoutActivity();
    router.replace("/(tabs)");
  }, [router]);

  const activities = showAll ? [...PRIMARY_ACTIVITIES, ...MORE_ACTIVITIES] : PRIMARY_ACTIVITIES;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }} testID="first-activity-screen">
      <ScrollView contentContainerClassName="px-6 py-8">
        <Text className="text-3xl font-bold mb-3" style={{ color: primaryTextColor }}>
          {t("newOwnerOnboarding.activity.title")}
        </Text>
        <Text className="text-base mb-7" style={{ color: secondaryTextColor }}>
          {t("newOwnerOnboarding.activity.subtitle")}
        </Text>

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
              <Text className="text-lg font-semibold" style={{ color: primaryTextColor }}>
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

        <Pressable
          onPress={handleSkipRemainingSetup}
          className="py-4 mt-6 items-center rounded-button-lg border"
          style={{ borderColor }}
          accessibilityRole="button"
          testID="skip-remaining-setup-button"
        >
          <Text className="text-base font-semibold" style={{ color: primaryTextColor }}>
            {t("newOwnerOnboarding.activity.skipRemaining")}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
