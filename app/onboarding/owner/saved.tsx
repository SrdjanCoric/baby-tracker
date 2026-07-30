import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { ACTION, SURFACE } from "@/constants/colors";
import { Button } from "@/components/Button";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { useColorScheme } from "nativewind";

export default function ActivitySavedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useLanguage();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const cardColor = isDark ? SURFACE.dark.secondary : SURFACE.light.secondary;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    NewOwnerOnboardingStorageService.getState(language).then(state => {
      if (!active) return;
      if (state.screen !== "activity-saved") {
        router.replace("/onboarding/owner");
        return;
      }
      setIsReady(true);
    });
    return () => {
      active = false;
    };
  }, [language, router]);

  const finish = useCallback(async (route: "/(tabs)" | "/(tabs)/timeline") => {
    await NewOwnerOnboardingStorageService.completeSavedActivity();
    router.replace(route);
  }, [router]);

  if (!isReady) {
    return (
      <OnboardingScreen
        testID="activity-saved-screen"
        title={t("common.loading")}
        contentClassName="flex-1 items-center justify-center"
      >
        <View testID="onboarding-loading-indicator" accessibilityState={{ busy: true }}>
          <ActivityIndicator color={isDark ? ACTION.dark.primary : ACTION.light.primary} />
        </View>
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen
      testID="activity-saved-screen"
      title={t("newOwnerOnboarding.saved.title")}
      description={t("newOwnerOnboarding.saved.message")}
      contentClassName="gap-3 justify-center"
    >
      <View className="rounded-card p-6 gap-3" style={{ backgroundColor: cardColor }}>
        <Text className="text-3xl">✓</Text>
        <Button wrapText onPress={() => finish("/(tabs)/timeline")} testID="view-in-timeline-button">
          {t("newOwnerOnboarding.saved.viewTimeline")}
        </Button>
        <Button wrapText variant="ghost" onPress={() => finish("/(tabs)")} testID="continue-home-button">
          {t("newOwnerOnboarding.saved.continueHome")}
        </Button>
      </View>
    </OnboardingScreen>
  );
}
