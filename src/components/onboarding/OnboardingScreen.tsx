/**
 * OnboardingScreen - Reusable screen template for onboarding
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { OnboardingPagination } from "./OnboardingPagination";
import { OnboardingIllustration, type IllustrationType } from "./OnboardingIllustration";

const PRIMARY_COLOR = "#6B9E6E";

interface OnboardingScreenProps {
  title: string;
  subtitle: string;
  illustration: IllustrationType;
  primaryButtonText: string;
  onPrimaryPress: () => void;
  showSkip?: boolean;
  onSkipPress?: () => void;
  currentStep: number;
  totalSteps: number;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function OnboardingScreen({
  title,
  subtitle,
  illustration,
  primaryButtonText,
  onPrimaryPress,
  showSkip = false,
  onSkipPress,
  currentStep,
  totalSteps,
  isLoading = false,
  children,
}: OnboardingScreenProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark">
        {/* Skip button */}
        {showSkip && (
          <View className="absolute top-4 right-4 z-10">
            <Pressable
              onPress={onSkipPress}
              className="py-2 px-4 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={t("common.skip")}
            >
              <Text className="text-base text-content-secondary dark:text-content-dark-secondary font-medium">
                {t("common.skip")}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Content */}
        <View className="flex-1 items-center justify-center px-8">
          {/* Illustration */}
          <View className="mb-12">
            <OnboardingIllustration type={illustration} />
          </View>

          {/* Title */}
          <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary text-center mb-3">
            {title}
          </Text>

          {/* Subtitle */}
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-8 leading-6">
            {subtitle}
          </Text>

          {/* Custom children (for forms, etc.) */}
          {children}
        </View>

        {/* Bottom Section */}
        <View className="px-8 pb-8">
          {/* Pagination dots */}
          <OnboardingPagination
            currentStep={currentStep}
            totalSteps={totalSteps}
          />

          {/* Primary button */}
          <Pressable
            onPress={onPrimaryPress}
            disabled={isLoading}
            className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${
              isLoading ? "opacity-50" : ""
            }`}
            style={{ backgroundColor: PRIMARY_COLOR }}
            accessibilityRole="button"
            accessibilityLabel={primaryButtonText}
            accessibilityState={{ disabled: isLoading }}
          >
            <Text className="text-lg font-semibold text-white">
              {isLoading ? t("common.loading") : primaryButtonText}
            </Text>
          </Pressable>
        </View>
      </View>
  );
}
