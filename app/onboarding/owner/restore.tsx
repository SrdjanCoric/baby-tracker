import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth, useBaby, useHousehold, useTheme } from "@/contexts";
import { ACTION, TEXT } from "@/constants/colors";
import { Button } from "@/components/Button";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { restoreReturningUserAccount } from "@/services/returning-user-restoration";
import type { NewOwnerOnboardingState } from "@/types/new-owner-onboarding";

const RETURNING_SCREENS = new Set([
  "returning-restoring",
  "returning-restored",
  "returning-verified-empty",
  "returning-unavailable",
  "returning-signed-out",
]);

export default function ReturningUserRestoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark } = useTheme();
  const { user, refreshUserProfile, signOut } = useAuth();
  const { refreshHousehold } = useHousehold();
  const { refreshBabies } = useBaby();
  const [state, setState] = useState<NewOwnerOnboardingState | null>(null);
  const operationRef = useRef(0);

  const reloadState = useCallback(async () => {
    const nextState = await NewOwnerOnboardingStorageService.getState("system");
    setState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    void reloadState();
    return () => {
      operationRef.current += 1;
    };
  }, [reloadState]);

  useEffect(() => {
    if (state?.screen !== "returning-restoring") return;
    const operation = ++operationRef.current;
    const attempt = state.attempt;

    const restore = async () => {
      const result = await restoreReturningUserAccount({
        userId: user?.id ?? null,
        refreshUserProfile,
        refreshHousehold,
        refreshBabies,
      });
      if (operationRef.current !== operation) return;

      if (result.status === "unavailable") {
        await NewOwnerOnboardingStorageService.markReturningUnavailable(
          attempt,
          result.reason
        );
        if (operationRef.current === operation) await reloadState();
        return;
      }

      await NewOwnerOnboardingStorageService.attachReturningHousehold(
        attempt,
        result.householdId
      );
      if (result.status === "verified-empty") {
        await NewOwnerOnboardingStorageService.markReturningVerifiedEmpty(
          attempt,
          result.householdId
        );
        if (operationRef.current === operation) await reloadState();
        return;
      }

      await NewOwnerOnboardingStorageService.markReturningRestored(
        attempt,
        result.householdId,
        result.babyId
      );
      if (operationRef.current !== operation) return;
      const current = await reloadState();
      if (current.screen === "returning-restored" &&
        current.attempt === attempt &&
        current.babyId === result.babyId) {
        router.replace("/(tabs)");
      }
    };

    void restore();
  }, [
    refreshBabies,
    refreshHousehold,
    refreshUserProfile,
    reloadState,
    router,
    state,
    user?.id,
  ]);

  const handleRetry = useCallback(async () => {
    operationRef.current += 1;
    const attempt = await NewOwnerOnboardingStorageService.retryReturningRestoration();
    if (attempt !== null) await reloadState();
  }, [reloadState]);

  const handleSignOut = useCallback(async () => {
    operationRef.current += 1;
    const { error } = await signOut();
    if (error) return;
    await NewOwnerOnboardingStorageService.markReturningSignedOut();
    router.replace("/onboarding/owner");
  }, [router, signOut]);

  const handleAddBaby = useCallback(async () => {
    await NewOwnerOnboardingStorageService.continueReturningWithBaby();
    router.replace("/onboarding/owner/baby");
  }, [router]);

  const handleJoinFamily = useCallback(async () => {
    await NewOwnerOnboardingStorageService.continueReturningWithFamilyJoin();
    router.replace("/onboarding/owner/join");
  }, [router]);

  if (!state || state.screen === "returning-restoring") {
    return (
      <OnboardingScreen
        testID="returning-restoring-screen"
        title={t("newOwnerOnboarding.restoration.loadingTitle")}
        description={t("newOwnerOnboarding.restoration.loadingDescription")}
        contentClassName="items-center justify-center"
      >
        <View accessibilityState={{ busy: true }}>
          <ActivityIndicator size="large" color={isDark ? ACTION.dark.primary : ACTION.light.primary} />
        </View>
      </OnboardingScreen>
    );
  }

  if (state.screen === "returning-verified-empty") {
    return (
      <OnboardingScreen
        testID="returning-verified-empty-screen"
        title={t("newOwnerOnboarding.restoration.emptyTitle")}
        description={t("newOwnerOnboarding.restoration.emptyDescription")}
        contentClassName="gap-3 justify-center"
      >
        <Button wrapText onPress={handleAddBaby} testID="returning-add-baby-button">
          {t("newOwnerOnboarding.restoration.addBaby")}
        </Button>
        <Button wrapText variant="secondary" onPress={handleJoinFamily} testID="returning-join-family-button">
          {t("newOwnerOnboarding.restoration.joinFamily")}
        </Button>
      </OnboardingScreen>
    );
  }

  if (state.screen === "returning-unavailable") {
    return (
      <OnboardingScreen
        testID="returning-unavailable-screen"
        title={t("newOwnerOnboarding.restoration.unavailableTitle")}
        contentClassName="gap-3 justify-center"
      >
        <Text
          accessibilityRole="alert"
          className="text-base mb-5"
          style={{ color: isDark ? TEXT.dark.secondary : TEXT.light.secondary }}
        >
          {t("newOwnerOnboarding.restoration.unavailableDescription")}
        </Text>
        <Button wrapText onPress={handleRetry} testID="returning-retry-button">
          {t("common.retry")}
        </Button>
        <Button wrapText variant="ghost" onPress={handleSignOut} testID="returning-sign-out-button">
          {t("auth.signOut")}
        </Button>
      </OnboardingScreen>
    );
  }

  if (!RETURNING_SCREENS.has(state.screen)) {
    router.replace("/onboarding/owner");
  }
  return <View className="flex-1" />;
}
