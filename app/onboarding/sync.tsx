/**
 * Sync Screen - Fourth onboarding screen
 */

import { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { OnboardingScreen } from "@/components";
import { useOnboarding } from "@/contexts";

export default function SyncScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state, nextStep, skipOnboarding } = useOnboarding();

  const handleNext = useCallback(() => {
    nextStep();
    router.push("/onboarding/baby");
  }, [nextStep, router]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top", "bottom"]}>
      <OnboardingScreen
        title={t("onboarding.sync.title")}
        subtitle={t("onboarding.sync.subtitle")}
        illustration="phones-sync"
        primaryButtonText={t("onboarding.next")}
        onPrimaryPress={handleNext}
        showSkip
        onSkipPress={handleSkip}
        currentStep={state.currentStep}
        totalSteps={6}
      />
    </SafeAreaView>
  );
}
