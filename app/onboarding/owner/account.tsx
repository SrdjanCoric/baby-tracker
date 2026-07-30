import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { OnboardingScreen } from "@/components/onboarding";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

export default function NewOwnerAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const beginAuthentication = useCallback(async (intent: "sign-in" | "create-account") => {
    await NewOwnerOnboardingStorageService.beginAuthentication(intent);
    router.push(`/auth/sign-in?onboardingIntent=${intent}`);
  }, [router]);

  const continueOnDevice = useCallback(async () => {
    await NewOwnerOnboardingStorageService.continueOnDevice();
    router.push("/onboarding/owner/baby");
  }, [router]);

  return (
    <OnboardingScreen
      testID="new-owner-account-screen"
      title={t("newOwnerOnboarding.account.title")}
      description={t("newOwnerOnboarding.account.description")}
      contentClassName="flex-1 justify-center gap-3"
    >
      <Button
        size="large"
        wrapText
        onPress={() => beginAuthentication("sign-in")}
        testID="onboarding-sign-in-button"
      >
        {t("newOwnerOnboarding.account.signIn")}
      </Button>
      <Button
        variant="secondary"
        size="large"
        wrapText
        onPress={() => beginAuthentication("create-account")}
        testID="onboarding-create-account-button"
      >
        {t("newOwnerOnboarding.account.create")}
      </Button>
      <Button
        variant="ghost"
        size="large"
        wrapText
        onPress={continueOnDevice}
        testID="continue-on-device-button"
      >
        {t("newOwnerOnboarding.account.continueOnDevice")}
      </Button>
    </OnboardingScreen>
  );
}
