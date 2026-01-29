/**
 * Sign In Screen - Simplified auth with Social + Magic Link
 * Warm, welcoming design matching the app's aesthetic
 */

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
  const { signInWithMagicLink, signInWithGoogle, signInWithApple, isAppleSignInAvailable, user } = useAuth();

  const [email, setEmail] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();

  // Display name prompt state
  const [showDisplayNamePrompt, setShowDisplayNamePrompt] = useState(false);

  // Use ref to always get latest user value
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Helper to handle post-auth flow
  const handlePostAuth = useCallback(() => {
    // Check if user needs to set display name after auth completes
    // The user object updates asynchronously, so we check after a delay
    setTimeout(() => {
      const currentUser = userRef.current;
      if (!currentUser?.displayName) {
        setShowDisplayNamePrompt(true);
      } else {
        router.back();
      }
    }, 500);
  }, [router]);

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
                    style={{ color: SEMANTIC.error.light, fontFamily: "Nunito-Regular" }}
                  >
                    {emailError}
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
