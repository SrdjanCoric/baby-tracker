import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth, useBaby, useHousehold, useTheme } from "@/contexts";
import { ACTION, SEMANTIC, SURFACE, TEXT } from "@/constants/colors";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import type { JoinHouseholdError } from "@/services/household-service";
import type {
  CaregiverCodeValidationReason,
  CaregiverJoinFailureReason,
  CaregiverJoinFailureState,
  CaregiverJoinRefreshState,
  NewOwnerOnboardingState,
} from "@/types/new-owner-onboarding";
import { formatInviteCodeForDisplay } from "@/utils/inviteCode";

const JOIN_ERROR_KEYS: Record<CaregiverJoinFailureReason, string> = {
  invalidInvitation: "household.invalidInvitation",
  alreadyInHousehold: "household.alreadyInHousehold",
  ownHousehold: "newOwnerOnboarding.join.ownHousehold",
  sharedHousehold: "household.alreadyInHousehold",
  rateLimitExceeded: "household.rateLimitExceeded",
  joinFailed: "household.joinFailed",
  offline: "newOwnerOnboarding.join.offline",
  refreshFailed: "newOwnerOnboarding.join.refreshFailed",
};

function toJoinFailureReason(error: JoinHouseholdError): CaregiverJoinFailureReason {
  if (error === "alreadyInOwnHousehold") return "ownHousehold";
  if (error === "alreadyInSharedHousehold") return "sharedHousehold";
  if (error === "invalidInvitation" ||
    error === "alreadyInHousehold" ||
    error === "rateLimitExceeded" ||
    error === "joinFailed" ||
    error === "offline") {
    return error;
  }
  return "joinFailed";
}

