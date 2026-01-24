/**
 * Auth Choice Screen - Sign In or Continue as Guest
 * Warm, welcoming design for new parents
 */

import { useCallback } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useOnboarding, useTheme } from "@/contexts";
import { OnboardingPagination } from "@/components/onboarding";
import { Ionicons } from "@expo/vector-icons";

const COLORS = {
  primary: "#6B9E6E",
  primaryLight: "#E8F5E9",
  primaryDark: "#5A8A5D",
  warmCream: "#FBF9F6",
  warmGray: "#6B665E",
  warmGrayLight: "#B5B0A8",
  warmGrayLightest: "#E8E5E0",
  darkBg: "#1A1918",
  darkCard: "#242220",
  darkBorder: "#3D3935",
  darkText: "#FAF9F7",
  darkTextSecondary: "#B5B0A8",
};

export default function AuthChoiceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state, nextStep, skipOnboarding } = useOnboarding();
  const { isDark } = useTheme();

  const handleSignIn = useCallback(() => {
    router.push("/auth/sign-in");
  }, [router]);

  const handleContinueAsGuest = useCallback(() => {
    nextStep();
    router.push("/onboarding/features");
  }, [nextStep, router]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? COLORS.darkBg : COLORS.warmCream }}
      edges={["top", "bottom"]}
    >
      {/* Skip button */}
      <View className="absolute top-4 right-4 z-10">
        <Pressable
          onPress={handleSkip}
          className="py-2 px-4 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={t("common.skip")}
        >
          <Text
            className="text-base font-medium"
            style={{ color: isDark ? COLORS.darkTextSecondary : COLORS.warmGray }}
          >
            {t("common.skip")}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-6">
        {/* Illustration */}
        <View
          className="w-36 h-36 rounded-full items-center justify-center mb-8"
          style={{
            backgroundColor: isDark ? COLORS.darkCard : COLORS.primaryLight,
            borderWidth: 3,
            borderColor: COLORS.primary,
          }}
        >
          <Text className="text-6xl">🤝</Text>
        </View>

        {/* Title */}
        <Text
          className="text-2xl text-center mb-2"
          style={{
            color: isDark ? COLORS.darkText : "#2D2A26",
            fontFamily: "Nunito-Bold",
          }}
        >
          {t("onboarding.authChoice.title")}
        </Text>

        {/* Subtitle */}
        <Text
          className="text-base text-center mb-10 leading-6 px-4"
          style={{
            color: isDark ? COLORS.darkTextSecondary : COLORS.warmGray,
            fontFamily: "Nunito-Regular",
          }}
        >
          {t("onboarding.authChoice.subtitle")}
        </Text>

        {/* Auth Options Container */}
        <View className="w-full">
          {/* Sign In Button - Primary Action */}
          <Pressable
            onPress={handleSignIn}
            className="rounded-2xl py-5 mb-4 active:scale-[0.98]"
            style={{ backgroundColor: COLORS.primaryDark }}
            accessibilityRole="button"
          >
            <View className="flex-row items-center justify-center">
              <Ionicons name="log-in-outline" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text
                className="text-white text-lg"
                style={{ fontFamily: "Nunito-SemiBold" }}
              >
                {t("auth.signIn")}
              </Text>
            </View>
            <Text
              className="text-center text-sm mt-1"
              style={{
                color: "rgba(255,255,255,0.75)",
                fontFamily: "Nunito-Regular",
              }}
            >
              {t(Platform.OS === "ios" ? "onboarding.authChoice.signInMethodsIos" : "onboarding.authChoice.signInMethodsAndroid")}
            </Text>
          </Pressable>

          {/* Divider with "or" */}
          <View className="flex-row items-center my-4">
            <View
              className="flex-1 h-[1px]"
              style={{ backgroundColor: isDark ? COLORS.darkBorder : COLORS.warmGrayLightest }}
            />
            <Text
              className="mx-4 text-sm"
              style={{
                color: isDark ? COLORS.darkTextSecondary : COLORS.warmGrayLight,
                fontFamily: "Nunito-Medium",
              }}
            >
              {t("common.or")}
            </Text>
            <View
              className="flex-1 h-[1px]"
              style={{ backgroundColor: isDark ? COLORS.darkBorder : COLORS.warmGrayLightest }}
            />
          </View>

          {/* Continue as Guest */}
          <Pressable
            onPress={handleContinueAsGuest}
            className="rounded-2xl py-5 px-5 active:scale-[0.98]"
            style={{
              backgroundColor: isDark ? COLORS.darkCard : "#FFFFFF",
              borderWidth: 1,
              borderColor: isDark ? COLORS.darkBorder : COLORS.warmGrayLightest,
            }}
            accessibilityRole="button"
          >
            <View className="flex-row items-center justify-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{
                  backgroundColor: isDark ? "#2A2826" : COLORS.warmCream,
                }}
              >
                <Ionicons
                  name="play-forward-outline"
                  size={20}
                  color={isDark ? COLORS.darkTextSecondary : COLORS.warmGray}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-base"
                  style={{
                    color: isDark ? COLORS.darkText : "#2D2A26",
                    fontFamily: "Nunito-SemiBold",
                  }}
                >
                  {t("auth.continueAsGuest")}
                </Text>
                <Text
                  className="text-sm mt-0.5"
                  style={{
                    color: isDark ? COLORS.darkTextSecondary : COLORS.warmGrayLight,
                    fontFamily: "Nunito-Regular",
                  }}
                >
                  {t("onboarding.authChoice.guestHint")}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDark ? COLORS.darkTextSecondary : COLORS.warmGrayLight}
              />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Bottom Section */}
      <View className="px-8 pb-8">
        <OnboardingPagination currentStep={state.currentStep} totalSteps={6} />
      </View>
    </SafeAreaView>
  );
}
