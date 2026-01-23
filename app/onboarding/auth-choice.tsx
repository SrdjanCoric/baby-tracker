/**
 * Auth Choice Screen - Sign In, Sign Up, or Continue as Guest
 */

import { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useOnboarding } from "@/contexts";
import { OnboardingPagination, OnboardingIllustration } from "@/components/onboarding";

export default function AuthChoiceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state, nextStep, skipOnboarding } = useOnboarding();

  const handleSignIn = useCallback(() => {
    router.push("/auth/sign-in");
  }, [router]);

  const handleSignUp = useCallback(() => {
    router.push("/auth/sign-up");
  }, [router]);

  const handleContinueAsGuest = useCallback(() => {
    nextStep();
    router.push("/onboarding/features");
  }, [nextStep, router]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

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
      <View className="flex-1 items-center justify-center px-8">
        {/* Illustration */}
        <View className="mb-8">
          <OnboardingIllustration type="phones-sync" />
        </View>

        {/* Title */}
        <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary text-center mb-3">
          {t("onboarding.authChoice.title")}
        </Text>

        {/* Subtitle */}
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-8 leading-6">
          {t("onboarding.authChoice.subtitle")}
        </Text>

        {/* Auth Buttons */}
        <View className="w-full">
          {/* Sign In */}
          <Pressable
            onPress={handleSignIn}
            className="bg-primary dark:bg-primary-dark rounded-xl py-4 items-center mb-3 active:opacity-80"
            accessibilityRole="button"
          >
            <Text className="text-white font-semibold text-base">
              {t("auth.signIn")}
            </Text>
          </Pressable>

          {/* Sign Up */}
          <Pressable
            onPress={handleSignUp}
            className="bg-surface-card dark:bg-surface-dark-card border-2 border-primary dark:border-primary-dark rounded-xl py-4 items-center mb-3 active:opacity-80"
            accessibilityRole="button"
          >
            <Text className="text-primary dark:text-primary-dark font-semibold text-base">
              {t("auth.signUp")}
            </Text>
          </Pressable>

          {/* Continue as Guest */}
          <Pressable
            onPress={handleContinueAsGuest}
            className="py-4 items-center active:opacity-70"
            accessibilityRole="button"
          >
            <Text className="text-content-secondary dark:text-content-dark-secondary font-medium text-base">
              {t("auth.continueAsGuest")}
            </Text>
          </Pressable>
        </View>

        {/* Guest hint */}
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary text-center mt-2">
          {t("onboarding.authChoice.guestHint")}
        </Text>
      </View>

      {/* Bottom Section */}
      <View className="px-8 pb-8">
        <OnboardingPagination currentStep={state.currentStep} totalSteps={6} />
      </View>
    </SafeAreaView>
  );
}
