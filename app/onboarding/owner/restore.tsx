import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth, useBaby, useHousehold, useTheme } from "@/contexts";
import { ACTION, SURFACE, TEXT } from "@/constants/colors";
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

  const backgroundColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const primaryText = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const secondaryText = isDark ? TEXT.dark.secondary : TEXT.light.secondary;

  if (!state || state.screen === "returning-restoring") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-6" style={{ backgroundColor }} testID="returning-restoring-screen">
        <ActivityIndicator size="large" color={isDark ? ACTION.dark.primary : ACTION.light.primary} />
        <Text className="text-xl font-bold mt-6 text-center" style={{ color: primaryText }}>
          {t("newOwnerOnboarding.restoration.loadingTitle")}
        </Text>
        <Text className="text-base mt-3 text-center" style={{ color: secondaryText }}>
          {t("newOwnerOnboarding.restoration.loadingDescription")}
        </Text>
      </SafeAreaView>
    );
  }

  if (state.screen === "returning-verified-empty") {
    return (
      <SafeAreaView className="flex-1 px-6 justify-center" style={{ backgroundColor }} testID="returning-verified-empty-screen">
        <Text className="text-3xl font-bold text-center" style={{ color: primaryText }}>
          {t("newOwnerOnboarding.restoration.emptyTitle")}
        </Text>
        <Text className="text-base mt-3 mb-8 text-center" style={{ color: secondaryText }}>
          {t("newOwnerOnboarding.restoration.emptyDescription")}
        </Text>
        <View className="gap-3">
          <Pressable
            onPress={handleAddBaby}
            className="rounded-button-lg py-4 items-center"
            style={{ backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary }}
            testID="returning-add-baby-button"
          >
            <Text className="text-white text-base font-bold">
              {t("newOwnerOnboarding.restoration.addBaby")}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleJoinFamily}
            className="rounded-button-lg py-4 items-center border"
            style={{ borderColor: secondaryText }}
            testID="returning-join-family-button"
          >
            <Text className="text-base font-semibold" style={{ color: primaryText }}>
              {t("newOwnerOnboarding.restoration.joinFamily")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state.screen === "returning-unavailable") {
    return (
      <SafeAreaView className="flex-1 px-6 justify-center" style={{ backgroundColor }} testID="returning-unavailable-screen">
        <Text className="text-3xl font-bold text-center" style={{ color: primaryText }}>
          {t("newOwnerOnboarding.restoration.unavailableTitle")}
        </Text>
        <Text className="text-base mt-3 mb-8 text-center" style={{ color: secondaryText }}>
          {t("newOwnerOnboarding.restoration.unavailableDescription")}
        </Text>
        <View className="gap-3">
          <Pressable
            onPress={handleRetry}
            className="rounded-button-lg py-4 items-center"
            style={{ backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary }}
            testID="returning-retry-button"
          >
            <Text className="text-white text-base font-bold">{t("common.retry")}</Text>
          </Pressable>
          <Pressable onPress={handleSignOut} className="py-4 items-center" testID="returning-sign-out-button">
            <Text className="text-base font-semibold" style={{ color: secondaryText }}>
              {t("auth.signOut")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!RETURNING_SCREENS.has(state.screen)) {
    router.replace("/onboarding/owner");
  }
  return <View className="flex-1" style={{ backgroundColor }} />;
}
