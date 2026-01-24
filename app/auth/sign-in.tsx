import { useState, useCallback, useRef, useEffect } from "react";
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
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useAuth } from "@/contexts";
import { validateSignIn, sanitizeAuthError } from "@/validators";

type AuthMode = "magic" | "password";

const TAB_ACTIVE_COLOR = "#8A857D";
const BUTTON_COLOR = "#5A8A5D";

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { signIn, signInWithMagicLink, signInWithGoogle, signInWithApple, isAppleSignInAvailable } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("magic");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const passwordInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });

    if (authMode === "password") {
      setTimeout(() => passwordInputRef.current?.focus(), 300);
    }
  }, [authMode, fadeAnim]);

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
        // DEBUG: Show actual error message
        Alert.alert("Google Sign-In Error (Debug)", error.message || "Unknown error");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err) {
      // DEBUG: Show actual catch error
      Alert.alert("Google Sign-In Catch (Debug)", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsGoogleLoading(false);
    }
  }, [signInWithGoogle, router]);

  const handleAppleSignIn = useCallback(async () => {
    setIsAppleLoading(true);
    try {
      const { error } = await signInWithApple();
      if (error) {
        Alert.alert(t("common.error"), t("auth.appleSignInError"));
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
        Alert.alert(t("common.error"), t("auth.magicLinkError"));
      } else {
        Alert.alert(
          t("auth.magicLinkSentTitle"),
          t("auth.magicLinkSentMessage"),
          [{ text: t("common.ok") }]
        );
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.generic"));
    } finally {
      setIsMagicLinkLoading(false);
    }
  }, [email, signInWithMagicLink, t]);

  const handleGoToSignUp = useCallback(() => {
    router.replace("/auth/sign-up");
  }, [router]);

  const toggleAuthMode = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    setErrors({});
  }, []);

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

            {/* Header */}
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

            {/* Email Field - Always Visible */}
            <View className="mb-4">
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
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType={authMode === "magic" ? "send" : "next"}
                onSubmitEditing={() => {
                  if (authMode === "magic") {
                    handleMagicLink();
                  } else {
                    passwordInputRef.current?.focus();
                  }
                }}
              />
              {errors.email && (
                <Text className="text-red-500 text-sm mt-1">{errors.email}</Text>
              )}
            </View>

            {/* Password Field - Only in password mode, appears between email and toggle */}
            {authMode === "password" && (
              <Animated.View className="mb-4" style={{ opacity: fadeAnim }}>
                <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                  {t("auth.password")}
                </Text>
                <TextInput
                  ref={passwordInputRef}
                  className={`bg-surface-card dark:bg-surface-dark-card rounded-xl px-4 text-base text-content-primary dark:text-content-dark-primary ${
                    errors.password ? "border-2 border-red-500" : ""
                  }`}
                  style={{ fontSize: 16, lineHeight: 20, paddingTop: 16, paddingBottom: 16 }}
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSignIn}
                />
                {errors.password && (
                  <Text className="text-red-500 text-sm mt-1">{errors.password}</Text>
                )}
              </Animated.View>
            )}

            {/* Auth Mode Toggle */}
            <View className="flex-row bg-surface-card dark:bg-surface-dark-card rounded-xl p-1 mb-5">
              <Pressable
                onPress={() => toggleAuthMode("magic")}
                className="flex-1 py-3 rounded-lg items-center"
                style={{
                  backgroundColor: authMode === "magic" ? TAB_ACTIVE_COLOR : "transparent",
                }}
              >
                <Text
                  className="font-medium text-sm"
                  style={{
                    color: authMode === "magic" ? "#FFFFFF" : (isDark ? "#9CA3AF" : "#6B7280"),
                  }}
                >
                  {t("auth.magicLinkTab")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => toggleAuthMode("password")}
                className="flex-1 py-3 rounded-lg items-center"
                style={{
                  backgroundColor: authMode === "password" ? TAB_ACTIVE_COLOR : "transparent",
                }}
              >
                <Text
                  className="font-medium text-sm"
                  style={{
                    color: authMode === "password" ? "#FFFFFF" : (isDark ? "#9CA3AF" : "#6B7280"),
                  }}
                >
                  {t("auth.passwordTab")}
                </Text>
              </Pressable>
            </View>

            {/* Action Button */}
            {authMode === "magic" ? (
              /* Magic Link Mode */
              <View>
                <Pressable
                  onPress={handleMagicLink}
                  disabled={isMagicLinkLoading}
                  className="rounded-xl py-5 items-center active:opacity-80"
                  style={{ backgroundColor: BUTTON_COLOR }}
                >
                  {isMagicLinkLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <View className="flex-row items-center">
                      <Text className="text-xl mr-2">✉️</Text>
                      <Text className="text-white font-semibold text-lg">
                        {t("auth.sendMagicLink")}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Text className="text-center text-content-tertiary dark:text-content-dark-tertiary text-sm mt-3">
                  {t("auth.magicLinkHint")}
                </Text>
              </View>
            ) : (
              /* Password Mode */
              <Pressable
                onPress={handleSignIn}
                disabled={isLoading}
                className="rounded-xl py-4 items-center active:opacity-80"
                style={{ backgroundColor: BUTTON_COLOR }}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">
                    {t("auth.signIn")}
                  </Text>
                )}
              </Pressable>
            )}

            {/* Sign Up Link */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-content-secondary dark:text-content-dark-secondary">
                {t("auth.noAccount")}{" "}
              </Text>
              <Pressable onPress={handleGoToSignUp}>
                <Text className="font-semibold" style={{ color: BUTTON_COLOR }}>
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
