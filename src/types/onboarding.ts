/**
 * Onboarding Types
 * Type definitions for the onboarding flow
 */

export interface OnboardingStatus {
  hasCompleted: boolean;
  completedAt: string | null;
  skipped: boolean;
}

export interface OnboardingScreenContent {
  id: string;
  title: string;
  subtitle: string;
  illustration: string;
}

export const ONBOARDING_SCREENS = ["welcome", "features", "sync", "baby"] as const;
export type OnboardingScreen = (typeof ONBOARDING_SCREENS)[number];
