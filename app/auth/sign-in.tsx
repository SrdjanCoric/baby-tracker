/**
 * Sign In Screen - Simplified auth with Social + Magic Link
 * Warm, welcoming design matching the app's aesthetic
 */

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
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useTheme } from "@/contexts";
import { DisplayNamePrompt } from "@/components/DisplayNamePrompt";
import { validateEmail } from "@/validators";
import { SURFACE, TEXT, ACTION, BORDER, SEMANTIC } from "@/constants/colors";

const BRAND_COLORS = {
  google: "#4285F4",
  googleBg: "#FFFFFF",
  appleBg: "#000000",
};

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark } = useTheme();
  const { signIn, signUp, signInWithMagicLink, signInWithGoogle, signInWithApple, isAppleSignInAvailable, user, refreshUserProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [password, setPassword] = useState("");
  const [isDevLoading, setIsDevLoading] = useState(false);

  // Display name prompt state
  const [showDisplayNamePrompt, setShowDisplayNamePrompt] = useState(false);

  // Helper to handle post-auth flow
  const handlePostAuth = useCallback(async () => {
    const profile = await refreshUserProfile();
    if (!profile?.displayName) {
      setShowDisplayNamePrompt(true);
    } else {
      router.back();
    }
  }, [router, refreshUserProfile]);

  // Handle display name prompt completion
  const handleDisplayNameComplete = useCallback(() => {
    setShowDisplayNamePrompt(false);
    router.back();
  }, [router]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        Alert.alert(t("common.error"), t("auth.googleSignInError"));
      } else {
        // Show display name step (will check if needed)
        handlePostAuth();
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.generic"));
    } finally {
      setIsGoogleLoading(false);
    }
  }, [signInWithGoogle, handlePostAuth, t]);

  const handleAppleSignIn = useCallback(async () => {
    setIsAppleLoading(true);
    try {
      const { error } = await signInWithApple();
      if (error) {
        Alert.alert(t("common.error"), t("auth.appleSignInError"));
      } else {
        // Show display name step (will check if needed)
        handlePostAuth();
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.generic"));
    } finally {
      setIsAppleLoading(false);
    }
  }, [signInWithApple, handlePostAuth, t]);

  const handleMagicLink = useCallback(async () => {
    const validation = validateEmail(email);
    if (!validation.isValid) {
      setEmailError(validation.error);
      return;
    }

    setEmailError(undefined);
    setIsMagicLinkLoading(true);

    try {
      const { error: magicLinkError } = await signInWithMagicLink(validation.normalizedEmail!);

      if (magicLinkError) {
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

  const handleDevSignIn = useCallback(async () => {
    setIsDevLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        Alert.alert("Dev Sign In Error", error.message);
      } else {
        handlePostAuth();
      }
    } catch (e: unknown) {
      Alert.alert("Dev Sign In Error", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsDevLoading(false);
    }
  }, [email, password, signIn, handlePostAuth]);

  const handleDevSignUp = useCallback(async () => {
    setIsDevLoading(true);
    try {
      const { error } = await signUp(email, password, "Dev User");
      if (error) {
        Alert.alert("Dev Sign Up Error", error.message);
      } else {
        handlePostAuth();
      }
    } catch (e: unknown) {
      Alert.alert("Dev Sign Up Error", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsDevLoading(false);
    }
  }, [email, password, signUp, handlePostAuth]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? SURFACE.dark.background : SURFACE.light.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-4 pb-8">
            {/* Header with drag handle */}
            <View className="items-center mb-2">
              <View
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: isDark ? BORDER.dark.default : BORDER.light.subtle }}
              />
            </View>

            {/* Close button */}
            <Pressable
              onPress={handleClose}
              className="absolute top-4 right-6 w-10 h-10 rounded-full items-center justify-center active:opacity-70"
              style={{ backgroundColor: isDark ? SURFACE.dark.card : BORDER.light.subtle }}
              accessibilityLabel={t("common.close")}
              testID="close-button"
            >
              <Ionicons
                name="close"
                size={22}
                color={isDark ? TEXT.dark.secondary : TEXT.light.secondary}
              />
            </Pressable>

            {/* Title Section */}
            <View className="mt-10 mb-8">
              <Text
                className="text-3xl mb-2"
                style={{
                  color: isDark ? TEXT.dark.primary : TEXT.light.primary,
                  fontFamily: "Nunito-Bold",
                }}
              >
                {t("auth.signIn")}
              </Text>
              <Text
                className="text-base leading-6"
                style={{
                  color: isDark ? TEXT.dark.secondary : TEXT.light.secondary,
                  fontFamily: "Nunito-Regular",
                }}
              >
                {t("auth.signInDescription")}
              </Text>
            </View>

            {/* Social Sign-in Buttons */}
            <View className="mb-6">
              {/* Google Sign In */}
              <Pressable
                onPress={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="flex-row items-center justify-center rounded-2xl py-4 mb-3 active:scale-[0.98]"
                style={{
                  backgroundColor: BRAND_COLORS.googleBg,
                  borderWidth: 1,
                  borderColor: isDark ? BORDER.dark.default : BORDER.light.subtle,
                }}
                testID="google-signin-button"
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color={BRAND_COLORS.google} />
                ) : (
                  <>
                    <View className="w-6 h-6 mr-3 items-center justify-center">
                      <Text className="text-lg font-bold" style={{ color: BRAND_COLORS.google }}>G</Text>
                    </View>
                    <Text
                      className="text-base"
                      style={{
                        color: "#3C4043",
                        fontFamily: "Nunito-SemiBold",
                      }}
                    >
                      {t("auth.continueWithGoogle")}
                    </Text>
                  </>
                )}
              </Pressable>

              {/* Apple Sign In - iOS only */}
              {Platform.OS === "ios" && isAppleSignInAvailable && (
                <Pressable
                  onPress={handleAppleSignIn}
                  disabled={isAppleLoading}
                  className="flex-row items-center justify-center rounded-2xl py-4 mb-3 active:scale-[0.98]"
                  style={{ backgroundColor: BRAND_COLORS.appleBg }}
                  testID="apple-signin-button"
                >
                  {isAppleLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
                      <Text
                        className="text-base text-white"
                        style={{ fontFamily: "Nunito-SemiBold" }}
                      >
                        {t("auth.continueWithApple")}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            {/* Divider */}
            <View className="flex-row items-center mb-6">
              <View
                className="flex-1 h-[1px]"
                style={{ backgroundColor: isDark ? BORDER.dark.default : BORDER.light.subtle }}
              />
              <Text
                className="mx-4 text-sm"
                style={{
                  color: isDark ? TEXT.dark.secondary : TEXT.light.muted,
                  fontFamily: "Nunito-Medium",
                }}
              >
                {t("auth.orContinueWithEmail")}
              </Text>
              <View
                className="flex-1 h-[1px]"
                style={{ backgroundColor: isDark ? BORDER.dark.default : BORDER.light.subtle }}
              />
            </View>

            {/* Magic Link Section */}
            <View
              className="rounded-3xl p-5 mb-4"
              style={{
                backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card,
                borderWidth: 1,
                borderColor: isDark ? BORDER.dark.default : BORDER.light.subtle,
              }}
            >
              {/* Email Field */}
              <View className="mb-4">
                <Text
                  className="text-sm mb-2"
                  style={{
                    color: isDark ? TEXT.dark.secondary : TEXT.light.secondary,
                    fontFamily: "Nunito-Medium",
                  }}
                >
                  {t("auth.email")}
                </Text>
                <TextInput
                  className="rounded-xl px-4"
                  style={{
                    backgroundColor: isDark ? SURFACE.dark.background : SURFACE.light.background,
                    color: isDark ? TEXT.dark.primary : TEXT.light.primary,
                    fontFamily: "Nunito-Regular",
                    fontSize: 16,
                    paddingTop: 14,
                    paddingBottom: 14,
                    borderWidth: emailError ? 2 : 0,
                    borderColor: emailError ? SEMANTIC.error.light : "transparent",
                  }}
                  placeholder={t("auth.emailPlaceholder")}
                  placeholderTextColor={isDark ? TEXT.dark.secondary : TEXT.light.muted}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setEmailError(undefined);
                  }}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={handleMagicLink}
                  testID="email-input"
                />
                {emailError && (
                  <Text
                    className="text-sm mt-1.5"
                    style={{ color: SEMANTIC.error[isDark ? "dark" : "light"], fontFamily: "Nunito-Regular" }}
                  >
                    {t(emailError)}
                  </Text>
                )}
              </View>

              {/* Send Magic Link Button */}
              <Pressable
                onPress={handleMagicLink}
                disabled={isMagicLinkLoading}
                className="rounded-xl py-4 items-center active:scale-[0.98]"
                style={{ backgroundColor: ACTION.light.primaryHover }}
                testID="send-magic-link-button"
              >
                {isMagicLinkLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View className="flex-row items-center">
                    <Ionicons name="mail-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text
                      className="text-white text-base"
                      style={{ fontFamily: "Nunito-SemiBold" }}
                    >
                      {t("auth.sendMagicLink")}
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Magic Link Hint */}
              <Text
                className="text-center text-sm mt-3"
                style={{
                  color: isDark ? TEXT.dark.secondary : TEXT.light.muted,
                  fontFamily: "Nunito-Regular",
                }}
              >
                {t("auth.magicLinkHint")}
              </Text>
            </View>

            {__DEV__ && (
              <View
                className="rounded-3xl p-5 mb-4"
                style={{
                  backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card,
                  borderWidth: 2,
                  borderColor: "#F59E0B",
                }}
              >
                <Text
                  className="text-sm mb-3 text-center"
                  style={{
                    color: "#F59E0B",
                    fontFamily: "Nunito-Bold",
                  }}
                >
                  Dev Login (Debug Only)
                </Text>

                <TextInput
                  className="rounded-xl px-4 mb-3"
                  style={{
                    backgroundColor: isDark ? SURFACE.dark.background : SURFACE.light.background,
                    color: isDark ? TEXT.dark.primary : TEXT.light.primary,
                    fontFamily: "Nunito-Regular",
                    fontSize: 16,
                    paddingTop: 14,
                    paddingBottom: 14,
                  }}
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor={isDark ? TEXT.dark.secondary : TEXT.light.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  testID="dev-password-input"
                />

                <View className="flex-row gap-3">
                  <Pressable
                    onPress={handleDevSignIn}
                    disabled={isDevLoading}
                    className="flex-1 rounded-xl py-3 items-center active:scale-[0.98]"
                    style={{ backgroundColor: "#F59E0B" }}
                    testID="dev-signin-button"
                  >
                    {isDevLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text
                        className="text-white text-sm"
                        style={{ fontFamily: "Nunito-SemiBold" }}
                      >
                        Dev Sign In
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={handleDevSignUp}
                    disabled={isDevLoading}
                    className="flex-1 rounded-xl py-3 items-center active:scale-[0.98]"
                    style={{ backgroundColor: "#D97706" }}
                    testID="dev-signup-button"
                  >
                    {isDevLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text
                        className="text-white text-sm"
                        style={{ fontFamily: "Nunito-SemiBold" }}
                      >
                        Dev Sign Up
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Guest option at bottom */}
            <View className="mt-auto pt-6">
              <Pressable
                onPress={() => router.replace("/(tabs)")}
                className="py-3 items-center active:opacity-70"
                testID="continue-as-guest-button"
              >
                <Text
                  className="text-base"
                  style={{
                    color: isDark ? TEXT.dark.secondary : TEXT.light.secondary,
                    fontFamily: "Nunito-Medium",
                  }}
                >
                  {t("auth.continueAsGuest")}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Display Name Prompt - shown after auth if no display name */}
      <DisplayNamePrompt
        visible={showDisplayNamePrompt}
        onComplete={handleDisplayNameComplete}
      />
    </SafeAreaView>
  );
}
