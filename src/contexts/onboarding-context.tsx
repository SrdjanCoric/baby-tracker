/**
 * Onboarding Context
 * Manages onboarding state and navigation
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback, useMemo } from "react";
import { OnboardingStorageService } from "@/services/onboarding-storage";
import { onboardingReducer, initialOnboardingState, type OnboardingState, type OnboardingAction } from "./onboarding-reducer";
import { TOTAL_ONBOARDING_STEPS } from "@/constants/onboarding";
import type { OnboardingScreen } from "@/types/onboarding";

export {
  onboardingReducer,
  initialOnboardingState,
  type OnboardingState,
  type OnboardingAction,
};

interface OnboardingContextValue {
  state: OnboardingState;
  currentScreen: OnboardingScreen;
  totalSteps: number;
  isLastStep: boolean;
  isFirstStep: boolean;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const SCREEN_ORDER: OnboardingScreen[] = ["welcome", "features", "sync", "baby"];

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState);

  useEffect(() => {
    const loadOnboardingStatus = async () => {
      const [status, currentStep] = await Promise.all([
        OnboardingStorageService.getOnboardingStatus(),
        OnboardingStorageService.getCurrentStep(),
      ]);

      dispatch({
        type: "INITIALIZE",
        payload: {
          hasCompleted: status.hasCompleted,
          currentStep,
          skipped: status.skipped,
        },
      });
    };

    loadOnboardingStatus();
  }, []);

  const nextStep = useCallback(async () => {
    const newStep = Math.min(state.currentStep + 1, TOTAL_ONBOARDING_STEPS - 1);
    dispatch({ type: "NEXT_STEP" });
    await OnboardingStorageService.setCurrentStep(newStep);
  }, [state.currentStep]);

  const previousStep = useCallback(async () => {
    const newStep = Math.max(state.currentStep - 1, 0);
    dispatch({ type: "PREVIOUS_STEP" });
    await OnboardingStorageService.setCurrentStep(newStep);
  }, [state.currentStep]);

  const goToStep = useCallback(async (step: number) => {
    dispatch({ type: "GO_TO_STEP", payload: step });
    await OnboardingStorageService.setCurrentStep(Math.max(0, Math.min(step, TOTAL_ONBOARDING_STEPS - 1)));
  }, []);

  const completeOnboarding = useCallback(async () => {
    dispatch({ type: "COMPLETE" });
    await OnboardingStorageService.markOnboardingComplete(false);
    await OnboardingStorageService.clearCurrentStep();
  }, []);

  const skipOnboarding = useCallback(async () => {
    dispatch({ type: "SKIP" });
    await OnboardingStorageService.markOnboardingComplete(true);
    await OnboardingStorageService.clearCurrentStep();
  }, []);

  const resetOnboarding = useCallback(async () => {
    dispatch({ type: "RESET" });
    await OnboardingStorageService.resetOnboarding();
    await OnboardingStorageService.clearCurrentStep();
  }, []);

  const currentScreen = SCREEN_ORDER[state.currentStep] || "welcome";
  const isLastStep = state.currentStep === TOTAL_ONBOARDING_STEPS - 1;
  const isFirstStep = state.currentStep === 0;

  const value: OnboardingContextValue = useMemo(() => ({
    state,
    currentScreen,
    totalSteps: TOTAL_ONBOARDING_STEPS,
    isLastStep,
    isFirstStep,
    nextStep,
    previousStep,
    goToStep,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
  }), [state, currentScreen, isLastStep, isFirstStep, nextStep, previousStep, goToStep, completeOnboarding, skipOnboarding, resetOnboarding]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
