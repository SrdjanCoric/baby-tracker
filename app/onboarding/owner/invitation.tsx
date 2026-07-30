import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { useLanguage } from "@/contexts";
import {
  createCaregiverInvitation,
  listCaregiverInvitations,
  type CaregiverInvitation,
} from "@/services/household-service";
import { formatInviteCodeForDisplay } from "@/utils/inviteCode";
import { ACTION, SURFACE, TEXT } from "@/constants/colors";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

export default function NewOwnerInvitationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useLanguage();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryTextColor = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const secondaryTextColor = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const [email, setEmail] = useState("");
  const [invitation, setInvitation] = useState<CaregiverInvitation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const restoreInvitation = async () => {
      const state = await NewOwnerOnboardingStorageService.getState(language);
      if (!active || state.screen !== "invitation" || state.invitation.status !== "ready") return;
      setIsRestoring(true);
      setRestoreFailed(false);
      const invitationId = state.invitation.invitationId;
      const result = await listCaregiverInvitations();
      if (!active) return;
      const restored = result.data?.find(item => item.id === invitationId) ?? null;
      setIsRestoring(false);
      if (restored) {
        setInvitation(restored);
      } else {
        setRestoreFailed(true);
      }
    };
    void restoreInvitation();
    return () => {
      active = false;
    };
  }, [language, restoreAttempt]);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    setError(null);
    const result = await createCaregiverInvitation(email);
    setIsCreating(false);
    if (!result.data) {
      setError(result.error ?? "invitationCreateFailed");
      return;
    }
    await NewOwnerOnboardingStorageService.markInvitationReady(result.data.id);
    setInvitation(result.data);
  }, [email]);

  const handleNotNow = useCallback(async () => {
    await NewOwnerOnboardingStorageService.skipInvitation();
    router.replace("/onboarding/owner/activity");
  }, [router]);

  const handleSkipRemaining = useCallback(async () => {
    await NewOwnerOnboardingStorageService.completeRemainingSetup();
    router.replace("/(tabs)");
  }, [router]);

  const handleShare = useCallback(async () => {
    if (!invitation) return;
    try {
      await Share.share({
        message: t("household.shareMessage", {
          code: formatInviteCodeForDisplay(invitation.inviteCode),
        }),
      });
    } catch {
      return;
    }
  }, [invitation, t]);

  const inputError = error
    ? t(error === "invalidCaregiverEmail"
      ? "household.invalidCaregiverEmail"
      : "household.invitationCreateFailed")
    : undefined;

  return (
    <OnboardingScreen
      testID="new-owner-invitation-screen"
      title={t("newOwnerOnboarding.invitation.title")}
      description={t("newOwnerOnboarding.invitation.description")}
    >
      {isRestoring ? (
        <View className="items-center py-4" accessibilityState={{ busy: true }}>
          <ActivityIndicator color={isDark ? ACTION.dark.primary : ACTION.light.primary} />
        </View>
      ) : restoreFailed ? (
        <View className="gap-3">
          <Text accessibilityRole="alert" style={{ color: secondaryTextColor }}>
            {t("household.invitationCreateFailed")}
          </Text>
          <Button wrapText onPress={() => setRestoreAttempt(attempt => attempt + 1)} testID="retry-invitation-restore-button">
            {t("common.retry")}
          </Button>
        </View>
      ) : invitation ? (
        <View className="rounded-card p-5" style={{ backgroundColor: isDark ? SURFACE.dark.secondary : SURFACE.light.secondary }}>
          <Text className="text-base font-semibold mb-2" style={{ color: primaryTextColor }}>
            {t("newOwnerOnboarding.invitation.ready")}
          </Text>
          <Text className="text-3xl font-bold tracking-widest" style={{ color: primaryTextColor }}>
            {formatInviteCodeForDisplay(invitation.inviteCode)}
          </Text>
        </View>
      ) : (
        <>
          <Input
            label={t("newOwnerOnboarding.invitation.email")}
            error={inputError}
            value={email}
            onChangeText={setEmail}
            placeholder={t("newOwnerOnboarding.invitation.emailPlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            testID="onboarding-caregiver-email"
          />
          <Button
            wrapText
            onPress={handleCreate}
            loading={isCreating}
            disabled={isCreating}
            testID="create-onboarding-invitation-button"
          >
            {t("newOwnerOnboarding.invitation.create")}
          </Button>
        </>
      )}
      {invitation ? (
        <>
          <Button wrapText onPress={handleShare} testID="share-onboarding-invitation-button">
            {t("newOwnerOnboarding.invitation.share")}
          </Button>
          <Button wrapText variant="secondary" onPress={handleNotNow} testID="continue-after-invitation-button">
            {t("newOwnerOnboarding.invitation.continue")}
          </Button>
        </>
      ) : (
        <Button wrapText variant="secondary" onPress={handleNotNow} testID="invitation-not-now-button">
          {t("newOwnerOnboarding.invitation.notNow")}
        </Button>
      )}
      <Button wrapText variant="ghost" onPress={handleSkipRemaining} testID="invitation-skip-remaining-button">
        {t("newOwnerOnboarding.invitation.skipRemaining")}
      </Button>
    </OnboardingScreen>
  );
}
