jest.unmock("@/contexts/onboarding-context");

import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react-native";
import { Text, View, Pressable } from "react-native";
import type { OnboardingStatus } from "@/types/onboarding";

const mockGetOnboardingStatus = jest.fn();
const mockMarkOnboardingComplete = jest.fn();
const mockResetOnboarding = jest.fn();
const mockHasCompletedOnboarding = jest.fn();
const mockGetCurrentStep = jest.fn();
const mockSetCurrentStep = jest.fn();
const mockClearCurrentStep = jest.fn();

jest.mock("@/services/onboarding-storage", () => ({
  OnboardingStorageService: {
    getOnboardingStatus: () => mockGetOnboardingStatus(),
    markOnboardingComplete: (skipped: boolean) => mockMarkOnboardingComplete(skipped),
    resetOnboarding: () => mockResetOnboarding(),
    hasCompletedOnboarding: () => mockHasCompletedOnboarding(),
    getCurrentStep: () => mockGetCurrentStep(),
    setCurrentStep: (step: number) => mockSetCurrentStep(step),
    clearCurrentStep: () => mockClearCurrentStep(),
  },
}));

import { OnboardingProvider, useOnboarding } from "./onboarding-context";

const DEFAULT_STATUS: OnboardingStatus = {
  hasCompleted: false,
  completedAt: null,
  skipped: false,
};

function TestConsumer({ testID }: { testID: string }) {
  const onboarding = useOnboarding();
  return (
    <View testID={testID}>
      <Text testID="loading">{onboarding.state.isLoading ? "loading" : "ready"}</Text>
      <Text testID="has-completed">{onboarding.state.hasCompleted ? "completed" : "not-completed"}</Text>
      <Text testID="current-step">{onboarding.state.currentStep}</Text>
      <Text testID="current-screen">{onboarding.currentScreen}</Text>
      <Text testID="is-first-step">{onboarding.isFirstStep ? "true" : "false"}</Text>
      <Text testID="is-last-step">{onboarding.isLastStep ? "true" : "false"}</Text>
      <Text testID="total-steps">{onboarding.totalSteps}</Text>
      <Pressable testID="next-button" onPress={onboarding.nextStep}>
        <Text>Next</Text>
      </Pressable>
      <Pressable testID="prev-button" onPress={onboarding.previousStep}>
        <Text>Previous</Text>
      </Pressable>
      <Pressable testID="skip-button" onPress={onboarding.skipOnboarding}>
        <Text>Skip</Text>
      </Pressable>
      <Pressable testID="complete-button" onPress={onboarding.completeOnboarding}>
        <Text>Complete</Text>
      </Pressable>
      <Pressable testID="reset-button" onPress={onboarding.resetOnboarding}>
        <Text>Reset</Text>
      </Pressable>
    </View>
  );
}

