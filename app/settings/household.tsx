import { useCallback, useState } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { useHousehold, useAuth } from "@/contexts";
import { formatInviteCodeForDisplay } from "@/utils/inviteCode";

type HouseholdErrorKey =
  | "household.householdNotFound"
  | "household.householdFetchFailed"
  | "household.membersFetchFailed"
  | "household.regenerateFailed"
  | "errors.generic";

const ERROR_TRANSLATIONS: Record<string, HouseholdErrorKey> = {
  householdNotFound: "household.householdNotFound",
  householdFetchFailed: "household.householdFetchFailed",
  membersFetchFailed: "household.membersFetchFailed",
  regenerateFailed: "household.regenerateFailed",
};

export default function HouseholdSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { household, members, isLoading, error, regenerateCode } = useHousehold();
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const inviteCode = household?.inviteCode ?? null;

  const handleSignIn = useCallback(() => {
    router.push("/auth/sign-in");
  }, [router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleCopyCode = useCallback(async () => {
    if (!inviteCode) return;

    await Clipboard.setStringAsync(inviteCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [inviteCode]);

  const handleShareCode = useCallback(async () => {
    if (!inviteCode) return;

    const message = t("household.shareMessage", { code: inviteCode });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync("", {
        dialogTitle: t("household.shareInviteCode"),
        mimeType: "text/plain",
      });
    } else {
      await Clipboard.setStringAsync(message);
      Alert.alert(t("common.success"), t("household.copied"));
    }
  }, [inviteCode, t]);

  const handleRegenerateCode = useCallback(() => {
    Alert.alert(
      t("household.regenerateCode"),
      t("household.regenerateCodeConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.confirm"),
          style: "destructive",
          onPress: async () => {
            setIsRegenerating(true);
            const success = await regenerateCode();
            setIsRegenerating(false);
            if (success) {
              Alert.alert(t("common.success"), t("household.codeRegenerated"));
            }
          },
        },
      ]
    );
  }, [regenerateCode, t]);

  const handleJoinHousehold = useCallback(() => {
    router.push("/settings/join-household");
  }, [router]);

  const formattedCode = inviteCode
    ? formatInviteCodeForDisplay(inviteCode)
    : "----";

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <Pressable
          onPress={handleBack}
          className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text className="text-2xl">{"\u{2190}"}</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {t("household.title")}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      {!isAuthenticated ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">🏠</Text>
          <Text className="text-xl font-semibold text-content-primary dark:text-content-dark-primary mb-2 text-center">
            {t("household.signInRequired")}
          </Text>
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center mb-6">
            {t("household.signInRequiredDescription")}
          </Text>
          <Pressable
            onPress={handleSignIn}
            className="bg-primary dark:bg-primary-dark px-8 py-4 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">
              {t("auth.signIn")}
            </Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">😕</Text>
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center">
            {t(ERROR_TRANSLATIONS[error] || "errors.generic")}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-6">
          {/* Invite Code Section */}
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-6 mb-6">
            <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
              {t("household.inviteCode")}
            </Text>

            <View className="items-center py-4">
              <Text className="text-4xl font-bold tracking-widest text-content-primary dark:text-content-dark-primary mb-2">
                {formattedCode}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary text-center">
                {t("household.inviteCodeDescription")}
              </Text>
            </View>

            <View className="flex-row gap-3 mt-4">
              <Pressable
                onPress={handleCopyCode}
                className="flex-1 bg-surface-secondary dark:bg-surface-dark-secondary py-3 rounded-lg items-center active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel={t("household.copyInviteCode")}
              >
                <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
                  {isCopied ? "✓ " + t("household.copied") : "📋 " + t("household.copyInviteCode")}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleShareCode}
                className="flex-1 bg-primary dark:bg-primary-dark py-3 rounded-lg items-center active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel={t("household.shareInviteCode")}
              >
                <Text className="text-base font-medium text-white">
                  {"📤 " + t("household.shareInviteCode")}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleRegenerateCode}
              disabled={isRegenerating}
              className="mt-4 py-2 items-center active:opacity-60"
              accessibilityRole="button"
            >
              {isRegenerating ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                  {t("household.regenerateCode")}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Members Section */}
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            <View className="px-4 py-3 border-b border-border-subtle dark:border-border-dark-subtle">
              <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary">
                {t("household.members")} ({members.length})
              </Text>
            </View>

            {members.map((member, index) => (
              <View key={member.id}>
                <View className="flex-row items-center px-4 py-3">
                  <View className="w-10 h-10 rounded-full bg-primary/20 dark:bg-primary-dark/20 items-center justify-center mr-3">
                    <Text className="text-lg">👤</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base text-content-primary dark:text-content-dark-primary">
                      {member.displayName || member.email || t("common.anonymous")}
                    </Text>
                    {member.displayName && member.email && (
                      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                        {member.email}
                      </Text>
                    )}
                  </View>
                </View>
                {index < members.length - 1 && (
                  <View className="h-px bg-border-subtle dark:bg-border-dark-subtle ml-16" />
                )}
              </View>
            ))}

            {members.length === 0 && (
              <View className="px-4 py-6 items-center">
                <Text className="text-content-tertiary dark:text-content-dark-tertiary">
                  {t("common.noData")}
                </Text>
              </View>
            )}
          </View>

          {/* Join Another Household Section */}
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-6 mt-6">
            <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
              {t("household.joinHousehold")}
            </Text>
            <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mb-4">
              {t("household.joinHouseholdDescription")}
            </Text>
            <Pressable
              onPress={handleJoinHousehold}
              className="bg-surface-secondary dark:bg-surface-dark-secondary py-3 rounded-lg items-center active:opacity-80"
              accessibilityRole="button"
              testID="join-household-button"
            >
              <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
                {t("household.joinHousehold")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
