import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useAuth, useTheme } from "@/contexts";
import { ACTION, SURFACE, TEXT } from "@/constants/colors";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import type { NewOwnerOnboardingState } from "@/types/new-owner-onboarding";

export function ReturningUserProfileFallback() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark } = useTheme();
  const { refreshUserProfile, signOut } = useAuth();
  const [state, setState] = useState<NewOwnerOnboardingState | null>(null);
  const operationRef = useRef(0);

  const reloadState = useCallback(async () => {
    const current = await NewOwnerOnboardingStorageService.getState("system");
    setState(current);
    return current;
  }, []);

  const restoreProfile = useCallback(async (attempt: number) => {
    const operation = ++operationRef.current;
    try {
      const profile = await refreshUserProfile();
      if (operationRef.current !== operation) return;
      if (!profile.householdId) throw new Error("Profile household is unavailable");
      await NewOwnerOnboardingStorageService.attachReturningHousehold(
        attempt,
        profile.householdId
      );
    } catch {
      if (operationRef.current !== operation) return;
      await NewOwnerOnboardingStorageService.markReturningUnavailable(attempt, "profile");
      if (operationRef.current === operation) await reloadState();
    }
  }, [refreshUserProfile, reloadState]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const current = await NewOwnerOnboardingStorageService.getState("system");
      if (!active) return;
      setState(current);

      let attempt: number | null = null;
      if (current.screen === "returning-auth") {
        attempt = await NewOwnerOnboardingStorageService.beginReturningRestoration();
      } else if (current.screen === "returning-restoring") {
        attempt = current.attempt;
      } else if (current.screen === "returning-verified-empty" ||
        current.screen === "returning-restored") {
        attempt = await NewOwnerOnboardingStorageService.revalidateReturningRestoration();
      }
      if (active && attempt !== null) void restoreProfile(attempt);
    };
    void initialize();
    return () => {
      active = false;
      operationRef.current += 1;
    };
  }, [restoreProfile]);

  const handleRetry = useCallback(async () => {
    operationRef.current += 1;
    const attempt = await NewOwnerOnboardingStorageService.retryReturningRestoration();
    if (attempt === null) return;
    const current = await reloadState();
    if (current.screen === "returning-restoring" && current.attempt === attempt) {
      void restoreProfile(attempt);
    }
  }, [reloadState, restoreProfile]);

  const handleSignOut = useCallback(async () => {
    operationRef.current += 1;
    const { error } = await signOut();
    if (error) return;
    await NewOwnerOnboardingStorageService.markReturningSignedOut();
    router.replace("/onboarding/owner");
  }, [router, signOut]);

  const backgroundColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const primaryText = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const secondaryText = isDark ? TEXT.dark.secondary : TEXT.light.secondary;

  if (state?.screen === "returning-unavailable") {
    return (
      <View className="flex-1 px-6 justify-center" style={{ backgroundColor }} testID="returning-profile-unavailable">
        <Text className="text-3xl font-bold text-center" style={{ color: primaryText }}>
          {t("newOwnerOnboarding.restoration.unavailableTitle")}
        </Text>
        <Text className="text-base mt-3 mb-8 text-center" style={{ color: secondaryText }}>
          {t("newOwnerOnboarding.restoration.unavailableDescription")}
        </Text>
        <Pressable
          onPress={handleRetry}
          className="rounded-button-lg py-4 items-center"
          style={{ backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary }}
          testID="returning-profile-retry-button"
        >
          <Text className="text-white text-base font-bold">{t("common.retry")}</Text>
        </Pressable>
        <Pressable
          onPress={handleSignOut}
          className="py-4 items-center"
          testID="returning-profile-sign-out-button"
        >
          <Text className="text-base font-semibold" style={{ color: secondaryText }}>
            {t("auth.signOut")}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (state?.screen !== "returning-auth" &&
    state?.screen !== "returning-restoring" &&
    state?.screen !== "returning-verified-empty" &&
    state?.screen !== "returning-restored") {
    return null;
  }

  return (
    <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor }} testID="returning-profile-loading">
      <ActivityIndicator size="large" color={isDark ? ACTION.dark.primary : ACTION.light.primary} />
      <Text className="text-xl font-bold mt-6 text-center" style={{ color: primaryText }}>
        {t("newOwnerOnboarding.restoration.loadingTitle")}
      </Text>
    </View>
  );
}
