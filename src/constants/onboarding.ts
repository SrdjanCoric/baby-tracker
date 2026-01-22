/**
 * Onboarding Constants
 * Default values and screen content for onboarding flow
 */

import type { OnboardingScreenContent, OnboardingScreen } from "@/types/onboarding";

export const TOTAL_ONBOARDING_STEPS = 4;

export const ONBOARDING_SCREEN_CONTENT: Record<OnboardingScreen, OnboardingScreenContent> = {
  welcome: {
    id: "welcome",
    title: "onboarding.welcome.title",
    subtitle: "onboarding.welcome.subtitle",
    illustration: "baby-welcome",
  },
  features: {
    id: "features",
    title: "onboarding.features.title",
    subtitle: "onboarding.features.subtitle",
    illustration: "activity-icons",
  },
  sync: {
    id: "sync",
    title: "onboarding.sync.title",
    subtitle: "onboarding.sync.subtitle",
    illustration: "phones-sync",
  },
  baby: {
    id: "baby",
    title: "onboarding.baby.title",
    subtitle: "onboarding.baby.subtitle",
    illustration: "baby-profile",
  },
};
