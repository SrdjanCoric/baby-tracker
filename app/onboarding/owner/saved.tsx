import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { ACTION, SURFACE, TEXT } from "@/constants/colors";
import { useColorScheme } from "nativewind";

export default function ActivitySavedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useLanguage();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const cardColor = isDark ? SURFACE.dark.secondary : SURFACE.light.secondary;
  const primaryTextColor = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const secondaryTextColor = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
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
    <SafeAreaView className="flex-1" style={{ backgroundColor }} testID="activity-saved-screen">
      {isReady && (
        <View className="flex-1 justify-center px-6">
          <View className="rounded-card p-6" style={{ backgroundColor: cardColor }}>
            <Text className="text-3xl mb-3">✓</Text>
            <Text className="text-2xl font-bold mb-2" style={{ color: primaryTextColor }}>
              {t("newOwnerOnboarding.saved.title")}
            </Text>
            <Text className="text-base mb-6" style={{ color: secondaryTextColor }}>
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
              <Text className="font-semibold" style={{ color: primaryTextColor }}>
                {t("newOwnerOnboarding.saved.continueHome")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
