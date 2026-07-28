import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { ACTION } from "@/constants/colors";

export default function ActivitySavedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useLanguage();
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

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="activity-saved-screen">
      {isReady && (
        <View className="flex-1 justify-center px-6">
          <View className="rounded-card p-6 bg-surface-secondary dark:bg-surface-dark-secondary">
            <Text className="text-3xl mb-3">✓</Text>
            <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
              {t("newOwnerOnboarding.saved.title")}
            </Text>
            <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-6">
              {t("newOwnerOnboarding.saved.message")}
            </Text>
            <Pressable
              onPress={() => finish("/(tabs)/timeline")}
              className="rounded-button-lg py-4 items-center mb-2"
              style={{ backgroundColor: ACTION.light.primary }}
              accessibilityRole="button"
              testID="view-in-timeline-button"
            >
              <Text className="text-white font-bold">{t("newOwnerOnboarding.saved.viewTimeline")}</Text>
            </Pressable>
            <Pressable
              onPress={() => finish("/(tabs)")}
              className="py-3 items-center"
              accessibilityRole="button"
              testID="continue-home-button"
            >
              <Text className="text-content-primary dark:text-content-dark-primary font-semibold">
                {t("newOwnerOnboarding.saved.continueHome")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
