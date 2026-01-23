/**
 * Features Screen - Second onboarding screen
 */

import { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { OnboardingScreen } from "@/components";
import { useOnboarding } from "@/contexts";

export default function FeaturesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state, nextStep, skipOnboarding } = useOnboarding();

  const handleNext = useCallback(() => {
    nextStep();
    router.push("/onboarding/sync");
  }, [nextStep, router]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top", "bottom"]}>
      <OnboardingScreen
        title={t("onboarding.features.title")}
        subtitle={t("onboarding.features.subtitle")}
        illustration="activity-icons"
        primaryButtonText={t("onboarding.next")}
        onPrimaryPress={handleNext}
        showSkip
        onSkipPress={handleSkip}
        onSwipeLeft={handleNext}
        onSwipeRight={handleBack}
        currentStep={state.currentStep}
        totalSteps={4}
      />
    </SafeAreaView>
  );
}
