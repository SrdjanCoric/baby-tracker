import { useCallback, useState, useEffect } from "react";
import {
  Pressable,
  Text,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useHousehold, useAuth } from "@/contexts";
import { validateInviteCode, normalizeInviteCode, formatInviteCodeForDisplay } from "@/utils/inviteCode";

type JoinErrorKey =
  | "household.inviteCodeRequired"
  | "household.inviteCodeLength"
  | "household.inviteCodeInvalidChars"
  | "household.householdNotFound"
  | "household.alreadyInHousehold"
  | "household.joinFailed"
  | "errors.generic";

const ERROR_TRANSLATIONS: Record<string, JoinErrorKey> = {
  inviteCodeRequired: "household.inviteCodeRequired",
  inviteCodeLength: "household.inviteCodeLength",
  inviteCodeInvalidChars: "household.inviteCodeInvalidChars",
  householdNotFound: "household.householdNotFound",
  alreadyInHousehold: "household.alreadyInHousehold",
  joinFailed: "household.joinFailed",
};

export default function JoinHouseholdScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { joinHousehold, clearError } = useHousehold();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Clear any context error when leaving this screen
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleSignIn = useCallback(() => {
    router.dismissAll();
    router.push("/auth/sign-in");
  }, [router]);

  const handleCodeChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const formatted = formatInviteCodeForDisplay(cleaned);
    setInviteCode(formatted);
    setError(null);
  }, []);

  const handleJoin = useCallback(async () => {
    const normalized = normalizeInviteCode(inviteCode);
    const validation = validateInviteCode(normalized);

    if (!validation.isValid) {
      setError(validation.error ?? "inviteCodeInvalidChars");
      return;
    }

    setIsJoining(true);
    setError(null);

    const result = await joinHousehold(normalized);

    setIsJoining(false);

    if (result.success) {
      Alert.alert(
        t("common.success"),
        t("household.joinSuccess"),
        [{ text: t("common.ok"), onPress: () => router.back() }]
      );
    } else if (result.error) {
      setError(result.error);
    }
  }, [inviteCode, joinHousehold, router, t]);

  const displayedError = error ? t(ERROR_TRANSLATIONS[error] || "errors.generic") : null;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("household.joinHousehold")}
        </Text>
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
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 px-4 py-6">
            <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-6">
              <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-6">
                {t("household.joinHouseholdDescription")}
              </Text>

              <View className="mb-4">
                <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
                  {t("household.enterInviteCode")}
                </Text>
                <TextInput
                  testID="invite-code-input"
                  value={inviteCode}
                  onChangeText={handleCodeChange}
                  placeholder={t("household.inviteCodePlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={9}
                  className="bg-surface-secondary dark:bg-surface-dark-secondary px-4 py-3 rounded-lg text-center text-2xl font-bold tracking-widest text-content-primary dark:text-content-dark-primary"
                  accessibilityLabel={t("household.enterInviteCode")}
                />
              </View>

              {displayedError && (
                <View className="mb-4 p-3 bg-error/10 rounded-lg">
                  <Text className="text-sm text-error text-center">
                    {displayedError}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleJoin}
                disabled={isJoining}
                className="bg-primary dark:bg-primary-dark py-4 rounded-lg items-center active:opacity-80 disabled:opacity-50"
                accessibilityRole="button"
              >
                {isJoining ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-base font-semibold text-white ml-2">
                      {t("household.joining")}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {t("household.join")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
