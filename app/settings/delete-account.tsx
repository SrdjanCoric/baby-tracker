import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth, useBaby } from "@/contexts";
import { AccountDeletionService } from "@/services/account-deletion-service";
import { DeletionWarning, DeletionConfirmation } from "@/components/account";
import { validateDeletionConfirmation } from "@/utils/account-deletion";
import type { DeletionPreview } from "@/types/account-deletion";

const EMPTY_PREVIEW: DeletionPreview = {
  feedings: 0,
  sleep: 0,
  diapers: 0,
  pumping: 0,
  growth: 0,
  tummyTime: 0,
  babies: [],
  householdWillBeDeleted: false,
  hasOtherCaregivers: false,
};

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user, signOut, verifyPassword } = useAuth();
  const { selectedBaby } = useBaby();

  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [preview, setPreview] = useState<DeletionPreview>(EMPTY_PREVIEW);
  const [confirmationText, setConfirmationText] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = validateDeletionConfirmation(confirmationText);
  const hasEmailAuth = !!user?.email;
  const canProceed = isConfirmed && (isPasswordVerified || !hasEmailAuth);

  const loadPreview = useCallback(async () => {
    if (!selectedBaby || !user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const isOnline = await AccountDeletionService.isOnline();
      if (!isOnline) {
        setError(t("accountDeletion.offlineError"));
        setIsLoading(false);
        return;
      }

      const result = await AccountDeletionService.getDeletionPreview(
        selectedBaby.id,
        user.householdId
      );
      setPreview(result);
    } catch (err) {
      setError(t("accountDeletion.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [selectedBaby, user, t]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleVerifyPassword = useCallback(async () => {
    if (!password.trim()) {
      setError(t("accountDeletion.errors.passwordRequired"));
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const { verified, error: verifyError } = await verifyPassword(password);

      if (verified) {
        setIsPasswordVerified(true);
      } else {
        setError(verifyError?.message || t("accountDeletion.errors.invalidPassword"));
      }
    } catch (err) {
      setError(t("accountDeletion.errors.verificationFailed"));
    } finally {
      setIsVerifying(false);
    }
  }, [password, verifyPassword, t]);

  const handleDelete = useCallback(async () => {
    if (!user || !canProceed) return;

    const isOnline = await AccountDeletionService.isOnline();
    if (!isOnline) {
      Alert.alert(
        t("accountDeletion.error"),
        t("accountDeletion.offlineError")
      );
      return;
    }

    Alert.alert(
      t("accountDeletion.finalConfirmTitle"),
      t("accountDeletion.finalConfirmMessage"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("accountDeletion.deleteButton"),
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            setError(null);

            try {
              const result = await AccountDeletionService.deleteAccount(
                user.id
              );

              if (result.success) {
                await signOut();
              } else {
                const errorKey = result.error as "deletionFailed" | "networkError" | "unknown";
                const errorMessages = {
                  deletionFailed: t("accountDeletion.errors.deletionFailed"),
                  networkError: t("accountDeletion.errors.networkError"),
                  unknown: t("accountDeletion.errors.unknown"),
                };
                setError(errorMessages[errorKey] || errorMessages.unknown);
                setIsDeleting(false);
              }
            } catch (err) {
              setError(t("accountDeletion.errors.unknown"));
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [user, canProceed, signOut, t]);

  if (!user) {
    return (
      <SafeAreaView
        className="flex-1 bg-surface dark:bg-surface-dark"
        edges={["top", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center">
            {t("accountDeletion.notLoggedIn")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-surface dark:bg-surface-dark"
      edges={["top", "bottom"]}
    >
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("accountDeletion.title")}
        </Text>
      </View>

      {isDeleting ? (
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" />
          <Text className="text-content-secondary dark:text-content-dark-secondary mt-4 text-center">
            {t("accountDeletion.deletingAccount")}
          </Text>
        </View>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="text-content-secondary dark:text-content-dark-secondary mt-2">
            {t("accountDeletion.loading")}
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-4 py-6"
            showsVerticalScrollIndicator={false}
          >
            {error && (
              <View className="bg-red-100 dark:bg-red-900/30 rounded-xl p-4 mb-6">
                <Text className="text-red-700 dark:text-red-300">{error}</Text>
              </View>
            )}

            <DeletionWarning preview={preview} />

            <DeletionConfirmation
              value={confirmationText}
              onChangeText={setConfirmationText}
              isValid={isConfirmed}
            />

            {hasEmailAuth && isConfirmed && !isPasswordVerified && (
              <View className="mt-6">
                <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-2">
                  {t("accountDeletion.verifyPassword")}
                </Text>
                <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-4">
                  {t("accountDeletion.verifyPasswordDescription")}
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  className={`px-4 py-4 rounded-lg border ${
                    isDark
                      ? "border-gray-700 bg-gray-800 text-white"
                      : "border-gray-300 bg-gray-50 text-gray-900"
                  }`}
                />
                <Pressable
                  onPress={handleVerifyPassword}
                  disabled={isVerifying || !password.trim()}
                  accessibilityRole="button"
                  className={`mt-3 py-3 rounded-lg items-center ${
                    password.trim() && !isVerifying
                      ? "bg-primary-500"
                      : "bg-gray-300 dark:bg-gray-700"
                  }`}
                >
                  {isVerifying ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-medium">
                      {t("accountDeletion.verifyButton")}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            {isPasswordVerified && (
              <View className="mt-4 p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Text className="text-green-700 dark:text-green-300 text-center">
                  {t("accountDeletion.passwordVerified")}
                </Text>
              </View>
            )}
          </ScrollView>

          <View className="px-4 pb-4 pt-2 border-t border-border-subtle dark:border-border-dark-subtle">
            <Pressable
              onPress={handleDelete}
              disabled={!canProceed}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canProceed }}
              accessibilityLabel={t("accountDeletion.deleteButton")}
              testID="delete-account-button"
              className={`py-4 rounded-button-lg items-center ${
                canProceed
                  ? "bg-red-500 active:bg-red-600"
                  : "bg-gray-300 dark:bg-gray-700"
              }`}
            >
              <Text
                className={`text-lg font-semibold ${
                  canProceed ? "text-white" : "text-gray-500"
                }`}
              >
                {t("accountDeletion.deleteButton")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              testID="cancel-button"
              className="py-3 mt-2 items-center"
            >
              <Text className="text-base text-primary-500 dark:text-primary-400">
                {t("common.cancel")}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
