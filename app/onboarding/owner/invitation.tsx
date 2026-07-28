import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { ACTION, BORDER, SURFACE, TEXT } from "@/constants/colors";

export default function NewOwnerInvitationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useLanguage();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const primaryTextColor = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const secondaryTextColor = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const borderColor = isDark ? BORDER.dark.default : BORDER.light.default;
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

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }} testID="new-owner-invitation-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <Pressable onPress={Keyboard.dismiss} className="py-3" testID="dismiss-keyboard" />
        <ScrollView contentContainerClassName="flex-grow justify-center px-6" keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-bold mb-3" style={{ color: primaryTextColor }}>
          {t("newOwnerOnboarding.invitation.title")}
        </Text>
        <Text className="text-base leading-6 mb-8" style={{ color: secondaryTextColor }}>
          {t("newOwnerOnboarding.invitation.description")}
        </Text>
        {isRestoring ? (
          <ActivityIndicator className="mb-4" />
        ) : restoreFailed ? (
          <View className="mb-4">
            <Text className="text-red-500 mb-3">
              {t("household.invitationCreateFailed")}
            </Text>
            <Pressable
              onPress={() => setRestoreAttempt(attempt => attempt + 1)}
              className="rounded-button-lg py-4 items-center"
              style={{ backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary }}
              accessibilityRole="button"
              testID="retry-invitation-restore-button"
            >
              <Text className="text-white text-base font-semibold">{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : invitation ? (
          <View className="rounded-card p-5 mb-4" style={{ backgroundColor: isDark ? SURFACE.dark.secondary : SURFACE.light.secondary }}>
            <Text className="text-base font-semibold mb-2" style={{ color: primaryTextColor }}>
              {t("newOwnerOnboarding.invitation.ready")}
            </Text>
            <Text className="text-3xl font-bold tracking-widest" style={{ color: primaryTextColor }}>
              {formatInviteCodeForDisplay(invitation.inviteCode)}
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-sm font-semibold mb-2" style={{ color: primaryTextColor }}>
              {t("newOwnerOnboarding.invitation.email")}
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("newOwnerOnboarding.invitation.emailPlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              className="rounded-lg border px-4 py-4 mb-3"
              style={{ borderColor, color: primaryTextColor }}
              testID="onboarding-caregiver-email"
            />
            {error && (
              <Text className="text-red-500 mb-3">
                {t(error === "invalidCaregiverEmail"
                  ? "household.invalidCaregiverEmail"
                  : "household.invitationCreateFailed")}
              </Text>
            )}
            <Pressable
              onPress={handleCreate}
              disabled={isCreating}
              className="rounded-button-lg py-4 items-center mb-3"
              style={{
                backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary,
                opacity: isCreating ? 0.5 : 1,
              }}
              accessibilityRole="button"
              testID="create-onboarding-invitation-button"
            >
              {isCreating ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-base font-semibold">
                  {t("newOwnerOnboarding.invitation.create")}
                </Text>
              )}
            </Pressable>
          </>
        )}
        {invitation ? (
          <>
            <Pressable
              onPress={handleShare}
              className="rounded-button-lg py-4 items-center mb-3"
              style={{ backgroundColor: ACTION.light.primary }}
              accessibilityRole="button"
              testID="share-onboarding-invitation-button"
            >
              <Text className="text-white text-base font-semibold">
                {t("newOwnerOnboarding.invitation.share")}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleNotNow}
              className="rounded-button-lg border py-4 items-center"
              style={{ borderColor }}
              accessibilityRole="button"
              testID="continue-after-invitation-button"
            >
              <Text className="text-base font-semibold" style={{ color: primaryTextColor }}>
                {t("newOwnerOnboarding.invitation.continue")}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={handleNotNow}
            className="rounded-button-lg border py-4 items-center"
            style={{ borderColor }}
            accessibilityRole="button"
            testID="invitation-not-now-button"
          >
            <Text className="text-base font-semibold" style={{ color: primaryTextColor }}>
              {t("newOwnerOnboarding.invitation.notNow")}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleSkipRemaining}
          className="py-4 items-center"
          accessibilityRole="button"
          testID="invitation-skip-remaining-button"
        >
          <Text className="text-sm" style={{ color: secondaryTextColor }}>
            {t("newOwnerOnboarding.invitation.skipRemaining")}
          </Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
