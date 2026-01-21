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
import { validateSignIn, sanitizeAuthError } from "@/validators";

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn, signInWithMagicLink, signInWithGoogle, signInWithApple, isAppleSignInAvailable } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSignIn = useCallback(async () => {
    const validation = validateSignIn({ email, password });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const { error } = await signIn(validation.normalizedEmail!, password);

      if (error) {
        Alert.alert(t("common.error"), t("auth.signInError"));
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  }, [email, password, signIn, router, t]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        const errorKey = sanitizeAuthError(error, "auth.googleSignInError");
        Alert.alert(t("common.error"), t(errorKey));
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.generic"));
    } finally {
      setIsGoogleLoading(false);
    }
  }, [signInWithGoogle, router, t]);

  const handleAppleSignIn = useCallback(async () => {
    setIsAppleLoading(true);
    try {
      const { error } = await signInWithApple();
      if (error) {
        const errorKey = sanitizeAuthError(error, "auth.appleSignInError");
        Alert.alert(t("common.error"), t(errorKey));
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.generic"));
    } finally {
      setIsAppleLoading(false);
    }
  }, [signInWithApple, router, t]);

  const handleMagicLink = useCallback(async () => {
    const validation = validateSignIn({ email, password: "placeholder" });

    if (validation.errors.email) {
      setErrors({ email: validation.errors.email });
      return;
    }

    setErrors({});
    setIsMagicLinkLoading(true);

    try {
      const { error } = await signInWithMagicLink(validation.normalizedEmail!);

      if (error) {
        const errorKey = sanitizeAuthError(error, "auth.magicLinkError");
        Alert.alert(t("common.error"), t(errorKey));
      } else {
        Alert.alert(t("common.success"), t("auth.magicLinkSent"));
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.generic"));
    } finally {
      setIsMagicLinkLoading(false);
    }
  }, [email, signInWithMagicLink, t]);

  const handleGoToSignUp = useCallback(() => {
    router.push("/auth/sign-up");
  }, [router]);

  const handleGoBack = useCallback(() => {
    router.back();
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
            <View className="items-center mb-4">
              <View className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </View>

            {/* Close button */}
            <Pressable onPress={handleGoBack} className="mb-6 self-start">
              <Text className="text-content-secondary dark:text-content-dark-secondary text-base">
                {t("common.cancel")}
              </Text>
            </Pressable>

            <View className="mb-8">
              <Text className="text-3xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
                {t("auth.signInTitle")}
              </Text>
              <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
                {t("auth.signInSubtitle")}
              </Text>
            </View>

            {/* Social Sign-in Buttons */}
            <View className="mb-6">
              {/* Google Sign-in */}
              <Pressable
                onPress={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="flex-row items-center justify-center bg-white border border-gray-300 rounded-xl py-4 mb-3 active:opacity-80"
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color="#4285F4" />
                ) : (
                  <>
                    <Text className="text-xl mr-3">G</Text>
                    <Text className="text-gray-800 font-medium text-base">
                      {t("auth.continueWithGoogle")}
                    </Text>
                  </>
                )}
              </Pressable>

              {/* Apple Sign-in (iOS only) */}
              {Platform.OS === "ios" && isAppleSignInAvailable && (
                <Pressable
                  onPress={handleAppleSignIn}
                  disabled={isAppleLoading}
                  className="flex-row items-center justify-center bg-black rounded-xl py-4 mb-3 active:opacity-80"
                >
                  {isAppleLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text className="text-xl mr-3 text-white"></Text>
                      <Text className="text-white font-medium text-base">
                        {t("auth.continueWithApple")}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            {/* Divider */}
            <View className="flex-row items-center mb-6">
              <View className="flex-1 h-px bg-border-subtle dark:bg-border-dark-subtle" />
              <Text className="mx-4 text-content-tertiary dark:text-content-dark-tertiary text-sm">
                {t("auth.orContinueWithEmail")}
              </Text>
              <View className="flex-1 h-px bg-border-subtle dark:bg-border-dark-subtle" />
            </View>

            {/* Email/Password Form */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("auth.email")}
              </Text>
              <TextInput
                className={`bg-surface-card dark:bg-surface-dark-card rounded-xl px-4 py-4 text-base text-content-primary dark:text-content-dark-primary ${
                  errors.email ? "border-2 border-red-500" : ""
                }`}
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

            <View className="mb-4">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("auth.password")}
              </Text>
              <TextInput
                className={`bg-surface-card dark:bg-surface-dark-card rounded-xl px-4 py-4 text-base text-content-primary dark:text-content-dark-primary ${
                  errors.password ? "border-2 border-red-500" : ""
                }`}
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
              />
              {errors.password && (
                <Text className="text-red-500 text-sm mt-1">{errors.password}</Text>
              )}
            </View>

            <Pressable
              onPress={handleSignIn}
              disabled={isLoading}
              className="bg-primary dark:bg-primary-dark rounded-xl py-4 items-center mb-3 active:opacity-80"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  {t("auth.signIn")}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleMagicLink}
              disabled={isMagicLinkLoading}
              className="bg-surface-card dark:bg-surface-dark-card border border-border-subtle dark:border-border-dark-subtle rounded-xl py-4 items-center mb-6 active:opacity-80"
            >
              {isMagicLinkLoading ? (
                <ActivityIndicator color="#6B7280" />
              ) : (
                <Text className="text-content-primary dark:text-content-dark-primary font-medium text-base">
                  {t("auth.magicLink")}
                </Text>
              )}
            </Pressable>

            <View className="flex-row justify-center">
              <Text className="text-content-secondary dark:text-content-dark-secondary">
                {t("auth.noAccount")}{" "}
              </Text>
              <Pressable onPress={handleGoToSignUp}>
                <Text className="text-primary dark:text-primary-dark font-semibold">
                  {t("auth.signUp")}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