describe("OnboardingContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOnboardingStatus.mockResolvedValue(DEFAULT_STATUS);
    mockGetCurrentStep.mockResolvedValue(0);
    mockMarkOnboardingComplete.mockResolvedValue(undefined);
    mockResetOnboarding.mockResolvedValue(undefined);
    mockSetCurrentStep.mockResolvedValue(undefined);
    mockClearCurrentStep.mockResolvedValue(undefined);
  });

  describe("useOnboarding hook", () => {
    it("should throw error when used outside OnboardingProvider", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      expect(() => {
        render(<TestConsumer testID="consumer" />);
      }).toThrow("useOnboarding must be used within an OnboardingProvider");
      consoleError.mockRestore();
    });
  });

  describe("initialization", () => {
    it("should load onboarding status on mount", async () => {
      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(mockGetOnboardingStatus).toHaveBeenCalled();
      expect(mockGetCurrentStep).toHaveBeenCalled();
    });

    it("should show loading state initially", async () => {
      mockGetOnboardingStatus.mockImplementation(() => new Promise(() => {}));

      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      expect(screen.getByTestId("loading")).toHaveTextContent("loading");
    });

    it("should initialize with correct current step", async () => {
      mockGetCurrentStep.mockResolvedValue(2);

      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("current-step")).toHaveTextContent("2");
      expect(screen.getByTestId("current-screen")).toHaveTextContent("sync");
    });

    it("should initialize as completed when status is completed", async () => {
      mockGetOnboardingStatus.mockResolvedValue({
        hasCompleted: true,
        completedAt: "2024-01-15T10:30:00.000Z",
        skipped: false,
      });

      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("has-completed")).toHaveTextContent("completed");
    });
  });

  describe("navigation", () => {
    it("should navigate to next step", async () => {
      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      expect(screen.getByTestId("current-screen")).toHaveTextContent("welcome");

      await act(async () => {
        fireEvent.press(screen.getByTestId("next-button"));
      });

      expect(screen.getByTestId("current-step")).toHaveTextContent("1");
      expect(screen.getByTestId("current-screen")).toHaveTextContent("features");
      expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
    });

    it("should navigate to previous step", async () => {
      mockGetCurrentStep.mockResolvedValue(2);

      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("current-step")).toHaveTextContent("2");

      await act(async () => {
        fireEvent.press(screen.getByTestId("prev-button"));
      });

      expect(screen.getByTestId("current-step")).toHaveTextContent("1");
      expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
    });

    it("should not go below step 0", async () => {
      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      expect(screen.getByTestId("is-first-step")).toHaveTextContent("true");

      await act(async () => {
        fireEvent.press(screen.getByTestId("prev-button"));
      });

      expect(screen.getByTestId("current-step")).toHaveTextContent("0");
    });

    it("should not exceed last step", async () => {
      mockGetCurrentStep.mockResolvedValue(3);

      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("current-step")).toHaveTextContent("3");
      expect(screen.getByTestId("is-last-step")).toHaveTextContent("true");

      await act(async () => {
        fireEvent.press(screen.getByTestId("next-button"));
      });

      expect(screen.getByTestId("current-step")).toHaveTextContent("3");
    });

    it("should show correct screen for each step", async () => {
      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("current-screen")).toHaveTextContent("welcome");

      await act(async () => {
        fireEvent.press(screen.getByTestId("next-button"));
      });
      expect(screen.getByTestId("current-screen")).toHaveTextContent("features");

      await act(async () => {
        fireEvent.press(screen.getByTestId("next-button"));
      });
      expect(screen.getByTestId("current-screen")).toHaveTextContent("sync");

      await act(async () => {
        fireEvent.press(screen.getByTestId("next-button"));
      });
      expect(screen.getByTestId("current-screen")).toHaveTextContent("baby");
    });
  });

  describe("completion", () => {
    it("should complete onboarding", async () => {
      mockGetCurrentStep.mockResolvedValue(3);

      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("complete-button"));
      });

      expect(screen.getByTestId("has-completed")).toHaveTextContent("completed");
      expect(mockMarkOnboardingComplete).toHaveBeenCalledWith(false);
      expect(mockClearCurrentStep).toHaveBeenCalled();
    });

    it("should skip onboarding", async () => {
      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("skip-button"));
      });

      expect(screen.getByTestId("has-completed")).toHaveTextContent("completed");
      expect(mockMarkOnboardingComplete).toHaveBeenCalledWith(true);
      expect(mockClearCurrentStep).toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("should reset onboarding state", async () => {
      mockGetOnboardingStatus.mockResolvedValue({
        hasCompleted: true,
        completedAt: "2024-01-15T10:30:00.000Z",
        skipped: false,
      });
      mockGetCurrentStep.mockResolvedValue(3);

      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("has-completed")).toHaveTextContent("completed");

      await act(async () => {
        fireEvent.press(screen.getByTestId("reset-button"));
      });

      expect(screen.getByTestId("has-completed")).toHaveTextContent("not-completed");
      expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      expect(mockResetOnboarding).toHaveBeenCalled();
      expect(mockClearCurrentStep).toHaveBeenCalled();
    });
  });

  describe("step indicators", () => {
    it("should have correct total steps", async () => {
      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("total-steps")).toHaveTextContent("4");
    });

    it("should correctly identify first step", async () => {
      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("is-first-step")).toHaveTextContent("true");
      expect(screen.getByTestId("is-last-step")).toHaveTextContent("false");
    });

    it("should correctly identify last step", async () => {
      mockGetCurrentStep.mockResolvedValue(3);

      render(
        <OnboardingProvider>
          <TestConsumer testID="consumer" />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("is-first-step")).toHaveTextContent("false");
      expect(screen.getByTestId("is-last-step")).toHaveTextContent("true");
    });
  });
});
