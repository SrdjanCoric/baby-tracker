/**
 * Onboarding Reducer
 * State management for onboarding flow
 */

import { TOTAL_ONBOARDING_STEPS } from "@/constants/onboarding";

export interface OnboardingState {
  hasCompleted: boolean;
  currentStep: number;
  isLoading: boolean;
  skipped: boolean;
}

export type OnboardingAction =
  | { type: "NEXT_STEP" }
  | { type: "PREVIOUS_STEP" }
  | { type: "GO_TO_STEP"; payload: number }
  | { type: "COMPLETE" }
  | { type: "SKIP" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "RESET" }
  | { type: "INITIALIZE"; payload: { hasCompleted: boolean; currentStep: number; skipped: boolean } };

export const initialOnboardingState: OnboardingState = {
  hasCompleted: false,
  currentStep: 0,
  isLoading: true,
  skipped: false,
};

const MAX_STEP = TOTAL_ONBOARDING_STEPS - 1;

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "NEXT_STEP":
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, MAX_STEP),
      };

    case "PREVIOUS_STEP":
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, 0),
      };

    case "GO_TO_STEP":
      return {
        ...state,
        currentStep: Math.max(0, Math.min(action.payload, MAX_STEP)),
      };

    case "COMPLETE":
      return {
        ...state,
        hasCompleted: true,
        skipped: false,
      };

    case "SKIP":
      return {
        ...state,
        hasCompleted: true,
        skipped: true,
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "RESET":
      return initialOnboardingState;

    case "INITIALIZE":
      return {
        ...state,
        hasCompleted: action.payload.hasCompleted,
        currentStep: action.payload.currentStep,
        skipped: action.payload.skipped,
        isLoading: false,
      };

    default:
      return state;
  }
}
