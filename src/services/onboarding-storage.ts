/**
 * Onboarding Storage Service
 * Handles persisting onboarding status in AsyncStorage
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OnboardingStatus } from "@/types/onboarding";

const ONBOARDING_STATUS_KEY = "@onboarding_status";
const ONBOARDING_CURRENT_STEP_KEY = "@onboarding_current_step";

const DEFAULT_ONBOARDING_STATUS: OnboardingStatus = {
  hasCompleted: false,
  completedAt: null,
  skipped: false,
};

function isValidOnboardingStatus(data: unknown): data is OnboardingStatus {
  if (!data || typeof data !== "object") {
    return false;
  }

  const status = data as Record<string, unknown>;

  return (
    typeof status.hasCompleted === "boolean" &&
    (status.completedAt === null || typeof status.completedAt === "string") &&
    typeof status.skipped === "boolean"
  );
}

export const OnboardingStorageService = {
  async getOnboardingStatus(): Promise<OnboardingStatus> {
    const stored = await AsyncStorage.getItem(ONBOARDING_STATUS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (isValidOnboardingStatus(parsed)) {
          return parsed;
        }
      } catch {
        // Invalid JSON, return defaults
      }
    }
    return DEFAULT_ONBOARDING_STATUS;
  },

  async markOnboardingComplete(skipped: boolean = false): Promise<void> {
    const status: OnboardingStatus = {
      hasCompleted: true,
      completedAt: new Date().toISOString(),
      skipped,
    };
    await AsyncStorage.setItem(ONBOARDING_STATUS_KEY, JSON.stringify(status));
  },

  async resetOnboarding(): Promise<void> {
    await AsyncStorage.removeItem(ONBOARDING_STATUS_KEY);
  },


  async hasCompletedOnboarding(): Promise<boolean> {
    const status = await this.getOnboardingStatus();
    return status.hasCompleted;
  },

  async getCurrentStep(): Promise<number> {
    const stored = await AsyncStorage.getItem(ONBOARDING_CURRENT_STEP_KEY);
    if (stored) {
      const step = parseInt(stored, 10);
      if (!isNaN(step)) {
        return step;
      }
    }
    return 0;
  },

  async setCurrentStep(step: number): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_CURRENT_STEP_KEY, step.toString());
  },

  async clearCurrentStep(): Promise<void> {
    await AsyncStorage.removeItem(ONBOARDING_CURRENT_STEP_KEY);
  },
};
