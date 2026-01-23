/**
 * Welcome Screen - First onboarding screen
 */

import { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { OnboardingScreen } from "@/components";
import { useOnboarding } from "@/contexts";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state, nextStep, skipOnboarding } = useOnboarding();

  const handleGetStarted = useCallback(() => {
    nextStep();
    router.push("/onboarding/features");
  }, [nextStep, router]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top", "bottom"]}>
      <OnboardingScreen
        title={t("onboarding.welcome.title")}
        subtitle={t("onboarding.welcome.subtitle")}
        illustration="baby-welcome"
        primaryButtonText={t("onboarding.getStarted")}
        onPrimaryPress={handleGetStarted}
        showSkip
        onSkipPress={handleSkip}
        onSwipeLeft={handleGetStarted}
        currentStep={state.currentStep}
        totalSteps={5}
      />
    </SafeAreaView>
  );
}
