import { describe, it, expect } from "vitest";
import {
  onboardingReducer,
  initialOnboardingState,
  type OnboardingState,
} from "./onboarding-reducer";

describe("onboardingReducer", () => {
  describe("NEXT_STEP", () => {
    it("should increment current step", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 0,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "NEXT_STEP" });

      expect(result.currentStep).toBe(1);
    });

    it("should not exceed max steps", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 3,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "NEXT_STEP" });

      expect(result.currentStep).toBe(3);
    });
  });

  describe("PREVIOUS_STEP", () => {
    it("should decrement current step", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 2,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "PREVIOUS_STEP" });

      expect(result.currentStep).toBe(1);
    });

    it("should not go below 0", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 0,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "PREVIOUS_STEP" });

      expect(result.currentStep).toBe(0);
    });
  });

  describe("GO_TO_STEP", () => {
    it("should go to specified step", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 0,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "GO_TO_STEP", payload: 2 });

      expect(result.currentStep).toBe(2);
    });

    it("should clamp to valid range (minimum)", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 2,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "GO_TO_STEP", payload: -1 });

      expect(result.currentStep).toBe(0);
    });

    it("should clamp to valid range (maximum)", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 0,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "GO_TO_STEP", payload: 10 });

      expect(result.currentStep).toBe(3);
    });
  });

  describe("COMPLETE", () => {
    it("should mark onboarding as completed", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 3,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "COMPLETE" });

      expect(result.hasCompleted).toBe(true);
      expect(result.skipped).toBe(false);
    });
  });

  describe("SKIP", () => {
    it("should mark onboarding as completed and skipped", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 1,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "SKIP" });

      expect(result.hasCompleted).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading to true", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 0,
        isLoading: false,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "SET_LOADING", payload: true });

      expect(result.isLoading).toBe(true);
    });

    it("should set loading to false", () => {
      const state: OnboardingState = {
        hasCompleted: false,
        currentStep: 0,
        isLoading: true,
        skipped: false,
      };

      const result = onboardingReducer(state, { type: "SET_LOADING", payload: false });

      expect(result.isLoading).toBe(false);
    });
  });

  describe("RESET", () => {
    it("should reset to initial state", () => {
      const state: OnboardingState = {
        hasCompleted: true,
        currentStep: 3,
        isLoading: false,
        skipped: true,
      };

      const result = onboardingReducer(state, { type: "RESET" });

      expect(result).toEqual(initialOnboardingState);
    });
  });

  describe("INITIALIZE", () => {
    it("should initialize from stored status", () => {
      const state = initialOnboardingState;

      const result = onboardingReducer(state, {
        type: "INITIALIZE",
        payload: {
          hasCompleted: true,
          currentStep: 2,
          skipped: false,
        },
      });

      expect(result.hasCompleted).toBe(true);
      expect(result.currentStep).toBe(2);
      expect(result.skipped).toBe(false);
      expect(result.isLoading).toBe(false);
    });

    it("should handle skipped onboarding", () => {
      const state = initialOnboardingState;

      const result = onboardingReducer(state, {
        type: "INITIALIZE",
        payload: {
          hasCompleted: true,
          currentStep: 0,
          skipped: true,
        },
      });

      expect(result.hasCompleted).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.isLoading).toBe(false);
    });
  });

  describe("initialOnboardingState", () => {
    it("should have correct default values", () => {
      expect(initialOnboardingState.hasCompleted).toBe(false);
      expect(initialOnboardingState.currentStep).toBe(0);
      expect(initialOnboardingState.isLoading).toBe(true);
      expect(initialOnboardingState.skipped).toBe(false);
    });
  });
});