export default function JoinFamilyOnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark } = useTheme();
  const { isAuthenticated, refreshUserProfile } = useAuth();
  const { babies, isLoading: babiesLoading, refreshBabies } = useBaby();
  const {
    members,
    isLoading: householdLoading,
    joinHousehold,
    refreshHousehold,
  } = useHousehold();
  const [state, setState] = useState<NewOwnerOnboardingState | null>(null);
  const [displayCode, setDisplayCode] = useState("");
  const [localError, setLocalError] = useState<CaregiverCodeValidationReason | "joinFailed" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loadedRef = useRef(false);
  const joinSubmissionRef = useRef(false);

  const showRefreshFailure = useCallback(async (refreshState: CaregiverJoinRefreshState) => {
    await NewOwnerOnboardingStorageService.markCaregiverRefreshFailure();
    setState({
      ...refreshState,
      screen: "join-failure",
      recovery: "refresh",
      reason: "refreshFailed",
    });
  }, []);

  const refreshJoinedHousehold = useCallback(async (refreshState: CaregiverJoinRefreshState) => {
    setState(refreshState);
    setLocalError(null);
    try {
      const profile = await refreshUserProfile();
      if (profile.householdId !== refreshState.householdId) {
        throw new Error("Joined household profile is not ready");
      }
      const [, loadedBabies] = await Promise.all([
        refreshHousehold(refreshState.householdId),
        refreshBabies(refreshState.householdId),
      ]);
      const selectedBaby = loadedBabies[0];
      if (!selectedBaby) throw new Error("Joined household has no baby");
      await NewOwnerOnboardingStorageService.completeCaregiverJoin(selectedBaby.id);
      router.replace("/(tabs)");
    } catch {
      await showRefreshFailure(refreshState);
    }
  }, [refreshBabies, refreshHousehold, refreshUserProfile, router, showRefreshFailure]);

  const reconcileInterruptedJoin = useCallback(async (
    joiningState: Extract<NewOwnerOnboardingState, { screen: "joining" }>
  ) => {
    try {
      const profile = await refreshUserProfile();
      if (!profile.householdId) throw new Error("Household profile is unavailable");
      await NewOwnerOnboardingStorageService.recoverInterruptedCaregiverJoin(profile.householdId);
      if (profile.householdId !== joiningState.sourceHouseholdId) {
        await refreshJoinedHousehold({
          version: joiningState.version,
          screen: "join-refresh",
          language: joiningState.language,
          entryPath: "caregiver",
          pendingCode: joiningState.pendingCode,
          householdId: profile.householdId,
        });
        return;
      }
      setState({ ...joiningState, screen: "join-confirmation" });
    } catch {
      await NewOwnerOnboardingStorageService.markCaregiverReconciliationFailure();
      setState({
        version: joiningState.version,
        screen: "join-failure",
        language: joiningState.language,
        entryPath: "caregiver",
        pendingCode: joiningState.pendingCode,
        recovery: "reconcile",
        reason: "offline",
        householdId: joiningState.sourceHouseholdId,
      });
    }
  }, [refreshJoinedHousehold, refreshUserProfile]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let active = true;

    const restore = async () => {
      const restored = await NewOwnerOnboardingStorageService.getState("system");
      if (!active) return;
      setState(restored);
      if ("pendingCode" in restored) {
        setDisplayCode(formatInviteCodeForDisplay(restored.pendingCode));
      }

      const needsPostSubmitAuthentication = restored.screen === "joining" ||
        restored.screen === "join-refresh" ||
        (restored.screen === "join-failure" && restored.recovery !== "confirmation");
      if (needsPostSubmitAuthentication && !isAuthenticated) {
        router.replace("/auth/sign-in?resumeOnboarding=true");
        return;
      }
      if (restored.screen === "join-refresh") {
        await refreshJoinedHousehold(restored);
        return;
      }
      if (restored.screen === "joining" && isAuthenticated) {
        await reconcileInterruptedJoin(restored);
      }
    };

    void restore();
    return () => {
      active = false;
    };
  }, [isAuthenticated, reconcileInterruptedJoin, refreshJoinedHousehold, router]);

  const handleCodeChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    setDisplayCode(formatInviteCodeForDisplay(cleaned));
    setLocalError(null);
  }, []);

  const handleContinue = useCallback(async () => {
    const result = await NewOwnerOnboardingStorageService.beginCaregiverAuthentication(displayCode);
    if (!result.success) {
      setLocalError(result.error);
      return;
    }
    router.push("/auth/sign-in?onboardingIntent=join-family");
  }, [displayCode, router]);

  const executeJoin = useCallback(async (
    confirmationState: Extract<NewOwnerOnboardingState, { screen: "join-confirmation" }>
  ) => {
    await NewOwnerOnboardingStorageService.beginCaregiverJoin();
    setState({ ...confirmationState, screen: "joining" });
    setLocalError(null);

    try {
      const result = await joinHousehold(confirmationState.pendingCode);
      if (!result.success) {
        const reason = toJoinFailureReason(result.error);
        if (reason === "offline") {
          await NewOwnerOnboardingStorageService.markCaregiverReconciliationFailure();
          setState({
            version: confirmationState.version,
            screen: "join-failure",
            language: confirmationState.language,
            entryPath: "caregiver",
            pendingCode: confirmationState.pendingCode,
            recovery: "reconcile",
            reason,
            householdId: confirmationState.sourceHouseholdId,
          });
          return;
        }
        await NewOwnerOnboardingStorageService.markCaregiverJoinFailure(reason);
        setState({
          version: confirmationState.version,
          screen: "join-failure",
          language: confirmationState.language,
          entryPath: "caregiver",
          pendingCode: confirmationState.pendingCode,
          recovery: "confirmation",
          reason,
          householdId: confirmationState.sourceHouseholdId,
        });
        return;
      }

      await NewOwnerOnboardingStorageService.markCaregiverJoinRedeemed(result.householdId);
      await refreshJoinedHousehold({
        version: confirmationState.version,
        screen: "join-refresh",
        language: confirmationState.language,
        entryPath: "caregiver",
        pendingCode: confirmationState.pendingCode,
        householdId: result.householdId,
      });
    } catch {
      await NewOwnerOnboardingStorageService.markCaregiverReconciliationFailure();
      setState({
        version: confirmationState.version,
        screen: "join-failure",
        language: confirmationState.language,
        entryPath: "caregiver",
        pendingCode: confirmationState.pendingCode,
        recovery: "reconcile",
        reason: "offline",
        householdId: confirmationState.sourceHouseholdId,
      });
    }
  }, [joinHousehold, refreshJoinedHousehold]);

  const handleJoin = useCallback(async () => {
    if (!state || state.screen !== "join-confirmation" || joinSubmissionRef.current) return;
    joinSubmissionRef.current = true;
    setIsSubmitting(true);
    const releaseSubmission = () => {
      joinSubmissionRef.current = false;
      setIsSubmitting(false);
    };

    try {
      const codeResult = await NewOwnerOnboardingStorageService.updateCaregiverCode(displayCode);
      if (!codeResult.success) {
        setLocalError(codeResult.error);
        releaseSubmission();
        return;
      }
      const confirmationState = { ...state, pendingCode: codeResult.pendingCode };
      setState(confirmationState);
      const finishJoin = async () => {
        try {
          await executeJoin(confirmationState);
        } finally {
          releaseSubmission();
        }
      };
      const hasSoloBabyData = babies.length > 0 && members.length <= 1;
      if (!hasSoloBabyData) {
        await finishJoin();
        return;
      }
      Alert.alert(
        t("newOwnerOnboarding.join.deleteDataTitle"),
        t("newOwnerOnboarding.join.deleteDataWarning", { count: babies.length }),
        [
          { text: t("common.cancel"), style: "cancel", onPress: releaseSubmission },
          {
            text: t("newOwnerOnboarding.join.deleteDataAndJoin"),
            style: "destructive",
            onPress: () => void finishJoin(),
          },
        ]
      );
    } catch {
      releaseSubmission();
      setLocalError("joinFailed");
    }
  }, [babies.length, displayCode, executeJoin, members.length, state, t]);

  const handleRetry = useCallback(async () => {
    if (!state || state.screen !== "join-failure") return;
    await NewOwnerOnboardingStorageService.retryCaregiverJoin();
    if (state.recovery === "reconcile") {
      const joiningState = {
        version: state.version,
        screen: "joining" as const,
        language: state.language,
        entryPath: "caregiver" as const,
        pendingCode: state.pendingCode,
        sourceHouseholdId: state.householdId,
      };
      setState(joiningState);
      await reconcileInterruptedJoin(joiningState);
      return;
    }
    if (state.recovery === "refresh") {
      await refreshJoinedHousehold({
        version: state.version,
        screen: "join-refresh",
        language: state.language,
        entryPath: "caregiver",
        pendingCode: state.pendingCode,
        householdId: state.householdId,
      });
      return;
    }
    setState({
      version: state.version,
      screen: "join-confirmation",
      language: state.language,
      entryPath: "caregiver",
      pendingCode: state.pendingCode,
      sourceHouseholdId: state.householdId,
    });
  }, [reconcileInterruptedJoin, refreshJoinedHousehold, state]);

  if (!state) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" testID="join-family-screen">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const isCodeEntry = state.screen === "join-code";
  const isConfirmation = state.screen === "join-confirmation";
  const failure = state.screen === "join-failure" ? state as CaregiverJoinFailureState : null;
  const isBusy = state.screen === "joining" || state.screen === "join-refresh";
  const errorKey = localError
    ? `household.${localError}`
    : failure
      ? JOIN_ERROR_KEYS[failure.reason]
      : null;

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? SURFACE.dark.background : SURFACE.light.background }}
      testID="join-family-screen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center px-6"
      >
        <View
          className="rounded-card p-6"
          style={{ backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card }}
        >
          <Text
            className="text-3xl font-bold mb-3"
            style={{ color: isDark ? TEXT.dark.primary : TEXT.light.primary }}
          >
            {t("newOwnerOnboarding.join.title")}
          </Text>
          <Text
            className="text-base leading-6 mb-6"
            style={{ color: isDark ? TEXT.dark.secondary : TEXT.light.secondary }}
          >
            {t(isConfirmation
              ? "newOwnerOnboarding.join.confirmDescription"
              : "newOwnerOnboarding.join.description")}
          </Text>

          <TextInput
            testID="join-code-input"
            value={displayCode}
            onChangeText={handleCodeChange}
            editable={isCodeEntry || isConfirmation}
            placeholder={t("household.inviteCodePlaceholder")}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={9}
            className="px-4 py-4 rounded-xl text-center text-2xl font-bold tracking-widest"
            style={{
              color: isDark ? TEXT.dark.primary : TEXT.light.primary,
              backgroundColor: isDark ? SURFACE.dark.secondary : SURFACE.light.secondary,
            }}
          />

          {errorKey && (
            <Text
              className="text-sm text-center mt-4"
              style={{ color: isDark ? SEMANTIC.error.dark : SEMANTIC.error.light }}
              testID="join-error"
            >
              {t(errorKey, { defaultValue: t("errors.generic") })}
            </Text>
          )}

          {isCodeEntry && (
            <Pressable
              onPress={handleContinue}
              className="rounded-button-lg py-4 items-center mt-6"
              style={{ backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary }}
              testID="continue-to-auth-button"
            >
              <Text className="text-white text-base font-bold">{t("common.continue")}</Text>
            </Pressable>
          )}

          {isConfirmation && (
            <Pressable
              onPress={handleJoin}
              disabled={babiesLoading || householdLoading || isSubmitting}
              className="rounded-button-lg py-4 items-center mt-6 disabled:opacity-50"
              style={{ backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary }}
              testID="join-family-submit-button"
            >
              <Text className="text-white text-base font-bold">
                {t("newOwnerOnboarding.join.submit")}
              </Text>
            </Pressable>
          )}

          {failure && (
            <Pressable
              onPress={handleRetry}
              className="rounded-button-lg py-4 items-center mt-6"
              style={{ backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary }}
              testID="retry-join-button"
            >
              <Text className="text-white text-base font-bold">{t("common.retry")}</Text>
            </Pressable>
          )}

          {isBusy && (
            <View className="flex-row items-center justify-center gap-3 mt-6">
              <ActivityIndicator color={isDark ? ACTION.dark.primary : ACTION.light.primary} />
              <Text style={{ color: isDark ? TEXT.dark.secondary : TEXT.light.secondary }}>
                {t(state.screen === "joining"
                  ? "newOwnerOnboarding.join.joining"
                  : "newOwnerOnboarding.join.loadingFamily")}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
