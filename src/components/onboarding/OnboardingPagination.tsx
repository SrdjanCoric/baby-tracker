/**
 * OnboardingPagination - Dot indicators for onboarding progress
 */

import React from "react";
import { View } from "react-native";

const PRIMARY_COLOR = "#7C3AED";
const INACTIVE_COLOR = "#D1D5DB";
const INACTIVE_COLOR_DARK = "#4B5563";

interface OnboardingPaginationProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingPagination({ currentStep, totalSteps }: OnboardingPaginationProps) {
  return (
    <View
      className="flex-row justify-center items-center mb-6"
      accessibilityRole="progressbar"
      accessibilityValue={{
        now: currentStep + 1,
        min: 1,
        max: totalSteps,
      }}
    >
      {Array.from({ length: totalSteps }, (_, index) => (
        <View
          key={index}
          className={`mx-1 rounded-full transition-all ${
            index === currentStep
              ? "w-6 h-2"
              : "w-2 h-2"
          }`}
          style={{
            backgroundColor: index === currentStep ? PRIMARY_COLOR : INACTIVE_COLOR,
          }}
        />
      ))}
    </View>
  );
}
