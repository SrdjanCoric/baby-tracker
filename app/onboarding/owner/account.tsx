import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { ACTION, BORDER, SURFACE, TEXT } from "@/constants/colors";

export default function NewOwnerAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const primaryTextColor = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const secondaryTextColor = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const borderColor = isDark ? BORDER.dark.default : BORDER.light.default;

  const beginAuthentication = useCallback(async (intent: "sign-in" | "create-account") => {
    await NewOwnerOnboardingStorageService.beginAuthentication(intent);
    router.push(`/auth/sign-in?onboardingIntent=${intent}`);
  }, [router]);

  const continueOnDevice = useCallback(async () => {
    await NewOwnerOnboardingStorageService.continueOnDevice();
    router.push("/onboarding/owner/baby");
  }, [router]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }} testID="new-owner-account-screen">
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold mb-3" style={{ color: primaryTextColor }}>
          {t("newOwnerOnboarding.account.title")}
        </Text>
        <Text className="text-base leading-6 mb-8" style={{ color: secondaryTextColor }}>
          {t("newOwnerOnboarding.account.description")}
        </Text>
        <Pressable
          onPress={() => beginAuthentication("sign-in")}
          className="rounded-button-lg py-4 items-center mb-3"
          style={{ backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary }}
          accessibilityRole="button"
          testID="onboarding-sign-in-button"
        >
          <Text className="text-white text-base font-semibold">
            {t("newOwnerOnboarding.account.signIn")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => beginAuthentication("create-account")}
          className="rounded-button-lg py-4 items-center mb-3 border"
          style={{ borderColor }}
          accessibilityRole="button"
          testID="onboarding-create-account-button"
        >
          <Text className="text-base font-semibold" style={{ color: primaryTextColor }}>
            {t("newOwnerOnboarding.account.create")}
          </Text>
        </Pressable>
        <Pressable
          onPress={continueOnDevice}
          className="rounded-button-lg border py-4 items-center"
          style={{ borderColor }}
          accessibilityRole="button"
          testID="continue-on-device-button"
        >
          <Text className="text-base font-semibold" style={{ color: ACTION.light.primary }}>
            {t("newOwnerOnboarding.account.continueOnDevice")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
