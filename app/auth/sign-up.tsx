import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts";
import { validateSignUp, sanitizeAuthError } from "@/validators";

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    displayName?: string;
  }>({});

  const handleSignUp = useCallback(async () => {
    const validation = validateSignUp({
      email,
      password,
      confirmPassword,
      displayName: displayName || undefined,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const { error } = await signUp(
        validation.normalizedEmail!,
        password,
        displayName || undefined
      );

      if (error) {
        console.error("Sign-up error:", error.message, error);
        const errorKey = sanitizeAuthError(error, "auth.signUpError");
        Alert.alert(t("common.error"), t(errorKey));
      } else {
        Alert.alert(t("common.success"), t("auth.checkEmail"), [
          {
            text: t("common.done"),
            onPress: () => router.replace("/auth/sign-in"),
          },
        ]);
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  }, [email, password, confirmPassword, displayName, signUp, router, t]);

  const handleGoToSignIn = useCallback(() => {
    router.back();
  }, [router]);

  const handleContinueAsGuest = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-4 pb-8">
            {/* Drag handle */}
            <View className="items-center mb-6">
              <View className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </View>

            <View className="mb-8">
              <Text className="text-3xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
                {t("auth.signUpTitle")}
              </Text>
              <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
                {t("auth.signUpSubtitle")}
              </Text>
            </View>

            <View className="mb-5">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("auth.displayName")} ({t("common.optional")})
              </Text>
              <TextInput
                className={`bg-surface-card dark:bg-surface-dark-card rounded-xl px-4 text-base text-content-primary dark:text-content-dark-primary ${
                  errors.displayName ? "border-2 border-red-500" : ""
                }`}
                style={{ fontSize: 16, lineHeight: 20, paddingTop: 16, paddingBottom: 16 }}
                placeholder={t("auth.displayNamePlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
              />
              {errors.displayName && (
                <Text className="text-red-500 text-sm mt-1">{errors.displayName}</Text>
              )}
            </View>

            <View className="mb-5">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("auth.email")}
              </Text>
              <TextInput
                className={`bg-surface-card dark:bg-surface-dark-card rounded-xl px-4 text-base text-content-primary dark:text-content-dark-primary ${
                  errors.email ? "border-2 border-red-500" : ""
                }`}
                style={{ fontSize: 16, lineHeight: 20, paddingTop: 16, paddingBottom: 16 }}
                placeholder={t("auth.emailPlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              {errors.email && (
                <Text className="text-red-500 text-sm mt-1">{errors.email}</Text>
              )}
            </View>

            <View className="mb-5">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("auth.password")}
              </Text>
              <TextInput
                className={`bg-surface-card dark:bg-surface-dark-card rounded-xl px-4 text-base text-content-primary dark:text-content-dark-primary ${
                  errors.password ? "border-2 border-red-500" : ""
                }`}
                style={{ fontSize: 16, lineHeight: 20, paddingTop: 16, paddingBottom: 16 }}
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mt-1">
                {t("auth.passwordRequirements")}
              </Text>
              {errors.password && (
                <Text className="text-red-500 text-sm mt-1">{errors.password}</Text>
              )}
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("auth.confirmPassword")}
              </Text>
              <TextInput
                className={`bg-surface-card dark:bg-surface-dark-card rounded-xl px-4 text-base text-content-primary dark:text-content-dark-primary ${
                  errors.confirmPassword ? "border-2 border-red-500" : ""
                }`}
                style={{ fontSize: 16, lineHeight: 20, paddingTop: 16, paddingBottom: 16 }}
                placeholder={t("auth.confirmPasswordPlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
              {errors.confirmPassword && (
                <Text className="text-red-500 text-sm mt-1">{errors.confirmPassword}</Text>
              )}
            </View>

            <Pressable
              onPress={handleSignUp}
              disabled={isLoading}
              className="bg-primary dark:bg-primary-dark rounded-xl py-4 items-center mb-6 active:opacity-80"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  {t("auth.createAccount")}
                </Text>
              )}
            </Pressable>

            <View className="flex-row justify-center mb-8">
              <Text className="text-content-secondary dark:text-content-dark-secondary">
                {t("auth.hasAccount")}{" "}
              </Text>
              <Pressable onPress={handleGoToSignIn}>
                <Text className="text-primary dark:text-primary-dark font-semibold">
                  {t("auth.signIn")}
                </Text>
              </Pressable>
            </View>

            {/* Continue as Guest - Prominent Section */}
            <View className="mt-auto pt-4 border-t border-border-subtle dark:border-border-dark-subtle">
              <View className="items-center mb-3">
                <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary text-center">
                  {t("auth.guestDescription")}
                </Text>
              </View>
              <Pressable
                onPress={handleContinueAsGuest}
                className="bg-surface-card dark:bg-surface-dark-card border-2 border-primary dark:border-primary-dark rounded-xl py-4 items-center active:opacity-80"
              >
                <Text className="text-primary dark:text-primary-dark font-semibold text-base">
                  {t("auth.continueAsGuest")}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
